"use strict";

const TIME_RE = /\b([01]\d|2[0-3]):([0-5]\d)\b/g;

const HEADER_ALIASES = {
  date: ["date", "datum"],
  start: ["start", "from", "von", "beginn"],
  end: ["end", "to", "bis", "ende"],
  time: ["time", "times", "zeit", "zeitraum"],
  project: ["project", "projekt"],
  task: ["task", "aufgabe"],
  activity: ["activity", "tätigkeit", "taetigkeit"],
  remark: ["remark", "remarks", "comment", "comments", "bemerkung", "kommentar"],
};

function normalize(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function canonicalHeader(value) {
  const header = normalize(value).toLocaleLowerCase("de");
  return Object.entries(HEADER_ALIASES).find(([, aliases]) =>
    aliases.some((alias) => header === alias || header.includes(alias)),
  )?.[0];
}

function extractTimes(value) {
  const matches = [...String(value || "").matchAll(TIME_RE)];
  return matches.map((match) => match[0]);
}

function colorToHex(value) {
  const color = normalize(value);
  if (/^#[0-9a-f]{6}$/i.test(color)) return color.toUpperCase();
  const rgb = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/i.exec(color);
  if (!rgb) return color;
  return `#${rgb.slice(1, 4).map((part) => Number(part).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function zepDate(date) {
  const [year, month, day] = date.split("-").map(Number);
  const weekday = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return `${weekday}, ${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.${year}`;
}

function timeDuration(start, end) {
  const toMinutes = (value) => {
    const [hour, minute] = value.split(":").map(Number);
    return hour * 60 + minute;
  };
  const minutes = toMinutes(end) - toMinutes(start);
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

async function one(locator, description) {
  const count = await locator.count();
  if (count !== 1) {
    throw new Error(
      `Expected exactly one ${description}, found ${count}. Run \`npm run zep -- inspect --headed\` and calibrate zep-page.js.`,
    );
  }
  return locator;
}

class ZepPage {
  constructor(page, baseUrl) {
    this.page = page;
    this.baseUrl = baseUrl;
  }

  async goto() {
    await this.page.goto(this.baseUrl, { waitUntil: "domcontentloaded" });
    await this.page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
  }

  async googleSignInControl() {
    const name = /(sign in with google|continue with google|mit google anmelden)/i;
    for (const frame of this.page.frames()) {
      const candidates = [
        frame.getByRole("button", { name }),
        frame.getByRole("link", { name }),
        frame.locator('input[type="submit"][value*="Google" i], input[type="button"][value*="Google" i]'),
        frame.getByText(name, { exact: true }),
      ];
      for (const candidate of candidates) {
        const count = await candidate.count();
        for (let index = 0; index < count; index += 1) {
          const control = candidate.nth(index);
          if (await control.isVisible().catch(() => false)) return control;
        }
      }
    }
    return null;
  }

  async clickGoogleSignInIfPresent() {
    const control = await this.googleSignInControl();
    if (!control) return false;
    const previousUrl = this.page.url();
    await control.click();
    await this.page.waitForURL((url) => url.href !== previousUrl, { timeout: 5000 }).catch(() => {});
    await this.page.waitForLoadState("domcontentloaded", { timeout: 5000 }).catch(() => {});
    return true;
  }

  async googleContinueControl() {
    const continueAs = /^(continue as .+|continue)$/i;
    for (const frame of this.page.frames()) {
      const frameUrl = frame.url();
      const candidates = [
        frame.getByRole("button", { name: continueAs }),
        frame.getByRole("link", { name: continueAs }),
        frame.getByText(/^continue as .+$/i, { exact: true }),
      ];
      if (/accounts\.google\./i.test(frameUrl)) {
        candidates.push(frame.getByText(/^continue$/i, { exact: true }));
      }
      for (const candidate of candidates) {
        const count = await candidate.count();
        for (let index = 0; index < count; index += 1) {
          const control = candidate.nth(index);
          if (await control.isVisible().catch(() => false)) return control;
        }
      }
    }
    return null;
  }

  async clickGoogleContinueIfPresent() {
    const control = await this.googleContinueControl();
    if (!control) return false;
    const previousUrl = this.page.url();
    await control.click();
    await this.page.waitForURL((url) => url.href !== previousUrl, { timeout: 5000 }).catch(() => {});
    await this.page.waitForLoadState("domcontentloaded", { timeout: 5000 }).catch(() => {});
    return true;
  }

  async clickContinueTimeRecordingIfPresent() {
    const name = /((go ahead|continue|resume).*(time recording|time tracking)|(time recording|time tracking).*(continue|resume)|zeiterfassung.*(fortsetzen|weiter)|(fortsetzen|weiter).*zeiterfassung)/i;
    const candidates = [
      this.page.getByRole("button", { name }),
      this.page.getByRole("link", { name }),
      this.page.getByText(name),
    ];
    for (const candidate of candidates) {
      const count = await candidate.count();
      for (let index = 0; index < count; index += 1) {
        const control = candidate.nth(index);
        if (!(await control.isVisible().catch(() => false))) continue;
        await control.click();
        await this.page.waitForLoadState("domcontentloaded", { timeout: 5000 }).catch(() => {});
        await this.page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
        return true;
      }
    }
    return false;
  }

  async advanceAuthentication(maxSteps = 6) {
    const actions = [];
    for (let step = 0; step < maxSteps; step += 1) {
      if (await this.clickContinueTimeRecordingIfPresent()) {
        actions.push("zep-time-recording");
        continue;
      }
      if (await this.clickGoogleSignInIfPresent()) {
        actions.push("google-sign-in");
        continue;
      }
      if (await this.clickGoogleContinueIfPresent()) {
        actions.push("google-continue");
        continue;
      }
      break;
    }
    return actions;
  }

  async authenticationRequired() {
    const currentUrl = new URL(this.page.url());
    const authenticationLocation = `${currentUrl.hostname}${currentUrl.pathname}`;
    const passwordInputs = await this.page.locator('input[type="password"]:visible').count();
    const googleSignIn = await this.googleSignInControl();
    return passwordInputs > 0 || Boolean(googleSignIn) || /login|signin|anmeld|accounts\.google\./i.test(authenticationLocation);
  }

  async waitForAuthentication(timeout = 10000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (!(await this.authenticationRequired())) return true;
      await this.page.waitForTimeout(250);
    }
    return !(await this.authenticationRequired());
  }

  async assertAuthenticated() {
    if (await this.authenticationRequired()) {
      throw new Error("ZEP authentication is required. Run `npm run zep -- auth`, complete Google sign-in, and try again.");
    }
  }

  async inspect() {
    const controls = await this.page
      .locator('input:visible, select:visible, textarea:visible, button:visible, [role="button"]:visible, [role="combobox"]:visible')
      .evaluateAll((elements) =>
        elements.slice(0, 200).map((element) => ({
          tag: element.tagName.toLowerCase(),
          type: element.getAttribute("type"),
          role: element.getAttribute("role"),
          name: element.getAttribute("name"),
          id: element.id || null,
          ariaLabel: element.getAttribute("aria-label"),
          placeholder: element.getAttribute("placeholder"),
          text: element.tagName === "BUTTON" || element.getAttribute("role") === "button"
            ? (element.textContent || "").replace(/\s+/g, " ").trim().slice(0, 120)
            : null,
        })),
      );

    const tables = [];
    for (const table of await this.page.locator("table:visible").all()) {
      const headers = await table.locator("thead th").allTextContents();
      const rowCount = await table.locator("tbody tr").count();
      tables.push({ headers: headers.map(normalize), rowCount });
    }

    const currentUrl = new URL(this.page.url());
    return {
      url: `${currentUrl.origin}${currentUrl.pathname}`,
      title: await this.page.title(),
      controls,
      tables,
    };
  }

  async openDate(date) {
    const todayButton = await one(this.page.locator("#calendar-btn-today:visible"), "Today button");
    await todayButton.click();
    const column = this.page.locator(`.fc-timegrid-col[data-date="${date}"]`);
    await one(column, `calendar column for ${date}`);
    this.currentDate = date;
  }

  async readEntries() {
    if (!this.currentDate) throw new Error("openDate(date) must be called before readEntries()");
    const column = await one(
      this.page.locator(`.fc-timegrid-col[data-date="${this.currentDate}"]`),
      `calendar column for ${this.currentDate}`,
    );
    const entries = [];

    for (const event of await column.locator(".fc-timegrid-event").all()) {
      const project = normalize(await event.locator("h4").first().innerText());
      const details = (await event.locator(".details").first().innerText())
        .split("\n")
        .map(normalize)
        .filter(Boolean);
      const timeIndex = details.findIndex((line) => extractTimes(line).length >= 2);
      if (!project || timeIndex < 2) {
        throw new Error(`Could not parse a ZEP calendar event for ${this.currentDate}`);
      }
      const [start, end] = extractTimes(details[timeIndex]);
      const backgroundColor = await event.evaluate((element) => getComputedStyle(element).backgroundColor);
      entries.push({
        start,
        end,
        project,
        task: details[0],
        activity: details[1],
        remark: details.slice(2, timeIndex).join(" "),
        color: colorToHex(backgroundColor),
        billable: (await event.locator(".icon-payments").count()) > 0,
      });
    }

    return entries;
  }

  async selectOption(selector, value, description) {
    const control = await one(this.page.locator(selector), `${description} select`);
    const options = await control.locator("option").evaluateAll((elements) =>
      elements.map((option) => ({ value: option.value, label: (option.textContent || "").replace(/\s+/g, " ").trim() })),
    );
    const normalizedValue = normalize(value);
    const matches = options.filter((option) =>
      option.value === normalizedValue
      || option.label === normalizedValue
      || option.label.startsWith(`${normalizedValue} (`),
    );
    if (matches.length !== 1) {
      throw new Error(`Expected one ${description} option for "${value}", found ${matches.length}`);
    }
    await control.selectOption(matches[0].value);
    await control.dispatchEvent("change");
    await this.page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
  }

  async verifyEntryForm(date, entry) {
    const selectedLabel = async (selector) => this.page.locator(`${selector} option:checked`).innerText();
    const matchesChoice = (label, value) => label === value || label.startsWith(`${value} (`);
    const actual = {
      date: await this.page.locator("#datum-datepicker-input").inputValue(),
      start: await this.page.locator("#von").inputValue(),
      end: await this.page.locator("#bis").inputValue(),
      project: normalize(await selectedLabel("#projektId")),
      task: normalize(await selectedLabel("#vorgangId")),
      activity: normalize(await selectedLabel("#taetigkeit")),
      remark: await this.page.locator("#bemerkung").inputValue(),
      color: colorToHex(await this.page.locator('input[name="color"]:checked').getAttribute("value")),
      billable: await this.page.locator("#fakturierbar").isChecked(),
    };
    const expectedDate = zepDate(date);
    const matchesTime = (actualTime, expectedTime) => actualTime === expectedTime || actualTime === `${expectedTime}:00`;
    if (actual.date !== expectedDate
      || !matchesTime(actual.start, entry.start)
      || !matchesTime(actual.end, entry.end)
      || !matchesChoice(actual.project, entry.project)
      || !matchesChoice(actual.task, entry.task)
      || !matchesChoice(actual.activity, entry.activity)
      || actual.remark !== entry.remark
      || actual.color !== colorToHex(entry.color)
      || actual.billable !== entry.billable) {
      throw new Error(`ZEP form verification failed before save. Expected ${JSON.stringify({ ...entry, date: expectedDate })}; found ${JSON.stringify(actual)}`);
    }
  }

  async createEntry(date, entry) {
    await (await one(this.page.locator("#calendar-btn-create:visible"), "Record Project Time button")).click();
    await this.page.locator("#projektId:visible").waitFor({ timeout: 10000 });

    await this.selectOption("#projektId", entry.project, "project");
    await this.page.waitForFunction(
      ({ selector, value }) => [...document.querySelector(selector).options].some((option) => {
        const label = (option.textContent || "").replace(/\s+/g, " ").trim();
        return option.value === value || label === value || label.startsWith(`${value} (`);
      }),
      { selector: "#vorgangId", value: entry.task },
      { timeout: 10000 },
    );
    await this.selectOption("#vorgangId", entry.task, "task");
    await this.selectOption("#taetigkeit", entry.activity, "activity");

    await this.page.locator("#datum-datepicker-input").fill(zepDate(date));

    const color = colorToHex(entry.color);
    const colorControl = await one(
      this.page.locator(`input[name="color"][value="${color}" i]`),
      `color ${color}`,
    );
    await colorControl.check();
    const billable = this.page.locator("#fakturierbar");
    if (entry.billable) await billable.check();
    else await billable.uncheck();
    await this.page.locator("#bemerkung").fill("");
    await this.page.locator("#bemerkung").fill(entry.remark);

    await this.page.evaluate(({ start, end, duration }) => {
      document.querySelector("#von").value = start;
      document.querySelector("#bis").value = end;
      document.querySelector("#dauer").value = duration;
    }, { start: entry.start, end: entry.end, duration: timeDuration(entry.start, entry.end) });

    await this.verifyEntryForm(date, entry);
    await (await one(this.page.locator("#Save:visible"), "Save button")).click();
    await this.page.locator("#zep-popup:visible").waitFor({ state: "hidden", timeout: 10000 }).catch(() => {});
    await this.page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
  }
}

module.exports = { ZepPage };

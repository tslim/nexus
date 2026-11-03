const test = require("node:test");
const assert = require("node:assert/strict");
const { parseArgs } = require("./args");

test("boolean --json preserves following positional arguments", () => {
  assert.deepEqual(parseArgs(["--json", "C123"]), {
    positional: ["C123"],
    flags: { json: true },
  });

  assert.deepEqual(parseArgs(["--json", "deploy failed"]), {
    positional: ["deploy failed"],
    flags: { json: true },
  });
});

test("value flags still consume their following value", () => {
  assert.deepEqual(parseArgs(["--limit", "25", "C123"]), {
    positional: ["C123"],
    flags: { limit: "25" },
  });
});

test("equals syntax and other boolean flags remain supported", () => {
  assert.deepEqual(parseArgs(["--json=true", "--inclusive", "C123"]), {
    positional: ["C123"],
    flags: { json: "true", inclusive: true },
  });
});

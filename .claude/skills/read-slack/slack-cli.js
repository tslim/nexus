#!/usr/bin/env node

const { WebClient } = require('@slack/web-api');
const fs = require('fs');
const path = require('path');

const token = process.env.SLACK_TOKEN;
if (!token) {
  console.error('Error: SLACK_TOKEN environment variable is required');
  process.exit(1);
}

const web = new WebClient(token);

function parseArgs(argv) {
  const positional = [];
  const flags = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }

    const eq = arg.indexOf('=');
    if (eq !== -1) {
      const key = arg.slice(2, eq);
      const value = arg.slice(eq + 1);
      flags[key] = value;
      continue;
    }

    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      flags[key] = next;
      i += 1;
    } else {
      flags[key] = true;
    }
  }

  return { positional, flags };
}

function toInt(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toEpochDaysAgo(days) {
  const d = toInt(days, null);
  if (!d) return null;
  return Math.floor((Date.now() - d * 24 * 60 * 60 * 1000) / 1000).toString();
}

function tsToLocal(ts) {
  return new Date(parseFloat(ts) * 1000).toLocaleString();
}

function compactText(text, maxLen = 220) {
  const normalized = (text || '').replace(/\n/g, ' ').trim();
  if (normalized.length <= maxLen) return normalized;
  return `${normalized.slice(0, maxLen)}...`;
}

function printResult(data, asJson) {
  if (asJson) {
    console.log(JSON.stringify(data, null, 2));
  }
}

async function fetchHistory(channel, opts = {}) {
  const limit = toInt(opts.limit, 100);
  const oldest = opts.oldest || null;
  const latest = opts.latest || null;
  const inclusive = opts.inclusive === true;

  let cursor = opts.cursor || null;
  const out = [];
  let done = false;

  while (!done && out.length < limit) {
    const chunkSize = Math.min(200, limit - out.length);
    const resp = await web.conversations.history({
      channel,
      limit: chunkSize,
      cursor: cursor || undefined,
      oldest: oldest || undefined,
      latest: latest || undefined,
      inclusive
    });

    const messages = resp.messages || [];
    out.push(...messages);

    cursor = resp.response_metadata && resp.response_metadata.next_cursor
      ? resp.response_metadata.next_cursor
      : null;

    done = !cursor || messages.length === 0;
  }

  return out;
}

async function resolveUsers(userIds) {
  const unique = [...new Set(userIds.filter(Boolean))];
  const result = [];

  for (const userId of unique) {
    const resp = await web.users.info({ user: userId });
    const u = resp.user;
    result.push({
      user_id: userId,
      username: u.name || null,
      display_name: u.profile.display_name || null,
      real_name: u.real_name || null,
      email: u.profile.email || null,
      title: u.profile.title || null
    });
  }

  return result;
}

async function resolveChannels(channelIds) {
  const unique = [...new Set(channelIds.filter(Boolean))];
  const result = [];

  for (const channelId of unique) {
    const resp = await web.conversations.info({ channel: channelId });
    const c = resp.channel;
    result.push({
      channel_id: c.id,
      name: c.name || null,
      is_private: !!c.is_private,
      is_im: !!c.is_im,
      is_mpim: !!c.is_mpim,
      member_count: c.num_members != null ? c.num_members : null
    });
  }

  return result;
}

function messagesToRows(channelId, messages) {
  return (messages || []).map((m) => ({
    channel_id: channelId,
    ts: m.ts,
    time: tsToLocal(m.ts),
    user_id: m.user || null,
    bot_id: m.bot_id || null,
    text: m.text || '',
    thread_ts: m.thread_ts || null,
    reply_count: m.reply_count || 0,
    has_files: !!(m.files && m.files.length),
    files: (m.files || []).map((f) => ({ id: f.id, name: f.name, size: f.size }))
  }));
}

function printHumanMessages(rows, showChannel = false) {
  rows.forEach((row) => {
    const prefix = showChannel ? `[${row.channel_id}] ` : '';
    console.log(`${prefix}[${row.time}] ${compactText(row.text, 260)}`);
    if (row.reply_count) {
      console.log(`  replies=${row.reply_count}`);
    }
  });
}

const extractPatterns = {
  blockers: /\b(blocker|blocked|blocking|stuck|waiting on|can't|cannot|issue|dependency)\b/i,
  tasks: /\b(i'll|i will|need to|todo|action item|follow up|please\s+\w+)\b/i,
  decisions: /\b(decided|decision|agreed|approved|we will)\b/i,
  risks: /\b(risk|concern|at risk|problem|failure|uncertain)\b/i
};

const commands = {
  async channels() {
    const result = await web.conversations.list({
      types: 'public_channel,private_channel,mpim,im',
      limit: 200
    });

    result.channels.forEach((c) => {
      const type = c.is_mpim ? 'group-dm' : c.is_im ? 'dm' : c.is_private ? 'private' : 'public';
      const name = c.name || c.name_normalized || (c.user ? `DM:${c.user}` : 'unnamed');
      const members = c.num_members != null ? c.num_members : '-';
      console.log(`${name} | ${c.id} | ${type} | ${members} members`);
    });
  },

  async history(args) {
    const { positional, flags } = parseArgs(args);
    const channelId = positional[0];
    if (!channelId) throw new Error('Channel ID required');

    const messages = await fetchHistory(channelId, {
      limit: flags.limit || 50,
      oldest: flags.oldest,
      latest: flags.latest,
      cursor: flags.cursor,
      inclusive: flags.inclusive === true
    });

    const rows = messagesToRows(channelId, messages);
    if (flags.json) {
      printResult({ channel_id: channelId, count: rows.length, messages: rows }, true);
      return;
    }

    printHumanMessages(rows);
  },

  async search(args) {
    const { positional, flags } = parseArgs(args);
    const query = positional.join(' ').trim();
    if (!query) throw new Error('Search query required');

    const asJson = !!flags.json;
    const limit = toInt(flags.limit, 50);
    const oldest = flags.days ? toEpochDaysAgo(flags.days) : null;

    if (flags.channels) {
      const channelIds = flags.channels.split(',').map((s) => s.trim()).filter(Boolean);
      const needle = query.toLowerCase();
      const rows = [];

      for (const channelId of channelIds) {
        const messages = await fetchHistory(channelId, { limit, oldest });
        const matches = messages
          .filter((m) => (m.text || '').toLowerCase().includes(needle))
          .map((m) => ({ channel_id: channelId, ...messagesToRows(channelId, [m])[0] }));
        rows.push(...matches);
      }

      if (asJson) {
        printResult({ mode: 'local', query, count: rows.length, messages: rows }, true);
      } else {
        printHumanMessages(rows, true);
      }
      return;
    }

    const slackQuery = oldest ? `${query} after:${new Date(parseInt(oldest, 10) * 1000).toISOString().slice(0, 10)}` : query;
    const resp = await web.search.messages({ query: slackQuery, count: Math.min(limit, 100), sort: 'timestamp', sort_dir: 'desc' });
    const matches = ((resp.messages && resp.messages.matches) || []).slice(0, limit);

    const rows = matches.map((m) => ({
      channel_id: m.channel && m.channel.id,
      channel_name: m.channel && m.channel.name,
      ts: m.ts,
      time: tsToLocal(m.ts),
      user_id: m.user,
      text: m.text || '',
      permalink: m.permalink || null,
      thread_ts: m.thread_ts || null,
      reply_count: m.reply_count || 0
    }));

    if (asJson) {
      printResult({ mode: 'search_api', query: slackQuery, count: rows.length, messages: rows }, true);
    } else {
      rows.forEach((row) => {
        console.log(`[${row.channel_name || row.channel_id}] [${row.time}] ${compactText(row.text, 220)}`);
        if (row.permalink) console.log(`  ${row.permalink}`);
      });
    }
  },

  async messagesFilter(args) {
    const { positional, flags } = parseArgs(args);
    const channelId = positional[0];
    if (!channelId) throw new Error('Channel ID required');

    const patternInput = flags.pattern || positional.slice(1).join(' ');
    if (!patternInput) throw new Error('Pattern required (--pattern)');

    const regex = new RegExp(patternInput, flags.case === 'sensitive' ? '' : 'i');
    const limit = toInt(flags.limit, 200);
    const oldest = flags.days ? toEpochDaysAgo(flags.days) : flags.oldest;
    const messages = await fetchHistory(channelId, { limit, oldest, latest: flags.latest });
    const rows = messagesToRows(channelId, messages).filter((row) => regex.test(row.text));

    if (flags.json) {
      printResult({ channel_id: channelId, pattern: patternInput, count: rows.length, messages: rows }, true);
    } else {
      printHumanMessages(rows);
    }
  },

  async threads(args) {
    const { positional, flags } = parseArgs(args);
    const channelId = positional[0];
    if (!channelId) throw new Error('Channel ID required');

    const limit = toInt(flags.limit, 100);
    const oldest = flags.days ? toEpochDaysAgo(flags.days) : flags.oldest;
    const messages = await fetchHistory(channelId, { limit, oldest, latest: flags.latest });
    const rows = messagesToRows(channelId, messages).filter((row) => row.reply_count > 0);

    if (flags.json) {
      printResult({ channel_id: channelId, count: rows.length, threads: rows }, true);
      return;
    }

    rows.forEach((row) => {
      console.log(`[${row.time}] ${compactText(row.text, 180)}`);
      console.log(`  thread_ts=${row.thread_ts || row.ts} replies=${row.reply_count}`);
    });
  },

  async threadGet(args) {
    const { positional, flags } = parseArgs(args);
    const channelId = positional[0];
    const threadTs = positional[1];
    if (!channelId || !threadTs) throw new Error('Channel ID and thread ts required');

    const resp = await web.conversations.replies({
      channel: channelId,
      ts: threadTs,
      limit: toInt(flags.limit, 200)
    });

    const rows = messagesToRows(channelId, resp.messages || []);
    if (flags.json) {
      printResult({ channel_id: channelId, thread_ts: threadTs, count: rows.length, messages: rows }, true);
      return;
    }

    printHumanMessages(rows);
  },

  async send(channel, text) {
    const result = await web.chat.postMessage({ channel, text });
    console.log(`Sent: ${result.ts}`);
  },

  async usersResolve(args) {
    const { positional, flags } = parseArgs(args);
    const idsRaw = flags.ids || positional.join(',');
    if (!idsRaw) throw new Error('User IDs required (--ids U1,U2 or positional)');

    const ids = idsRaw.split(',').map((s) => s.trim()).filter(Boolean);
    const rows = await resolveUsers(ids);
    if (flags.json) {
      printResult({ count: rows.length, users: rows }, true);
      return;
    }

    rows.forEach((u) => {
      console.log(`${u.user_id} | ${u.real_name || u.username} | ${u.email || 'N/A'} | ${u.title || 'N/A'}`);
    });
  },

  async channelsResolve(args) {
    const { positional, flags } = parseArgs(args);
    const idsRaw = flags.ids || positional.join(',');
    if (!idsRaw) throw new Error('Channel IDs required (--ids C1,C2 or positional)');

    const ids = idsRaw.split(',').map((s) => s.trim()).filter(Boolean);
    const rows = await resolveChannels(ids);
    if (flags.json) {
      printResult({ count: rows.length, channels: rows }, true);
      return;
    }

    rows.forEach((c) => {
      console.log(`${c.channel_id} | ${c.name || 'unknown'} | private=${c.is_private} | members=${c.member_count != null ? c.member_count : 'N/A'}`);
    });
  },

  async extract(args) {
    const { positional, flags } = parseArgs(args);
    const channelId = positional[0];
    if (!channelId) throw new Error('Channel ID required');

    const mode = (flags.mode || 'blockers').toLowerCase();
    const pattern = extractPatterns[mode];
    if (!pattern) throw new Error('Unsupported mode. Use blockers|tasks|decisions|risks');

    const limit = toInt(flags.limit, 200);
    const oldest = flags.days ? toEpochDaysAgo(flags.days) : flags.oldest;
    const messages = await fetchHistory(channelId, { limit, oldest, latest: flags.latest });
    const rows = messagesToRows(channelId, messages).filter((row) => pattern.test(row.text));

    if (flags.json) {
      printResult({ channel_id: channelId, mode, count: rows.length, items: rows }, true);
      return;
    }

    rows.forEach((row) => {
      console.log(`[${row.time}] ${compactText(row.text, 240)}`);
    });
  },

  async exportCmd(args) {
    const { positional, flags } = parseArgs(args);
    const channelId = positional[0];
    if (!channelId) throw new Error('Channel ID required');

    const format = (flags.format || 'json').toLowerCase();
    const limit = toInt(flags.limit, 200);
    const oldest = flags.days ? toEpochDaysAgo(flags.days) : flags.oldest;
    const messages = await fetchHistory(channelId, { limit, oldest, latest: flags.latest });
    const rows = messagesToRows(channelId, messages);

    let output;
    if (format === 'json') {
      output = JSON.stringify({ channel_id: channelId, count: rows.length, messages: rows }, null, 2);
    } else if (format === 'csv') {
      const header = 'channel_id,ts,time,user_id,text,thread_ts,reply_count';
      const csvRows = rows.map((r) => {
        const safe = (value) => `"${String(value || '').replace(/"/g, '""')}"`;
        return [
          safe(r.channel_id),
          safe(r.ts),
          safe(r.time),
          safe(r.user_id),
          safe(r.text),
          safe(r.thread_ts),
          safe(r.reply_count)
        ].join(',');
      });
      output = [header, ...csvRows].join('\n');
    } else if (format === 'md') {
      const lines = ['# Slack Export', '', `- Channel: \`${channelId}\``, `- Messages: ${rows.length}`, ''];
      rows.forEach((r) => {
        lines.push(`- [${r.time}] (${r.user_id || 'unknown'}) ${compactText(r.text, 400)}`);
      });
      output = lines.join('\n');
    } else {
      throw new Error('Unsupported format. Use json|csv|md');
    }

    if (flags.out) {
      fs.writeFileSync(flags.out, output);
      console.log(`Exported ${rows.length} messages to ${path.resolve(flags.out)}`);
      return;
    }

    console.log(output);
  },

  async test() {
    const result = await web.auth.test();
    console.log(`Authenticated as: ${result.user}`);
    console.log(`Team: ${result.team}`);
  },

  async files(channelId, limit = 10) {
    const result = await web.files.list({ channel: channelId, limit: parseInt(limit, 10) });
    result.files.forEach((f) => {
      const date = new Date(f.timestamp * 1000).toLocaleString();
      console.log(`${date} | ${f.name} | ${f.id} | ${(f.size / 1024).toFixed(1)}KB`);
    });
  },

  async download(fileId, outputPath) {
    const result = await web.files.info({ file: fileId });
    const file = result.file;

    if (!file.url_private) {
      throw new Error('No download URL available for this file');
    }

    const response = await fetch(file.url_private, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`);
    }

    const dest = outputPath || file.name;
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(dest, buffer);

    console.log(`Downloaded: ${file.name} -> ${path.resolve(dest)}`);
    console.log(`Size: ${(file.size / 1024).toFixed(1)}KB`);
  }
};

async function main() {
  const [cmd, ...args] = process.argv.slice(2);

  if (!cmd || cmd === 'help') {
    console.log(`Usage: slack-cli <command> [args]

Commands:
  channels
  history <channelId> [--limit N] [--oldest ts] [--latest ts] [--json]
  search <query> [--channels C1,C2] [--days N] [--limit N] [--json]
  messages-filter <channelId> --pattern <regex> [--days N] [--limit N] [--json]
  threads <channelId> [--days N] [--limit N] [--json]
  thread-get <channelId> <threadTs> [--limit N] [--json]
  users-resolve --ids U1,U2 [--json]
  channels-resolve --ids C1,C2 [--json]
  extract <channelId> --mode blockers|tasks|decisions|risks [--days N] [--limit N] [--json]
  export <channelId> [--format json|csv|md] [--out path] [--days N] [--limit N]

  send <channel> <text>
  files <channelId> [limit]
  download <fileId> [path]
  test

Environment:
  SLACK_TOKEN must be set with a user token (xoxp-...)`);
    return;
  }

  try {
    switch (cmd) {
      case 'channels':
        await commands.channels();
        break;
      case 'history':
        await commands.history(args);
        break;
      case 'search':
        await commands.search(args);
        break;
      case 'messages-filter':
        await commands.messagesFilter(args);
        break;
      case 'threads':
        await commands.threads(args);
        break;
      case 'thread-get':
        await commands.threadGet(args);
        break;
      case 'users-resolve':
        await commands.usersResolve(args);
        break;
      case 'channels-resolve':
        await commands.channelsResolve(args);
        break;
      case 'extract':
        await commands.extract(args);
        break;
      case 'export':
        await commands.exportCmd(args);
        break;
      case 'send':
        if (!args[0] || !args[1]) throw new Error('Channel and text required');
        await commands.send(args[0], args.slice(1).join(' '));
        break;
      case 'test':
        await commands.test();
        break;
      case 'files':
        if (!args[0]) throw new Error('Channel ID required');
        await commands.files(args[0], args[1]);
        break;
      case 'download':
        if (!args[0]) throw new Error('File ID required');
        await commands.download(args[0], args[1]);
        break;
      default:
        throw new Error(`Unknown command: ${cmd}`);
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

main();

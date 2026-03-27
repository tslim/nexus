#!/usr/bin/env node

const { WebClient } = require('@slack/web-api');

const token = process.env.SLACK_TOKEN;
if (!token) {
  console.error('Error: SLACK_TOKEN environment variable is required');
  process.exit(1);
}

const web = new WebClient(token);

const commands = {
  async channels() {
    const result = await web.conversations.list({
      types: 'public_channel,private_channel',
      limit: 100
    });
    result.channels.forEach(c => {
      console.log(`${c.name} | ${c.id} | ${c.num_members} members`);
    });
  },

  async read(channelId, limit = 10) {
    const result = await web.conversations.history({
      channel: channelId,
      limit: parseInt(limit)
    });
    result.messages.forEach(m => {
      const time = new Date(parseFloat(m.ts) * 1000).toLocaleString();
      console.log(`[${time}] ${m.text.substring(0, 100)}`);
    });
  },

  async readByName(channelName, limit = 5) {
    const list = await web.conversations.list({
      types: 'public_channel,private_channel',
      limit: 100
    });
    const channel = list.channels.find(c => c.name === channelName);
    if (!channel) {
      console.log('Channel not found');
      return;
    }

    const history = await web.conversations.history({
      channel: channel.id,
      limit: parseInt(limit)
    });
    history.messages.forEach(m => {
      const time = new Date(parseFloat(m.ts) * 1000).toLocaleTimeString();
      const text = m.text.substring(0, 150) + (m.text.length > 150 ? '...' : '');
      console.log(`[${time}] ${text}`);
      if (m.reply_count) console.log(`  ↳ ${m.reply_count} replies`);
    });
  },

  async send(channel, text) {
    const result = await web.chat.postMessage({ channel, text });
    console.log(`Sent: ${result.ts}`);
  },

  async replies(channelId, threadTs) {
    const result = await web.conversations.replies({
      channel: channelId,
      ts: threadTs
    });
    result.messages.forEach(m => {
      const time = new Date(parseFloat(m.ts) * 1000).toLocaleTimeString();
      console.log(`[${time}] ${m.text.substring(0, 150)}`);
    });
  },

  async userInfo(userId) {
    const result = await web.users.info({ user: userId });
    const u = result.user;
    console.log(`Name: ${u.real_name || u.name}`);
    console.log(`Email: ${u.profile.email || 'N/A'}`);
    console.log(`Title: ${u.profile.title || 'N/A'}`);
  },

  async test() {
    const result = await web.auth.test();
    console.log(`Authenticated as: ${result.user}`);
    console.log(`Team: ${result.team}`);
  }
};

async function main() {
  const [cmd, ...args] = process.argv.slice(2);

  if (!cmd || cmd === 'help') {
    console.log(`Usage: slack-cli <command> [args]

Commands:
  channels                    List all channels
  read <channelId> [limit]    Read messages from channel ID
  read-name <name> [limit]    Read messages by channel name
  send <channel> <text>       Send message to channel
  replies <channelId> <ts>    Read thread replies
  user <userId>               Get user info
  test                        Test authentication

Environment:
  SLACK_TOKEN must be set with a user token (xoxp-...)`);
    return;
  }

  try {
    switch (cmd) {
      case 'channels':
        await commands.channels();
        break;
      case 'read':
        if (!args[0]) throw new Error('Channel ID required');
        await commands.read(args[0], args[1]);
        break;
      case 'read-name':
        if (!args[0]) throw new Error('Channel name required');
        await commands.readByName(args[0], args[1]);
        break;
      case 'send':
        if (!args[0] || !args[1]) throw new Error('Channel and text required');
        await commands.send(args[0], args[1]);
        break;
      case 'replies':
        if (!args[0] || !args[1]) throw new Error('Channel ID and thread ts required');
        await commands.replies(args[0], args[1]);
        break;
      case 'user':
        if (!args[0]) throw new Error('User ID required');
        await commands.userInfo(args[0]);
        break;
      case 'test':
        await commands.test();
        break;
      default:
        console.error(`Unknown command: ${cmd}`);
        process.exit(1);
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

main();

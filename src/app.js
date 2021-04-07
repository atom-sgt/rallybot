const Discord = require('discord.js');
const { token, prefix } = require('../config.json');
const rallybot = require('./rallybot.js');
const log = require('./fancy-log.js');

// Start Discord client
const client = new Discord.Client();
client.once('ready', () => { log.success('RallyBot running...'); });
client.login(token);

// Bind message listener
client.on('message', function commandListener(message) {
	// Skip commandless, bot messages, or dms
	if (message.content.startsWith(prefix) &&
		!message.author.bot &&
		message.channel.type !== 'dm') {
		rallybot(message);
	}
});

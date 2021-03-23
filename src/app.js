const Discord = require('discord.js');
const { token } = require('../client.json');
const { prefix } = require('../config.json');
const { rallybot } = require('./rallybot.js');

// Start Discord client
const client = new Discord.Client();
client.once('ready', () => { console.log('RallyBot running...'); });
client.login(token);
client.on('message', commandListener);

function commandListener(message) {
	// Skip commandless or bot messages
	if (!message.content.startsWith(prefix) || message.author.bot || message.channel.type == 'dm') {
		return;
	}
	
	// Parse command
	const args = message.content
		.slice(prefix.length)
		.trim()
		.split(/\s+/)
		.filter(arg => arg !== '');
	// Forward command
	rallybot(message, args);
}


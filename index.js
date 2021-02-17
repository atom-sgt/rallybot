const Discord = require('discord.js');
const fs = require('fs');
const { token } = require('./client.json');
const { prefix } = require('./config.json');
// Data
const { classes, locations } = require('./data/dr2.json');

// Start Discord client
const client = new Discord.Client();
client.once('ready', () => { console.log('Bot running...'); });
client.login(token);
client.on('message', commandListener);

function commandListener(message) {
	// Skip commandless or bot messages
	if (!message.content.startsWith(prefix) || message.author.bot) {
		return;
	}
	
	// Parse command
	const args = message.content.slice(prefix.length).trim().split(/ +/);
	const botCommand = args.shift().toLowerCase();
	console.log("COMMAND:", botCommand, args);
	// console.log(message);

	// Forward command
	switch(botCommand) {
		case 'rallybot':
			rallyBot(message, args);
	}
	// TODO: Will there ever be more here?
}

function rallyBot(message, args) {
	// Skip no args, send help text
	if(!args.length) {
		sendHelpMessage(message);
		return;
	}

	// Parse command
	try {
		let command = args.shift();
		switch(command) {
			case 'new':
				initBoard(message, args);
				break;
			case 'reset':
				resetBoard(message, args);
				break;
			case 'add':
				addRecord(message, args);
				break;
			case 'remove':
				removeRecord(message, args);
				break;
			case 'board':
				sendBoard(message, args);
				break;
			case 'rank':
				sendRank(message, args);
				break;
			case 'random':
				message.channel.send(randomRally());
				break;
			case 'please':
				logUserFeedback(message, args);
				break;
			default:
				sendHelpMessage(message);
		}
	} catch (error) {
		console.error(error);
		message.channel.send("Something went wrong.");
	}
}

function sendHelpMessage(message) {
	let helpMessage = "Hello, my name is rallybot. Here are some commands:" +
		"\n`board` Show the current leaderboard." +
		"\n`rank` Show your rank." +
		"\n`new` Start a new leaderboard." +
		"\n`reset` Reset all leaderboard times." +
		"\n`add <0:00.000>` Add a time your time to the leaderboard." +
		"\n`remove <rank | username>` Remove a time from the leaderboard." +
		"\n`random` Show a random rally." +
		"\n\nExample `!rallybot add 1:23.456`";

	message.channel.send(helpMessage);
}

function initBoard(message, args) {
	let locale = locations.random();
	let data = {
		carClass: classes.random(),
		conditions: locale.conditions.random(), 
		locale: locale.name,
		stage: locale.stages.random(),
		records: [],
	};
	
	fs.writeFileSync('./data/leaderboard.json', JSON.stringify(data));
}

function resetBoard(message, args) {
	let data = JSON.parse(fs.readFileSync('./data/leaderboard.json', 'utf8'));
	data.records = [];
	fs.writeFileSync('./data/leaderboard.json', JSON.stringify(data));
}

function addRecord(message, args) {
	// Skip no time 
	if(!args.length) {
		message.channel.send("Please specify a time to add.");
	}
	
	let username = message.author.username;
	let newTime = args.shift();
	let timeFormat = /\d+:\d{2}([.]\d{1,3})?/;
	
	if(newTime.match(timeFormat)) {
		let data = JSON.parse(fs.readFileSync('./data/leaderboard.json', 'utf8'));

		// Find, compare, and replace user time(s)
		let userRecord = data.records.filter(rec => rec.username === username)
		let isNew = !userRecord.length;
		userRecord.push({ username, time:newTime })
		userRecord = userRecord.sort(sortFormattedTime)[0];

		// Add user time to records
		data.records = data.records
			.filter(rec => rec.username !== username)
			.concat(userRecord)
			.sort(sortFormattedTime);

		// Write new records
		fs.writeFileSync('./data/leaderboard.json', JSON.stringify(data));

		let isPb = userRecord.time === newTime;
		let rank = data.records.findIndex(val => val.username === username) + 1;
		message.channel.send(buildAddTimeResponse(isPb, isNew, rank));
	}
}

function buildAddTimeResponse(isPb, isNew, rank) {
	let message = `Time added.  Your current rank is **#${rank}**.`;
	if (!isNew && isPb) {
		message += "\nA new personal best!";
	}
	// message += "\nType `!board` to view the leaderboard."; 

	return message;
}

function removeRecord(message, args) {
	// Skip no target
	if(!args.length) {
		message.channel.send("Please specify a record to remove.");
	}

	let target = args.shift();
	if(target.match(/^#?\d/)) {
		removeByRank(message, target.match(/\d+/));
	} else {
		removeByUsername(message, target);
	}
}

function removeByRank(message, rank) {
	let data = JSON.parse(fs.readFileSync('./data/leaderboard.json', 'utf8'));
	
	if(rank >= 0 && rank < data.records.length) {
		data.records.splice(rank-1, 1);
		fs.writeFileSync('./data/leaderboard.json', JSON.stringify(data));
		
		message.channel.send(`Record ${rank} has been removed.`);
	} else {
		message.channel.send(`No record found for target rank.`);
	}
}

function removeByUsername(message, username) {
	let data = JSON.parse(fs.readFileSync('./data/leaderboard.json', 'utf8'));
	
	// Remove leading @
	username = username.replace(/^@/, '');

	if(data.records.findIndex(val => val.username === username) !== -1) {
		// Filter records w/ username
		data.records = data.records
			.filter(rec => rec.username !== username);

		// Write new records
		fs.writeFileSync('./data/leaderboard.json', JSON.stringify(data));

		message.channel.send("Record removed.");
	} else {
		message.channel.send("No record found for target user.");
	}
}

function sendBoard(message, args) {
	let data = JSON.parse(fs.readFileSync('./data/leaderboard.json', 'utf8'));
	
	message.channel.send(formatLeaderboard(data));
}

function formatLeaderboard(data) {
	let challenge = `${data.carClass} | ${data.stage} (${data.conditions}), ${data.locale}`;
	let times = (data.records.length) ? data.records
		.sort(sortFormattedTime)	
		.map((rec, index) => `#${index+1}\t${rec.time} - ${rec.username}`)
		.join('\n') :
		"No records.";
	
	return `\`${challenge}\`\n\`\`\`${times}\`\`\``; 
}

function sendRank(message, args) {
	let data = JSON.parse(fs.readFileSync('./data/leaderboard.json', 'utf8'));
	let rank = data.records
		.findIndex(val => val.username === message.author.username);

	if(rank !== -1) {
		message.channel.send(`You are ranked **#${rank + 1}**.`);
	} else {
		message.channel.send("You do not have a rank.");
	}
}

function sortFormattedTime(a, b) {
	return parseFloat(a.time.replace(/:/, '')) > parseFloat(b.time.replace(/:/, '')) ? 1 : -1;
}

function logUserFeedback(message, args) {
	console.log(args.join(' '));
}

function randomRally() {
	let carClass = classes.random();
	let loc = locations.random();
	let stage = loc.stages.random();
	let conditions = loc.conditions.random();

	return `${carClass} | ${stage} (${conditions}), ${loc.name}`;
}

Array.prototype.random = function() {
	return this[Math.floor(Math.random() * this.length)];
}


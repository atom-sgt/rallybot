const Discord = require('discord.js');
const fs = require('fs');
const { token } = require('./client.json');
const { prefix } = require('./config.json');

// Logging shortcuts
const isDebug = true;
const log = console.log;
const debug = (message) =>  isDebug && log(message);

// Data
const { cars, groups, locales } = require('./data/dirt-rally-2-data.json');
const leaderboardFile = './data/leaderboard.json';
const dbFileName = './data/database.json';

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

	// Forward command
	switch(botCommand) {
		case 'rallybot':
			rallyBot(message, args);
	}
	// TODO: Will there ever be more here?
}

function rallyBot(message, args) {
	console.log("COMMAND:", args);

	// Skip no args, send help text
	if(!args.length) {
		sendHelpMessage(message);
		return;
	}

	// Parse command
	try {
		let command = args.shift();
		switch(command) {
			// Print Board 
			case 'daily':
				sendDailyBoard(message, args);
				break;
			case 'weekly':
				sendWeeklyBoard(message, args);
				break;
			// Data
			case 'random':
				parseRandom(message, args);
				break;
			case 'rank':
				sendRank(message, args);
				break;
			// Board management
			case 'new':
				parseNew(message, args);
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
			// Other
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

// OLD ////////////////////////////////////////////////////////////////////////
function initBoard(message, args) {
	let locale = locales.random();
	let data = {
		group: groups.random(),
		conditions: locale.conditions.random(), 
		locale: locale.name,
		stage: locale.stages.random(),
		records: [],
	};
	
	fs.writeFileSync(leaderboardFile, JSON.stringify(data));
	sendBoard(message, args);
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
		let data = JSON.parse(fs.readFileSync(leaderboardFile, 'utf8'));

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
		fs.writeFileSync(leaderboardFile, JSON.stringify(data));

		let isPb = userRecord.time === newTime;
		let rank = data.records.findIndex(val => val.username === username) + 1;
		message.channel.send(buildAddTimeResponse(isPb, isNew, rank));
	}
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
	let data = JSON.parse(fs.readFileSync(leaderboardFile, 'utf8'));
	
	// Remove leading @
	username = username.replace(/^@/, '');

	if(data.records.findIndex(val => val.username === username) !== -1) {
		// Filter records w/ username
		data.records = data.records
			.filter(rec => rec.username !== username);

		// Write new records
		fs.writeFileSync(leaderboardFil, JSON.stringify(data));

		message.channel.send("Record removed.");
	} else {
		message.channel.send("No record found for target user.");
	}
}

function sendRank(message, args) {
	let data = JSON.parse(fs.readFileSync(leaderboardFile, 'utf8'));
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

function parseNew(message, args) {
	let opt = args.shift();

	switch(opt) {
		case 'daily':
			// initDailyChallenge();
			break;
		case 'weekly':
			// initWeeklyChallenge();
			break;
		case 'random':
			// initRandomChallenge();
			break;
		default:
			// TODO: Better help text on bad opt
			sendHelpMessage();				
	}
}

// HELP ///////////////////////////////////////////////////////////////////////
function sendHelpMessage(message) {
	let helpMessage = "Hello, my name is rallybot. Here are some commands:" +
		"\n`<daily|weekly>` Show the current leaderboard for the given challenge" +
		"\n`random <car|class|locale|stage>` Show a random rally." + 
		"\n`new <daily|weekly>` Start a new challenge.";

	message.channel.send(helpMessage);
}

// ADD ////////////////////////////////////////////////////////////////////////
function buildAddTimeResponse(isPb, isNew, rank) {
	let message = `Time added.  Your current rank is **#${rank}**.`;
	if (!isNew && isPb) {
		message += "\nA new personal best!";
	}

	return message;
}

// RANDOM /////////////////////////////////////////////////////////////////////
function parseRandom(message, args) {
	let opt = args.shift();
	let response = '';
	switch (opt) {
		case 'car':
			response = cars.random().name;
			break;
		case 'stage':
			response = randomStage();
			break;
		case 'location':
		case 'locale':
			response = locales.random().name
			break;
		case 'class':
		case 'group':
			response = groups.random().name;
			break;
		default:
			response = randomRally();
	}

	message.channel.send(response);
}

function randomRally() {
	let group = groups.random();
	let loc = locales.random();
	let stage = loc.stages.random();
	let conditions = loc.conditions.random();
	
	return `${group.name} | ${randomStage()}`;
}

function randomStage() {
	let loc = locales.random();
	return `${loc.stages.random()} (${loc.conditions.random()}), ${loc.name}`;
}

// REMOVE /////////////////////////////////////////////////////////////////////

// BOARD PRINT ////////////////////////////////////////////////////////////////
function buildLeaderboardMessage(board) {
	let ranks = board.records.sort()
		.map((rec, index) => `#${index+1}\t${formatTime(rec.time)} - ${rec.username}`)
		.join('\n');

	return `\`${board.challenge}\`\n\`\`\`${ranks}\`\`\``; 
}

function sendDailyBoard(message, args) {
	let guildDb = getGuildLeaderboards(0);
	message.channel.send(buildLeaderboardMessage(guildDb.leaderboards.daily));
}

function sendWeeklyBoard(message, args) {
	let guildDb = getGuildLeaderboards(0);
	message.channel.send(buildLeaderboardMessage(guildDb.leaderboards.weekly));
}

// OTHER COMMANDS /////////////////////////////////////////////////////////////
function logUserFeedback(message, args) {
	log(args.join(' '));
}

// HELPERS ////////////////////////////////////////////////////////////////////
function formatTime(ms) {
	// Convert
	let minutes = Math.floor(ms / 60000);
	let seconds = ((ms % 60000) / 1000).toFixed(0);
	let milliseconds = ms % 1000;

	// Padding
	minutes = (minutes < 10) ? '0'+minutes : minutes;
	seconds = (seconds < 10) ? '0'+seconds : seconds;

	return `${minutes}:${seconds}.${milliseconds}`;
}

function timeToMs(time) {
	let minutes = parseInt(time.match(/^\d+/)[0]);
	let seconds = parseInt(time.match(/:\d/)[0].replace(/:/, ''));
	let milliseconds = parseInt(time.match(/\.\d+/)[0].replace(/:/, ''));

	milliseconds += seconds * 1000;
	milliseconds += minutes * 60000;

	return milliseconds;
}

function getServerIdFromMessage(message) {
	log(message.guild.id);
}

function getGuildLeaderboards(guildId) {
	return getDb().servers.find((guild) => guild.id === guildId);
}

function getDb() {	
	return JSON.parse(fs.readFileSync(dbFileName, 'utf8'));
}

function saveDb() {
	// fs.writeFileSync(dbFileName, JSON.stringify(data));
}

Array.prototype.random = function() {
	return this[Math.floor(Math.random() * this.length)];
}


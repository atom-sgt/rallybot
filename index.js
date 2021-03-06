const Discord = require('discord.js');
const fs = require('fs');
const { token } = require('./client.json');
const { prefix } = require('./config.json');

// Logging shortcuts
const isDebug = false;
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
	log("COMMAND:", args);
	// log(message);

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
			case 'guild': 
			case 'server': 
				log(getGuildData(getGuildId(message)));
				break;
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
			case 'ranks':
				// sendRanks(message, args);
				break;
			// Board management
			case 'new':
				parseNew(message, args);
				break;
			case 'reset':
				resetRecords(message, args);
				break;
			case 'add':
				parseAdd(message, args);
				break;
			case 'remove':
				parseRemove(message, args);
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

// NEW ////////////////////////////////////////////////////////////////////////
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

function resetRecords(message, args) {
	let targetBoard = args.shift();

	let guildId = getGuildId(message);
	let guildData = getGuildData(guildId);
	if (!guildData[targetBoard]) {
		message.channel.send('No challenge exists by that name.');
	} else {
		guildData[targetBoard].records = [];
		saveGuildData(guildId, guildData);

		message.channel.send(`Records reset for ${targetBoard}.`);
	}
}

// HELP ///////////////////////////////////////////////////////////////////////
function sendHelpMessage(message) {
	let helpMessage = "Hello, my name is rallybot. Here are some commands:" +
		"\n`<daily|weekly>` Show the current leaderboard for the given challenge" +
		"\n`random <car|class|locale|stage>` Show a random rally." + 
		"\n`new <daily|weekly>` Start a new challenge.";

	// TODO: Better command examples / format
	message.channel.send(helpMessage);
}

// ADD ////////////////////////////////////////////////////////////////////////
function parseAdd(message, args) {
	let target = args.shift();
	let time = args.shift();
	let username = message.author.username;

	// TODO: Validate time

	switch(target) {
		case 'daily':
			addDailyTime(message, timeToMs(time));
			break;
		case 'weekly':
			addWeeklyTime(message, timeToMs(time));
			break;
		default:
			sendHelpMessage();
	}
}

function addDailyTime(message, time) {
	// End if no daily board
	let guildId = getGuildId(message);
	let guildData = getGuildData(guildId);
	if (!guildData.daily) {
		return message.channel.send("There's no active daily challenge.");
	}
	
	// Get data
	let username = message.author.username;
	let userId = message.author.id;
	let proof = 'www.example.com';
	let newRecord = { id: userId, username, time, proof };
	let oldRecord = guildData.daily.records.find((record) => record.id === userId);

	// Determine if new best
	let rank = 'unranked';
	let isNew = !oldRecord;
	let isBest = isNew || newRecord.time < oldRecord.time;
	if (isBest) {
		// Replace old
		guildData.daily.records = guildData.daily.records
			.filter((record) => record.id !== userId)
		guildData.daily.records.push(newRecord);
		rank = guildData.daily.records.sort().findIndex((record) => record.id === userId) + 1;

		// Save
		log('Adding new record:', newRecord);
		saveGuildData(guildId, guildData);
	}

	// Determine message
	if(isNew) {
		message.channel.send(`Time added.  Your rank is **#${rank}**`);
	} else if (isBest) {
		message.channel.send(`Time added.  Your new rank is **#${rank}**.\nCongratulations on the new personal best!`);
	} else {
		message.channel.send(`You failed to beat your previous best of \`${formatTime(oldRecord.time)}\``);
	}
}

function addWeeklyTime(guildId, time) {
	message.channel.send(`Not ready yet.`);
	// TODO: Just use one func and pass in the appropriate leaderboards and guildId
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
function parseRemove(message, args) {
	let targetBoard = args.shift();
	let targetRecord = args.shift();

	// Get challenge data
	let guildId = getGuildId(message);
	let guildData = getGuildData(guildId);
	if (!guildData[targetBoard]) {
		return message.channel.send("No challenge exists by that name.");
	}

	// Remove
	if(targetRecord.match(/^#?\d/)) {
		removeByRank(message, targetRecord.match(/\d+/)[0], targetBoard, guildId, guildData);
	} else {
		// Assume username if not all digits
		removeByUsername(message, targetRecord, targetBoard, guildId, guildData);
	}
}

function removeByRank(message, rank, targetBoard, guildId, guildData) {
	log('Removing rank:', targetBoard, rank, guildData[targetBoard].records.length);
	if(rank >= 0 && rank <= guildData[targetBoard].records.length) {
		guildData[targetBoard].records.slice(rank-1, 1);
		saveGuildData(guildId, guildData);

		message.channel.send(`Record ${rank} has been removed.`);
	} else {
		message.channel.send(`No record found for the specified rank.`);
	}
}

function removeByUsername(message, username, targetBoard, guildId, guildData) {
	log('Removing user:', targetBoard, username);
	let challenge = guildData[targetBoard];
	
	// Sanitize name
	username = username.replace(/^@/, '');

	if(challenge.records.findIndex(val => val.username === username) !== -1) {
		// Filter records w/ username
		challenge.records = challenge.records
			.filter(rec => rec.username !== username);
		guildData[targetBoard] = challenge;

		// Write new records
		saveGuildData(guildId, guildData);

		message.channel.send(`${username} has been removed from ${targetBoard} records.`);
	} else {
		message.channel.send("No record found for that user.");
	}
}

// BOARD PRINT ////////////////////////////////////////////////////////////////
function buildLeaderboardMessage(board) {
	let ranks = (board.records.length) ? 
		board.records.sort()
			.map((rec, index) => `#${index+1}\t${formatTime(rec.time)} - ${rec.username}`)
			.join('\n') :
		"No records"

	return `\`${board.challenge}\`\n\`\`\`${ranks}\`\`\``; 
}

function sendDailyBoard(message, args) {
	let data = getGuildData(getGuildId(message));
	message.channel.send(buildLeaderboardMessage(data.daily));
}

function sendWeeklyBoard(message, args) {
	let guildDb = getGuildData(getGuildId(message));
	message.channel.send(buildLeaderboardMessage(guildDb.data.weekly));
}

// OTHER COMMANDS /////////////////////////////////////////////////////////////
function logUserFeedback(message, args) {
	log('FEEDBACK:', args.join(' '));
}

// UTILS //////////////////////////////////////////////////////////////////////
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
	let milliseconds = parseInt(time.match(/\.\d+/)[0].replace(/\./, ''));

	milliseconds += seconds * 1000;
	milliseconds += minutes * 60000;

	return milliseconds;
}

function buildGuild(guildId) {
	return {
		id: guildId,
		data: {
			daily: {
				challenge: 'No challenge set',
				records: [],
			},
			weekly: {
				challenge: 'No challenge set',
				records: [],
			},
			random: {
				challenge: 'No challenge set',
				records: [],
			},
		}
	};
}

function getGuildId(message) {
	return message.channel.guild.id;
}

function getGuildData(guildId) {
	let db = getDb();
	let guild = db.guilds.find((guild) => guild.id === guildId);
	let guildIndex = db.guilds.findIndex((dbGuild) => dbGuild.id === guildId);

	if (!guild) {
		guild = buildGuild(guildId);
	}
	
	return guild.data;
}

function saveGuildData(guildId, guildData) {
	let db = getDb();
	let guildIndex = db.guilds.findIndex((dbGuild) => dbGuild.id === guildId);
	
	if (guildIndex === -1) {
		// Push new guild
		let guild = buildGuild(guildId);
		guild.data = guildData;
		db.guilds.push(guild);
	} else {
		// Overwrite existing guild data
		db.guilds[guildIndex] = guildData;
	}

	saveDb(db);
}

function getDb() {	
	let db = JSON.parse(fs.readFileSync(dbFileName, 'utf8'));
	debug('READ:', db);
	return db;
}

function saveDb(db) {
	debug('WRITE:', db);
	fs.writeFileSync(dbFileName, JSON.stringify(db));
}

Array.prototype.random = function() {
	return this[Math.floor(Math.random() * this.length)];
}


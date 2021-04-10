const fs = require('fs');
const log = require('./fancy-log.js');
const { prefix } = require('../config.json');
const { Locale, Stage, Condition, WrcClass, Rally, GuildUserTime, GuildUser } = require('./models.js');

function rallybot(message) {
	try {
		log.info(message.content);

		// Parse command
		let args = messageToArgs(message);

		// Skip no args
		if(!args.length) {
			message.channel.send("Hello");
			return;
		}

		// Parse command
		// NOTE: Quick parse for single commands. Do a more detailed parse if nothing hits.
		let command = args.shift();
		switch(command) {
			case 'locations':
			case 'locales':
				cmdLocaleCodes(message);
				break;
			case 'stages':
				let localeCode = args.shift();
				cmdStages(message, localeCode);
				break;
			case 'classes':
			case 'groups':
				cmdWrcClasses(message);
				break;
			default:
				parseArgs(message);
		}
	} catch (error) {
		log.error(error);
		message.channel.send("Something went wrong.");
	}
}

// COMMANDS ///////////////////////////////////////////////////////////////////
function cmdLocaleCodes(message) {
	Locale.findAll()
		.then((locales) => 
			sendLocaleCodes(message, locales));
}

async function cmdStages(message, localeCode) {
	if (localeCode) {
		let locale = await Locale.findOne({
		  where: {
		    code: localeCode
		  }
		});

		let stages = await Stage.findAll({
			where: {
				localeId: locale.id
			}
		});

		sendStages(message, locale, stages);
	}
	else
	{
		message.channel.send("Please specify a country code.");
		cmdLocaleCodes(message);
	}
}

function cmdWrcClasses(message) {
	WrcClass.findAll()
		.then((wrcClasses) => 
			sendWrcClassCodes(message, wrcClasses));
}

// MESSAGE SENDERS ////////////////////////////////////////////////////////////
function sendLocaleCodes(message, locales) {
	let response = `>>> ${locales.sort((a, b) => a.id - b.id).map((locale) => `**${locale.code}**: ${locale.name}`).join('\n')}`;
	message.channel.send(response);
}

function sendStages(message, locale, stages) {
	let response = `>>> Here are the stages available for ${locale.name}:\n` +
	`${stages.sort((a, b) => a.id - b.id).map((stage) => `**${stage.code}**: ${stage.name}`).join('\n')}`;

	message.channel.send(response);
}

function sendWrcClassCodes(message, wrcClasses) {
	let response = `>>> ${wrcClasses.sort((a, b) => a.id - b.id).map((wrcClass) => `**${wrcClass.code}**: ${wrcClass.name}`).join('\n')}`;

	message.channel.send(response);
}

function sendTimeAdded(message, locale, stage, conditions, time) {
	let response = `${locale.name}\n${stage.name} / ${conditions.name}\n${formatTime(time)}`;

	message.channel.send(response);
}

function sendHelpMessage(message) {
	let helpMessage = "Hello, my name is rallybot. Here are basic commands:\n" +
		`Adding a time: ${prefix} <stage shorthand code> <WRC class shorthand code> <0:00.000> (order and capitalization don't matter).` +
		`Shorthand codes: ${prefix} <locations|stages <location code>|classes>\n` +
		`Example: \`${prefix} h1 us-01w 1:23.456\`\n`;

	message.channel.send(helpMessage);
}

// UTILS //////////////////////////////////////////////////////////////////////
function messageToArgs(message) {
	return message.content
		.slice(prefix.length)
		.split(/\s+/)
		.filter(arg => arg !== '');
}

async function parseArgs(message) {
	// TODO: Break this up and put things where they belong
	try {
		// Get codes
		const guildId = message.channel.guild?.id
		const userId = message.author.id;
		const locales = await Locale.findAll();
		const stages = await Stage.findAll();
		const wrcClasses = await WrcClass.findAll();
		// TODO: Load async. Cache.

		// Pull codes from message
		let codes = message.content
			.slice(prefix.length)
			.toLowerCase()
			.match(/(?<locale>[a-z]{2,3})[\W]?(?<stage>\d{2})[\W]?(?<conditions>[w])?/)
			?.groups;

		// Pull time from message
		let timeText = message.content
			.match(/(?<min>\d{1,2}):(?<sec>\d{2})([.:](?<ms>\d{1,3}))?/)
			?.groups;

		// TODO: Pull wrc class from message

		// Build args object
		let locale = locales.find((locale) => locale.code.toLowerCase() === codes.locale);
		let stage = stages.find((stage) => stage.localeId === locale?.id && stage.code.toLowerCase() === codes.stage);
		let args = { 
			locale,
			stage,
			conditions: (codes.conditions)?  2 : 1,
			wrcClass: 'h1', // TODO: Remove placeholder
			time: timeToMs(timeText.min, timeText.sec, timeText.ms),
			permalink: getPermalink(message),
		};

		// Do command
		if (args.stage && args.time) {
			// Get current user
			let [guildUser, isNewUser] = await GuildUser.findOrCreate({
				where: {
		 			guildId: guildId,
		 			userId: userId,
				},
			});

			// Get current time
			let [userTime, isNewTime] = await GuildUserTime.findOrCreate({
		 		where: { 
		 			guildUserId: guildUser.id,
		 			rallyId: await getRallyId(1, stage.id, 1) // TODO: Remove placeholder conditions and wrcClass
		 		},
			});

			// Compare times
			if (isNewUser || !userTime.time || userTime.time > args.time) {
				// Update record
				userTime.time = args.time;
				userTime.permalink = getPermalink(message);
				userTime.save();

				log.success(`Updated GuildUserTime (GuildUser<${guildUser.id}>): Set ${`${args.locale.code}-${args.stage.code}${args.conditions} / ${args.wrcClass}`.toUpperCase()} to ${args.time}`);
				message.channel.send(`Best time updated.`);
				// TODO: More detailed message.
			} else {
				log.info(`No update: Given time (${args.time}) failed to beat previous time (${userTime.time})`);
				message.channel.send(`You failed to beat your previous best of ${formatTime(userTime.time)}`)
			}
		}
	} catch (error) {
		log.error(error);

		message.channel.send("Something went wrong when parsing that command.");
	}
}

function calcRankPoints(rank, count) {
	return sqrt(count)/sqrt(rank/10);
}

async function getRallyId(wrcClassId, stageId, localeConditionId = 1) {
	// TODO: Add rally records to DB
	try {
		return await Rally.findOne({
			where: {
				localeConditionId,
				stageId,
				wrcClassId,
			}
		});
	} catch (error) {
		log.error("Unable to retrieve rally.", error);
	}
}

function getPermalink(message) {
	// TODO: Does this already exist?
	return `https://discord.com/channels/${message.channel.guild?.id ?? '@me'}/${message.channel.id}/${message.id}`
}

function formatTime(ms) {
	// Convert
	let minutes = Math.floor(ms / 60000);
	let seconds = Math.floor((ms % 60000) / 1000);
	let milliseconds = ms % 1000;

	// Padding
	minutes = (minutes < 10) ? '0'+minutes : minutes;
	seconds = (seconds < 10) ? '0'+seconds : seconds;
	
	return `${minutes}:${seconds}.${milliseconds}`;
}

function timeToMs(minutes = 0, seconds = 0, milliseconds = 0) {
	milliseconds = parseInt(milliseconds);
	milliseconds += parseInt(seconds) * 1000;
	milliseconds += parseInt(minutes) * 60000;

	return milliseconds;
}

Array.prototype.random = function() {
	return this[Math.floor(Math.random() * this.length)];
}

module.exports = rallybot;
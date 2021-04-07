const fs = require('fs');
const log = require('./fancy-log.js');
const { prefix, dbConnection } = require('../config.json');
const { Sequelize, Op } = require('sequelize');
const sequelize = new Sequelize(dbConnection, { log: log.debug, });
const { Locale, Stage, Condition, WrcClass, Rally, UserTime, GuildUser } = require('./models.js');

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
	try {
		// Get codes
		const guildId = message.channel.guild?.id
		const userId = message.author.id;
		const locales = await Locale.findAll();
		const stages = await Stage.findAll();
		const wrcClasses = await WrcClass.findAll();

		// Pull codes from message
		let codes = message.content
			.slice(prefix.length)
			.toLowerCase()
			.match(/(?<locale>[a-z]{2,3})[\W]?(?<stage>\d{2})[\W]?(?<conditions>[w])?/)
			?.groups;

		// Pull time from message
		let time = message.content
			.match(/(?<min>\d{1,2}):(?<sec>\d{2})([.:](?<ms>\d{1,3}))?/)
			?.groups;

		// Build args object
		let locale = locales.find((locale) => locale.code.toLowerCase() === codes.locale);
		let stage = stages.find((stage) => stage.localeId === locale?.id && stage.code.toLowerCase() === codes.stage);
		let args = { 
			locale,
			stage,
			conditions: codes.conditions ?? '',
			time: timeToMs(time.min, time.sec, time.ms),
			permalink: getPermalink(message),
		};
		log.info('args:', args);

		// Do command
		if (locale && stage && time) {
			// TODO: Add time, send response.
			log.info(`Updating User<${userId}>: Adding ${args.time} to ${`${args.locale.code}-${args.stage.code}${args.conditions}`.toUpperCase()}`);
		}
	} catch (error) {
		log.error(error);
		message.channel.send("Something went wrong when parsing that command.");
	}
}

function calcPoints(rank, count) {
	return sqrt(count)/sqrt(rank/10);
}

async function getRallyId(localeId, stageId, conditionId = 1, wrcClassId) {
	try {
		return await Rally.findOne({
			where: {
				localeId: localeId,
				stageId: stageId,
				wrcClassId: wrcClassId,
			}
		});
	} catch (error) {
		log.error("Unable to retrieve rally.", error);
	}
}

function getPermalink(message) {
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

function formattedTimeToMs(time) {
	let minutes = parseInt(time.match(/^\d+/)[0]);
	let seconds = parseInt(time.match(/:\d+/)[0].replace(/:/, ''));
	let milliseconds = parseInt(time.match(/\.\d+/)[0].replace(/\./, ''));

	milliseconds += seconds * 1000;
	milliseconds += minutes * 60000;

	return milliseconds;
}

Array.prototype.random = function() {
	return this[Math.floor(Math.random() * this.length)];
}

module.exports = rallybot;
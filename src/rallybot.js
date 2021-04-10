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
			case 'location':
			case 'locations':
			case 'locale':
			case 'locales':
				cmdLocaleCodes(message);
				break;
			case 'stage':
			case 'stages':
				let localeCode = args.shift();
				cmdStages(message, localeCode);
				break;
			case 'class':
			case 'classes':
			case 'group':
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

async function parseArgs(message) {
	// TODO: Break this up and put things where they belong
	try {
		// Get codes
		const guildId = message.channel.guild?.id
		const userId = message.author.id;
		const locales = await Locale.findAll();
		const stages = await Stage.findAll();
		const conditions = await Condition.findAll();
		const wrcClasses = await WrcClass.findAll();
		// TODO: Load async. Cache.

		// Pull data from message
		let stageCodes = getStageCodes(message);
		let wrcCode = getWrcClassCode(message, wrcClasses.map(wrc => wrc.code.toLowerCase()));
		let timeText = getTimeText(message);

		// Get objects from message codes
		let messageData = {};
		// Locale
		messageData.locale = locales.find((locale) => 
			locale.code.toLowerCase() === stageCodes.locale.toLowerCase());
		if (!messageData.locale) {
			return sendBadLocaleCode(message, locales);
		} else {
			// Stage
			messageData.stage = stages.find((stage) => 
				stage.localeId === messageData.locale?.id &&
				stage.code.toLowerCase() === stageCodes.stage.toLowerCase());

			if (!messageData.stage) {
				return sendBadStageCode(message, messageData.locale, stages);
			} else {
				// Conditions
				// TODO: Take another look at this.
				if (stageCodes.locale === 'SE' || stageCodes.locale === 'MC') {
					// Skip snow locations
					messageData.conditions = conditions.find(condition => condition.name === 'Snow');
				} else {
					// Default to dry
					messageData.conditions = (stageCodes.conditions && stageCodes.conditions?.toLowerCase() === 'w') ? 
						conditions.find(condition => condition.name === 'Wet') :
						conditions.find(condition => condition.name === 'Dry')
				}
			}
		}
		// WRC Class
		messageData.wrcClass = wrcClasses.find(wrc => wrc.code.toLowerCase() === wrcCode.toLowerCase());
		// Time in ms
		messageData.time = timeToMs(timeText.min, timeText.sec, timeText.ms);
		// Self link
		messageData.permalink = getPermalink(message);

		// Do command
		if (messageData.stage && messageData.time) {
			let rally = await getRally(messageData.wrcClass.id, messageData.stage.id, messageData.conditions.id);
			log.debug(rally);
			if (!rally) {
				return sendBadRally(message);
			} else {
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
			 			rallyId: rally.id,
			 		},
				});

				// Compare times
				if (isNewUser || !userTime.time || userTime.time > messageData.time) {
					// Update record
					userTime.time = messageData.time;
					userTime.permalink = messageData.permalink;
					userTime.save();

					log.success(`Updated GuildUserTime (GuildUser<${guildUser.id}>): Set ${`${messageData.locale.code}-${messageData.stage.code}${messageData.conditions} / ${messageData.wrcClass}`.toUpperCase()} to ${userTime.time}`);
					message.channel.send(`Best time updated.`);
					// TODO: More detailed message.
				} else {
					log.info(`No update: Given time (${messageData.time}) failed to beat previous time (${userTime.time})`);
					message.channel.send(`You failed to beat your previous best of ${formatTime(userTime.time)}`)
				}	
			}
		}
	} catch (error) {
		log.error(error);

		message.channel.send("Something went wrong when parsing that command.");
	}
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

function sendBadLocaleCode(message, locales) {
	message.channel.send("I don't recognize that location.  Here's a list of valid shorthand codes for locations.");
	sendLocaleCodes(message, locales);
}

function sendBadStageCode(message, locale, stages) {
	message.channel.send(`You did not provide a valid stage code.  Here's a list of valid shorthand codes for **${locale.name}**.`);
	sendStages(message, locale, stages);
}

function sendBadRally(message) {
	message.channel.send("I don't recognize that rally code.  Try `locations`, `stages`, or `classes` for lists or usable shorthand codes.");
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

function getStageCodes(message) {
	return message.content
		.slice(prefix.length)
		.toLowerCase()
		.match(/(?<locale>[a-z]{2,3})[\W]?(?<stage>\d{2})[\W]?(?<conditions>[w])?/)
		?.groups;
}

function getWrcClassCode(message, validCodes) {
	return message.content
		.slice(prefix.length)
		.toLowerCase()
		.match(/\w+/g)
		.find(arg => validCodes.includes(arg));
}

function getTimeText(message) {
	return message.content
		.match(/(?<min>\d{1,2}):(?<sec>\d{2})([.:](?<ms>\d{1,3}))?/)
		?.groups;
}

function calcRankPoints(rank, count) {
	return sqrt(count)/sqrt(rank/10);
}

async function getRally(wrcClassId, stageId, localeConditionId = 1) {
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
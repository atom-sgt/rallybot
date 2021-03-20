const colors = require('colors');
colors.setTheme({
	error: 'red',
	warn: 'yellow',
	info: 'cyan',
	debug: 'inverse',
	success: 'green',
});
const prefix = {
	ERROR: '[ERROR]'.error,
	WARN: '[WARN]'.warn,
	INFO: '[INFO]'.info,
	DEBUG: '[DEBUG]'.debug,
	SUCCESS: '[SUCCESS]'.success,
};

log = console.log;
log.error = (...args) => log(prefix.ERROR, ...args);
log.warn = (...args) => log(prefix.WARN, ...args);
log.info = (...args) =>	log(prefix.INFO, ...args);
log.debug = (...args) => log(prefix.DEBUG, ...args);
log.success = (...args) => log(prefix.SUCCESS, ...args);

module.exports = log;

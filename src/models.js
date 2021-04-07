const { dbConnection } = require('../config.json');
const { Sequelize, DataTypes } = require('sequelize');
const sequelize = new Sequelize(dbConnection, {});
sequelize.sync({ alter: true });

const Car = sequelize.define('Car', {
	name: DataTypes.STRING,
	wrcClassId: DataTypes.INTEGER,
});

const Condition = sequelize.define('Condition', {
	name: DataTypes.STRING,
});

const GuildUser = sequelize.define('GuildUser', {
	guildId: DataTypes.BIGINT,
	userId: DataTypes.BIGINT,
	points: {
		type: DataTypes.INTEGER,
		defaultValue: 0,
	}
});

const Locale = sequelize.define('Locale', {
	name: DataTypes.STRING,
	code: DataTypes.STRING,
	surfaceType: DataTypes.STRING,
	description: DataTypes.STRING,
	flag: DataTypes.STRING
});

const LocaleCondition = sequelize.define('LocaleCondition', {
	localeId: DataTypes.INTEGER,
	conditionId: DataTypes.INTEGER,
});

const Rally = sequelize.define('Rally', {
	stageId: DataTypes.INTEGER,
	localeConditionId: DataTypes.INTEGER,
	wrcClassId: DataTypes.INTEGER,
});

const Stage = sequelize.define('Stage', {
	name: DataTypes.STRING,
	localeId: DataTypes.INTEGER,
	code: DataTypes.STRING,
});

const UserTime = sequelize.define('UserTime', {
	userId: DataTypes.BIGINT,
	rallyId: DataTypes.INTEGER,
	time: DataTypes.INTEGER,
	permalink: DataTypes.STRING,
	isVerified: {
		type: DataTypes.BOOLEAN,
		defaultValue: false,
	},
});

const WrcClass = sequelize.define('WrcClass', {
	name: DataTypes.STRING,
	code: DataTypes.STRING,
});

module.exports = { 
	Car,
	Condition,
	GuildUser,
	Locale,
	LocaleCondition,
	Rally,
	Stage, 
	UserTime, 
	WrcClass,
};

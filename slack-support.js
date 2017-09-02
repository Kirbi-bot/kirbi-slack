const chalk = require('chalk');

exports.slackLogin = function (Kirbi) {
	const RtmClient = require('@slack/client').RtmClient;

	console.log(chalk.magenta(`Slack Enabled... Starting.`));
	if (Kirbi.Auth.slack.bot_token) {
		console.log('Logging in to Slack...');
		const MemoryDataStore = require('@slack/client').MemoryDataStore;
		Kirbi.Slack = new RtmClient(Kirbi.Auth.slack.bot_token, {
			logLevel: 'error',
			dataStore: new MemoryDataStore()
		});
		Kirbi.Slack.c_events = require('@slack/client').CLIENT_EVENTS;
		Kirbi.Slack.rtm_events = require('@slack/client').RTM_EVENTS;
		Kirbi.Slack.start();
		require('./lib/on-event')(Kirbi);
	} else {
		console.log(chalk.red('ERROR: Kirbi must have a Slack bot token...'));
		return;
	}

	Kirbi.setupSlackCommands = function () {
		// Load external slack-specific modules
		if (Kirbi.Config.slack.modules.length > 0 && Array.isArray(Kirbi.Config.slack.modules)) {
			Kirbi.slackCommands = {};
			Kirbi.Config.slack.modules.forEach(module => {
				if (Kirbi.slackCommands[module]) {
					return;
				}
				try {
					module = require(`kirbi-slack-${module}`)(Kirbi);
				} catch (err) {
					console.log(chalk.red(`Improper setup of the 'slack-${module}' command file. : ${err}`));
					return;
				}
				if (module && module.commands) {
					module.commands.forEach(command => {
						if (command in module) {
							try {
								Kirbi.slackCommands[command] = module[command];
							} catch (err) {
								console.log(err);
							}
						}
					});
				}
			});
		}
	};
	Kirbi.setupSlackCommands();

	console.log(`Loaded ${Kirbi.commandCount()} base commands`);
	console.log(`Loaded ${Object.keys(Kirbi.slackCommands).length} Slack commands`);
};

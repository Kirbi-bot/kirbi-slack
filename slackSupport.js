const Kirbi = require('../../kirbi');
const chalk = require('chalk');

exports.slackLogin = function () {
    const RtmClient = require('@slack/client').RtmClient;
	console.log(chalk.magenta(`Slack Enabled... Starting.`));
	if (Kirbi.Auth.slack.bot_token) {
		console.log('Logging in to Slack...');
		let MemoryDataStore = require('@slack/client').MemoryDataStore;
        Kirbi.Slack = new RtmClient(Kirbi.Auth.slack.bot_token, {
			logLevel: 'error',
			dataStore: new MemoryDataStore()
		});
		Kirbi.Slack.c_events = require('@slack/client').CLIENT_EVENTS;
		Kirbi.Slack.rtm_events = require('@slack/client').RTM_EVENTS;
        Kirbi.Slack.start();
		require('./lib/onEvent');
	} else {
        console.log(chalk.red('ERROR: Kirbi must have a Slack bot token...'));
        return;
	}

	//Load external slack-specific modules
	if (Kirbi.Config.slack.modules.length && Kirbi.Config.slack.modules instanceof Array) {
		Kirbi.slackCommands = {};
		Kirbi.Config.slack.modules.forEach(module => {
			if (Kirbi.slackCommands[module]) {return};
			try {
				module = require(`kirbi-slack-${module}`);
			} catch (err) {
				Kirbi.logError(`Improper setup of the 'slack-${module}' command file. : ${err}`);
				return;
			}
			if (module && module['commands']) {
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

	var commandCount = Object.keys(Kirbi.Commands).length + Object.keys(Kirbi.slackCommands).length;
	console.log(`Loaded ${commandCount} Slack chat commands`);
}

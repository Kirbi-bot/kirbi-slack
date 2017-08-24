const Kirbi = require('../../../../kirbi');

//initialize AI
if (Kirbi.Config.elizaEnabled && !Kirbi.Eliza) {
	let Eliza = Kirbi.require('./extras/eliza');
	Kirbi.Eliza = new Eliza();
	console.log('Eliza enabled.');
	Kirbi.Eliza.memSize = 500;
};

function currentChannelHasHook (channelId) {
	if (Kirbi.Auth.slack.webhooks[Kirbi.Slack.dataStore.getChannelById(channelId).name]) return true;
	return false;
};

function slackMessageCb (output, msg, expires, delCalling) {
	//we need to format the message output for the Slack API first...
	if (typeof output === 'object') {
		let reformatted;
		reformatted = {};
		reformatted.attachments = [];
		reformatted.attachments[0] = {};
		reformatted.attachments[0].fallback = 'There was an error';
		if (output.embed.color) reformatted.attachments[0].color = `#${output.embed.color}`;
		if (output.embed.title) reformatted.attachments[0].title = output.embed.title;
		if (output.embed.description) reformatted.attachments[0].text = output.embed.description;
		if (typeof output.embed.image !== 'undefined') reformatted.attachments[0].image_url = output.embed.image.url;
		if (typeof output.embed.thumbnail !== 'undefined') reformatted.attachments[0].thumb_url = output.embed.thumbnail.url;
		if (output.embed.footer) reformatted.attachments[0].footer = output.embed.footer;
		if (typeof output.embed.author !== 'undefined') {
			if (output.embed.author.name) reformatted.attachments[0].author_name = output.embed.author.name;
			if (output.embed.author.url) reformatted.attachments[0].author_link = output.embed.author.url;
			if (output.embed.author.icon_url) reformatted.attachments[0].author_icon = output.embed.author.icon_url;
		}
		if (typeof output.embed.fields !== 'undefined') {
			reformatted.attachments[0].fields = [];
			output.embed.fields.forEach(field => {
				reformatted.attachments[0].fields.push({
					title: field.name,
					value: field.value,
					short: field.inline
				});
			});
		}
		if (output.reply) reformatted.attachments[0].pretext = `<@${output.reply}>`;

		if (currentChannelHasHook(msg.channel)) {
			//check config for webhook urls...
			//if the message came from a channel that we have a webhook for,
			//send the attachment to that url
			let url = Kirbi.Auth.slack.webhooks[Kirbi.Slack.dataStore.getChannelById(msg.channel).name];
			require('request').post({
				uri: url,
				json: true,
				body: reformatted
			});
		};
		return;
	};


	//then send it and interact with it based on the supplied flags...
	//if (expires) {
	//	return msg.channel.send(output).then(message => message.delete(5000));
	//}
	//if (delCalling) {
	//	return msg.channel.send(output).then(() => msg.delete());
	//}
	Kirbi.Slack.sendMessage(output, msg.channel);
};

function checkMessageForCommand (msg, isEdit) {
	let self = Kirbi.Slack.dataStore.getBotByName('Kirbi');
	function isMention (args) {
		return args[0] === `<@${self.id}>`;
	};
	msg.author = `<@${msg.user}>`;
	//drop our own messages to prevent feedback loops
	if (msg.user === self.id) {
		return;
	}
	if (Kirbi.Config.debug) {
		console.log('message received:', msg.type, msg.subtype, 'interpreting...');
	}
	//check for mention
	if (isMention(msg.text.split(' '))) {
		if (Kirbi.Config.elizaEnabled) {
			//If Eliza AI is enabled, respond to @mention
			let message = msg.text.replace(`<@${self.id}> `, '');
			Kirbi.Slack.sendMessage(Kirbi.Eliza.transform(message), msg.channel);
			return;
		} else {
			Kirbi.Slack.sendMessage('Yes?', msg.channel);
			return;
		};
	};
	//check for IM
	if (typeof Kirbi.Slack.dataStore.getDMById(msg.channel) !== 'undefined') {
		Kirbi.Slack.sendMessage(`I don't respond to direct messages.`, msg.channel);
		return;
	};
	//check if message is a command
	if (msg.text.startsWith(Kirbi.Config.commandPrefix)) {
		let allCommands = Object.assign(Kirbi.Commands, Kirbi.slackCommands);
		let cmdTxt = msg.text.split(' ')[0].substring(Kirbi.Config.commandPrefix.length).toLowerCase();
		let suffix = msg.text.substring(cmdTxt.length + Kirbi.Config.commandPrefix.length + 1); //add one for the ! and one for the space
		let cmd = allCommands[cmdTxt];
		if (cmdTxt === 'help') {
			let DM = Kirbi.Slack.dataStore.getDMByUserId(msg.user).id;
			if (suffix) {
				let cmds = suffix.split(' ').filter(function (cmd) { return allCommands[cmd] });
				let info = "";
				cmds.forEach(cmd => {
					//TODO: add permissions check back here
					info += `**${Kirbi.Config.commandPrefix + cmd}**`;
					let usage = allCommands[cmd].usage;
					if (usage) {
						info += ` ${usage}`;
					}
					let description = allCommands[cmd].description;
					if (description instanceof Function) {
						description = description();
					}
					if (description) {
						info += `\n\t${description}`;
					}
					info += '\n'
				});
				Kirbi.Slack.sendMessage(info, DM);
			} else {
				Kirbi.Slack.sendMessage('**Available Commands:**', DM);
				let batch = '';
				let sortedCommands = Object.keys(allCommands).sort();
				for (let i in sortedCommands) {
					let cmd = sortedCommands[i];
					let info = `**${Kirbi.Config.commandPrefix + cmd}**`;
					let usage = allCommands[cmd].usage;
					if (usage) {
						info += ` ${usage}`;
					}
					let description = allCommands[cmd].description;
					if (description instanceof Function) {
						description = description();
					}
					if (description) {
						info += `\n\t${description}`;
					}
					let newBatch = `${batch}\n${info}`;
					if (newBatch.length > (1024 - 8)) { //limit message length
						Kirbi.Slack.sendMessage(batch, DM);
						batch = info;
					} else {
						batch = newBatch
					}
				};
				if (batch.length > 0) {
					Kirbi.Slack.sendMessage(batch, DM);
				};
			}
		} else if (cmd) {
			try {
				//add permissions check back here, too
				console.log(`Treating ${msg.text} from ${msg.team}:${msg.user} as command`);
				cmd.process(msg, suffix, isEdit, slackMessageCb);
			} catch (err) {
				let msgTxt = `Command ${cmdTxt} failed :disappointed_relieved:`;
				if (Kirbi.Config.debug) {
					msgTxt += `\n${err.stack}`;
				}
				Kirbi.Slack.sendMessage(msgTxt, msg.channel);
			}
		} else {
			Kirbi.Slack.sendMessage(`${cmdTxt} not recognized as a command!`, msg.channel);
		}
	};
};

Kirbi.Slack.on(Kirbi.Slack.rtm_events.MESSAGE, (msg) => checkMessageForCommand(msg, false));

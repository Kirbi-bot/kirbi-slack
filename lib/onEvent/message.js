module.exports = function (Kirbi) {
	function currentChannelHasHook(channelId) {
		if (Kirbi.Auth.slack.webhooks[Kirbi.Slack.dataStore.getChannelById(channelId).name]) {
			return true;
		}
		return false;
	}

	function slackMessageCb(output, msg) {
		// Format the message output for the Slack API
		if (typeof output === 'object') {
			const reformatted = {
				attachments: [
					{ fallback: 'There was an error' }
				]
			};
			if (output.embed.color) {
				reformatted.attachments[0].color = `#${output.embed.color}`;
			}
			if (output.embed.title) {
				reformatted.attachments[0].title = output.embed.title;
			}
			if (output.embed.description) {
				reformatted.attachments[0].text = output.embed.description;
			}
			if (typeof output.embed.image === 'object') {
				reformatted.attachments[0].image_url = output.embed.image.url;
			}
			if (typeof output.embed.thumbnail === 'object') {
				reformatted.attachments[0].thumb_url = output.embed.thumbnail.url;
			}
			if (output.embed.footer) {
				reformatted.attachments[0].footer = output.embed.footer;
			}
			if (typeof output.embed.author === 'object') {
				if (output.embed.author.name) {
					reformatted.attachments[0].author_name = output.embed.author.name;
				}
				if (output.embed.author.url) {
					reformatted.attachments[0].author_link = output.embed.author.url;
				}
				if (output.embed.author.icon_url) {
					reformatted.attachments[0].author_icon = output.embed.author.icon_url;
				}
			}
			if (typeof output.embed.fields === 'object') {
				reformatted.attachments[0].fields = [];
				output.embed.fields.forEach(field => {
					reformatted.attachments[0].fields.push({
						title: field.name,
						value: field.value,
						short: field.inline
					});
				});
			}
			if (output.reply) {
				reformatted.attachments[0].pretext = `<@${output.reply}>`;
			}
			if (currentChannelHasHook(msg.channel)) {
				const url = Kirbi.Auth.slack.webhooks[Kirbi.Slack.dataStore.getChannelById(msg.channel).name];
				require('request').post({
					uri: url,
					json: true,
					body: reformatted
				});
			}
			return;
		}

		// TODO: add expiring and maybe delCalling pieces
		// Then send it and interact with it based on the supplied flags...
		/* if (expires) {
			return msg.channel.send(output).then(message => message.delete(5000));
		}
		if (delCalling) {
			return msg.channel.send(output).then(() => msg.delete());
		} */
		Kirbi.Slack.sendMessage(output, msg.channel);
	}

	function checkMessageForCommand(msg, isEdit) {
		const self = Kirbi.Slack.dataStore.getBotByName('Kirbi');
		msg.author = `<@${msg.user}>`;
		// Drop our own messages to prevent feedback loops
		if (msg.user === self.id) {
			return;
		}
		if (Kirbi.Config.debug) {
			console.log('message received:', msg.type, msg.subtype, 'interpreting...');
		}
		// Check for mention
		if (msg.text.split(' ')[0] === `<@${self.id}>`) {
			if (Kirbi.Config.elizaEnabled) {
				// If Eliza AI is enabled, respond to @mention
				const message = msg.text.replace(`<@${self.id}> `, '');
				Kirbi.Slack.sendMessage(Kirbi.Eliza.transform(message), msg.channel);
				return;
			}
			Kirbi.Slack.sendMessage('Yes?', msg.channel);
			return;
		}
		// Check for IM
		if (Kirbi.Slack.dataStore.getDMById(msg.channel)) {
			if (msg.text.startsWith(Kirbi.Config.commandPrefix) && msg.text.split(' ')[0].substring(Kirbi.Config.commandPrefix.length).toLowerCase() === 'reload') {
				Kirbi.setupCommands();
				Kirbi.setupSlackCommands();
				Kirbi.Slack.sendMessage(`Reloaded ${Kirbi.commandCount()} Base Commands`, msg.channel);
				Kirbi.Slack.sendMessage(`Reloaded ${Object.keys(Kirbi.slackCommands).length} Slack Commands`, msg.channel);
				return;
			}
			Kirbi.Slack.sendMessage(`I don't respond to direct messages.`, msg.channel);
			return;
		}
		// Check if message is a command
		if (msg.text.startsWith(Kirbi.Config.commandPrefix)) {
			const allCommands = Object.assign(Kirbi.Commands, Kirbi.slackCommands);
			const cmdTxt = msg.text.split(' ')[0].substring(Kirbi.Config.commandPrefix.length).toLowerCase();
			const suffix = msg.text.substring(cmdTxt.length + Kirbi.Config.commandPrefix.length + 1); // Add one for the ! and one for the space
			const cmd = allCommands[cmdTxt];
			if (cmdTxt === 'help') {
				const DM = Kirbi.Slack.dataStore.getDMByUserId(msg.user).id;
				if (suffix) {
					const cmds = suffix.split(' ').filter(cmd => {
						return allCommands[cmd];
					});
					let info = '';
					if (cmds.length > 0) {
						cmds.forEach(cmd => {
							// TODO: add permissions check back here
							info += `**${Kirbi.Config.commandPrefix + cmd}**`;
							const usage = allCommands[cmd].usage;
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
							info += '\n';
						});
						Kirbi.Slack.sendMessage(info, DM);
						return;
					}
					Kirbi.Slack.sendMessage('I can\'t describe a command that doesn\'t exist', msg.channel);
				} else {
					Kirbi.Slack.sendMessage('**Available Commands:**', DM);
					let batch = '';
					const sortedCommands = Object.keys(allCommands).sort();
					for (const i in sortedCommands) {
						const cmd = sortedCommands[i];
						let info = `**${Kirbi.Config.commandPrefix + cmd}**`;
						const usage = allCommands[cmd].usage;
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
						const newBatch = `${batch}\n${info}`;
						if (newBatch.length > (1024 - 8)) { // Limit message length
							Kirbi.Slack.sendMessage(batch, DM);
							batch = info;
						} else {
							batch = newBatch;
						}
					}
					if (batch.length > 0) {
						Kirbi.Slack.sendMessage(batch, DM);
					}
				}
			} else if (cmd) {
				try {
					// Add permissions check back here, too
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
		}
	}

	Kirbi.Slack.on(Kirbi.Slack.rtm_events.MESSAGE, msg => checkMessageForCommand(msg, false));
};

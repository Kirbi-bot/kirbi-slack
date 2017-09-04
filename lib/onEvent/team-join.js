module.exports = function (Kirbi) {
	Kirbi.Slack.on(Kirbi.Slack.rtm_events.TEAM_JOIN, event => {
		Kirbi.Slack.sendMessage(`@here, please Welcome ${event.user.name} to ${Kirbi.Config.slack.teamName}!`, Kirbi.Slack.dataStore.getChannelByName(Kirbi.Config.slack.welcomeChannel).id);
	});
};

module.exports = function (Kirbi) {
	Kirbi.Slack.on(Kirbi.Slack.c_events.RTM.AUTHENTICATED, rtmStartData => {
		console.log(`Logged into Slack! Name:${rtmStartData.self.name}, Team:${rtmStartData.team.name}`);
	});
	Kirbi.Slack.on(Kirbi.Slack.c_events.RTM.RTM_CONNECTION_OPENED, () => {
		console.log(`Connection to Slack Successful!`);
	});
};

const Kirbi = require('../../../../kirbi');

Kirbi.Slack.on(Kirbi.Slack.c_events.RTM.AUTHENTICATED, function (rtmStartData) {
    console.log(`Logged into Slack! Name:${rtmStartData.self.name}, Team:${rtmStartData.team.name}`);
    Kirbi.Slack._self = {
        id: rtmStartData.self.id,
        name: rtmStartData.self.name
    };
});
Kirbi.Slack.on(Kirbi.Slack.c_events.RTM.RTM_CONNECTION_OPENED, function(data) {
    console.log(`Connection to Slack Successful!`);
});
// 🟦 Require the Module
const emoteParser = require("tmi-emote-parse");

// 🟦 Set debug state and add event handlers (optional)
emoteParser.setDebug(true);
emoteParser.events.on("error", e => {
    console.log("Error:", e);
})

// 🟦 Register Twitch API credentials (ClientID and OAuth Token) needed for User-ID request
emoteParser.setTwitchCredentials(process.env.TWITCH_CLIENTID, process.env.TWITCH_OAUTH_TOKEN);

// 🟦 Now you can finally load emotes and badges for a specific channel to later parse/use
emoteParser.loadAssets(process.env.TWITCH_CHANNEL);

module.exports = emoteParser;
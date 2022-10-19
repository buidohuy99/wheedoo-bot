// 🟦 Require the Module
const emoteParser = require("tmi-emote-parse");
const {refreshAccessToken} = require("./auth-axios");

// 🟦 Set debug state and add event handlers (optional)
emoteParser.setDebug(true);
emoteParser.events.on("error", async (e) => {
    console.error("Error:", e);
    const access_token = await refreshAccessToken();
    emoteParser.setTwitchCredentials(process.env.TWITCH_CLIENTID, access_token);
});

// Get credentials
(async() => {
    const access_token = await refreshAccessToken();
    emoteParser.setTwitchCredentials(process.env.TWITCH_CLIENTID, access_token);
    // 🟦 Now you can finally load emotes and badges for a specific channel to later parse/use
    emoteParser.loadAssets(process.env.TWITCH_CHANNEL);
})();

module.exports = emoteParser;
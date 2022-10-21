// 🟦 Require the Module
const emoteParser = require("./emote-parser");
const {refreshAccessToken} = require("./auth-axios");
const fs = require("fs");
const pth = require("path");

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

function compareEnd(a, b) {
    if (a.end < b.end) {
        return -1;
    }
    if (a.end > b.end) {
        return 1;
    }
    return 0;
}

module.exports.getEmotesWithOccurrences = (message, tags, channel) => {
    let emotes = [];
    const gotEmotes = {};
    if (tags.emotes != null) {
        Object.keys(tags.emotes).forEach((el, ind) => {
            const em = tags.emotes[el];
            em.forEach(ele => {
                var start = parseInt(ele.split("-")[0]);
                var end = parseInt(ele.split("-")[1]);
                emotes.push({
                    start: start,
                    end: end,
                    rep: Object.keys(tags.emotes)[ind]
                })
            })
        })

        emotes.sort(compareEnd);

        emotes.forEach((ele) => {
            const code = message.substring(ele.start, ele.end + 1);
            if(!gotEmotes[code]){
                gotEmotes[code] = {
                    img: `https://static-cdn.jtvnw.net/emoticons/v2/${ele.rep}/default/dark/3.0`,
                    type: "twitch",
                    occurrences: [{
                        start: ele.start,
                        end: ele.end
                    }]
                };
            }else{
                gotEmotes[code].occurrences.push({
                    start: ele.start,
                    end: ele.end
                });
            }
        });
    }

    let fEmotes = emoteParser.getAllEmotes(channel);

    //Remove duplicates
    fEmotes = fEmotes.filter((value, idx) => {
        //Remove 
        if(value.scope === "global" && fEmotes.some((e, eidx) => e.name === value.name && eidx !== idx)){
            return false;
        }
        return true;
    });

    fEmotes.forEach(ele => {
        const code = ele.name; 
        const regex = new RegExp(`(?:^|\\s+)(${code})(?=$|\\s+)`, "gm");
        while(match = regex.exec(message)){
            if(!gotEmotes[code]){
                let newEmote = ele;
                delete newEmote.name;
                newEmote.occurrences = [{
                    start: match.index !== 0 ? match.index + 1 : 0,
                    end: match.index + match[0].length - 1
                }]
                gotEmotes[code] = newEmote;
            }else{
                gotEmotes[code].occurrences.push({
                    start: match.index !== 0 ? match.index + 1 : 0,
                    end: match.index + match[0].length - 1
                });
            }
        }
        if(gotEmotes[code]){
            gotEmotes[code].occurrences.sort(compareEnd);
        }
    })

    return gotEmotes;
}

module.exports.getAllComplementaryEmotes = (channel) => {
    const gotEmotes = [];
    if(fs.existsSync(`./complementary-emotes/global.compemotes`)){
        //Get global complementary emotes
        const data = fs.readFileSync(pth.join(__dirname, `complementary-emotes/global.compemotes`));
        const emotes = data.toString().split(/[\s,]+/);
        gotEmotes.push(emotes);
    }

    if(fs.existsSync(`./complementary-emotes/${channel}.compemotes`)){ 
        const data = fs.readFileSync(pth.join(__dirname, `complementary-emotes/${channel}.compemotes`));
        const femotes = data.toString().split(/[\s,]+/);
        gotEmotes.push(femotes);
    }

    return gotEmotes;
}
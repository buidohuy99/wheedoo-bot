// 🟦 Require the Module
const emoteParser = require("./emote-parser");
const {refreshAccessToken} = require("./auth-axios");
const fs = require("fs");
const pth = require("path");
const { all } = require("../routes");

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
                const start = parseInt(ele.split("-")[0]);
                const end = parseInt(ele.split("-")[1]);
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
                    name: code,
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

const getAllComplementaryEmotes = (channel) => {
    let gotEmotes = [];
    if(fs.existsSync(pth.join(__dirname, `complementary-emotes/global-compemotes.json`))){
        //Get global complementary emotes
        const data = fs.readFileSync(pth.join(__dirname, `complementary-emotes/global-compemotes.json`));
        const emotes = JSON.parse(data.toString());
        gotEmotes = gotEmotes.concat(emotes);
    }

    if(fs.existsSync(pth.join(__dirname,`complementary-emotes/${channel}-compemotes.json`))){ 
        const data = fs.readFileSync(pth.join(__dirname, `complementary-emotes/${channel}-compemotes.json`));
        const femotes = JSON.parse(data.toString());
        gotEmotes = gotEmotes.concat(femotes);
    }

    return gotEmotes;
}

const complementaryEmotes = getAllComplementaryEmotes(process.env.TWITCH_CHANNEL);

module.exports.chatMessageContainsEmotes = (message, userstate, channel) => {
    const emoteDict = module.exports.getEmotesWithOccurrences(message, userstate, channel);
    const emoteList = Object.entries(emoteDict).map((value) => value[1]);
    return emoteList.length > 0;
}

module.exports.extractEmoteGroups = (message, userstate, channel) => {
    const emoteDict = module.exports.getEmotesWithOccurrences(message, userstate, channel);
    const emoteList = Object.entries(emoteDict).map((value) => value[1]);

    const compEmotes = complementaryEmotes;
    const normalEmotesInMessage = emoteList.filter((emote) => !compEmotes.find(ce => ce.name == emote.name));
    const compEmotesInMessage = emoteList.filter((emote) => compEmotes.find(ce => ce.name == emote.name));
    const standaloneCompEmotes = compEmotesInMessage.map((emote) => {
        const returnedEmote = {...emote};
        const compPos = compEmotes.find((ce) => ce.name == emote.name).compPos;
        const standaloneInstances = emote.occurrences.filter((occ) => {
            if(!compPos || compPos.toLowerCase().trim() === "right"){
                return !emoteList.find((fe) => fe.occurrences.find(t => t.end + 2 === occ.start));
            }else{
                return !emoteList.find((fe) => fe.occurrences.find(t => t.start - 2 === occ.end));
            }
        });
        returnedEmote.occurrences = standaloneInstances;
        return returnedEmote;
    });

    const allEmotesWithCompEmotesRefs = [...normalEmotesInMessage, ...(standaloneCompEmotes.filter(e => e.occurrences.length > 0))];
    compEmotesInMessage.forEach((emote) => {
        const compPos = compEmotes.find((ce) => ce.name == emote.name).compPos;
        emote.occurrences.forEach((occ) => {
            let foundEmote;
            let seekPredicate;
            let currentEmoteOccurrence = occ;
            if(!compPos || compPos.toLowerCase().trim() === "right"){
                seekPredicate = (t, currentEmoteOccurrence) => t.end + 2 === currentEmoteOccurrence.start;
                
            }else{
                seekPredicate = (t, currentEmoteOccurrence) => t.start - 2 === currentEmoteOccurrence.end;
            }
            do{
                foundEmote = emoteList.find((fe) => {
                    const emoteOcc = fe.occurrences.find((t) => seekPredicate(t, currentEmoteOccurrence));
                    if(emoteOcc) currentEmoteOccurrence = emoteOcc; 
                    return emoteOcc;
                });
            }while(foundEmote && !allEmotesWithCompEmotesRefs.find(fe => fe.name === foundEmote.name));

            if(foundEmote){
                const emoteIdx = allEmotesWithCompEmotesRefs.findIndex((fe) => fe.name === foundEmote.name);
                if(!foundEmote.compRefs){
                    allEmotesWithCompEmotesRefs[emoteIdx].compRefs = {};
                    allEmotesWithCompEmotesRefs[emoteIdx].compRefs[`${currentEmoteOccurrence.start}-${currentEmoteOccurrence.end}`] = [{
                        name: emote.name,
                        start: occ.start,
                        end: occ.end
                    }];
                }else{
                    allEmotesWithCompEmotesRefs[emoteIdx].compRefs[`${currentEmoteOccurrence.start}-${currentEmoteOccurrence.end}`] = 
                    [...allEmotesWithCompEmotesRefs[emoteIdx].compRefs[`${currentEmoteOccurrence.start}-${currentEmoteOccurrence.end}`], {
                        name: emote.name,
                        start: occ.start,
                        end: occ.end
                    }];
                }
            }
        });
    });


    return allEmotesWithCompEmotesRefs;
}
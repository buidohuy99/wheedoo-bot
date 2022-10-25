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

    //Order emotes that occur first to the start of the array
    const sortedEmotes = Object.entries(gotEmotes).sort((emote1, emote2) => emote1[1].occurrences[0].start - emote2[1].occurrences[0].start);
    const resultingEmotes = Object.fromEntries(sortedEmotes);

    return resultingEmotes;
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
        femotes.forEach((item) => {
            const alreadyIn = gotEmotes.findIndex(e => e.name === item.name);
            if(alreadyIn !== -1){
                gotEmotes[alreadyIn] = item;
                return;
            }
            gotEmotes.push(item);
        });
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
            if(!compPos){
                return !emoteList.find((fe) => fe.occurrences.find(t => t.end + 2 === occ.start)) 
                && !emoteList.find((fe) => fe.occurrences.find(t => t.start - 2 === occ.end));
            }else if(compPos.toLowerCase().trim() === "right"){
                return !emoteList.find((fe) => {
                    const isCompEmote = compEmotes.find((ce) => ce.name == fe.name);
                    return fe.occurrences.some(t => t.end + 2 === occ.start)  
                    && (!isCompEmote || isCompEmote.compPos === "right");
                });
            }else{
                return !emoteList.find((fe) => {
                    const isCompEmote = compEmotes.find((ce) => ce.name == fe.name);
                    return fe.occurrences.some(t => t.start - 2 === occ.end)  
                    && (!isCompEmote || isCompEmote.compPos === "left");
                });
            }
        });
        
        returnedEmote.occurrences = standaloneInstances;
        return returnedEmote;
    });

    //All standalone emotes with comp emotes ref as attrib if have
    const allEmotesWithCompEmotesRefs = [...normalEmotesInMessage, ...(standaloneCompEmotes.filter(e => e.occurrences.length > 0))];

    //For comp emotes that could be on both sides
    const flexibleCompEmotes = compEmotesInMessage.map((emote) => {
        const returnedEmote = {...emote};
        const compPos = compEmotes.find((ce) => ce.name == emote.name).compPos;
        const nearEmotesInstances = emote.occurrences.filter((occ) => {
            if(!compPos){
                return emoteList.find((fe) => fe.occurrences.find(t => t.end + 2 === occ.start)) || emoteList.find((fe) => fe.occurrences.find(t => t.start - 2 === occ.end));
            }else{
                return false;
            }
        });
        returnedEmote.occurrences = nearEmotesInstances;
        return returnedEmote;
    }).filter(e => e.occurrences.length > 0);

    const leftAndRightCompEmotes = compEmotesInMessage.map((emote) => {
        const returnedEmote = {...emote};
        const compPos = compEmotes.find((ce) => ce.name == emote.name).compPos;
        const nearEmotesInstances = emote.occurrences.filter((occ) => {
            if(!compPos){
                return false;
            }else if(compPos.toLowerCase().trim() === "right"){
                return emoteList.find((fe) => {
                    const isCompEmote = compEmotes.find((ce) => ce.name == fe.name);
                    return fe.occurrences.some(t => t.end + 2 === occ.start)  
                    && (!isCompEmote || isCompEmote.compPos === "right");
                });
            }else{
                return emoteList.find((fe) => {
                    const isCompEmote = compEmotes.find((ce) => ce.name == fe.name);
                    return fe.occurrences.some(t => t.start - 2 === occ.end)  
                    && (!isCompEmote || isCompEmote.compPos === "left");
                });
            }
        });
        returnedEmote.occurrences = nearEmotesInstances;
        return returnedEmote;
    }).filter(e => e.occurrences.length > 0);

    flexibleCompEmotes.forEach(emote => {
        const occurrences = emote.occurrences;
        occurrences.forEach((occ) => {
            let leftEmote;
            let leftStandAloneEmote;
            let currentLeftOccurrence = occ;
            do{
                leftEmote = emoteList.find((fe) => fe.occurrences.find(t => t.end + 2 === currentLeftOccurrence.start));
                leftStandAloneEmote = allEmotesWithCompEmotesRefs.find(e => e.occurrences.find(t => t.end + 2 === currentLeftOccurrence.start));
                if(leftEmote){
                    currentLeftOccurrence = leftEmote.occurrences.find(t => t.end + 2 === currentLeftOccurrence.start);
                }
            }while(leftEmote && !leftStandAloneEmote);

            let rightEmote;
            let rightStandAloneEmote;
            let currentRightOccurrence = occ;
            //Find a standalone to connect to on the left of the emote
            if(leftStandAloneEmote){
                const emoteIdx = allEmotesWithCompEmotesRefs.findIndex((fe) => fe.name === leftStandAloneEmote.name);
                if(!allEmotesWithCompEmotesRefs[emoteIdx].compRefs){
                    allEmotesWithCompEmotesRefs[emoteIdx].compRefs = {};
                }
                if(!allEmotesWithCompEmotesRefs[emoteIdx].compRefs[`${currentLeftOccurrence.start}-${currentLeftOccurrence.end}`]){
                    allEmotesWithCompEmotesRefs[emoteIdx].compRefs[`${currentLeftOccurrence.start}-${currentLeftOccurrence.end}`] = [{
                        name: emote.name,
                        start: occ.start,
                        end: occ.end
                    }];
                }else{
                    allEmotesWithCompEmotesRefs[emoteIdx].compRefs[`${currentLeftOccurrence.start}-${currentLeftOccurrence.end}`].push({
                        name: emote.name,
                        start: occ.start,
                        end: occ.end
                    });
                }
            }else{ // Find right standalone emote if can't find a standalone on the left
                do{
                    rightEmote = emoteList.find((fe) => fe.occurrences.find(t => t.start - 2 === currentRightOccurrence.end));
                    rightStandAloneEmote = allEmotesWithCompEmotesRefs.find(e => e.occurrences.find(t => t.start - 2 === currentRightOccurrence.end));
                    if(rightEmote){
                        currentRightOccurrence = rightEmote.occurrences.find(t => t.start - 2 === currentRightOccurrence.end);
                    }
                }while(rightEmote && !rightStandAloneEmote);

                if(rightStandAloneEmote){
                    const emoteIdx = allEmotesWithCompEmotesRefs.findIndex((fe) => fe.name === rightStandAloneEmote.name);
                    if(!allEmotesWithCompEmotesRefs[emoteIdx].compRefs){
                        allEmotesWithCompEmotesRefs[emoteIdx].compRefs = {};
                    }
                    if(!allEmotesWithCompEmotesRefs[emoteIdx].compRefs[`${currentRightOccurrence.start}-${currentRightOccurrence.end}`]){
                        allEmotesWithCompEmotesRefs[emoteIdx].compRefs[`${currentRightOccurrence.start}-${currentRightOccurrence.end}`] = [{
                            name: emote.name,
                            start: occ.start,
                            end: occ.end
                        }];
                    }else{
                        allEmotesWithCompEmotesRefs[emoteIdx].compRefs[`${currentRightOccurrence.start}-${currentRightOccurrence.end}`].push({
                            name: emote.name,
                            start: occ.start,
                            end: occ.end
                        });
                    }
                }
            }
            
            if(!leftStandAloneEmote && !rightStandAloneEmote){ //If can't find an emote to rely on, make itself a standalone
                const currentEmoteIdx = allEmotesWithCompEmotesRefs.findIndex((fe) => fe.name === emote.name);
                if(currentEmoteIdx === -1){
                    const newStandaloneEmote = {...emote};
                    newStandaloneEmote.occurrences = [occ];
                    allEmotesWithCompEmotesRefs.push(newStandaloneEmote)
                }else{
                    allEmotesWithCompEmotesRefs[currentEmoteIdx].occurrences.push(occ);
                }
            }
        });
    });
    //For comp emotes with that can only be on the left or right
    leftAndRightCompEmotes.forEach((emote) => {
        const compPos = compEmotes.find((ce) => ce.name == emote.name).compPos;
        if(!compPos) return;

        emote.occurrences.forEach((occ) => {
            let foundEmote;
            let seekPredicate;
            let currentEmoteOccurrence = occ;
            let currentEmoteCompPos = compPos;

            if(compPos.toLowerCase().trim() === "right"){
                seekPredicate = (t, currentEmoteOccurrence) => t.end + 2 === currentEmoteOccurrence.start;
                
            }else{
                seekPredicate = (t, currentEmoteOccurrence) => t.start - 2 === currentEmoteOccurrence.end;
            }
            do{
                currentEmoteCompPos = undefined;
                foundEmote = emoteList.find((fe) => {
                    const emoteOcc = fe.occurrences.find((t) => seekPredicate(t, currentEmoteOccurrence));
                    if(emoteOcc) currentEmoteOccurrence = emoteOcc;
                    const isCompEmote = compEmotes.find((ce) => ce.name === fe.name);
                    if(isCompEmote) {
                        currentEmoteCompPos = isCompEmote.compPos ? isCompEmote.compPos.toLowerCase().trim() : "flexible";
                    }
                    return emoteOcc;
                });
            }while(foundEmote
                && !allEmotesWithCompEmotesRefs.find(fe => fe.name === foundEmote.name 
                && (!currentEmoteCompPos || fe.occurrences.some(item => item.end === currentEmoteOccurrence.end && item.start === currentEmoteOccurrence.start))));

            if(foundEmote){
                const emoteIdx = allEmotesWithCompEmotesRefs.findIndex((fe) => fe.name === foundEmote.name);
                if(!allEmotesWithCompEmotesRefs[emoteIdx].compRefs){
                    allEmotesWithCompEmotesRefs[emoteIdx].compRefs = {};
                }
                if(!allEmotesWithCompEmotesRefs[emoteIdx].compRefs[`${currentEmoteOccurrence.start}-${currentEmoteOccurrence.end}`]){
                    allEmotesWithCompEmotesRefs[emoteIdx].compRefs[`${currentEmoteOccurrence.start}-${currentEmoteOccurrence.end}`] = [{
                        name: emote.name,
                        start: occ.start,
                        end: occ.end
                    }];
                }else{
                    allEmotesWithCompEmotesRefs[emoteIdx].compRefs[`${currentEmoteOccurrence.start}-${currentEmoteOccurrence.end}`].push(
                        {
                            name: emote.name,
                            start: occ.start,
                            end: occ.end
                        }
                    );
                }
            }
        });
    });

    //Connect emotes that are next to each other through comp emotes found in comprefs
    allEmotesWithCompEmotesRefs.forEach(emote => {
        const currentEmoteIdx = allEmotesWithCompEmotesRefs.indexOf(emote);
        emote.occurrences.forEach((occ, currentOccIdx) => {
            //Connected from searching up the comp ref array of the current occurrence
            if(!emote.compRefs) return;
            const compRef = emote.compRefs[`${occ.start}-${occ.end}`];
            if(!compRef) return;
            compRef.forEach((ref) => {
                const findCompEmotes = compEmotes.find(e => e.name === ref.name);
                if(!findCompEmotes || findCompEmotes.compPos !== undefined) return;
                //Other emotes
                allEmotesWithCompEmotesRefs.forEach((e) => {
                    //To other emote's occurrences or comp refs
                    const connectedToOccurence = e.occurrences.findIndex(ite => ite == e.occurrences.filter(oc => oc.start !== occ.start && oc.end !== occ.end).find(otherocc => ref.end === otherocc.start - 2 || ref.start === otherocc.end + 2));
                    const connectedToCompRefs = e.occurrences.findIndex(ite => ite == e.occurrences.filter(oc => oc.start !== occ.start && oc.end !== occ.end).find(otherOcc =>
                        e.compRefs && e.compRefs[`${otherOcc.start}-${otherOcc.end}`] && 
                        e.compRefs[`${otherOcc.start}-${otherOcc.end}`].find((compRef) => ref.end === compRef.start - 2 || ref.start === compRef.end + 2)
                    ));  
                    const emoteIdx = allEmotesWithCompEmotesRefs.indexOf(e); 

                    const isCurrentNormalEmote = normalEmotesInMessage.find(e => e.name === allEmotesWithCompEmotesRefs[currentEmoteIdx].name);
                    const isOtherNormalEmote = normalEmotesInMessage.find(e => e.name === allEmotesWithCompEmotesRefs[emoteIdx].name);
                    const newPlacementIdx = isCurrentNormalEmote || (!isCurrentNormalEmote && !isOtherNormalEmote) ? currentEmoteIdx : emoteIdx;
                    const oldPlacementIdx = isCurrentNormalEmote || (!isCurrentNormalEmote && !isOtherNormalEmote) ? emoteIdx : currentEmoteIdx;
                        
                    let occurrenceToSpliceIdx;
                    let occurrenceToAddCompRefs;
                    if(connectedToOccurence !== -1 || connectedToCompRefs !== -1){
                        if(connectedToOccurence !== -1){
                            occurrenceToSpliceIdx = isCurrentNormalEmote || (!isCurrentNormalEmote && !isOtherNormalEmote) ? connectedToOccurence : currentOccIdx;
                            occurrenceToAddCompRefs = isCurrentNormalEmote || (!isCurrentNormalEmote && !isOtherNormalEmote) ? occ : e.occurrences[connectedToOccurence];
                        }else{
                            occurrenceToSpliceIdx = isCurrentNormalEmote || (!isCurrentNormalEmote && !isOtherNormalEmote) ? connectedToCompRefs : currentOccIdx;
                            occurrenceToAddCompRefs = isCurrentNormalEmote || (!isCurrentNormalEmote && !isOtherNormalEmote) ? occ : e.occurrences[connectedToCompRefs];
                        }

                        const mainItem = allEmotesWithCompEmotesRefs[oldPlacementIdx].occurrences.splice(occurrenceToSpliceIdx, 1)[0];
                        if(!allEmotesWithCompEmotesRefs[newPlacementIdx].compRefs){
                            allEmotesWithCompEmotesRefs[newPlacementIdx].compRefs = {};
                        }
                        if(!allEmotesWithCompEmotesRefs[newPlacementIdx].compRefs[`${occurrenceToAddCompRefs.start}-${occurrenceToAddCompRefs.end}`]){
                            allEmotesWithCompEmotesRefs[newPlacementIdx].compRefs[`${occurrenceToAddCompRefs.start}-${occurrenceToAddCompRefs.end}`] = [];
                        }
                        
                        allEmotesWithCompEmotesRefs[newPlacementIdx].compRefs[`${occurrenceToAddCompRefs.start}-${occurrenceToAddCompRefs.end}`].push({
                            name: allEmotesWithCompEmotesRefs[oldPlacementIdx].name,
                            ...mainItem
                        });
                        if(allEmotesWithCompEmotesRefs[oldPlacementIdx].compRefs){
                            const compRefs = allEmotesWithCompEmotesRefs[oldPlacementIdx].compRefs[`${mainItem.start}-${mainItem.end}`];
                            if(compRefs){
                                delete allEmotesWithCompEmotesRefs[oldPlacementIdx].compRefs[`${mainItem.start}-${mainItem.end}`];
                                allEmotesWithCompEmotesRefs[newPlacementIdx].compRefs[`${occurrenceToAddCompRefs.start}-${occurrenceToAddCompRefs.end}`] = allEmotesWithCompEmotesRefs[newPlacementIdx].compRefs[`${occurrenceToAddCompRefs.start}-${occurrenceToAddCompRefs.end}`].concat(compRefs);
                            }
                        }
                    }

                    if(allEmotesWithCompEmotesRefs[oldPlacementIdx].compRefs && Object.keys(allEmotesWithCompEmotesRefs[oldPlacementIdx].compRefs).length === 0 && Object.getPrototypeOf(allEmotesWithCompEmotesRefs[oldPlacementIdx].compRefs) === Object.prototype){
                        delete allEmotesWithCompEmotesRefs[oldPlacementIdx].compRefs;
                    }
                    if(allEmotesWithCompEmotesRefs[oldPlacementIdx].occurrences.length <= 0)
                    {
                        allEmotesWithCompEmotesRefs.splice(oldPlacementIdx, 1);
                    }
                });
            });
        });
    });

    allEmotesWithCompEmotesRefs.forEach(emote => {
        const currentEmoteIdx = allEmotesWithCompEmotesRefs.indexOf(emote);
        emote.occurrences.forEach((occ, currentOccIdx) => {
            allEmotesWithCompEmotesRefs.forEach((e) => {
                //To other emote's occurrences or comp refs
                const connectedToCompRefs = e.occurrences.findIndex(ite => ite == e.occurrences.filter(oc => oc.start !== occ.start && oc.end !== occ.end).find(otherOcc =>
                    e.compRefs && e.compRefs[`${otherOcc.start}-${otherOcc.end}`] && 
                    e.compRefs[`${otherOcc.start}-${otherOcc.end}`].find((compRef) => occ.end === compRef.start - 2 || occ.start === compRef.end + 2)
                )); 
                if(connectedToCompRefs !== -1){
                    const compRefs = e.compRefs[`${e.occurrences[connectedToCompRefs].start}-${e.occurrences[connectedToCompRefs].end}`];
                    const compRefConnected = compEmotes.find(ce => compRefs.find(ref => ref.name === ce.name));  
                    if(!compRefConnected || compRefConnected.compPos !== undefined) return;
                }else{
                    return;
                }
                const emoteIdx = allEmotesWithCompEmotesRefs.indexOf(e); 

                const isCurrentNormalEmote = normalEmotesInMessage.find(e => e.name === allEmotesWithCompEmotesRefs[currentEmoteIdx].name);
                const isOtherNormalEmote = normalEmotesInMessage.find(e => e.name === allEmotesWithCompEmotesRefs[emoteIdx].name);
                const newPlacementIdx = isCurrentNormalEmote || (!isCurrentNormalEmote && !isOtherNormalEmote) ? currentEmoteIdx : emoteIdx;
                const oldPlacementIdx = isCurrentNormalEmote || (!isCurrentNormalEmote && !isOtherNormalEmote) ? emoteIdx : currentEmoteIdx;
                    
                let occurrenceToSpliceIdx;
                let occurrenceToAddCompRefs;
                if(connectedToCompRefs !== -1){
                    occurrenceToSpliceIdx = isCurrentNormalEmote || (!isCurrentNormalEmote && !isOtherNormalEmote) ? connectedToCompRefs : currentOccIdx;
                    occurrenceToAddCompRefs = isCurrentNormalEmote || (!isCurrentNormalEmote && !isOtherNormalEmote) ? occ : e.occurrences[connectedToCompRefs];

                    const mainItem = allEmotesWithCompEmotesRefs[oldPlacementIdx].occurrences.splice(occurrenceToSpliceIdx, 1)[0];
                    if(!allEmotesWithCompEmotesRefs[newPlacementIdx].compRefs){
                        allEmotesWithCompEmotesRefs[newPlacementIdx].compRefs = {};
                    }
                    if(!allEmotesWithCompEmotesRefs[newPlacementIdx].compRefs[`${occurrenceToAddCompRefs.start}-${occurrenceToAddCompRefs.end}`]){
                        allEmotesWithCompEmotesRefs[newPlacementIdx].compRefs[`${occurrenceToAddCompRefs.start}-${occurrenceToAddCompRefs.end}`] = [];
                    }
                    
                    allEmotesWithCompEmotesRefs[newPlacementIdx].compRefs[`${occurrenceToAddCompRefs.start}-${occurrenceToAddCompRefs.end}`].push({
                        name: allEmotesWithCompEmotesRefs[oldPlacementIdx].name,
                        ...mainItem
                    });
                    if(allEmotesWithCompEmotesRefs[oldPlacementIdx].compRefs){
                        const compRefs = allEmotesWithCompEmotesRefs[oldPlacementIdx].compRefs[`${mainItem.start}-${mainItem.end}`];
                        if(compRefs){
                            delete allEmotesWithCompEmotesRefs[oldPlacementIdx].compRefs[`${mainItem.start}-${mainItem.end}`];
                            allEmotesWithCompEmotesRefs[newPlacementIdx].compRefs[`${occurrenceToAddCompRefs.start}-${occurrenceToAddCompRefs.end}`] = allEmotesWithCompEmotesRefs[newPlacementIdx].compRefs[`${occurrenceToAddCompRefs.start}-${occurrenceToAddCompRefs.end}`].concat(compRefs);
                        }
                    }
                }

                if(allEmotesWithCompEmotesRefs[oldPlacementIdx].compRefs && Object.keys(allEmotesWithCompEmotesRefs[oldPlacementIdx].compRefs).length === 0 && Object.getPrototypeOf(allEmotesWithCompEmotesRefs[oldPlacementIdx].compRefs) === Object.prototype){
                    delete allEmotesWithCompEmotesRefs[oldPlacementIdx].compRefs;
                }
                if(allEmotesWithCompEmotesRefs[oldPlacementIdx].occurrences.length <= 0)
                {
                    allEmotesWithCompEmotesRefs.splice(oldPlacementIdx, 1);
                }
            });
        });
    });

    console.log(allEmotesWithCompEmotesRefs);

    return allEmotesWithCompEmotesRefs;
}
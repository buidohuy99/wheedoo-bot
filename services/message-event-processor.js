const {returnError, returnMessage, postChatMessage} = require('../functions/post-message-function');
const {clearMessageSchedule, clearAllMessageSchedules} = require('../functions/message-schedule-function');

const emoteParser = require('../utils/tmi-emote-parse');
const redis = require('../utils/redis');

const chatMessageIsEmoteOnlyAndHasOnlyOneEmoteType = (message, userstate) => {
    const emoteDict = emoteParser.getEmotesWithOccurrences(message, userstate, process.env.TWITCH_CHANNEL);
    const emotes = Object.entries(emoteDict);
    if(emotes.length !== 1) return false;
    const emote = emotes[0];
    //Check if emote only
    for(let i = 0; i < emote[1].occurrences.length - 1; i++){
        const current = emote[1].occurrences[i];
        const next = emote[1].occurrences[i + 1];
        if(current.end + 2 !== next.start) return false;
    }
    if(emote[1].occurrences.length === 1 && (emote[1].occurrences[0].start !== 0 || emote[1].occurrences[0].end !== message.length - 1)) return false;
    return true;
}
 
module.exports = async (channel, userstate, message, self, client) => {
    toggle_emote_reaction = await redis.get('emote_reaction_toggle') === 'true';
    if(process.env.APP_ENV === 'dev') toggle_emote_reaction = true;

    switch(channel.toLowerCase().replace("#", "")){
        case process.env.TWITCH_USERNAME:
            if(process.env.APP_ENV != 'production') return;
            //#region messages from wheedoo channel
            if(userstate.username.toLowerCase() !== process.env.TWITCH_USERNAME) return;
            const prefix = message.substring(0, Math.min(1, message.length));
            if(prefix !== '!') return;

            const commandSeparatorLocation = message.indexOf(' ');
            const command = message.substring(0, commandSeparatorLocation < 0 ? message.length : commandSeparatorLocation);
            const argsString = commandSeparatorLocation < 0 ? '' : message.substring(commandSeparatorLocation + 1).trim();

            switch(command.replace('!','')){
                case 'message/schedule':
                    if(argsString.length <= 0) { returnError('Insufficient arguments: found 0 argument(s), requires 4 arguments (name - interval - timespan - message)', client); return; }
                    const indexOfFirstWhitespace = argsString.indexOf(' ');
                    
                    if(indexOfFirstWhitespace < 0) { returnError('Insufficient arguments: found 1 argument(s), requires 4 arguments (name - interval - timespan - message)', client); return; }
                    const messageName = argsString.substring(0, indexOfFirstWhitespace);
                    const indexOfSecondWhitespace = argsString.indexOf(' ', indexOfFirstWhitespace + 1);
                    
                    if(indexOfSecondWhitespace < 0) { returnError('Insufficient arguments: found 2 argument(s), requires 4 arguments (name - interval - timespan - message)', client); return; }
                    const scheduledInterval = argsString.substring(indexOfFirstWhitespace + 1, indexOfSecondWhitespace);
                    const indexOfThirdWhitespace = argsString.indexOf(' ', indexOfSecondWhitespace + 1);
                    
                    if(indexOfThirdWhitespace < 0) { returnError('Insufficient arguments: found 3 argument(s), requires 4 arguments (name - interval - timespan - message)', client); return; }
                    const scheduledTimeSpan = argsString.substring(indexOfSecondWhitespace + 1, indexOfThirdWhitespace);
                    const scheduledMessage = argsString.substring(indexOfThirdWhitespace + 1);
                    
                    if(message_schedules[messageName]){
                        returnError(`A schedule for \'${messageName}\' already exists, please schedule this message under a different name`, client); return; 
                    } 
                    if(isNaN(scheduledInterval) || scheduledInterval < 1.6 || scheduledInterval > 86400){
                        returnError(`Scheduled interval is not a number or is not within the value range of 1.6 seconds to 86400 seconds`, client); return; 
                    }
                    if(isNaN(scheduledTimeSpan) || scheduledTimeSpan < 10){
                        returnError(`Scheduled timespan is not a number or is shorter than 10 seconds`, client); return; 
                    }

                    let transformedMessage = scheduledMessage;
                    const concatMessage = () => transformedMessage = transformedMessage.concat(' \udb40\udc00');
                    const resetMessage = () => transformedMessage = scheduledMessage;
                    message_schedules[messageName] = setInterval(() => {
                        postChatMessage(transformedMessage, client);
                        concatMessage();
                    }, scheduledInterval * 1000);
                    reset_message_intervals[messageName] = setInterval(() => {
                        resetMessage();
                    }, 30000 + 250);
                    message_schedules_info[messageName] = {
                        interval: scheduledInterval,
                        timespan: scheduledTimeSpan,
                        message: scheduledMessage
                    };

                    setTimeout(() => {
                        clearMessageSchedule(messageName);
                        returnMessage(`\'${messageName}\' has ended its run successfully`, client);
                    }, scheduledTimeSpan * 1000 + 1000);
                    toggle_emote_reaction = false;
                    returnMessage(`Successfully schedules \'${messageName}\' with an interval of ${scheduledInterval} seconds`, client);
                    break;

                case 'message/unschedule':
                    if(argsString.length <= 0) { returnError('Insufficient arguments: found 0 argument(s)', client); return; }
                    if(!message_schedules[argsString]) { returnError(`Schedule named \'${argsString}\' cannot be found`, client); return; }
                    clearMessageSchedule(argsString);
                    toggle_emote_reaction = true;
                    returnMessage(`Successfully unschedules \'${argsString}\'`, client);
                    break;

                case 'messages/clear-all':
                    clearAllMessageSchedules();
                    toggle_emote_reaction = true;
                    returnMessage(`Successfully clears all message schedules`, client);
                    break;

                case 'message/enable-hydrate':
                    await redis.set('enable_sipping_toggle', (true).toString());
                    enableSipping = true;
                    returnMessage(`Successfully enables hydrate reminder`, client);
                    break;
                
                case 'message/disable-hydrate':
                    await redis.set('enable_sipping_toggle', (false).toString());
                    enableSipping = false;
                    returnMessage(`Successfully disables hydrate reminder`, client);
                    break;

                case 'emote-reaction/toggle':
                    toggle_emote_reaction = !toggle_emote_reaction;
                    await redis.set('emote_reaction_toggle', (toggle_emote_reaction).toString());
                    returnMessage(`Successfully ${toggle_emote_reaction ? "enables" : "disables"} emote reaction function`, client);
                    break;

                default:
                    returnError('Command cannot be identified', client);
                    break;
            }
            //#endregion
            break;
        case process.env.TWITCH_CHANNEL:
            messages_this_interval++;
            //#region pyramid evaluator
            const insertNewPyramidLine = (occurrences, emoteName) => {
                let near_last_idx = pyramid.length - 1;
                if((near_last_idx < 0 && occurrences.length === 1)
                ||near_last_idx >= 0){
                    pyramid.push(occurrences.length);
                }
                //Check if the newly inserted element is with in +-1 range
                if(near_last_idx >= 0){
                    const difference = Math.abs(pyramid[near_last_idx] - pyramid[near_last_idx + 1]);
                    if(difference !== 1){
                        const lastElement = pyramid[near_last_idx + 1];
                        if(lastElement === 1){
                            pyramid = [lastElement];
                        }else{
                            pyramid = [];
                            current_pyramid_maker = undefined;
                        }
                        return;
                    }
                }
                //Check if the current state pyramid is a proper pyramid
                if(pyramid.length % 2 === 0 || pyramid.length < 3) return;
                const mid = Math.floor(pyramid.length / 2);
                const pyramid_width = pyramid[mid];
                let leftPointer = mid - 1;
                let rightPointer = mid + 1;
                let isPyramidComplete = true;
                while(leftPointer >= 0 && rightPointer < pyramid.length){
                    if(pyramid[leftPointer] !== pyramid[rightPointer]){
                        isPyramidComplete = false;
                        break;
                    }
                    leftPointer--;
                    rightPointer++;
                }
                if(isPyramidComplete){
                    if(pyramid_width >= 3){
                        setTimeout(() => {
                            postChatMessage(`/me POGGIES UWAAA~, nice ${pyramid_width}-Width  ${emoteName}  pyramid attempt! HYPER`, client);
                        }, 1000); //Delay 1 sec before congrats message
                    }
                    const lastElement = pyramid[near_last_idx + 1];
                    if(lastElement === 1){
                        pyramid = [lastElement];
                    }else{
                        pyramid = [];
                        current_pyramid_maker = undefined;
                    }
                    return;
                }
            };
            if(chatMessageIsEmoteOnlyAndHasOnlyOneEmoteType(message, userstate)){
                const emotes = Object.entries(emoteParser.getEmotesWithOccurrences(message, userstate, process.env.TWITCH_CHANNEL));
                const emote = emotes[0];
                const {occurrences} = emote[1];
                if(userstate.username.toLowerCase() !== current_pyramid_maker){
                    pyramid = [];
                    current_pyramid_maker = occurrences.length === 1 ? userstate.username.toLowerCase() : undefined;
                }
                console.log(current_pyramid_maker);
                console.log(userstate.username.toLowerCase());
                if(current_pyramid_maker && userstate.username.toLowerCase() === current_pyramid_maker)
                {   
                    insertNewPyramidLine(occurrences, emote[0]);
                }
            }else{
                console.log("Pyramid interrupted by another message");
                pyramid = [];
                current_pyramid_maker = undefined;
            }
            console.log(pyramid);
            //#endregion
            //#region reaction when others mass react
            const chat_has_emotes = emoteParser.chatMessageContainsEmotes(message, userstate, process.env.TWITCH_CHANNEL);
            if(chat_has_emotes && pyramid.length < 2 && messages_per_ten_second !== undefined && toggle_emote_reaction){
                const emote_cooldown = messages_per_ten_second >= 3 ? 
                (messages_per_ten_second >= 5 ? (messages_per_ten_second >= 7 ? 30 : 45) : 90) : 120;

                const increase_emote_count = (emoteName) => {
                    const messageCount = current_spammed_messages[emoteName];
                    current_spammed_messages[emoteName] = messageCount > 0 ? (messageCount + 1) : 1;
                    const time_remaining = messages_per_ten_second > 5 ? emote_cooldown*1.2 : emote_cooldown * 1.5; 
                    if(!emote_reset_count_timeout[emoteName]){
                        const reset_count_interval = setInterval(() => {
                            emote_reset_count_timeout[emoteName].time_remaining--;
                            if(emote_reset_count_timeout[emoteName].time_remaining === 0){
                                clearInterval(emote_reset_count_timeout[emoteName].interval);
                                delete emote_reset_count_timeout[emoteName];
                                delete current_spammed_messages[emoteName];
                                delete emote_combinations[emoteName];
                                return;
                            }
                        }, 1000);
                        emote_reset_count_timeout[emoteName] = {
                            time_remaining: time_remaining,
                            interval: reset_count_interval
                        };
                    }else{
                        emote_reset_count_timeout[emoteName].time_remaining += time_remaining - emote_reset_count_timeout[emoteName].time_remaining;
                    }
                }
                const build_emote_combinations = (emote) => {
                    emote.occurrences.forEach((item) => {
                        const mainEmote = {
                            name: emote.name,
                            start: item.start,
                            end: item.end
                        }
                        if(!emote_combinations[emote.name]){
                            emote_combinations[emote.name] = new Set();
                        }
                        if(emote.compRefs && emote.compRefs[`${item.start}-${item.end}`])
                        {
                            const allEmotesArray = [mainEmote, ...emote.compRefs[`${item.start}-${item.end}`]];
                            console.log(allEmotesArray);
                            allEmotesArray.sort((a,b) => {return a.end - b.end;});
                            const resultingComb = allEmotesArray.map((item) => item.name).join(" ");
                            console.log("Resulting combination:" + resultingComb);
                            emote_combinations[emote.name].add(resultingComb); 
                        }else{
                            console.log("Resulting emote:" + emote.name);
                            emote_combinations[emote.name].add(emote.name);
                        }
                    });
                }
                const exec_cooldown_if_emote_count_enough = (emote, timeoutBeforePostingMessage, updateTimeoutBeforePostingMessage, client) => { 
                    const messagesBeforeReaction = messages_per_ten_second >= 3 ? 
                    (messages_per_ten_second >= 5 ? (messages_per_ten_second >= 7 ? 7 : 5) : 4) : 3; 
                    if(current_spammed_messages[emote.name] >= messagesBeforeReaction){
                        currently_on_cooldown_emotes[emote.name] = true;
                        clearInterval(emote_reset_count_timeout[emote.name].interval);
                        delete emote_reset_count_timeout[emote.name];
                        //Output all possible combinations typed
                        let timeout = timeoutBeforePostingMessage;
                        const emote_combs_itr = emote_combinations[emote.name].values();
                        let emote_comb = emote_combs_itr.next();
                        let emoteCombsWithTimeout = [];
                        while(!emote_comb.done){
                            const emoteComb = emote_comb.value;
                            emoteCombsWithTimeout.push({
                                comb: emoteComb,
                                timeout: timeout
                            });
                            timeout += 1300;
                            emote_comb = emote_combs_itr.next();
                        }
                        updateTimeoutBeforePostingMessage(timeout);
                        emoteCombsWithTimeout.forEach(item => setTimeout(() => postChatMessage(item.comb + ' \udb40\udc00', client), item.timeout));
                        delete emote_combinations[emote.name];
                        setTimeout(() => {
                            delete currently_on_cooldown_emotes[emote.name];
                            delete current_spammed_messages[emote.name];
                        }, emote_cooldown*1000);
                    }
                }

                const emotesToIncreaseCount = emoteParser.extractEmoteGroups(message, userstate, process.env.TWITCH_CHANNEL);
                //Order emote by order of appearance in message
                emotesToIncreaseCount.sort((emote1, emote2) => {return emote1.occurrences[0].end - emote2.occurrences[0].end});
                let timeoutBeforePostingMessage = 500;
                emotesToIncreaseCount.forEach((emote) => {
                    if(currently_on_cooldown_emotes[emote.name]){
                        return;
                    }
                    increase_emote_count(emote.name);
                    build_emote_combinations(emote);
                    exec_cooldown_if_emote_count_enough(emote, timeoutBeforePostingMessage, (newTimeout) => { timeoutBeforePostingMessage = newTimeout}, client);
                });
            }
            //#endregion
            break;
    }
}
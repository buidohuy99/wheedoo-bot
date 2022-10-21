const {returnError, returnMessage, postChatMessage} = require('../functions/post-message-function');
const {clearMessageSchedule, clearAllMessageSchedules} = require('../functions/message-schedule-function');

const emoteParser = require('../utils/tmi-emote-parse');

const chatMessageHasOnlyOneEmoteType = (message, userstate) => {
    const emotes = Object.entries(emoteParser.getEmotesWithOccurrences(message, userstate, process.env.TWITCH_CHANNEL));
    if(emotes.length !== 1) return false;
    return true;
}

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
 
module.exports = (channel, userstate, message, self, client) => {
    if(process.env.APP_ENV != 'production') return;

    switch(channel.toLowerCase().replace("#", "")){
        case process.env.TWITCH_USERNAME:
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
                    returnMessage(`Successfully schedules \'${messageName}\' with an interval of ${scheduledInterval} seconds`, client);
                    break;

                case 'message/unschedule':
                    if(argsString.length <= 0) { returnError('Insufficient arguments: found 0 argument(s)', client); return; }
                    if(!message_schedules[argsString]) { returnError(`Schedule named \'${argsString}\' cannot be found`, client); return; }
                    clearMessageSchedule(argsString);
                    returnMessage(`Successfully unschedules \'${argsString}\'`, client);
                    break;

                case 'messages/clear-all':
                    clearAllMessageSchedules();
                    returnMessage(`Successfully clears all message schedules`, client);
                    break;

                case 'message/enable-hydrate':
                    enableSipping = true;
                    returnMessage(`Successfully enables hydrate reminder`, client);
                    break;
                
                case 'message/disable-hydrate':
                    enableSipping = false;
                    returnMessage(`Successfully disables hydrate reminder`, client);
                    break;

                default:
                    returnError('Command cannot be identified', client);
                    break;
            }
            //#endregion
            break;
        case process.env.TWITCH_CHANNEL:
            //#region make pyramid
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
                        console.log(pyramid);
                        return;
                    }
                }
                console.log(pyramid);
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
                        postChatMessage(`/me POGGIES Nice ${pyramid_width}-Width  ${emoteName}  pyramid attempt~ elisSmile`, client);
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
                if(current_pyramid_maker && userstate.username.toLowerCase() === current_pyramid_maker)
                {   
                    insertNewPyramidLine(occurrences, emote[0]);
                }
            }else{
                pyramid = [];
                current_pyramid_maker = undefined;
            }
            //#endregion
            //#region reaction when others mass react
            if(chatMessageHasOnlyOneEmoteType(message, userstate) && pyramid.length < 2 && channel_live_status !== undefined){
                const emote_cooldown = channel_live_status && channel_viewer_count >= 3500 ? 25 : 30;
                const emotes = Object.entries(emoteParser.getEmotesWithOccurrences(message, userstate, process.env.TWITCH_CHANNEL));
                const emote = emotes[0];
                const emoteName = emote[0];
                if(currently_on_cooldown_emotes[emoteName]){
                    return;
                }
                const messageCount = current_spammed_messages[emoteName];
                current_spammed_messages[emoteName] = messageCount > 0 ? (messageCount + 1) : 1;
                if(!emote_reset_count_timeout[emoteName]){
                    const reset_count_interval = setInterval(() => {
                        emote_reset_count_timeout[emoteName].time_remaining--;
                        if(emote_reset_count_timeout[emoteName].time_remaining === 0){
                            clearInterval(emote_reset_count_timeout[emoteName].interval);
                            delete emote_reset_count_timeout[emoteName];
                            current_spammed_messages[emoteName] = 0;
                            return;
                        }
                    }, 1000);
                    emote_reset_count_timeout[emoteName] = {
                        time_remaining: (emote_cooldown - 5) - 1,
                        interval: reset_count_interval
                    };
                }else{
                    emote_reset_count_timeout[emoteName].time_remaining += (emote_cooldown - 5) - 1 - emote_reset_count_timeout[emoteName].time_remaining;
                }
                const messagesBeforeReaction = channel_live_status && channel_viewer_count >= 3500 ? 6 : 4; 
                if(current_spammed_messages[emoteName] >= messagesBeforeReaction){
                    currently_on_cooldown_emotes[emoteName] = true;
                    current_spammed_messages[emoteName] = 0;
                    clearInterval(emote_reset_count_timeout[emoteName].interval);
                    delete emote_reset_count_timeout[emoteName];
                    setTimeout(() => postChatMessage(emoteName + ' \udb40\udc00', client), 1000);
                    setTimeout(() => {
                        delete currently_on_cooldown_emotes[emoteName];
                        current_spammed_messages[emoteName] = 0;
                    }, emote_cooldown*1000);
                }
                
            }
            //#endregion
            break;
    }
}
const {returnError, returnMessage, postChatMessage} = require('../functions/post-message-function');

const {clearMessageSchedule, clearAllMessageSchedules} = require('../functions/message-schedule-function');

const emoteParser = require('../utils/tmi-emote-parse');

const chatMessageHasOnlyOneEmote = (message, userstate) => {
    const emotes = emoteParser.getEmotes(message, userstate, process.env.TWITCH_CHANNEL);
    if(emotes.length != 1) return false;
    return true;
}
 
module.exports = (channel, userstate, message, self, client) => {
    //if(process.env.APP_ENV != 'production') return;

    switch(channel.toLowerCase()){
        case '#wheedoo':
            //#region messages from wheedoo channel
            if(userstate.username.toLowerCase() !== 'wheedoo') return;
            const prefix = message.substring(0, Math.min(4, message.length));
            if(prefix !== 'UwU/') return;

            const commandSeparatorLocation = message.indexOf(' ');
            const command = message.substring(0, commandSeparatorLocation < 0 ? message.length : commandSeparatorLocation);
            const argsString = commandSeparatorLocation < 0 ? '' : message.substring(commandSeparatorLocation + 1).trim();

            switch(command.replace('UwU/','')){
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
        case '#tectone':
            //#region messages from tectone channel
            if(chatMessageHasOnlyOneEmote(message, userstate)){
                const emotes = emoteParser.getEmotes(message, userstate, process.env.TWITCH_CHANNEL);
                const emoteName = emotes[0].code;
                if(Object.entries(currently_on_cooldown_emotes).some(([key,]) => key === emoteName)){
                    current_spammed_messages[emoteName] = 0;
                    return;
                }
                const messageCount = current_spammed_messages[emoteName];
                current_spammed_messages[emoteName] = messageCount ? messageCount + 1 : 1;
                if(current_spammed_messages[emoteName] >= 3){
                    setTimeout(() => postChatMessage(emoteName + ' \udb40\udc00', client), 1000);
                    setTimeout(() => {
                        currently_on_cooldown_emotes[emoteName] = undefined;
                        current_spammed_messages[emoteName] = 0;
                    }, 30*1000);
                    currently_on_cooldown_emotes[emoteName] = true;
                    current_spammed_messages[emoteName] = 0;
                }
            }
            //#endregion
            break;
    }
}
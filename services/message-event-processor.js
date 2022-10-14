const returnError = (error, client) => {
    setTimeout(() => {
        client.say(process.env.TWITCH_USERNAME, `/me ${error}`);
    }, 1000);
}

const returnMessage = (message, client) => {
    setTimeout(() => {
        client.say(process.env.TWITCH_USERNAME, `/me ${message}`);
    }, 1000);
}

module.exports = (channel, userstate, message, self, client) => {
    if(process.env.APP_ENV != 'production') return;
    
    if(channel.toLowerCase() !== '#tectone') return;
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
            if(isNaN(scheduledInterval) || scheduledInterval < 2 || scheduledInterval > 86400){
                returnError(`Scheduled interval is not a number or is not within the value range of 2 seconds to 86400 seconds`, client); return; 
            }
            if(isNaN(scheduledTimeSpan) || scheduledTimeSpan < 10){
                returnError(`Scheduled timespan is not a number or is shorter than 10 seconds`, client); return; 
            }
            let message = scheduledMessage;
            const concatMessage = () => message = message.concat(' \udb40\udc00');
            message_schedules[messageName] = setInterval(() => {
                client.say(process.env.TWITCH_CHANNEL, message);
                concatMessage();
            }, scheduledInterval * 1000);
            setTimeout(() => {
                clearInterval(message_schedules[messageName]);
                message_schedules[messageName] = undefined;
                returnMessage(`\'${messageName}\' has ended its run successfully`, client);
            }, scheduledTimeSpan * 1000 + 1000);
            returnMessage(`Successfully schedules \'${messageName}\' with an interval of ${scheduledInterval} seconds`, client);
            break;

        case 'message/unschedule':
            if(argsString.length <= 0) { returnError('Insufficient arguments: found 0 argument(s)', client); return; }
            if(!message_schedules[argsString]) { returnError(`Schedule named \'${argsString}\' cannot be found`, client); return; }
            clearInterval(message_schedules[argsString]);
            message_schedules[argsString] = undefined;
            returnMessage(`Successfully unschedules \'${argsString}\'`, client);
            break;

        case 'messages/clear-all':
            Object.entries(message_schedules).forEach(([key, value]) => {
                clearInterval(value);
                message_schedules[key] = undefined;
            });
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
}
module.exports.returnError = (error, client) => {
    setTimeout(() => {
        client.say(process.env.TWITCH_USERNAME, `/me ${error}`);
    }, 1000);
}

module.exports.returnMessage = (message, client) => {
    setTimeout(() => {
        client.say(process.env.TWITCH_USERNAME, `/me ${message}`);
    }, 1000);
}

module.exports.postChatMessage = (message, client) => {
    if(last_message_timestamp && new Date().getTime() - last_message_timestamp < 1600) {
        this.returnError("Message will not be posted because it's a repetition", client);
        return;
    }
    last_message_timestamp = new Date().getTime();
    client.say(process.env.TWITCH_CHANNEL, message);
}

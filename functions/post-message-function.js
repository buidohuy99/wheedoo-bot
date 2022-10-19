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
    client.say(process.env.TWITCH_CHANNEL, message);
}

export const returnError = (error, client) => {
    setTimeout(() => {
        client.say(process.env.TWITCH_USERNAME, `/me ${error}`);
    }, 1000);
}

export const returnMessage = (message, client) => {
    setTimeout(() => {
        client.say(process.env.TWITCH_USERNAME, `/me ${message}`);
    }, 1000);
}

export const postChatMessage = (message, client) => {
    client.say(process.env.TWITCH_CHANNEL, message);
}

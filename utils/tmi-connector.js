import tmi from 'tmi.js';

// Setup connection configurations
// These include the channel, username and password
const client = new tmi.Client({
    options: { debug: true, messagesLogLevel: "info" },
    connection: {
        reconnect: true,
        secure: true
    },

    identity: {
        username: `${process.env.TWITCH_USERNAME}`,
        password: `${process.env.TWITCH_OAUTH}`
    },

    channels: [`${process.env.TWITCH_CHANNEL}`, `${process.env.TWITCH_USERNAME}`]
});

export default client;
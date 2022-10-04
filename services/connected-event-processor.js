const axios = require('../functions/auth-axios');

module.exports = (address, port, client) => {
    sippingInterval = setInterval(async () => {
        if(process.env.APP_ENV != 'production') return;
        
        const currentDate = new Date();
        if(currentDate.getMinutes() % 30 != 0) return;

        const {data: response} = await axios.get(process.env.TWITCH_API_URL + `/helix/streams?user_login=${process.env.TWITCH_CHANNEL}`);
        if(response.data && response.data.length != 0) return;

        client.say(process.env.TWITCH_CHANNEL, "eggySip Remember to keep yourself peepoHappy hydrated peepoHappy chat eggyDrink");
    }, 60000);
};
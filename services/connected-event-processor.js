const axios = require('./auth-axios');

module.exports = (address, port, client) => {
    sippingInterval = setInterval(async () => {
        if(process.env.APP_ENV != 'production') return;
        const {data: response} = await axios.get(process.env.TWITCH_API_URL + `/helix/streams?user_login=${process.env.TWITCH_CHANNEL}`);
        
        const currentDate = new Date();
        if(currentDate.getMinutes() % 30 != 0) return;
        if(response.data && response.data.length != 0) return;
        

        client.say(process.env.TWITCH_CHANNEL, "eggySip");
    }, 60000);
};
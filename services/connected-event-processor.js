const {axios_instance} = require('../utils/auth-axios');

module.exports = async (address, port, client) => {
    if(reconnectingToTwitch){
        await client.join(process.env.TWITCH_CHANNEL);
        await client.join(process.env.TWITCH_USERNAME);
        reconnectingToTwitch = false;
    }

    sippingInterval = setInterval(async () => {
        if(process.env.APP_ENV != 'production') return;
        if(!enableSipping) return;
        
        const currentDate = new Date();
        const {data: response} = await axios_instance.get(process.env.TWITCH_API_URL + `/helix/streams?user_login=${process.env.TWITCH_CHANNEL}`);

        if(currentDate.getMinutes() % 30 != 0) return;
        if(response.data && response.data.length != 0) return;

        client.say(process.env.TWITCH_CHANNEL, "eggySip Remember to keep yourself peepoHappy hydrated eggyDrink chat 💕");
    }, 60000);

    checkLiveInterval = setInterval(async() => {
        if(process.env.APP_ENV != 'production') return;
        const {data: response} = await axios_instance.get(process.env.TWITCH_API_URL + `/helix/streams?user_login=${process.env.TWITCH_CHANNEL}`);

        if(response.data && response.data.length != 0) {
            //Channel is live
            channel_live_status = true;
        }else if (response.data){
            //Channel is not live
            channel_live_status = false;
        }else{
            //Error
            channel_live_status = undefined;
        }
    }, 30*1000);
};
module.exports = (channel, userstate, message, self, client) => {
    if(process.env.APP_ENV != 'production') return;

    // Lack of this statement or it's inverse (!self) will make it in active
    if (self) return;

    const wordInString = (s, word) => new RegExp('\\b' + word + '\\b', 'i').test(s);

    const botnames = ['wheedoo', 'whee', 'wheed', 'wheedo'];

    //Check if message includes my name
    const lowercase = message.toLowerCase();

    if(botnames.some(q => wordInString(lowercase, q))){
        // if(['hi', 'hello', 'peepoHey', 'eggyYO'].some(q => wordInString(message, q))){
        //     client.say(channel, `@${userstate.username}, peepoHey eggyHug`);
        //     return;
        // }
    }
}
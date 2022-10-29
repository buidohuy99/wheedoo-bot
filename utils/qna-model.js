const tf = require('@tensorflow/tfjs');
const qna = require('@tensorflow-models/qna');
const memCache = require('./mem-cache');
const keyword_extractor = require('keyword-extractor').default;

let model;
(async() => {
    await tf.ready;
    model = await qna.load();
})();

module.exports.getAnswerToQuestion = async (question) => {
    await tf.ready();
    if(!model) throw Error("Qna model not found, not loaded");
    const keywords = keyword_extractor.extract(question, {
        language:"english",
        remove_digits: true,
        return_changed_case:true,
        remove_duplicates: false
    });
    let context = memCache.get(keywords[0]);
    if(context === undefined) memCache.set(keywords[0]);
    context = memCache.get(keywords[0]);
    let obj = context;
    for(let i = 1; i < keywords.length; i++){
        if(obj[keywords[i]] === undefined){
            obj[keywords[i]] = {};
            obj = obj[keywords[i]];
        }
    }
    console.log(context);
    

    const answers = await model.findAnswers(question, keywords[0]);

    return answers.length < 1 ? undefined : answers[0];
}
import bing from "bing-scraper";

export const getAnswerToQuestion = async (question, callback) => {

    const processResult = async (resp) => {
        let context = "";
        resp.results.forEach((searchRes) => {
            context = context.concat(context + "\r\n" + searchRes.title + " | " + searchRes.description);
        });
    };

    const searchRes = bing.search({
        q: question,
        enforceLanguage: true
    }, (err, resp) => {
        if(err){
            return undefined;
        }else{
            processResult(resp);
        }
    });
}
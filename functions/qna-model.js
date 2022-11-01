import {axios_instance} from '../utils/auth-axios.js'

export const getAnswerToQuestion = async (question, userid) => {
    const {data: response} = await axios_instance.get(`http://api.brainshop.ai/get?bid=${process.env.CHATBOT_BRAINID}&key=${process.env.CHATBOT_APIKEY}&uid=${userid}&msg=${question}`);
    return response.cnt;
}
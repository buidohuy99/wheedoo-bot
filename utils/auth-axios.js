const axios = require("axios").default;

const AuthAxios = axios.create({
    validateStatus : (status) => {
        return (status >= 200 && status < 300) || (status === 304);
    }
});

const updateTwitchAccessToken = async () => {
    try{
      const {data} = (await AuthAxios.post(process.env.TWITCH_TOKEN_URL + '/oauth2/token',
        'grant_type=refresh_token&'+
        `refresh_token=${process.env.TWITCH_REFRESH_TOKEN}&`+
        `client_id=${process.env.TWITCH_CLIENTID}&`+
        `client_secret=${process.env.TWITCH_CLIENTSECRET}`
      , {
        headers: {
            'Content-Type': "application/x-www-form-urlencoded",
        }
      }));
      twitch_access_token = data.access_token;
      return data.access_token;
    }catch(e){
      twitch_access_token = undefined;
      return null;
    }
}

const isUnAuthorizedError = (error) => {
    return error.config && error.response && error.response.status === 401;
}
  
const shouldRetry = (config) => {
    return config.retries.count < 3;
}

const default_request_interceptor = AuthAxios.interceptors.request.use(
    config => {
        let accessToken;
        const url = new URL(config.url);
        if(url.origin == process.env.TWITCH_API_URL){
            accessToken = twitch_access_token;
        }
        if (accessToken) {
            config.headers['Authorization'] = `Bearer ${twitch_access_token}`;
        }
        return config;
    },
    error => {
        return Promise.reject(error);
    }
);

const default_response_interceptor = AuthAxios.interceptors.response.use(
    (res) => {
      return res;
    },
    async (error) => {
        const url = new URL(error.config.url);
        error.config.retries = error.config.retries || { count: 0,};
        if (isUnAuthorizedError(error) && shouldRetry(error.config)) {
            let new_access; 
            if(url.origin == process.env.TWITCH_API_URL) new_access = await updateTwitchAccessToken(); // refresh the access token
            error.config.retries.count++;
            
            if(new_access){
                error.config.headers['Authorization'] = `Bearer ${new_access}`;
                if(url.origin == process.env.TWITCH_API_URL) error.config.headers['Client-Id'] = process.env.TWITCH_CLIENTID;
            }
            
            return AuthAxios.request(error.config); // if succeed in getting a new access token, re-fetch the original request with the updated accessToken
        }else if(isUnAuthorizedError(error) && !shouldRetry(error.config)){
            if(url.origin == process.env.TWITCH_API_URL) twitch_access_token = undefined;
        }
        
        return Promise.reject(error);
    }
);

module.exports.axios_instance = AuthAxios;

module.exports.refreshAccessToken = async() => await updateTwitchAccessToken();
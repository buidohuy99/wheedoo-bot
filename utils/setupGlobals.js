global.twitch_access_token = null;

global.reconnectingToTwitch = false;

global.channel_live_status = undefined;
global.channel_viewer_count = undefined;
global.checkLiveInterval = null;

global.sippingInterval = null;
global.enableSipping = true;

//#region message schedules
global.message_schedules = {};
global.reset_message_intervals = {};
global.message_schedules_info = {};
//#endregion

//#region tectone channel
global.currently_on_cooldown_emotes = {};
global.current_spammed_messages = {};
global.emote_reset_count_timeout = {};
global.emote_combinations = {};
global.toggle_emote_reaction = true;

global.pyramid = [];
global.current_pyramid_maker = undefined;

global.messages_this_interval = 0;
global.messages_per_ten_second = undefined;
let message_count_array = [];
const push_message_count = (message_count) => {
  message_count_array.push(message_count);
};
const clear_message_count_array = () => {
  message_count_array = [];
}
const message_count_interval = setInterval(() => {
  if(messages_per_ten_second === undefined && messages_this_interval > 0) {
    messages_per_ten_second = messages_this_interval;
  } 
  if(message_count_array.length < 6){
    push_message_count(messages_this_interval);
  }else{
    messages_per_ten_second = message_count_array.reduce((m, x, i) => m + (x - m) / (i + 1), 0);
    clear_message_count_array();
  }
  messages_this_interval = 0;
}, process.env.MESSAGE_COUNT_INTERVAL);
//#endregion
const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');

require('dotenv').config();

const redis = require("./utils/redis");

const app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

const {clearAllMessageSchedules} = require('./functions/message-schedule-function');

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

//Init redis global vars
(async() => {
  await redis.connect();

  const enable_sipping = await redis.get('enable_sipping_toggle');
  enableSipping = enable_sipping === undefined || enable_sipping === null ? true : enable_sipping;
  if(enable_sipping !== enableSipping) await redis.set('enable_sipping_toggle', enableSipping.toString());

  const emoteReaction = await redis.get('emote_reaction_toggle');
  toggle_emote_reaction = emoteReaction === undefined || emoteReaction === null ? true : emoteReaction;
  if(emoteReaction !== toggle_emote_reaction) await redis.set('emote_reaction_toggle', toggle_emote_reaction.toString());
})();

//Initialize tmi.js and connect
const twitch_chat_client = require("./utils/tmi-connector");
//Initialize tmi-emote-parser
require("./utils/tmi-emote-parse");
// We shall pass the parameters which shall be required
twitch_chat_client.on('connected', (address, port) => require('./services/connected-event-processor')(address, port, twitch_chat_client));
twitch_chat_client.on('chat', (channel, userstate, message, self) => require('./services/message-event-processor')(channel, userstate, message, self, twitch_chat_client));
twitch_chat_client.on('disconnected', (reason) => {
  console.error(reason);
  
  if(sippingInterval) {
    console.info('Ending sipping action');
    clearInterval(sippingInterval);
    sippingInterval = undefined;
  }

  if(checkLiveInterval) {
    console.info('Ending check live action');
    clearInterval(checkLiveInterval);
    checkLiveInterval = undefined;
  }

  clearAllMessageSchedules();
});
twitch_chat_client.on('reconnect', () => {
  reconnectingToTwitch = true;
});

app.use('/', require('./routes/index'));

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;

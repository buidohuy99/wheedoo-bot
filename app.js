const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');

require('dotenv').config();

const app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

const {clearAllMessageSchedules} = require('./functions/message-schedule-function');

global.twitch_access_token = null;

global.reconnectingToTwitch = false;

global.last_message_timestamp = undefined;

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

global.pyramid = [];
global.current_pyramid_maker = undefined;
//#endregion

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

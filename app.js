import createError from 'http-errors';
import cookieParser from 'cookie-parser';
import logger from 'morgan';

import './utils/load-dotenv.js';
import express from 'express';

import "./utils/setupGlobals.js";
import {clearAllMessageSchedules} from './functions/message-schedule-function.js';
import redis from "./utils/redis.js";
import twitch_chat_client from "./utils/tmi-connector.js";
import {connected_event_processor} from './services/connected-event-processor.js';
import {message_event_processor} from './services/message-event-processor.js';

import indexRouter from './routes/index.js'

const app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

//Init redis global vars
const enable_sipping = await redis.get('enable_sipping_toggle');
enableSipping = enable_sipping === undefined || enable_sipping === null ? true : enable_sipping;
if(enable_sipping !== enableSipping) await redis.set('enable_sipping_toggle', enableSipping.toString());

const emoteReaction = await redis.get('emote_reaction_toggle');
toggle_emote_reaction = emoteReaction === undefined || emoteReaction === null ? true : emoteReaction;
if(emoteReaction !== toggle_emote_reaction) await redis.set('emote_reaction_toggle', toggle_emote_reaction.toString());
console.log('++++ Finished Initializing redis');

//Initialize tmi.js and connect
// We shall pass the parameters which shall be required
twitch_chat_client.on('connected', (address, port) =>connected_event_processor(address, port, twitch_chat_client));
twitch_chat_client.on('chat', (channel, userstate, message, self) => message_event_processor(channel, userstate, message, self, twitch_chat_client));
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
twitch_chat_client.connect().catch(console.error);
console.log('++++ Finished Initializing tmi.js');

//Routers
app.use('/', indexRouter);
console.log('++++ Finished Initializing all endpoints of the application');

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

console.log('-OoO- Application COMPLETED initialization and can now be used -OoO-');

export default app;
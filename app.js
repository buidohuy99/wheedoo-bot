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

//Initialize tmi.js and connect
const twitch_chat_client = require('./services/tmi-connector');
global.sippingInterval = null;
global.twitch_access_token = null;

// We shall pass the parameters which shall be required
twitch_chat_client.on('connected', (address, port) => require('./services/connected-event-processor')(address, port, twitch_chat_client));
twitch_chat_client.on('chat', (channel, userstate, message, self) => require('./services/message-event-processor')(channel, userstate, message, self, twitch_chat_client));
twitch_chat_client.on('disconnected', (reason) => {
  if(sippingInterval) {
    console.info('Ending sipping action');
    clearInterval(sippingInterval);
    sippingInterval = undefined;
  }
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

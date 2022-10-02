const express = require('express');
const router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  const authorizationCodeTwitch = req.query.code;
  console.info(`New authorization code from TWITCH !!!!! : ${authorizationCodeTwitch}`);
  res.send(`Your twitch authorization code: ${authorizationCodeTwitch}`);
});

module.exports = router;

const fs = require('fs');
const path = require('path');
const NodeCache = require( "node-cache" );
const myCache = new NodeCache({checkperiod: 86400});

module.exports = myCache;


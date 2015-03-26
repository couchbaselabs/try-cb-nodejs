var express = require('express');
var app = express();
var config = require('./config');
var path = require('path');


app.use(express.static(path.join(__dirname, 'public')));
require('./routes/routes')(app);

app.listen(config.application.httpPort);

//// ▶▶ uncaught exception - DEBUG only ◀◀ ////
/*
 process.on('uncaughtException', function (err) {
 console.log('Caught exception: ' + err);
 });
 */
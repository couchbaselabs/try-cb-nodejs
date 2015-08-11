var express = require('express');
var app = express();
var config = require('./config');
var path = require('path');

app.use(express.static(path.join(__dirname, 'public')));
require('./routes/routes')(app);

app.listen(config.application.httpPort);

var http = require('http'),
    faye = require('faye');

var server = http.createServer(),
    bayeux = new faye.NodeAdapter({mount: '/faye', timeout: 45});

bayeux.attach(server);
server.listen(8000);

//// ▶▶ uncaught exception - DEBUG only ◀◀ ////
/*
 process.on('uncaughtException', function (err) {
 console.log('Caught exception: ' + err);
 });
 */

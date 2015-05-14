var db = require('./db');
var ottoman = require('ottoman');
ottoman.bucket = db.ODMBucket;

var FlightMdl = ottoman.model('Flight', {
    name: 'string',
    flight: 'string',
    date:'string',
    sourceairport:'string',
    destinationairport:'string',
    bookedon:'string'
});

module.exports=FlightMdl;

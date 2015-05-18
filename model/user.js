var db = require('./db');
var ottoman = require('ottoman');
ottoman.bucket = db.ODMBucket;
var Flight=require('./flight');

var UserMdl = ottoman.model('User', {
    name: 'string',
    password: 'string',
    token:'string',
    flights:'Mixed'
}, {
    index: {
        findByName: {
            type: 'refdoc',
            by: 'name'
        }
    }
});

UserMdl.prototype.addflights = function (newFlights, done) {
    if (typeof this.flights.length === 'undefined') {
        this.flights = [];
    }
    var curCount = 0;
    for (var i = 0; i < newFlights.length; i++,curCount++) {
        var curFlight = new Flight({
                                       name: newFlights[i]._data.name,
                                       flight: newFlights[i]._data.flight,
                                       date: newFlights[i]._data.date,
                                       sourceairport: newFlights[i]._data.sourceairport,
                                       destinationairport: newFlights[i]._data.destinationairport,
                                       bookedon:new Date().getTime().toString()
                                   });
        this.flights.push(curFlight);
    }
    if (curCount == (newFlights.length)) {
        done(null, curCount);
        return;
    }
    done("error", null);
}

module.exports=UserMdl;


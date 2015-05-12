var db = require('./db');
var ottoman = require('ottoman');
ottoman.bucket = db.ODMBucket;
var Flight=require('./flight');

var UserMdl = ottoman.model('User', {
    name: 'string',
    password: 'string',
    token:'string',
    flights:[Flight]
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
    console.log("debug:flights:", newFlights);
    var curCount = 0;
    for (var i = 0; i < newFlights.length; i++) {
        var curFlight = new Flight({
                                       name: newFlights[i]._data.name,
                                       flight: newFlights[i]._data.flight,
                                       date: newFlights[i]._data.date,
                                       sourceairport: newFlights[i]._data.sourceairport,
                                       destinationairport: newFlights[i]._data.destinationairport
                                   });
        this.flights.push(curFlight);
    }
    if (curCount = (newFlights.length - 1)) {
        done(null, curCount);
        return;
    }
    done("error", null);
}

module.exports=UserMdl;


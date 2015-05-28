var config = require('./../config');
var db = require('./db');
var haversine = require('haversine');

/**
 *
 * @param from
 * @param to
 * @param leave
 * @param ret
 * @param done
 */
module.exports.findAll = function (from, to, leave, done) {
    var queryPrep = "SELECT faa as fromAirport,geo FROM `" + config.couchbase.bucket + "` WHERE airportname = '" + from +
        "' UNION SELECT faa as toAirport,geo FROM `" + config.couchbase.bucket + "` WHERE airportname = '" + to + "'";
    db.query(queryPrep, function (err, res) {
        if (err) {
            done(err, null);
            return;
        }
        if (res) {
            var queryTo;
            var queryFrom;
            var geoStart;
            var geoEnd;
            var flightTime;
            var price;
            var distance;

            for (i = 0; i < res.length; i++) {
                if (res[i].toAirport) {
                    queryTo = res[i].toAirport;
                    geoEnd = {longitude: res[i].geo.lon, latitude: res[i].geo.lat};
                }
                if (res[i].fromAirport) {
                    queryFrom = res[i].fromAirport;
                    geoStart = {longitude: res[i].geo.lon, latitude: res[i].geo.lat};
                }
            }

            distance = haversine(geoStart, geoEnd);
            flightTime = Math.round(distance / config.application.avgKmHr);
            price = Math.round(distance * config.application.distanceCostMultiplier);

            queryPrep = "SELECT r.id, a.name, s.flight, s.utc, r.sourceairport, r.destinationairport, r.equipment " +
            "FROM `" + config.couchbase.bucket + "` r UNNEST r.schedule s JOIN `" +
            config.couchbase.bucket + "` a ON KEYS r.airlineid WHERE r.sourceairport='" + queryFrom +
            "' AND r.destinationairport='" + queryTo + "' AND s.day=" + convDate(leave) + " ORDER BY a.name";

            db.query(queryPrep, function (err, flightPaths) {
                if (err) {
                    done(err, null);
                    return;
                }
                if (flightPaths) {
                    var resCount = flightPaths.length;
                    for (r = 0; r < flightPaths.length; r++) {
                        resCount--;
                        flightPaths[r].flighttime = flightTime;
                        flightPaths[r].price = Math.round(price * ((100 - (Math.floor(Math.random() * (20) + 1))) / 100))

                        if (resCount == 0) {
                            done(null, flightPaths);
                            return;
                        }
                    }
                }
            });
        }
    });
}

/**
 *
 * @param dateStr
 * @returns {number}
 */
function convDate(dateStr){
    var d= new Date(Date.parse(dateStr));
    return parseInt(d.getDay())+1;
}

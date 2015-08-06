var db = require('./db');
var config = require('./../config');


/**
 *
 * @param queryStr
 * @param done
 */
module.exports.findAll = function (queryStr,user,done) {
    var queryPrep;
    if (queryStr.length == 3) {
        queryPrep = "SELECT airportname FROM `" + config.couchbase.bucket + "` WHERE faa ='" + queryStr.toUpperCase() + "'";
    } else if (queryStr.length == 4 && (queryStr==queryStr.toUpperCase()||queryStr==queryStr.toLowerCase())) {
        queryPrep = "SELECT airportname FROM `" + config.couchbase.bucket + "` WHERE icao ='" + queryStr.toUpperCase() + "'";
    } else {
        queryPrep = "SELECT airportname FROM `" + config.couchbase.bucket + "` WHERE airportname LIKE '" + queryStr + "%'";
    }

    db.query(queryPrep,user,function (err, res) {
        if (err) {
            done(err, null);
            return;
        }
        if (res) {
            done(null, res);
            return;
        }
    });
}


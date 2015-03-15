var db = require('./db');

/**
 *
 * @param queryStr
 * @param done
 */
module.exports.findAll = function (queryStr, done) {
    var queryPrep;
    if (queryStr.length == 3) {
        queryPrep = "SELECT airportname FROM default WHERE faa ='" + queryStr.toUpperCase() + "'";
    } else if (queryStr.length == 4 && (queryStr==queryStr.toUpperCase()||queryStr==queryStr.toLowerCase())) {
        queryPrep = "SELECT airportname FROM default WHERE icao ='" + queryStr.toUpperCase() + "'";
    } else {
        queryPrep = "SELECT airportname FROM default WHERE airportname LIKE '" + queryStr + "%'";
    }

    db.query(queryPrep, function (err, res) {
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

/**
 *
 * @param queryStr
 * @param done
 */
module.exports.findbycode = function (queryStr, done) {
    db.query( "SELECT faa FROM default WHERE airportname = '" + queryStr + "'", function (err, res) {
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
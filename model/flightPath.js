var db = require('./db');

/**
 *
 * @param from
 * @param to
 * @param leave
 * @param ret
 * @param done
 */
module.exports.findAll = function (from, to, leave,done) {
    var queryPrep = "SELECT faa as fromAirport FROM default WHERE airportname = '" + from +
        "' UNION SELECT faa as toAirport FROM default WHERE airportname = '" + to + "'";
    db.query(queryPrep, function (err, res) {
        if (err) {
            done(err, null);
            return;
        }
        if (res) {
            var queryTo;
            var queryFrom;
            for(i=0;i<res.length;i++){
                if(res[i].toAirport){
                    queryTo=res[i].toAirport;
                }
                if(res[i].fromAirport){
                    queryFrom=res[i].fromAirport;
                }
            }
            queryPrep="SELECT a.name, s.flight, s.utc, r.sourceairport, r.destinationairport, r.equipment FROM default r UNNEST r.schedule s JOIN default a ON KEYS r.airlineid WHERE r.sourceairport='" + queryFrom + "' AND r.destinationairport='" + queryTo + "' AND s.day=" + convDate(leave) + " ORDER BY a.name";
            db.query(queryPrep,function (err, flightPaths) {
                         if (err) {
                             done(err, null);
                             return;
                         }
                         if (flightPaths) {
                             done(null, flightPaths);
                             return;
                         }
                     }
            );
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
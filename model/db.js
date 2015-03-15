/**
 *
 * @type {exports}
 */
var couchbase = require('couchbase');
var endPoint = '192.168.41.101:8091';
var myCluster = new couchbase.Cluster(endPoint);
var myBucket = myCluster.openBucket('default');
var db=myBucket;

function reInit(){
    myBucket = myCluster.openBucket('default');
}

/**
 *
 * @param done
 */
module.exports.reset=function(done){
    var mgr=myBucket.manager('Administrator','password');
    mgr.flush(function(err,complete){
        if(err){
            done(err,null);
            return
        }
        done(null,{db:"flushed"});

    });
}

/**
 *
 * @param key
 * @param val
 * @param done
 */
module.exports.upsert = function (key, val, done) {
    db.upsert(key, val, function (err, res) {
        if (err) {
            console.log("DB.UPSERT:",key,":", err);
            done(err, null);
            return;
        }
        done(null, res);
    });
}

/**
 *
 * @param key
 * @param done
 */
module.exports.read = function (key, done) {
    db.get(key, function (err, result) {
        if (err) {
            console.log("DB.READ:", err);
            done(err, null);
            return;
        }
        done(null, result);
    });
}

/**
 *
 * @param key
 * @param done
 */
module.exports.delete = function (key, done) {
    db.delete(key, function (err, result) {
        if (err) {
            console.log("DB.DELETE:", err);
            done(err, null);
            return;
        }
        done(null, true);
    });
}

/**
 *
 * @param done
 */
module.exports.enableN1QL=function(done){
        db.enableN1ql('192.168.41.101:8093');
        done({n1ql:"enabled"});
    }

/**
 *
 * @param sql
 * @param done
 */
module.exports.query=function(sql,done){
    var N1qlQuery = couchbase.N1qlQuery;
    console.log("DEBUG:",sql);
    var query = N1qlQuery.fromString(sql);
    db.query(query,function(err,result){
        if (err) {
            done(err,null);
        }
        done(null,result);
    });
}


module.exports.endPoint=endPoint;
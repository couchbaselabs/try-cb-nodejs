/**
 *
 * @type {exports}
 */
var config = require('./../config');
var couchbase = require('couchbase');
var endPoint = config.couchbase.endPoint;
var bucket = config.couchbase.bucket;
var myCluster = new couchbase.Cluster(endPoint);
//var myBucket = myCluster.openBucket(bucket);
var db;
var http=require('http');
var request=require('request');

/**
 * 
 */
function init(done){
    console.log({init:"check"});
    request.get({
                    url:"http://" + config.couchbase.endPoint + "/pools/default/b/" + config.couchbase.bucket,auth: {
            'user': config.couchbase.user,
            'pass': config.couchbase.password,
            'sendImmediately': true
        }},function (err, response, body) {
        if(err){
            console.log({init:"not ready "+err});
            done(false);
            return;
        }
        if(response.statusCode==200){
                myBucket = myCluster.openBucket(bucket);
                db=myBucket;
                enableN1QL(function(){});
                console.log({init:"ready"+ response.statusCode});
                done(true);
                return;
        }
    });
}

function enableN1QL(done){
    db.enableN1ql(config.couchbase.n1qlService);
    done({n1ql:"enabled"});
}

init(function(){});

/**
 *
 * @param done
 */
module.exports.reset=function(done){
    var mgr=myBucket.manager(config.couchbase.user,config.couchbase.password);
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

/**
 *
 * @param sql
 * @param done
 */
module.exports.query=function(sql,done){
    var N1qlQuery = couchbase.N1qlQuery;
    if(config.couchbase.showQuery){
        console.log("QUERY:",sql);
    }
    var query = N1qlQuery.fromString(sql);
    db.query(query,function(err,result){
        if (err) {
            console.log("ERR:",err);
            done(err,null);
        }
        done(null,result);
    });
}

/**
 *
 * @param done
 */
module.exports.ops = function (done) {
    http.get("http://" + endPoint + "/pools/default/buckets/" + bucket, function (result) {
        var data = "";
        result.setEncoding('utf8');
        result.on('data', function (chunk) {
            data += chunk;
        });
        result.on('end', function () {
            var parsed = JSON.parse(data);
            done(null,Math.round(parsed.basicStats.opsPerSec));
            return;
        });
    });
}

/**
 *
 * @param done
 */



module.exports.endPoint=endPoint;
module.exports.bucket=bucket;
module.exports.init=init;

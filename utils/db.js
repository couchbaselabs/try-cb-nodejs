/**
 *
 * @type {exports}
 */
var config = require('./config');
var couchbase = require('couchbase');
var endPoint = config.couchbase.endPoint;
var bucket = config.couchbase.bucket;
var myCluster = new couchbase.Cluster(endPoint);
var myBucket=myCluster.openBucket(bucket);
var ODMBucket = myCluster.openBucket(bucket);
var db = myBucket;
var ottoman = require('ottoman');
var faye = require('faye');
var client = new faye.Client('http://localhost:8000/faye');

/**
 *
 * @param key
 * @param val
 * @param done
 */
function upsert(key, val, done) {
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
function read(key, done) {
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
function docDelete(key, done) {
    db.delete(key, function (err, result) {
        if (err) {
            console.log("DB.DELETE:", err);
            done(err, null);
            return;
        }
        done(null, true);
    });
}

function refreshExpiry(key, time, done) {
    db.touch(key, time, function(err, result) {
        if(err) {
            return done(err, null);
        }
        done(null, true);
    });
}

function sendMessage(channel, message) {
    if(config.couchbase.showQuery){
        if(channel){
            var publication = client.publish('/'+channel, {text: message},function(err,pubres){
                if(err){
                    console.log("ERR:",err);
                }
                if(pubres){
                    console.log("SUCCESS:",pubres);
                }
            });
        }
    }
}

/**
 *
 * @param sql
 * @param user
 * @param done
 */
function query(sql,user,done){

    // Init a channel
    var channel;

    // Check for only 2 parameters and if only 2 assign the callback correctly
    //   Otherwise, assign channel to the username passed in for publishing using Faye
    if(typeof done === "undefined"){
        done=user;
    }
    else{
        channel=user;
    }

    // Setup Query
    var N1qlQuery = couchbase.N1qlQuery;

    // Check if configured to show queries in console
    if(config.couchbase.showQuery){
        console.log("QUERY:",sql);
    }

    // publish to channel subscriber using faye
    if(channel){
        var publication = client.publish('/'+channel, {text: 'N1QL='+sql},function(err,pubres){
            if(err){
                console.log("ERR:",err);
            }
            if(pubres){
                console.log("SUCCESS:",pubres);
            }
        });
    }

    // Make a N1QL specific Query
    var query = N1qlQuery.fromString(sql);

    // Issue Query
    db.query(query,function(err,result){
        if (err) {
            console.log("ERR:",err);
            done(err,null);
            return;
        }
        done(null,result);
    });
}


/**
 *
 * @param done
 */

module.exports.ODMBucket=ODMBucket;
module.exports.endPoint=endPoint;
module.exports.bucket=bucket;
module.exports.query=query;
module.exports.delete=docDelete;
module.exports.read=read;
module.exports.upsert=upsert;
module.exports.refreshExpiry=refreshExpiry;
module.exports.sendMessage=sendMessage;

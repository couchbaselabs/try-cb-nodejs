/**
 *
 * @type {exports}
 */
var config = require('./../config');
var couchbase = require('couchbase');
var endPoint = config.couchbase.endPoint;
var bucket = config.couchbase.bucket;
var myCluster = new couchbase.Cluster(endPoint);
var ODMBucket;// = myCluster.openBucket(bucket);
var db;
var http=require('http');
var request=require('request');
var status="offline";  //offline,pending,online
var ottoman = require('ottoman');
var faye = require('faye');
var client = new faye.Client('http://localhost:8000/faye');
var ProgressBar = require('progress');
var barDone=false;
var bar = new ProgressBar('      LOADING [:bar] :percent :etas', {
    complete: '=',
    incomplete: ' ',
    total: 20
});


/**
 *
 */
function init(done) {
    // console.log("ENVIRONMENT: CHECK IF READY");
    if(config.application.verbose){
        console.log("VERBOSE:TRYING QUERY:","http://" + config.couchbase.n1qlService + "/query?statement=SELECT+name+FROM+system%3Akeyspaces")
    }
    request.get({
                    url: "http://" + config.couchbase.n1qlService + "/query?statement=SELECT+name+FROM+system%3Akeyspaces",
                    auth: {
                        'user': config.couchbase.user,
                        'pass': config.couchbase.password,
                        'sendImmediately': true
                    }
                }, function (err, response, body) {
        if (err) {
            console.log("    ENVIRONMENT: QUERY SERVICE",config.couchbase.n1qlService, "NOT RESPONDING");
            if (config.application.verbose) {
                console.log("↳ VERBOSE:ERR:", err);
            }
            done(false);
            return;
        }
        if (response.statusCode == 200) {
            if(config.application.verbose){
                console.log("↳ VERBOSE:QUERY SERVICE:UP");
                console.log("--VERBOSE:TRYING:ITEM COUNT","http://" + endPoint + "/pools/default/buckets/" + bucket)
            }
            request.get({
                            url: "http://" + endPoint + "/pools/default/buckets/" + bucket,
                            auth: {
                                'user': config.couchbase.user,
                                'pass': config.couchbase.password,
                                'sendImmediately': true
                            }
                        }, function (err, responseB, bodyB) {
                if (err) {
                    console.log("ENVIRONMENT: COUCHBASE",endPoint, "NOT RESPONDING");
                    if (config.application.verbose) {
                        console.log("--↳ VERBOSE:ERR", err);
                    }
                    done(false);
                    return;
                }
                if(responseB.statusCode!=404) {
                    if (parseInt(JSON.parse(bodyB).basicStats.itemCount) > config.couchbase.thresholdItemCount) {
                        myBucket = myCluster.openBucket(bucket);
                        db = myBucket;
                        ODMBucket = myCluster.openBucket(bucket);
                        ottoman.store.bucket = ODMBucket;
                        // console.log("ENVIRONMENT: SERVICES: CHECK INDEXES ONLINE");
                        query("CREATE INDEX temp ON `" + config.couchbase.bucket + "`(non) USING " + config.couchbase.indexType,
                              function (err, res) {
                                  if (err) {
                                      console.log("ENVIRONMENT: INDEX QUERY NOT RESPONDING");
                                      done(false);
                                      return;
                                  }
                                  if (res) {
                                      query('SELECT COUNT(*) FROM system:indexes WHERE state="online"',
                                            function (err, onlineCount) {
                                                if (err) {
                                                    console.log("ENVIRONMENT: INDEX QUERY NOT RESPONDING");
                                                    done(false);
                                                    return;
                                                }
                                                if (onlineCount) {
                                                    if(!config.application.autoprovision){
                                                        console.log("ENVIRONMENT: READY--LOGIN AT:","http://" + config.application.hostName + ":" + config.application.httpPort);
                                                    }
                                                    //console.log("ENVIRONMENT: SERVICES:","INDEXES ONLINE", onlineCount);
                                                    if (typeof onlineCount[0] !== "undefined") {
                                                        if (onlineCount[0].$1 == 1) {
                                                            query("DROP INDEX `" + config.couchbase.bucket + "`.temp USING " + config.couchbase.indexType,
                                                                  function (err, dropped) {
                                                                      if (err) {
                                                                          console.log("ENVIRONMENT: INDEX QUERY NOT RESPONDING");
                                                                          done(false);
                                                                          return;
                                                                      }
                                                                      if (dropped && status != "online") {
                                                                          status = "online";
                                                                          //console.log("ENVIRONMENT: ONLINE");
                                                                          done(true);
                                                                          return;
                                                                      }
                                                                  });
                                                        }
                                                    }
                                                }
                                            });
                                  }
                              });
                    } else {
                        if(!barDone) {
                            var ratio = (parseInt(JSON.parse(bodyB).basicStats.itemCount) / config.couchbase.thresholdItemCount);
                            if (ratio < .97) {
                                bar.update(ratio);
                            } else {
                                barDone=true;
                                bar.update(1);
                                //bar.terminate();
                            }
                        }
                        if (config.application.verbose) {
                            console.log("--↳ VERBOSE:ERR:ITEM COUNT", JSON.parse(bodyB).basicStats.itemCount);
                        }

                        done(false);
                        return;
                    }
                } else {
                    console.log("ENVIRONMENT: BUCKET",bucket,"REST SERVICE NOT PROVISIONED");
                    if (config.application.verbose) {
                        console.log("--↳ VERBOSE:ERR:ITEM COUNT:404 Resource not found.");
                    }
                    done(false);
                    return;
                }
            });
        }
    });
}

init(function(){});

/**
 *
 * @param done
 */
function reset(done){
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
        var publication = client.publish('/'+channel.replace(".","_"), {text: 'N1QL='+sql},function(err,pubres){
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
        return;
    });
}

/**
 *
 * @param done
 */
function ops(done) {
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

module.exports.ODMBucket=ODMBucket;
module.exports.endPoint=endPoint;
module.exports.bucket=bucket;
module.exports.init=init;
module.exports.query=query;
module.exports.reset=reset;
module.exports.ops=ops;
module.exports.delete=docDelete;
module.exports.read=read;
module.exports.upsert=upsert;
module.exports.refreshExpiry=refreshExpiry;
module.exports.sendMessage=sendMessage;

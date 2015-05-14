/**
 *
 * @type {exports}
 */
var config = require('./../config');
var couchbase = require('couchbase');
var endPoint = config.couchbase.endPoint;
var bucket = config.couchbase.bucket;
var myCluster = new couchbase.Cluster(endPoint);
var ODMBucket = myCluster.openBucket(bucket);
var db;
var http=require('http');
var request=require('request');
var status="offline";  //offline,pending,online

/**
 * 
 */
function init(done) {
    console.log({init: "check"});
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
            console.log({init: "not ready"});
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
                    console.log({init: "not ready"});
                    if (config.application.verbose) {
                        console.log("--↳ VERBOSE:ERR", err);
                    }
                    done(false);
                    return;
                }
                if (parseInt(JSON.parse(bodyB).basicStats.itemCount) > 31619) {
                    myBucket = myCluster.openBucket(bucket);
                    db = myBucket;
                    enableN1QL(function () {
                    });
                    query("CREATE INDEX temp ON `" + config.couchbase.bucket + "`(non) USING " + config.couchbase.indexType,
                          function (err, res) {
                              if (err) {
                                  console.log({init: "not ready"})
                                  done(false);
                                  return;
                              }
                              if (res) {
                                  query('SELECT COUNT(*) FROM system:indexes WHERE state="online"',
                                        function (err, onlineCount) {
                                            if (err) {
                                                console.log({init: "not ready"})
                                                done(false);
                                                return;
                                            }
                                            if (onlineCount) {
                                                console.log("INDEXES ONLINE:", onlineCount);
                                                if (typeof onlineCount[0] !== "undefined") {
                                                    if (onlineCount[0].$1 == 1) {
                                                        query("DROP INDEX `" + config.couchbase.bucket + "`.temp USING " + config.couchbase.indexType,
                                                              function (err, dropped) {
                                                                  if (err) {
                                                                      console.log({init: "not ready"})
                                                                      done(false);
                                                                      return;
                                                                  }
                                                                  if (dropped && status != "online") {
                                                                      status = "online";
                                                                      console.log({init: "ready"});
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
                    console.log({init: "not ready"});
                    if (config.application.verbose) {
                        console.log("--↳ VERBOSE:ERR:ITEM COUNT", JSON.parse(bodyB).basicStats.itemCount);
                    }
                    done(false);
                    return;
                }
            });
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

/**
 *
 * @param done
 */

/**
 *
 * @param sql
 * @param done
 */
function query(sql,done){
    var N1qlQuery = couchbase.N1qlQuery;
    if(config.couchbase.showQuery){
        console.log("QUERY:",sql);
    }
    var query = N1qlQuery.fromString(sql);
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
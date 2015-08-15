
var active=false;
var available=false;
var online=false;
var timerActive;
var timerAvailable;
var timerOnline;
var config = require('./../../config');
var request=require('request');
var db=require('./../db');
var fs = require('fs');
var tryCount=0;
var checkInterval=config.application.checkInterval;
var ProgressBar = require('progress');
var barDone=false;
var bar = new ProgressBar('      CHECKING [:bar] :percent :etas', {
    complete: '=',
    incomplete: ' ',
    total: 20
});

/**
 *
 */
if(config.application.autoprovision){
    console.log(" ⇒ AUTOPROVISION: INITIATED");
    instanceExists(function(exists){
        if(exists){
            console.log(" ⇐ AUTOPROVISION: ALREADY PROVISIONED. MOVING ON");
            console.log("LOGIN AT http://" + config.application.hostName + ":" + config.application.httpPort);
            return;
        }
        provisionCB(function(err,done){
            if(err){
                console.log("====----====");
                console.log("AUTOPROVISION: ERR:FATAL:",err);
                console.log("PLEASE CHECK config.js IS POINTING TO A VALID COUCHBASE INSTANCE");
                console.log("====----====");
                process.exit(9);
                return;
            }
            config.application.autoprovision=false;
            fs.writeFile('config.json', JSON.stringify(config,null,4),function(err){
                if(err){
                    console.log(" ⇐ AUTOPROVISION: ERR:FILESAVE:",err)
                }
            });
            console.log(" ⇐ AUTOPROVISION: DONE");
            console.log("LOGIN AT http://" + config.application.hostName + ":" + config.application.httpPort);
            return;
        });
    });

}


/**
 *
 * @param done
 */
function buidIndexes(done) {
    if (config.couchbase.indexType == 'view') {
        var indexesCB = ['faa', 'icao', 'city', 'airportname', 'type', 'sourceairport'];
        db.query('CREATE PRIMARY INDEX on `' + config.couchbase.bucket + '` USING ' + config.couchbase.indexType,
                 function (err, res) {
                 });
        db.query('CREATE INDEX def_name_type on `' + config.couchbase.bucket + "`(name) WHERE _type='User' USING " + config.couchbase.indexType,
                 function (err, res) {
                 });
        var cbCount = indexesCB.length - 1;
        for (var i = 0; i < indexesCB.length; i++) {
            var sql = ('CREATE INDEX def_' + indexesCB[i] + ' ON `' + config.couchbase.bucket + '`(' + indexesCB[i] + ') USING ' + config.couchbase.indexType);
            db.query(sql, function (err, res) {
                if (err) {
                    done({'err': "can't create index " + indexesCB[i] + err}, null);
                    return;
                }
                if (res) {
                    cbCount--;
                    if (cbCount == 0) {
                        console.log({'indexes': 'built'});
                        done(null, {'indexes': 'built'});
                        return;
                    }
                }
            });
        }
    }
    if (config.couchbase.indexType == 'gsi') {
        var buildStr = 'BUILD INDEX ON `' + config.couchbase.bucket + '`(def_primary,def_name_type';
        var indexesCB = ['faa', 'icao', 'city', 'airportname', 'type', 'sourceairport'];
        db.query('CREATE PRIMARY INDEX def_primary on `' + config.couchbase.bucket + '` USING ' + config.couchbase.indexType +
                 ' WITH{"defer_build":true}',
                 function (err, res) {
                 });
        db.query('CREATE INDEX def_name_type on `' + config.couchbase.bucket + "`(name) WHERE _type='User' USING " + config.couchbase.indexType +
                 ' WITH{"defer_build":true}',
                 function (err, res) {
                 });
        var cbCount = indexesCB.length - 1;
        for (var i = 0; i < indexesCB.length; i++) {
            var sql = ('CREATE INDEX def_' + indexesCB[i] + ' ON `' + config.couchbase.bucket + '`(' + indexesCB[i] + ') USING ' +
            config.couchbase.indexType + ' WITH{"defer_build":true}');
            buildStr += (',def_' + indexesCB[i]);
            db.query(sql, function (err, res) {
                if (err) {
                    done({'err': "can't create index " + indexesCB[i] + err}, null);
                    return;
                }
                if (res) {
                    cbCount--;
                    if (cbCount == 0) {
                        buildStr += ') USING GSI';
                        setTimeout(function () {
                            db.query(buildStr, function (err, indexBuilt) {
                                if (err) {
                                    done({'err': "can't build indexes " + err}, null);
                                }
                                if (indexBuilt) {
                                    isOnline(function(online){
                                        if(online){
                                            console.log("      PROVISION: INDEXES ONLINE");
                                            done(null, {'indexes': 'built'});
                                            return;
                                        }

                                    });
                                }
                            });
                        }, config.application.wait);
                    }
                }
            });
        }
    }
}


/**
 *
 * @param category
 * @param done
 */
function exists(category,done){
    if(raw[category]!=null){
        done(null,true);
        return;
    }
    done(true,null);
}

/**
 *
 * @param cutOff
 * @param done
 */
function isActive(cutOff,done) {
    timerActive = setInterval(function () {
        db.ops(function (err, ops) {
            if (err) {
                done(err, null);
                return;
            }
            if (ops < cutOff && !active) {
                clearInterval(timerActive);
                done(null, true);
                return;
            }
        });
    }, checkInterval);
}

/**
 *
 * @param done
 */
function isAvailable(done){
    tryCount=0;
    timerAvailable = setInterval(function () {
        if(tryCount==0) {
        console.log("      PROVISION: LOADING BUCKET", config.couchbase.bucket);
            ++tryCount;
            //console.log("  PROVISION: CHECKING IF INDEX SERVICE READY:ATTEMPT ", ++tryCount);
        }
        db.init(function(initialized){
            if(initialized && !available){
                available=true;
                clearInterval(timerAvailable);
                done(true);
                return;
            }
        });
    }, checkInterval);
}

/**
 *
 * @param done
 */
function isOnline(done){
    tryCount=0;
    timerOnline = setInterval(function () {
        if(tryCount == 0){
            console.log("      PROVISION: CHECKING IF INDEXES ARE ONLINE");
            ++tryCount
        }
        db.query('SELECT COUNT(*) FROM system:indexes WHERE state="online"', function(err,onlineCount){
            if(onlineCount){
                if(!barDone) {
                    bar.tick();
                }
                if(typeof onlineCount[0]!== "undefined") {
                    if (onlineCount[0].$1 == 8&&!online) {
                        bar.update(1);
                        barDone=true;
                        online=true;
                        clearInterval(timerOnline);
                        done(true);
                        return;
                    }
                }
            }
        });
    }, checkInterval);
}

function instanceExists(done) {
    console.log("    COUCHBASE INSTANCE:", config.couchbase.endPoint, "LOCATE");
    console.log("    COUCHBASE INSTANCE BUCKET:", config.couchbase.bucket,"CHECK IF PROVISIONED");
    request.get({
                    url: "http://" + config.couchbase.endPoint + "/pools/default/buckets/",
                    auth: {
                        'user': config.couchbase.user,
                        'pass': config.couchbase.password,
                        'sendImmediately': true
                    }
                }, function (err, responseB, bodyB) {
        if (err) {
            console.log("     COUCHBASE INSTANCE: NOT FOUND");
            done(false);
            return;
        }
        console.log("     COUCHBASE INSTANCE:", config.couchbase.endPoint,"LOCATED");
        bodyB=JSON.parse(bodyB);
        console.log("     COUCHBASE INSTANCE BUCKET COUNT:",bodyB.length,"LISTED BELOW");
        for (var i = 0; i < bodyB.length; i++) {
            console.log("      COUCHBASE INSTANCE BUCKET:", bodyB[i].name);
            if (bodyB[i].name == config.couchbase.bucket) {
                console.log("      COUCHBASE INSTANCE EXISTS:", config.couchbase.bucket,"PROVISIONED");
                done(true);
                return;
            }
        }
        console.log("      COUCHBASE INSTANCE EXISTS:", config.couchbase.bucket,"NOT PROVISIONED, CONTINUING");
        done(false);
    });
}


/**
 *
 * @param done
 */
function provisionInit(done) {
    var dataPath;
    var indexPath;
    if(config.couchbase.dataPath!=""){

    }
    else{
        if(process.platform=='darwin'){
            dataPath="/Users/" + process.env.USER + "/Library/Application Support/Couchbase/var/lib/couchbase/data";
        }else{
            dataPath="/opt/couchbase/var/lib/couchbase/data";
        }
    }
    if(config.couchbase.indexPath!=""){
        if(process.platform=='darwin'){
            indexPath="/Users/" + process.env.USER + "/Library/Application Support/Couchbase/var/lib/couchbase/data";
        }else{
            indexPath="/opt/couchbase/var/lib/couchbase/data";
        }
    }
    request.post({
                     url: 'http://'+ config.couchbase.endPoint + '/nodes/self/controller/settings',
                     form: {path: dataPath,
                         index_path:indexPath
                     }
                 }, function (err, httpResponse, body) {
        if(err){
            done(err,null);
            return;
        }
        console.log("      PROVISION INITIALIZE SERVICES",{'provisionInit':httpResponse.statusCode});
        done(null,httpResponse);

    });
}

/**
 *
 * @param done
 */
function provisionRename(done) {
    request.post({
                     url: 'http://'+ config.couchbase.endPoint+'/node/controller/rename',
                     form: {hostname: '127.0.0.1'
                     }
                 }, function (err, httpResponse, body) {
        if(err){
            done(err,null);
            return;
        }
        console.log("      PROVISION RENAMING",{'provisionRename':httpResponse.statusCode});
        done(null,httpResponse.statusCode);

    });
}

/**
 *
 * @param done
 */
function provisionServices(done) {
    request.post({
                     url: 'http://'+ config.couchbase.endPoint+'/node/controller/setupServices',
                     form: {services:'kv,n1ql,index'
                     }
                 }, function (err, httpResponse, body) {
        if(err){
            done(err,null);
            return;
        }
        console.log("      PROVISION SERVICE",{'provisionServices':httpResponse.statusCode});
        done(null,httpResponse.statusCode);

    });
}

function provisionMemory(done) {
    request.post({
                     url: 'http://'+ config.couchbase.endPoint+'/pools/default',
                     form: {indexMemoryQuota:config.couchbase.indexMemQuota,
                         memoryQuota:config.couchbase.dataMemQuota
                     }
                 }, function (err, httpResponse, body) {
        if(err){
            done(err,null);
            return;
        }
        console.log("      PROVISION MEMORY",{'provisionMemory':httpResponse.statusCode});
        done(null,httpResponse.statusCode);

    });
}


/**
 *
 * @param done
 */
function provisionAdmin(done) {
    request.post({
                     url: 'http://'+ config.couchbase.endPoint+'/settings/web',
                     form: {password:config.couchbase.password,
                         username:config.couchbase.user,
                         port:'SAME'
                     }
                 }, function (err, httpResponse, body) {
        if(err){
            done(err,null);
            return;
        }
        console.log("      PROVISION ADMIN USER",{'provisionAdmin':httpResponse.statusCode});
        done(null,httpResponse.statusCode);

    });
}

/**
 *
 * @param done
 */
function provisionBucket(done) {
    if(config.application.dataSource=="embedded"){
        request.post({
                         url: 'http://'+ config.couchbase.endPoint+'/sampleBuckets/install',
                         headers: {
                             'Content-Type': 'application/x-www-form-urlencoded'
                         },
                         form: JSON.stringify([config.couchbase.bucket]),
                         auth: {
                             'user': config.couchbase.user,
                             'pass': config.couchbase.password,
                             'sendImmediately': true
                         }
                     }, function (err, httpResponse, body) {
            if(err){
                done(err,null);
                return;
            }
            console.log("      PROVISION BUCKET",{'provisionBucket':httpResponse.statusCode});
            if(httpResponse.statusCode!=202){
                done(body,null);
            }
            done(null,httpResponse.statusCode);
        });
    }
}

/**
 *
 * @param done
 */
function provision(done) {
    provisionInit(function (err, init) {
        if (err) {
            done(err, null);
            return;
        }
        if (init) {
            provisionRename(function (err, rename) {
                if (err) {
                    done(err, null);
                    return;
                }
                if (rename) {
                    provisionServices(function (err, services) {
                        if (err) {
                            done(err, null);
                            return;
                        }
                        if (services) {
                            provisionMemory(function (err, mem) {
                                if (err) {
                                    done(err, null);
                                    return;
                                }
                                if (mem) {
                                    provisionAdmin(function (err, admin) {
                                        if (err) {
                                            done(err, null);
                                            return;
                                        }
                                        if (admin) {
                                            provisionBucket(function (err, bucket) {
                                                if (err) {
                                                    done(err, null);
                                                    return;
                                                }
                                                if (bucket) {
                                                    available = false;
                                                    isAvailable(function (ready) {
                                                        if (ready) {
                                                            console.log("      PROVISION: BUCKET", config.couchbase.bucket, "LOADED");
                                                            done(null, {'bucket': 'built'});
                                                            return;
                                                        }
                                                    });
                                                }
                                            });
                                        }
                                    });
                                }
                            });
                        }
                    });
                }
            });
        }
    });
}

/**
 *
 * @param done
 */
function provisionCB(done){
    provision(function(err,cluster){
        if(err){
            done(err,null);
            return;
        }
        if(cluster) {
            if (config.application.dataSource == "embedded") {
                buidIndexes(function (err, indexed) {
                    if (err) {
                        done(err, null);
                        return;
                    }
                    if (indexed) {
                        done(null, {"environment": "built"});
                        return;
                    }
                });
            }
        }
    });
}

module.exports.buildIndexes=buidIndexes;
module.exports.provision=provision;
module.exports.provisionCB=provisionCB;
module.exports.provisionBucket=provisionBucket;
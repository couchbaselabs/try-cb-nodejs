

var threshold=100;
var testInterval=5;
var currentCount=0;
var itemCount=0;
var active=false;
var available=false;
var online=false;
var timerBatch;
var timerActive;
var timerAvailable;
var timerOnline;
var config = require('./../../config');
var request=require('request');
var db=require('./../db');
var tryCount=0;
var checkInterval=config.application.checkInterval;

/**
 *
 * @param category
 * @param done
 */
function ingest(category, done) {
    raw = require('./rawJsonAir');
    exists(category,function(err,exists){
        if(err){
            console.log("ERR:",err);
            done({'err':category+" not valid"},null);
            return;
        }
        active=true;
        itemCount=raw[category].length-1;
        console.log({'category':category + ' load'});
        batch(category);
        isActive(5,function(err,idle){
            if(err){
                done({'err':category+" ingesting"},null);
                return;
            }
            if(idle){
                console.log({'category':category + ' loaded'});
                done(null,{'category':category});
                return;
            }
        })
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
        var buildStr = 'BUILD INDEX ON `' + config.couchbase.bucket + '`(def_primary';
        var indexesCB = ['faa', 'icao', 'city', 'airportname', 'type', 'sourceairport'];
        db.query('CREATE PRIMARY INDEX def_primary on `' + config.couchbase.bucket + '` USING ' + config.couchbase.indexType +
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
                                            console.log({'indexes': 'built'});
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
 * @param category
 */
function load(category){
    db.upsert((category=="routes")?"route_"+raw[category][itemCount].id:(category=="airlines")?
        "airline_"+raw[category][itemCount].id:"airport_"+raw[category][itemCount].id,
              (category=="routes")?buildSchedule(raw[category][itemCount].airline,raw[category][itemCount]):raw[category][itemCount],function(err,result){
        if(err){
            console.log("ERR:",err);
        }
        if(result && itemCount>0)
        {
            itemCount--;
            load(category);
        }else{
            currentCount--;
            if(currentCount==0){
                active=false;
            }
            //console.log("BUFFER DECREASE:",currentCount);
        }
    });
}

/**
 *
 * @param category
 */
function batch(category){
    timerBatch=setInterval(function () {
                          if (currentCount < threshold && active) {
                              // console.log("INCR:",currentCount);
                              currentCount++;
                              load(category);
                          } else {
                              clearInterval(timerBatch);
                              // console.log("TMR:STOPPED");
                          }
                      }, testInterval
    );
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
        console.log("CHECKING IF INDEX SERVICE READY:ATTEMPT ",++tryCount);
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
        console.log("CHECKING IF 7 INDEXES ARE ONLINE:ATTEMPT ",++tryCount);
        db.query('SELECT COUNT(*) FROM system:indexes WHERE state="online"', function(err,onlineCount){
            if(onlineCount){
                console.log("INDEXES ONLINE:",onlineCount);
                if(typeof onlineCount[0]!== "undefined") {
                    if (onlineCount[0].$1 == 7&&!online) {
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

/**
 *
 * @param low
 * @param high
 * @returns {number}
 */
function randomIntInc(low, high) {
    return Math.floor(Math.random() * (high - low + 1) + low);
}

/**
 *
 * @returns {string}
 */
function randomTime(){
    var hour = randomIntInc(0,23);
    if (hour<10) hour="0"+String(hour);
    var minute =randomIntInc(0,59);
    if (minute<10) minute="0"+String(minute);
    return hour+":"+minute+":"+"00"
}

/**
 *
 * @param airline
 * @returns {string}
 */
function randomFlightNum(airline){
    return airline + String(randomIntInc(0,9))+String(randomIntInc(0,9))+String(randomIntInc(0,9));
}

/**
 *
 * @param airline
 * @param doc
 * @returns {*}
 */
function buildSchedule(airline,doc) {
    var days = 7;  //Adds a schedule entry for at leat every day.
    var numFlightsDay=randomIntInc(1,5);
    for (var i = 1; i <=days; i++) {
        for (var j =1; j<=numFlightsDay;j++){
            doc.schedule.push({day:i,utc:randomTime(),flight:randomFlightNum(airline)});
        }
    }
    return doc;
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
        console.log({'provisionInit':httpResponse.statusCode});
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
        console.log({'provisionRename':httpResponse.statusCode});
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
        console.log({'provisionServices':httpResponse.statusCode});
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
        console.log({'provisionServices':httpResponse.statusCode});
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
        console.log({'provisionAdmin':httpResponse.statusCode});
        done(null,httpResponse.statusCode);

    });
}

/**
 *
 * @param done
 */
function provisionBucket(done) {
    if(config.application.dataSource=="repo"){
        request.post({
                         url: 'http://'+ config.couchbase.endPoint+'/pools/default/buckets',
                         form: {flushEnabled:'1',
                             threadsNumber:'3',
                             replicaIndex:'0',
                             replicaNumber:'0',
                             evictionPolicy:'valueOnly',
                             ramQuotaMB:'1024',
                             bucketType:'membase',
                             name:config.couchbase.bucket,
                             authType:'sasl',
                             saslPassword:null
                         },
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
            console.log({'provisionBucket':httpResponse.statusCode});
            done(null,httpResponse.statusCode);

        });
    }
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
            console.log({'provisionBucket':httpResponse.statusCode});
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
                                                            console.log({'bucket': 'built'});
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
function loadData(done){
    ingest("airports",function(err,airports){
        if(err){
            done(err,null);
            return;
        }
        if(airports){
            ingest("airlines",function(err,airlines){
                if(err){
                    done(err,null);
                    return;
                }
                if(airlines){
                    ingest("routes",function(err,routes){
                        if(err){
                            done(err,null);
                            return;
                        }
                        if(routes){
                            buidIndexes(function(err,indexed){
                                if(err){
                                    done(err,null);
                                    return;
                                }
                                if(indexed){
                                            console.log({'bucket':config.couchbase.bucket +' loaded'});
                                            done(null,{'bucket':'loaded'});
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
            if (config.application.dataSource == "repo") {
                loadData(function (err, loaded) {
                    if (err) {
                        done(err, null);
                        return;
                    }
                    if (loaded) {
                        done(null, {"environment": "built"});
                        return;
                    }
                });
            }
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

module.exports.ingest=ingest;
module.exports.buildIndexes=buidIndexes;
module.exports.provision=provision;
module.exports.loadData=loadData;
module.exports.provisionCB=provisionCB;
module.exports.provisionBucket=provisionBucket;


var threshold=100;
var testInterval=5;
var checkInterval=250;
var currentCount=0;
var itemCount=0;
var active=false;
var available=false;
var timerBatch;
var timerActive;
var timerAvailable;
var config = require('./../../config');
var request=require('request');
var db=require('./../db');

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
function buidIndexes(done){
    var indexesCB=['faa','icao','city','airportname','type','sourceairport'];
    db.query('CREATE PRIMARY INDEX on `' + config.couchbase.bucket + '` USING '+ config.couchbase.indexType,function(err,res){});
    var cbCount=indexesCB.length-1;
    for(var i=0; i<indexesCB.length; i++){
        var sql = ('CREATE INDEX def_' + indexesCB[i]+ ' ON `' + config.couchbase.bucket + '`('+indexesCB[i]+') USING ' + config.couchbase.indexType);
        db.query(sql,function(err,res){
            if(err){
                done({'err':"can't create index "+indexesCB[i]+ err},null);
            }
            if(res){
                cbCount--;
                if(cbCount==0){
                    console.log({'indexes':'built'});
                    done(null,{'indexes':'built'});
                }
            }
        });
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
    timerAvailable = setInterval(function () {
            request.get({
                            url:"http://" + config.couchbase.endPoint + "/pools/default/buckets/" + config.couchbase.bucket + "/stats",auth: {
                    'user': config.couchbase.user,
                    'pass': config.couchbase.password,
                    'sendImmediately': true
                }},function (err, response, body) {
                if(err){
                    return;
                }
                if(body && !available){
                    available=true;
                    if(JSON.parse(body).op.samplesCount=='60'){
                        clearInterval(timerAvailable);
                        done(true);
                        return;
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
                             ramQuotaMB:'597',
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
                console.log("DEBUG:",err);
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
        if(err){
            done(err,null);
            return;
        }
        if (init) {
            provisionRename(function (err, rename) {
                if(err){
                    done(err,null);
                    return;
                }
                if (rename) {
                    provisionServices(function (err, services) {
                        if(err){
                            done(err,null);
                            return;
                        }
                        if (services) {
                            provisionAdmin(function (err, admin) {
                                if(err){
                                    done(err,null);
                                    return;
                                }
                                if (admin) {
                                    provisionBucket(function (err, bucket) {
                                        if(err){
                                            done(err,null);
                                            return;
                                        }
                                        if(bucket){
                                           isAvailable(function(ready){
                                               if(ready){
                                                   console.log({'bucket':'built'});
                                                   done(null,{'bucket':'built'});
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
                                }
                            });
                        }
                    });
                }
            });
        }
    });
}
function flow (wait, done){
    console.log({"waiting":parseInt(wait)/1000+ ' seconds for bucket to finish provision'});
    setTimeout(function(){
        done(true);
    },wait);
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
        if(cluster){
            db.init(function(ready){
                if(err){
                    done(err,null);
                    return;
                }
                if(ready){
                    if(config.application.dataSource=="repo") {
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
                    if(config.application.dataSource=="embedded") {
                        flow(config.application.wait,function(waited){
                            if(waited){
                                db.init(function(waitedAgain) {
                                    if (waitedAgain) {
                                        buidIndexes(function(err,indexed){
                                            if(err){
                                                done(err,null);
                                                return;
                                            }
                                            if(indexed){
                                                done(null, {"environment": "built"});
                                                return;
                                            }
                                        });
                                    }
                                });
                            }
                        });
                    }
                }
            });
        }
    });
}

module.exports.ingest=ingest;
module.exports.buildIndexes=buidIndexes;
module.exports.provision=provision;
module.exports.loadData=loadData;
module.exports.provisionCB=provisionCB;
module.exports.provisionBucket=provisionBucket;
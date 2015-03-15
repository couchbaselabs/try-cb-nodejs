

var threshold=100;
var testInterval=5;
var currentCount=0;
var itemCount=0;
var raw;
var timer;
var db=require('./../db');


/**
 *
 * @param category
 * @param done
 */
module.exports.ingest=function(category, done) {
    raw = require('./rawJsonAir');
    exists(category,function(err,exists){
        if(err){
            done({'err':category+" not valid"},null);
            return;
        }
        itemCount=raw[category].length-1;
        batch(category);
        done(null,{'category':category});
    })
}

/**
 *
 * @param done
 */
module.exports.buildIndexes=function(done){
    var indexesCB=['faa','icao','city','airportname','type','sourceairport'];

    db.query('CREATE PRIMARY INDEX on default',function(err,res){});
    var cbCount=indexesCB.length-1;
    for(var i=0; i<indexesCB.length; i++){
        var sql = ('CREATE INDEX def_' + indexesCB[i]+ ' on default('+indexesCB[i]+')');
        db.query(sql,function(err,res){
            if(err){
                done({'err':"can't create index "+indexesCB[i]});
            }
            if(res){
                cbCount--;
                if(cbCount==0){
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
        done(null,true)
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
        raw[category][itemCount],function(err,result){
        if(err){
            console.log("ERR:",err);
        }
        if(result && itemCount>0)
        {
            itemCount--;
            load(category);
        }else{
            currentCount--;
            console.log("DECR:",currentCount);
        }
    });
}

/**
 *
 * @param category
 */
function batch(category){
    timer=setInterval(function () {
                          if (currentCount < threshold) {
                              console.log("INCR:",currentCount);
                              currentCount++;
                              load(category);
                          } else {
                              clearInterval(timer);
                              console.log("TMR:STOPPED");
                          }
                      }, testInterval
    );
}


//// ▶▶ require objects ◀◀ ////

var bodyParser = require('body-parser');
var http = require('http');
var db = require('../model/db');
var airport=require('../model/airport');
var flightPath=require('../model/flightPath');
var rawImport=require('../model/raw/rawImport');
db.enableN1QL(function(err,done){});

//// ▶▶ application/json parser ◀◀ ////
var jsonParser = bodyParser.json();

//// ▶▶ application/x-www-form-urlencoded parser ◀◀ ////
var urlencodedParser = bodyParser.urlencoded({ extended: false });

module.exports = function (app) {

    //// ▶▶ enable cors ◀◀ ////
    app.use(function(req, res, next) {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        next();
    });

    //// ▶▶ airports ◀◀ ////
    app.get('/api/airport/findAll',function(req,res) {
        if (req.query.search) {
            airport.findAll(req.query.search, function (err, done) {
                if (err) {
                    res.status = 400;
                    res.send(err);
                    return;
                }
                res.status = 202;
                res.send(done);
            });
        }else{
            res.status = 400;
            res.send({"airport":"bad request"});
            return;
        }
    });

    app.get('/api/airport/find/:id',function(req,res){

    });

    //// ▶▶ flightPath ◀◀ ////
    app.get('/api/flightPath/findAll',function(req,res){
        if(req.query.from && req.query.to && req.query.leave){
            flightPath.findAll(req.query.from, req.query.to,req.query.leave, function (err, done) {
                if (err) {
                    res.status = 400;
                    res.send(err);
                    return;
                }
                res.status = 202;
                res.send(done);
            });
        }else{
            res.status = 400;
            res.send({"flightPath":"bad request"});
            return;
        }
    });

    app.get('/api/flightPath/find/:id',function(req,res){

    });

    //// ▶▶ flight ◀◀ ////
    app.get('/api/flight/findall',function(req,res){

    });

    app.get('/api/flight/find/:id', function(req,res){

    });

    app.post('/api/flight/post/:id', function(req,res){

    });

    //// ▶▶ query ◀◀ ////
    app.get('/api/query/view/:ddoc/:view',function(req,res){
        var ViewQuery = couchbase.ViewQuery;
        var query = ViewQuery.from(req.params.ddoc,req.params.view);
        db.query(query,function(err,result){
            if (err) {
                res.send({error: err.message});
            }
            res.send(result);
        });
    });

    app.post('/api/query/view/buildView', function(req,res){
        var mgr=db.manager('Administrator','password');
        mgr.insertDesignDocument('usr-ddoc', {
            views: {
                'usr-history': {
                    map: function (doc, meta) {
                        if(doc.username){
                            emit(doc.username,new Date() );
                        }
                    }
                }
            }
        }, function(err) {
            if(err){
                res.send({error: err.message});
            }
            res.send({view:"built"});
        });
    });

    app.post('/api/query/n1ql/:state',function(req,res){
        if(req.params.state=="enable"){
            db.enableN1QL(function(){});
            res.send({n1ql:"enabled"});
        }
    });

    app.post('/api/query/n1ql',function(req,res){
        var N1qlQuery = couchbase.N1qlQuery;
        console.log("req.body:",req.body.query);
        query = N1qlQuery.fromString(req.body.query);
        db.query(query,function(err,result){
            if (err) {
                res.send({error: err.message});
            }
            res.send(result);
        });
    });

    //// ▶▶ status ◀◀ ////
    app.get('/api/status/nodes',function(req,res) {
        console.log("debug");
        http.get("http://"+ db.endPoint + "/pools/default/b/default", function (resp) {
            var data = "";
            resp.setEncoding('utf8');
            resp.on('data', function (chunk) {
                data += chunk;
            });
            resp.on('end', function () {
                var parsed = JSON.parse(data);
                res.send(parsed.nodesExt);
            });
        });
    });

   app.get('/api/status/ops', function(req,res) {
        http.get("http://" + db.endPoint + "/pools/default/buckets/default", function (result) {
            var data="";
            result.setEncoding('utf8');
            result.on('data', function (chunk) {
                data += chunk;
            });
            result.on('end',function(){
                var parsed=JSON.parse(data);
                res.status = 200;
                res.send({'ops': Math.round(parsed.basicStats.opsPerSec)});
            });
        });
    });

    app.post('/api/status/reset', function(req,res) {
        db.reset(function(err,done){
            if(err){
                res.status=400;
                res.send(err);
                return;
            }
            res.status=202;
            res.send(done);
        })
    });


    //// ▶▶ sampledata ◀◀ ////
    app.post('/api/raw/load/:type', function(req,res) {
        rawImport.ingest(req.params.type,function(err,done){
            if(err){
                res.status=400;
                res.send(err);
                return;
            }
            res.status=202;
            res.send(done);
        })
    });

    app.post('/api/raw/index', function(req,res) {
        rawImport.buildIndexes(function(err,done){
            if(err){
                res.status=400;
                res.send(err);
                return;
            }
            res.status=202;
            res.send(done);
        })
    });

    //CB Show and Tell POST create Index


    //CB Show and Tell POST populate


    //CB Show and Tell Post query

}

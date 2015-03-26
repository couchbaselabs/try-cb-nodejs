//// ▶▶ require objects ◀◀ ////

var bodyParser = require('body-parser');
var http = require('http');
var db = require('../model/db');
var airport=require('../model/airport');
var flightPath=require('../model/flightPath');
var rawImport=require('../model/raw/rawImport');
//db.enableN1QL(function(err,done){});

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

    //// ▶▶ status ◀◀ ////
    app.post('/api/status/build',function(req,res){
        rawImport.build(function(err,done){
            if(err){
                res.status=400;
                res.send(err);
                return;
            }
            res.status=202;
            res.send(done);
        })
    });

    //// ▶▶ debug endpoints -- Not Used For Production ◀◀ ////
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

    app.get('/api/status/ops', function(req,res) {
        db.ops(function(done){
            res.status = 200;
            res.send({'ops':done});
        });
    });

    app.get('/api/status/available',function(req,res){
        rawImport.available(function(done){
            res.status = 200;
            res.send({'available':done});
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

    app.post('/api/status/provision',function(req,res){
        rawImport.provision(function(err,done){
            if(err){
                res.status=400;
                res.send(err);
                return;
            }
            res.status=202;
            res.send(done);
        })
    });

    app.post('/api/status/load',function(req,res){
        rawImport.loadData(function(err,done){
            if(err){
                res.status=400;
                res.send(err);
                return;
            }
            res.status=202;
            res.send(done);
        })
    });


}

//// ▶▶ require objects ◀◀ ////

var bodyParser = require('body-parser');
var http = require('http');
var db = require('../model/db');
var airport=require('../model/airport');
var flightPath=require('../model/flightPath');
var rawImport=require('../model/raw/rawImport');
var auth=require('../model/auth.js');
var user=require('../model/user.js');
var jwt = require('jsonwebtoken');
var config = require('./../config');
var sec=config.application.hashToken;

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
            airport.findAll(req.query.search, jwt.decode(req.query.token).user,function (err, done) {
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
            flightPath.findAll(req.query.from, req.query.to,req.query.leave,jwt.decode(req.query.token).user, function (err, done) {
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

    //// ▶▶ create login ◀◀ ////
    app.post('/api/user/login',jsonParser,function(req,res){
        auth.createLogin(req.body.user,req.body.password,function(err,done){
            if(err){
                res.status=400;
                res.send(err);
                return;
            }
            res.status=202;
            res.send(done);
            return;
        });
    });

    //// ▶▶ login ◀◀ ////
    app.get('/api/user/login',urlencodedParser,function(req,res){
        auth.login(req.query.user,req.query.password,function(err,check){
            if(err){
                res.status=400;
                res.send(err);
                return;
            }
            if(check){
                res.status=202;
                res.send(check);
                return;
            }
        });
    });

    //// ▶▶ book flights ◀◀ ////
    app.post('/api/user/flights',jsonParser,function(req,res){
        auth.book(req.body.token,req.body.flights,function(err,done){
            if(err){
                res.status=400;
                res.send(err);
                return;
            }
            res.status=202;
            res.send({added:done});
            return;
        });
    });

    //// ▶▶ booked flights ◀◀ ////
    app.get('/api/user/flights',urlencodedParser,function(req,res){
        auth.booked(req.query.token,function(err,done){
            if(err){
                res.status=400;
                res.send(err);
                return;
            }
            res.status=202;
            res.send(done);
            return;
        });
    });

    //// ▶▶ provision ◀◀ ////
    app.post('/api/status/provisionCB',function(req,res){
        rawImport.provisionCB(function(err,done){
            if(err){
                res.status=400;
                res.send(err);
                return;
            }
            res.status=202;
            res.send(done);
            return;
        });
    });
}

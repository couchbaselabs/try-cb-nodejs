var db = require('./db');
var jwt = require('jsonwebtoken');
var config = require('./../config');
var User = require('./user.js');
var jwt = require('jsonwebtoken');
var sec=config.application.hashToken;

module.exports.createLogin = function (newUser,newPass,done) {
    // Check if user Exists
    newUser=newUser.toLowerCase();
    filterScan(newUser, function (filtcb) {
        if (filtcb) {
            User.findByName(newUser, function (err, user) {
                if(err){
                    // Error
                    done(err,null);
                    return;
                }
                if(user.length==0){
                    // Create user
                    var userNew = new User({
                        name:newUser,
                        password:newPass,
                        token:jwt.sign({user:newUser},sec),
                        flights:[]
                                           });
                    // Save User
                    userNew.save(function(err) {
                        if(err){
                            done(err,null);
                            return;
                        }
                        db.refreshExpiry("$User$name|" + userNew.name, 14400, function(error, result) {
                            db.refreshExpiry("User|" + userNew._id, 14400, function(error, result) {});
                            if(error) {
                                return done(error, null);
                            }
                            return done(null, {"success": userNew.token});
                        });
                    });
                }
                if(user.length>0){
                    // User Exists
                    done(null,{"failure":"User exists, please choose a different username"});
                    return;
                }
            });
        } else {
            // Word Violation
            done(null,{"failure":"Prohibited term, please choose a different username"});
            return;
        }
    });
}

module.exports.login=function(user,pass,done){
    User.findByName(user,function(err,found){
        if(err){
            // Error
            done(err,null);
            return;
        }
        if(found.length===0){
            // User not found
            done(null,{"failure":"Bad Username or Password"});
            return;
        }
        if(found.length===1){
            // User Found
            if(pass!=found[0].password){
                // Bad Password
                done(null,{"failure":"Bad Username or Password"});
                return;
            }else{
                done(null,{"success":found[0].token});
                return;
            }
        }
    })
}

module.exports.book=function(token,flights,done){
    User.findByName(jwt.decode(token).user,function(err,found){
        if(err){
            done(err,null)
        }
        if(found) {
            found[0].addflights(flights, function (err, count) {
                if (err) {
                    done("error adding flights", null);
                    return;
                }
                if (count) {
                    found[0].save(function (err) {
                        if (err) {
                            done(err, null);
                            return;
                        }
                        done(null, count);
                        return;
                    });
                }
            });
        }
    });

}

module.exports.booked =function(token,done){
    User.findByName(jwt.decode(token).user,function(err,found){
        if(err){
            done(err,null);
            return;
        }
        if(found) {
            done(null,found[0].flights);
            return;
            }else{
            done(null,"{}")
            return;
        }
    });
}

var filter = [];

function filterScan(term,done){
    for(var i=0; i<filter.length;i++){
        if(term.toLowerCase().indexOf(filter[i])!=-1){
            done(false);
            return
        }
    }
    done(true);
    return;
}

module.exports.isLoggedIn = function(token,done) {
    jwt.verify(token,sec,{ignoreExpiration:true},function(err,verified)
    {
        if(verfied){
            done(true);
        }
        done(false);
    });
    done(false);
}

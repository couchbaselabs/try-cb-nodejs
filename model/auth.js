var db = require('./db.js');
var jwt = require('jsonwebtoken');
var config = require('./../config');
var User = require('./user.js');
var jwt = require('jsonwebtoken');

var sec=config.application.hashToken;

module.exports.createLogin = function (newUser,newPass,done) {
    // Check if user Exists
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
                        token:jwt.sign({user:newUser},sec)
                                           });
                    // Save User
                    userNew.save(function(err) {
                        if(err){
                            done(err,null);
                            return;
                        }
                            done(null, {"success": userNew.token});
                            return;
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
            if(pass!=found.password){
                // Bad Password
                done(null,{"failure":"Bad Username or Password"});
                return;
            }else{
                done(null,{"success":found.token});
                return;
            }
        }
    })
}

var filter = ["put","banned","words","in","here"];

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


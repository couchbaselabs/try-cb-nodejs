var db = require('./db');
var ottoman = require('ottoman');
ottoman.bucket = db.ODMBucket;

var UserMdl = ottoman.model('User', {
    name: 'string',
    password: 'string',
    token:'string'
}, {
    index: {
        findByName: {
            type: 'refdoc',
            by: 'name'
        }
    }
});

module.exports=UserMdl;

'use strict';
var config = require('./config');
var request = require('request');
var fs = require('fs');

var checkInterval = config.application.checkInterval;

class cluster {
    constructor() {
        // local json object for Class properties.  ES6 does not
        //  include suport for class properties beyond setter/getters.
        //  The constructor instantiates a "config" and passes this
        //  through the provisioning process.

        var locals = {};
        locals.endPoint = config.couchbase.endPoint;
        locals.endPointQuery = config.couchbase.n1qlService;
        locals.hostName = config.couchbase.hostName;
        locals.sampleBucket = config.couchbase.bucket;
        locals.sampleBucketCount = config.couchbase.thresholdItemCount;
        locals.user = config.couchbase.user;
        locals.password = config.couchbase.password;
        locals.indexType = config.couchbase.indexType;
        locals.indexerStorageMode = config.couchbase.indexerStorageMode;
        locals.indexMemQuota = config.couchbase.indexMemQuota;
        locals.dataMemQuota = config.couchbase.dataMemQuota;
        locals.ftsMemQuota = config.couchbase.ftsMemQuota;
        locals.dataPath = config.couchbase.dataPath;
        locals.indexPath = config.couchbase.indexPath;
        locals.checkInterval = config.application.checkInterval;
        locals.finsihed = false;
        locals.currentCount = 0;
        locals.timerWait = "";

        this._locals = locals;
    }

    provision() {
        // Load locals to pass through provisioning sequence
        var locals = this.locals;

        // resolve path issues
        this._resolvePaths(locals);

        // Provision promise chain sequence.  Without binding "this",
        //  scope is not preserved from the caller each time a new
        //  promise is instantiated.  The final functional call is
        //  is bound to the calling scope to have access to the
        //  timer variable.
        this._verifyNodejsVersion(locals)
            .then(this._instanceExsists)
            .then(this._init)
            .then(this._rename)
            .then(this._storageMode)
            .then(this._services)
            .then(this._memory)
            .then(this._admin)
            .then(this._bucket)
            .then(this._loaded.bind(this))
            .then(this._finish.bind(this))
            .catch((err) => {
                console.log("ERR:", err)
            });
    }

    get locals() {
        return this._locals;
    }

    set _currentCount(count){
        this.locals.currentCount=count;
    }

    set finished(currentState) {
        this._locals.finished = currrentState;
    }

    _resolvePaths(locals) {
        // Check for custom datapath, otherwise assign to platform default
        if (locals.dataPath == "") {
            if (process.platform == 'darwin') {
                locals.dataPath = "/Users/" + process.env.USER +
                    "/Library/Application Support/Couchbase/var/lib/couchbase/data";
            } else {
                locals.dataPath = "/opt/couchbase/var/lib/couchbase/data";
            }
        }
        // Check for custom indexpath, otherwise assign to platform default
        if (locals.indexPath == "") {
            if (process.platform == 'darwin') {
                locals.indexPath = "/Users/" + process.env.USER +
                    "/Library/Application Support/Couchbase/var/lib/couchbase/data";
            } else {
                locals.indexPath = "/opt/couchbase/var/lib/couchbase/data";
            }
        }
    }

    _init(locals) {
        return new Promise(
            (resolve, reject) => {
                request.post({
                    url: 'http://' + locals.endPoint + '/nodes/self/controller/settings',
                    form: {
                        path: locals.dataPath,
                        index_path: locals.indexPath
                    }
                }, (err, httpResponse, body) => {
                    if (err) {
                        reject(err);
                    }
                    console.log("  PROVISION INITIALIZE SERVICES:", httpResponse.statusCode);
                    resolve(locals);
                });
            });
    }

    _rename(locals) {
        return new Promise(
            (resolve, reject) => {
                request.post({
                    url: 'http://' + locals.endPoint + '/node/controller/rename',
                    form: {
                        hostname: locals.hostName
                    }
                }, (err, httpResponse, body) => {
                    if (err) {
                        reject(err);
                    }
                    console.log("  PROVISION RENAMING:", httpResponse.statusCode);
                    resolve(locals);
                });
            });
    }

    _storageMode(locals) {
        return new Promise(
            (resolve, reject) => {
                request.post({
                    url: 'http://' + locals.endPoint + '/settings/indexes',
                    form: {
                        storageMode: locals.indexerStorageMode
                    }
                }, (err, httpResponse, body) => {
                    if (err) {
                        reject(err);
                    }
                    console.log("  PROVISION INDEX STORAGE MODE:", httpResponse.statusCode);
                    resolve(locals);
                });
            });
    }

    _services(locals) {
        return new Promise(
            (resolve, reject) => {
                var data = {
                    services: 'kv,n1ql,index'
                };

                if (locals.ftsMemQuota != "0") data["services"] += ",fts";

                request.post({
                    url: 'http://' + locals.endPoint + '/node/controller/setupServices',
                    form: data
                }, (err, httpResponse, body) => {
                    if (err) {
                        reject(err);
                    }
                    console.log("  PROVISION SERVICE:", httpResponse.statusCode);
                    resolve(locals);
                });
            });
    }

    _memory(locals) {
        return new Promise(
            (resolve, reject) => {
                var data = {
                    indexMemoryQuota: locals.indexMemQuota,
                    memoryQuota: locals.dataMemQuota
                };

                if (locals.ftsMemQuota != "0") data["ftsMemoryQuota"] = locals.ftsMemQuota;

                request.post({
                    url: 'http://' + locals.endPoint + '/pools/default',
                    form: data
                }, (err, httpResponse, body) => {
                    if (err) {
                        reject(err);
                    }
                    console.log("  PROVISION MEMORY:", httpResponse.statusCode);
                    resolve(locals);
                });
            });
    }

    _admin(locals) {
        return new Promise(
            (resolve, reject) => {
                request.post({
                    url: 'http://' + locals.endPoint + '/settings/web',
                    form: {
                        password: locals.password,
                        username: locals.user,
                        port: 'SAME'
                    }
                }, (err, httpResponse, body) => {
                    if (err) {
                        reject(err);
                    }
                    console.log("  PROVISION ADMIN USER:", httpResponse.statusCode);
                    resolve(locals);
                });
            });
    }

    _bucket(locals) {
        return new Promise(
            (resolve, reject) => {
                request.post({
                    url: 'http://' + locals.endPoint + '/sampleBuckets/install',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    form: JSON.stringify([locals.sampleBucket]),
                    auth: {
                        'user': locals.user,
                        'pass': locals.password,
                        'sendImmediately': true
                    }
                }, (err, httpResponse, body) => {
                    if (err) {
                        reject(err);
                    }
                    console.log("  PROVISION BUCKET:", httpResponse.statusCode);
                    if (httpResponse.statusCode == 202) {
                        resolve(locals);
                    }
                    reject(httpResponse.statusCode);
                });
            });
    }

    _instanceExsists(locals) {
        return new Promise(
            (resolve, reject) => {
                request.get({
                    url: "http://" + locals.endPoint + "/pools/default/buckets/",
                    auth: {
                        'user': locals.user,
                        'pass': locals.password,
                        'sendImmediately': true
                    }
                }, (err, httpResponse, body) => {
                    if (err) {
                        reject("COUCHBASE INSTANCE AT " + locals.endPoint + " NOT FOUND.");
                        return;
                    }
                    body = JSON.parse(body);
                    for (var i = 0; i < body.length; i++) {
                        if (body[i].name == locals.sampleBucket) {
                            reject("\n  This application cannot provision an already built cluster.\n" +
                                "    BUCKET:" + locals.sampleBucket + " on CLUSTER " +
                                locals.endPoint + " EXISTS\n  The cluster has not been modified.\n" +
                                "  To run the travel-sample application run 'npm start'");
                        }
                    }
                    resolve(locals);
                });
            });
    }

    _queryOnline() {
        return new Promise(
            (resolve, reject) => {
                request.get({
                    url: "http://" + this.endPointQuery + "/query?statement=SELECT+name+FROM+system%3Akeyspaces",
                    auth: {
                        'user': config.couchbase.user,
                        'pass': config.couchbase.password,
                        'sendImmediately': true
                    },
                    headers: {
                        Accept: 'application/json'
                    }
                }, (err, httpResponse, body) => {
                    if (err) {
                        reject(err);
                    }
                    if (response.statusCode == 200)
                        resolve(httpResponse.statusCode);
                });
            });
    }

    _itemCount() {
        return new Promise(
            (resolve, reject)=> {
                request.get({
                    url: "http://" + this.locals.endPoint + "/pools/default/buckets/" + this.locals.sampleBucket,
                    auth: {
                        'user': this.locals.user,
                        'pass': this.locals.password,
                        'sendImmediately': true
                    }
                }, (err, httpResponse, body) => {
                    if (err) {
                        resolve(false);
                        return;
                    }
                    if (parseInt(JSON.parse(body).basicStats.itemCount) > this.locals.sampleBucketCount) {
                        resolve(true);
                    }
                    else{
                        this._currentCount=parseInt(JSON.parse(body).basicStats.itemCount);
                        resolve(false);
                    }
                });
            });
    }

    _loaded() {
        return new Promise(
            (resolve, reject)=> {
                this.locals.timerLoop = setInterval(()=> {
                    this._itemCount().then((loaded)=> {
                        if (loaded) {
                            clearInterval(this.locals.timerLoop);
                            process.stdout.write("    LOADING ITEMS:100%  of " +this.locals.sampleBucketCount);
                            console.log("\n    BUCKET:", this.locals.sampleBucket, "LOADED.");
                            resolve("DONE");
                            return;
                        }
                        process.stdout.write("    LOADING ITEMS:" +
                            Math.round(100*(this.locals.currentCount/this.locals.sampleBucketCount))+ "%  of " +
                            this.locals.sampleBucketCount + "\r");
                    });
                }, this.locals.checkInterval);
            }
        );
    }

    _verifyNodejsVersion(locals) {
        return new Promise(
            (resolve, reject)=> {
                if (parseInt(((process.version).split("v"))[1].substr(0, 1)) < 4) {
                    reject("\n  The nodejs version is too low.  This application requires\n" +
                        "  ES6 features in order to provision a cluster, specifically: \n" +
                        "    --promises \n    --arrow functions \n    --classes \n" +
                        "  Please upgrade the nodejs version from:\n    --Current " +
                        process.version + "\n    --Minimum:4.0.0");
                } else resolve(locals);
            });
    }

    _finish() {
        return new Promise(
            (resolve, reject)=> {
                console.log("Cluster " + this.locals.endPoint + " provisioning complete. \n" +
                    "   To login to couchbase: open a browser " + this.locals.endPoint + "\n" +
                    "   To run the travel-sample application, run 'npm start'");
                resolve("ok");
            });
    }
}
var c = new cluster(config);
c.provision();

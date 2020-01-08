'use strict';

var bearerToken = require('express-bearer-token');
var bodyParser = require('body-parser');
var cors = require('cors');
var couchbase = require('couchbase');
var fts = require('couchbase/lib/searchquery');
var express = require('express');
var jwt = require('jsonwebtoken');
const uuidv4 = require('uuid/v4');

// Specify a key for JWT signing.
var JWT_KEY = 'IAMSOSECRETIVE!';

// Create a Couchbase Cluster connection
var cluster = new couchbase.Cluster('couchbase://10.112.195.101', {
  username: 'Administrator',
  password: 'password'
});

// Open a specific Couchbase bucket, `travel-sample` in this case.
var bucket = cluster.bucket('travel-sample');
// And select the default collection
var coll = bucket.defaultCollection();

// Open users bucket, with scope and specific collections
var userBucket = cluster.bucket("travel-users");
var userScope = userBucket.scope("userData");
var userColl = userScope.collection("users");
var flightColl = userScope.collection("flights");

// Set up our express application
var app = express();
app.use(cors());
app.use(bodyParser.json());

// Serve the public directory to the root of the web server.
app.use(express.static('public'));

function authUser(req, res, next) {
  bearerToken()(req, res, function() {
    // Temporary Hack to extract the token from the request
    req.token = req.headers.authorization.split(" ")[1]
    jwt.verify(req.token, JWT_KEY, function(err, decoded) {
      if (err) {
        res.status(400).send({
            error: 'Invalid JWT token',
            cause: err
        });
        return;
      }

      req.user = decoded;
      next();
    });
  });
}

app.get('/', function (req, res) {
  res.send('Hello World!');
});

app.get('/api/airports', async function(req, res) {
  var searchTerm = req.query.search;

  var qs;
  let sameCase = (searchTerm.toUpperCase() === searchTerm ||searchTerm.toLowerCase() === searchTerm)
  if (sameCase && searchTerm.length === 3) {
    // FAA code
    qs = "SELECT airportname from `travel-sample` WHERE faa = '" + searchTerm.toUpperCase() + "';";
  } else if (sameCase && searchTerm.length === 4) {
    // ICAO code
    qs = "SELECT airportname from `travel-sample` WHERE icao = '" + searchTerm.toUpperCase() + "';";
  } else {
    // Airport name
    qs = "SELECT airportname from `travel-sample` WHERE LOWER(airportname) LIKE '%" + searchTerm.toLowerCase() + "%';";
  }
  let result = await cluster.query(qs);
  let rows = result.rows;

  res.send({
    data: rows,
    context: [qs]
  });
});

app.get('/api/flightPaths/:from/:to', async function(req, res) {
  var fromAirport = req.params.from;
  var toAirport = req.params.to;
  var leaveDate = new Date(req.query.leave);

  var dayOfWeek = leaveDate.getDay();

  var qs1 =
      "SELECT faa AS fromAirport" +
      " FROM `travel-sample`" +
      " WHERE airportname = '" + fromAirport + "'" +
      " UNION" +
      " SELECT faa AS toAirport" +
      " FROM `travel-sample`" +
      " WHERE airportname = '" + toAirport + "';";

  let result = await cluster.query(qs1).catch(err => console.log(err));
  let rows = result.rows;

  if (rows.length !== 2) {
    res.status(404).send({
      error: "One of the specified airports is invalid.",
      context: [qs1]
    });
    return;
  }

  var fromFaa = rows[0].fromAirport || rows[1].fromAirport;
  var toFaa = rows[0].toAirport || rows[1].toAirport;

  var qs2 =
      " SELECT a.name, s.flight, s.utc, r.sourceairport, r.destinationairport, r.equipment" +
      " FROM `travel-sample` AS r" +
      " UNNEST r.schedule AS s" +
      " JOIN `travel-sample` AS a ON KEYS r.airlineid" +
      " WHERE r.sourceairport = '" + fromFaa + "'" +
      " AND r.destinationairport = '" + toFaa + "'" +
      " AND s.day = " + dayOfWeek +
      " ORDER BY a.name ASC;";

  result = await cluster.query(qs2);

  if (result.rows.length === 0) {
    res.status(404).send({
      error: "No flights exist between these airports.",
      context: [qs1, qs2]
    });
    return;
  }

  rows = result.rows

  for (var i = 0; i < rows.length; ++i) {
    rows[i].flighttime = Math.ceil(Math.random() * 8000);
    rows[i].price = Math.ceil(rows[i].flighttime / 8 * 100) / 100;
  }

  res.send({
    data: rows,
    context: [qs1, qs2]
  });
});

app.post('/api/user/login', function(req, res) {
  var user = req.body.user;
  var password = req.body.password;

  var userDocKey = user;

  userColl.get(userDocKey, function(err, doc) {
    if (err) {
      if (err === couchbase.errors.KEY_ENOENT) {
        res.status(401).send({
          error: 'User does not exist.'
        });
        return;
      }

      res.status(500).send({
        error: err
      });
      return;
    }

    if (doc.value.password !== password) {
      res.status(401).send({
        error: 'Password does not match.'
      });
      return;
    }

    var token = jwt.sign({
      user: user
    }, JWT_KEY);

    res.send({
      data: {
        token: token
      }
    });
  });
});

app.post('/api/user/signup', function(req, res) {
  var user = req.body.user;
  var password = req.body.password;

  var userDocKey = user;
  var userDoc = {
    name: user,
    password: password,
    flights: []
  };

  userColl.insert(userDocKey, userDoc, function(err, doc) {
    console.log(err)
    if (err) {
      if (err.code == 12) { // Key exists error
        res.status(409).send({
          error: 'User already exists.'
        });
        return;
      }

      res.status(500).send({
        error: err
      });
      return;
    }

    var token = jwt.sign({
      user: user
    }, JWT_KEY);

    res.send({
      data: {
        token: token
      },
      context: ['created document ' + userDocKey]
    });
  });
});

app.get('/api/user/:username/flights', authUser, function(req, res) {
  var username = req.params.username;

  if (username !== req.user.user) {
    res.status(401).send({
      error: 'Username does not match token username.'
    });
    return;
  }

  var userDocKey = username;
  userColl.get(userDocKey, async function(err, doc) {
    if (err) {
      if (err == couchbase.errors.KEY_ENOENT) {
        res.status(403).send({
          error: 'Could not find user.'
        });
        return;
      }

      res.status(500).send({
        error: err
      });
      return;
    }

    if (!doc.value.flights) {
      doc.value.flights = [];
    }

    let flights = []
    for(let flightID of doc.value.flights){
      let flight = await flightColl.get(flightID)
      flights.push(flight.value)
    }

    res.send({
      data: flights
    })
  });
});

app.post('/api/user/:username/flights', authUser, function(req, res) {
  var username = req.params.username;
  var flights = req.body.flights;

  if (username !== req.user.user) {
    res.status(401).send({
      error: 'Username does not match token username.'
    });
    return;
  }

  var userDocKey = username;
  userColl.get(userDocKey, function(err, doc) {
    if (err) {
      if (err == couchbase.errors.KEY_ENOENT) {
        res.status(403).send({
          error: 'Could not find user.'
        });
        return;
      }

      res.status(500).send({
        error: err
      });
      return;
    }

    if (!doc.value.flights) {
      doc.value.flights = [];
    }
    
    let flightIDs = [];
    for(let flight of flights){
      let ID = uuidv4()
      flightIDs.push(ID)
      flightColl.insert(ID, flight)
    }

    doc.value.flights  = doc.value.flights.concat(flightIDs);

    userColl.replace(userDocKey, doc.value, {cas:doc.cas}, function(err, result) {
      if (err) {
        res.status(500).send({
          error: err
        });
        return;
      }

      res.send({
        data: {
          added: flights
        },
        context: 'updated document ' + userDocKey
      })
    });
  });
});

app.get('/api/hotel/:description/:location?', function(req, res) {
  var description = req.params.description;
  var location = req.params.location;

  // FTS query

  var qp = fts.conjuncts([fts.term('hotel').field('type')]);

  if (location && location !== '*') {
    qp.and(fts.disjuncts(
        fts.match(location).field("country"),
        fts.match(location).field("city"),
        fts.match(location).field("state"),
        fts.match(location).field("address")
    ));
  }

  if (description && description !== '*') {
    qp.and(
        fts.disjuncts(
            fts.match(description).field("description"),
            fts.match(description).field("name")
        ));
  }

  // This syntax may be subject to change
  var q = new fts('hotels', qp)

  // Execute Query
  cluster.searchQuery(q, {limit: 100}, function(err, rows) {
    if (err) {
      res.status(500).send({
        error: err
      });
      return;
    }

    if (!rows.rows || rows.rows.length === 0) {
      res.send({
        data: [],
        context: []
      });
      return;
    }
    // Subdoc to get data from the hotels we found
    var fields = ['country', 'city', 'state', 'address', 'name', 'description']
    var results = [];
    var totalHandled = 0;
    for (var i = 0; i < rows.rows.length; ++i) {
      // Use function so subdoc ops run in parallel
      (function(row) {
        coll.lookupIn(row.id, fields.map(x => couchbase.LookupInSpec.get(x)), 
          function (err, docFrag) {
            if (totalHandled === -1) {
              return;
            }
            var doc = {}
            docFrag.results.forEach((field, i) => doc[fields[i]] = field.value)
            results.push(doc);
            totalHandled++;
            if (totalHandled >= rows.rows.length) {
              res.send({
                data: results,
                context: []
              });
            }
        });
      })(rows.rows[i]);
    }
  });
});

app.listen(8080, function () {
  console.log('Example app listening on port 8080!');
});

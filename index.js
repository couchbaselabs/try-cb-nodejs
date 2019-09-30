'use strict';

var bearerToken = require('express-bearer-token');
var bodyParser = require('body-parser');
var cors = require('cors');
var couchbase = require('couchbase');
var express = require('express');
var jwt = require('jsonwebtoken');

// Specify a key for JWT signing.
var JWT_KEY = 'IAMSOSECRETIVE!';

// Create a Couchbase Cluster connection
var cluster = new couchbase.Cluster('couchbase://localhost', {
  username: 'Administrator',
  password: 'password'
});

// Open a specific Couchbase bucket, `travel-sample` in this case.
var bucket = cluster.bucket('travel-sample');
// And select the default collection
var coll = bucket.defaultCollection();

// Set up our express application
var app = express();
app.use(cors());
app.use(bodyParser.json());

// Serve the public directory to the root of the web server.
app.use(express.static('public'));

function authUser(req, res, next) {
  bearerToken()(req, res, function() {
    // Temporary Hack to extract the token from the request
    req.token = req.headers.authentication.split(" ")[1]
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
  if (searchTerm.length === 3) {
    // FAA code
    qs = "SELECT airportname from `travel-sample` WHERE faa = '" + searchTerm.toUpperCase() + "';";
  } else if (searchTerm.length === 4 &&
      (searchTerm.toUpperCase() === searchTerm ||
        searchTerm.toLowerCase() === searchTerm)) {
    // ICAO code
    qs = "SELECT airportname from `travel-sample` WHERE icao = '" + searchTerm.toUpperCase() + "';";
  } else {
    // Airport name
    qs = "SELECT airportname from `travel-sample` WHERE LOWER(airportname) LIKE '%" + searchTerm.toLowerCase() + "%';";
  }

  let result = await coll.query(qs);
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

  let result = await coll.query(qs1).catch(err => console.log(err));
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

  result = await coll.query(qs2);

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

  var userDocKey = 'user::' + user;

  coll.get(userDocKey, function(err, doc) {
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

  var userDocKey = 'user::' + user;
  var userDoc = {
    name: user,
    password: password,
    flights: []
  };

  coll.insert(userDocKey, userDoc, function(err, doc) {
    if (err) {
      if (err === couchbase.errors.KEY_EEXISTS) {
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

  var userDocKey = 'user::' + username;
  coll.get(userDocKey, function(err, doc) {
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

    res.send({
      data: doc.value.flights
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

  var userDocKey = 'user::' + username;
  coll.get(userDocKey, function(err, doc) {
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

    doc.value.flights  = doc.value.flights.concat(flights);

    coll.replace(userDocKey, doc.value, {cas:doc.cas}, function(err, result) {
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

  var qp = couchbase.SearchQuery.conjuncts([couchbase.SearchQuery.term('hotel').field('type')]);

  if (location && location !== '*') {
    qp.and(couchbase.SearchQuery.disjuncts(
        couchbase.SearchQuery.match(location).field("country"),
        couchbase.SearchQuery.match(location).field("city"),
        couchbase.SearchQuery.match(location).field("state"),
        couchbase.SearchQuery.match(location).field("address")
    ));
  }

  if (description && description !== '*') {
    qp.and(
        couchbase.SearchQuery.disjuncts(
            couchbase.SearchQuery.match(description).field("description"),
            couchbase.SearchQuery.match(description).field("name")
        ));
  }

  var q = couchbase.SearchQuery.new('hotels', qp)
      .limit(100);

  coll.query(q, function(err, rows) {
    if (err) {
      res.status(500).send({
        error: err
      });
      return;
    }

    if (rows.length === 0) {
      res.send({
        data: [],
        context: []
      });
      return;
    }

    var results = [];

    var totalHandled = 0;
    for (var i = 0; i < rows.length; ++i) {
      (function(row) {
        coll.lookupIn(row.id)
            .get('country')
            .get('city')
            .get('state')
            .get('address')
            .get('name')
            .get('description')
            .execute(function (err, docFrag) {
              if (totalHandled === -1) {
                return;
              }

              var doc = {};

              try {
                doc.country = docFrag.content('country');
                doc.city = docFrag.content('city');
                doc.state = docFrag.content('state');
                doc.address = docFrag.content('address');
                doc.name = docFrag.content('name');
              } catch (e) { }

              // This is in a separate block since some versions of the
              //  travel-sample data set do not contain a description.
              try {
                doc.description = docFrag.content('description');
              } catch (e) { }

              results.push(doc);

              totalHandled++;

              if (totalHandled >= rows.length) {
                res.send({
                  data: results,
                  context: []
                });
              }
            });
      })(rows[i]);
    }
  });
});

app.listen(8080, function () {
  console.log('Example app listening on port 8080!');
});

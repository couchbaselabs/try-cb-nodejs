'use strict';

var bearerToken = require('express-bearer-token');
var bodyParser = require('body-parser');
var cors = require('cors');
var couchbase = require('couchbase');
var express = require('express');
var jwt = require('jsonwebtoken');

var JWT_KEY = 'IAMSOSECRETIVE!';

var cluster = new couchbase.Cluster('couchbase://localhost');
var bucket = cluster.openBucket('travel-sample');

var app = express();
app.use(cors());
app.use(bodyParser.json());

app.use(express.static('public'));

function authUser(req, res, next) {
  bearerToken()(req, res, function() {
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

app.get('/api/airports', function(req, res) {
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

  var q = couchbase.N1qlQuery.fromString(qs);
  bucket.query(q, function(err, rows) {
    if (err) {
      res.status(500).send({
        error: err
      });
      return;
    }

    res.send({
      data: rows,
      context: [qs]
    });
  });
});

app.get('/api/flightPaths/:from/:to', function(req, res) {
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
  var q = couchbase.N1qlQuery.fromString(qs1);
  bucket.query(q, function(err, rows) {
    if (err) {
      res.status(500).send({
        error: err,
        context: [qs1]
      });
      return;
    }

    if (rows.length !== 2) {
      res.status(404).send({
        error: "One of the specified airports is invalid.",
        context: [qs1]
      });
      return;
    }

    var toFaa = rows[0].toAirport;
    var fromFaa = rows[1].fromAirport;

    var qs2 =
        " SELECT a.name, s.flight, s.utc, r.sourceairport, r.destinationairport, r.equipment" +
        " FROM `travel-sample` AS r" +
        " UNNEST r.schedule AS s" +
        " JOIN `travel-sample` AS a ON KEYS r.airlineid" +
        " WHERE r.sourceairport = '" + fromFaa + "'" +
        " AND r.destinationairport = '" + toFaa + "'" +
        " AND s.day = " + dayOfWeek +
        " ORDER BY a.name ASC;";

    var q = couchbase.N1qlQuery.fromString(qs2);
    bucket.query(q, function(err, rows) {
      if (err) {
        res.status(500).send({
          error: err,
          context: [qs1, qs2]
        });
        return;
      }

      if (rows.length === 0) {
        res.status(404).send({
          error: "No flights exist between these airports.",
          context: [qs1, qs2]
        });
        return;
      }

      for (var i = 0; i < rows.length; ++i) {
        rows[i].flighttime = Math.ceil(Math.random() * 8000);
        rows[i].price = Math.ceil(rows[i].flighttime / 8 * 100) / 100;
      }

      res.send({
        data: rows,
        context: [qs1, qs2]
      });
    });
  })
});;

app.post('/api/user/login', function(req, res) {
  var user = req.body.user;
  var password = req.body.password;

  var userDocKey = 'user::' + user;

  bucket.get(userDocKey, function(err, doc) {
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

  bucket.insert(userDocKey, userDoc, function(err, doc) {
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
  bucket.get(userDocKey, function(err, doc) {
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
  bucket.get(userDocKey, function(err, doc) {
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

    bucket.replace(userDocKey, {cas: doc.cas}, doc.value, function(err, res) {
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

  var qp = couchbase.SearchQuery.conjuncts(couchbase.SearchQuery.term('hotel').field('type'));

  if (location && location !== '*') {
    qp.and(couchbase.SearchQuery.disjuncts(
        couchbase.SearchQuery.matchPhrase(location).field("country"),
        couchbase.SearchQuery.matchPhrase(location).field("city"),
        couchbase.SearchQuery.matchPhrase(location).field("state"),
        couchbase.SearchQuery.matchPhrase(location).field("address")
    ));
  }

  if (description && description !== '*') {
    qp.and(
        couchbase.SearchQuery.disjuncts(
            couchbase.SearchQuery.matchPhrase(description).field("description"),
            couchbase.SearchQuery.matchPhrase(description).field("name")
        ));
  }

  var q = couchbase.SearchQuery.new('hotels', qp)
      .limit(100);

  bucket.query(q, function(err, rows) {
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
        bucket.lookupIn(row.id)
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

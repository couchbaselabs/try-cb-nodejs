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
var cluster = new couchbase.Cluster(
  'couchbase://localhost',
  {
    username: 'Administrator',
    password: 'password'
  }
);

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
  bearerToken()(req, res, () => {
    // Temporary Hack to extract the token from the request
    req.token = req.headers.authentication.split(' ')[1];
    jwt.verify(req.token, JWT_KEY, (err, decoded) => {
      if (err) {
        res.status(400).send({
          error: 'Invalid JWT token',
          cause: err,
        });
        return;
      }

      req.user = decoded;
      next();
    });
  });
}

app.use((err, req, res, next) => {
  if (err) {
    res.status(500).send({
      error: err,
    });
    return;
  }

  next();
});

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.get('/api/airports', async (req, res) => {
  const searchTerm = req.query.search;

  let qs;
  if (searchTerm.length === 3) {
    // FAA code
    qs = `SELECT airportname from \`travel-sample\` WHERE faa = '${searchTerm.toUpperCase()}';`;
  } else if (
    searchTerm.length === 4 &&
    (searchTerm.toUpperCase() === searchTerm ||
      searchTerm.toLowerCase() === searchTerm)
  ) {
    // ICAO code
    qs = `SELECT airportname from \`travel-sample\` WHERE icao = '${searchTerm.toUpperCase()}';`;
  } else {
    // Airport name
    qs = `SELECT airportname from \`travel-sample\` WHERE LOWER(airportname) LIKE '%${searchTerm.toLowerCase()}%';`;
  }

  const result = await cluster.query(qs);
  const rows = result.rows;

  res.send({
    data: rows,
    context: [qs],
  });
});

app.get('/api/flightPaths/:from/:to', async (req, res) => {
  const fromAirport = req.params.from;
  const toAirport = req.params.to;
  const leaveDate = new Date(req.query.leave);

  const dayOfWeek = leaveDate.getDay();

  let qs1 = `
      SELECT faa AS fromAirport FROM \`travel-sample\` WHERE airportname = '${fromAirport}' 
      UNION 
      SELECT faa AS toAirport FROM \`travel-sample\` WHERE airportname = '${toAirport}';
    `;

  const result = await cluster.query(qs1);
  const rows = result.rows;
  if (rows.length !== 2) {
    res.status(404).send({
      error: 'One of the specified airports is invalid.',
      context: [qs1],
    });
    return;
  }

  const fromFaa = rows[0].fromAirport || rows[1].fromAirport;
  const toFaa = rows[0].toAirport || rows[1].toAirport;

  let qs2 = `
      SELECT a.name, s.flight, s.utc, r.sourceairport, r.destinationairport, r.equipment 
      FROM \`travel-sample\` AS r UNNEST r.schedule AS s 
      JOIN \`travel-sample\` AS a ON KEYS r.airlineid 
      WHERE r.sourceairport = '${fromFaa}' AND r.destinationairport = '${toFaa}' AND s.day = ${dayOfWeek} 
      ORDER BY a.name ASC;
    `;

  const result2 = await cluster.query(qs2);
  const rows2 = result2.rows;
  if (rows2.length === 0) {
    res.status(404).send({
      error: 'No flights exist between these airports.',
      context: [qs1, qs2],
    });
    return;
  }

  rows.forEach((row) => {
    row.flighttime = Math.ceil(Math.random() * 8000);
    row.price = Math.ceil((row.flighttime / 8) * 100) / 100;
  });

  res.send({
    data: rows,
    context: [qs1, qs2],
  });
});

app.post('/api/user/login', async (req, res) => {
  const user = req.body.user;
  const password = req.body.password;

  try {
    const userDocKey = 'user::' + user;
    const result = await coll.get(userDocKey);

    if (result.value.password !== password) {
      res.status(401).send({
        error: 'Password does not match.',
      });
      return;
    }

    const token = jwt.sign(
      {
        user: user,
      },
      JWT_KEY
    );

    res.send({
      data: {
        token: token,
      },
    });
  } catch (err) {
    if (err instanceof couchbase.errors.DocumentNotFoundError) {
      res.status(401).send({
        error: 'User does not exist.',
      });
      return;
    }

    throw err;
  }
});

app.post('/api/user/signup', async (req, res) => {
  const user = req.body.user;
  const password = req.body.password;

  try {
    const userDocKey = 'user::' + user;
    const userDoc = {
      name: user,
      password: password,
      flights: [],
    };

    await coll.insert(userDocKey, userDoc);

    const token = jwt.sign(
      {
        user: user,
      },
      JWT_KEY
    );

    res.send({
      data: {
        token: token,
      },
      context: ['created document ' + userDocKey],
    });
  } catch (err) {
    if (err instanceof couchbase.errors.DocumentExistsError) {
      res.status(409).send({
        error: 'User already exists.',
      });
      return;
    }

    throw err;
  }
});

app.get('/api/user/:username/flights', authUser, async (req, res) => {
  const username = req.params.username;

  if (username !== req.user.user) {
    res.status(401).send({
      error: 'Username does not match token username.',
    });
    return;
  }

  try {
    const userDocKey = 'user::' + username;
    const result = await coll.get(userDocKey);

    if (!result.content.flights) {
      result.content.flights = [];
    }

    res.send({
      data: result.content.flights,
    });
  } catch (err) {
    if (err instanceof couchbase.errors.DocumentNotFoundError) {
      res.status(403).send({
        error: 'Could not find user.',
      });
      return;
    }

    throw err;
  }
});

app.post('/api/user/:username/flights', authUser, async (req, res) => {
  const username = req.params.username;
  const flights = req.body.flights;

  if (username !== req.user.user) {
    res.status(401).send({
      error: 'Username does not match token username.',
    });
    return;
  }

  try {
    const userDocKey = 'user::' + username;
    const result = await coll.get(userDocKey);

    if (!result.content.flights) {
      result.content.flights = [];
    }

    result.content.flights = result.content.flights.concat(flights);

    await coll.replace(userDocKey, result.content, { cas: result.cas });

    res.send({
      data: {
        added: flights,
      },
      context: 'updated document ' + userDocKey,
    });
  } catch (err) {
    if (err instanceof couchbase.errors.DocumentNotFoundError) {
      res.status(403).send({
        error: 'Could not find user.',
      });
      return;
    }

    throw err;
  }
});

app.get('/api/hotel/:description/:location?', async (req, res) => {
  const description = req.params.description;
  const location = req.params.location;
  const qp = couchbase.SearchQuery.conjuncts([
    couchbase.SearchQuery.term('hotel').field('type'),
  ]);

  if (location && location !== '*') {
    qp.and(
      couchbase.SearchQuery.disjuncts(
        couchbase.SearchQuery.match(location).field('country'),
        couchbase.SearchQuery.match(location).field('city'),
        couchbase.SearchQuery.match(location).field('state'),
        couchbase.SearchQuery.match(location).field('address')
      )
    );
  }
  if (description && description !== '*') {
    qp.and(
      couchbase.SearchQuery.disjuncts(
        couchbase.SearchQuery.match(description).field('description'),
        couchbase.SearchQuery.match(description).field('name')
      )
    );
  }

  const result = await cluster.searchQuery('hotels', qp, { limit: 100 });
  const rows = result.rows;
  if (rows.length === 0) {
    res.send({
      data: [],
      context: [],
    });
    return;
  }

  const results = await Promise.all(
    rows.map(async (row) => {
      const doc = await coll.get(row.id, {
        project: [
          'type',
          'country',
          'city',
          'state',
          'address',
          'name',
          'description',
        ],
      });
      return doc.content;
    })
  );

  res.send({
    data: results,
    context: [],
  });
});

app.listen(8080, () => {
  console.log('Example app listening on port 8080!');
});

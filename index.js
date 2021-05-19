'use strict';

var bearerToken = require('express-bearer-token');
var cors = require('cors');
var couchbase = require('couchbase');
var express = require('express');
var jwt = require('jsonwebtoken');
const uuid = require( 'uuid')

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

// Set up our express application
var app = express();
app.use(cors());
app.use(express.json());
var tenants = express.Router({mergeParams: true})

function authUser(req, res, next) {
  bearerToken()(req, res, () => {
    // Temporary Hack to extract the token from the request
    req.token = req.headers.authorization.split(' ')[1];
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

/*
Python reference app gives:
[
  "/api/airports",
  "/",
  "/api/tenants/<tenant>/user/signup",
  "/api/tenants/<tenant>/user/login",
  "/api/tenants/<tenant>/user/<username>/flights",
  "/api/flightPaths/<fromloc>/<toloc>",
  "/api/hotels/<description>/<location>/",
  "/static/<path:filename>"
]

We have:
[
"GET /",
"GET /api/airports",
"GET /api/flightPaths/:from/:to",
"GET /api/hotels/:description/:location?",
"POST /api/tenants/:tenant/user/login",
"POST /api/tenants/:tenant/user/signup",
"GET,PUT /api/tenants/:tenant/user/:username/flights"
]
*/

app.get('/', (req, res) => {
  const format = prefix => o => {
    if (o.route) {
      const methods = Object.keys(o.route.methods).map(s => s.toUpperCase())
      return `${methods} ${ prefix }${ o.route.path }`
    } else {
      return []
    }
  }

  const shared = app._router.stack.flatMap(format(''))
  const tenanted = tenants.stack.flatMap(format('/api/tenants/:tenant'))
  res.send(
    JSON.stringify( shared.concat(tenanted) )
  )
})

app.get('/api/airports', async (req, res) => {
  const searchTerm = req.query.search;

  let where;
  if (searchTerm.length === 3) {
    // FAA code
    where = `faa = '${searchTerm.toUpperCase()}';`;
  } else if (
    searchTerm.length === 4 &&
    (searchTerm.toUpperCase() === searchTerm ||
      searchTerm.toLowerCase() === searchTerm)
  ) {
    // ICAO code
    where = `icao = '${searchTerm.toUpperCase()}';`;
  } else {
    // Airport name
    where = `LOWER(airportname) LIKE '%${searchTerm.toLowerCase()}%';`;
  }

  let qs = `SELECT airportname from \`travel-sample\`.inventory.airport WHERE ${ where }`;

  try {
    const result = await cluster.query(qs);
    const data = result.rows;
    const context = [`N1QL query - scoped to inventory: ${qs}`]
    res.send({data, context})
  }
  catch (err) {
    res.status(500).send({
      error: err
    });
    return;
  }
});

app.get('/api/flightPaths/:from/:to', async (req, res) => {
  const fromAirport = req.params.from;
  const toAirport = req.params.to;
  const leaveDate = new Date(req.query.leave);

  const dayOfWeek = leaveDate.getDay();

  let qs1 = `SELECT faa AS fromAirport FROM \`travel-sample\`.inventory.airport
            WHERE airportname = '${fromAirport}'
            UNION
            SELECT faa AS toAirport FROM \`travel-sample\`.inventory.airport
            WHERE airportname = '${toAirport}';`;

  const result = await cluster.query(qs1);
  const rows = result.rows;
  if (rows.length !== 2) {
    res.status(404).send({
      error: 'One of the specified airports is invalid.',
      context: [qs1],
    });
    return;
  }
  const airports = { ...rows[0], ...rows[1] }
  const fromFaa = airports.fromAirport;
  const toFaa   = airports.toAirport;

  let qs2 = `
      SELECT a.name, s.flight, s.utc, r.sourceairport, r.destinationairport, r.equipment
      FROM \`travel-sample\`.inventory.route AS r
      UNNEST r.schedule AS s
      JOIN \`travel-sample\`.inventory.airline AS a ON KEYS r.airlineid
      WHERE r.sourceairport = '${fromFaa}'
      AND r.destinationairport = '${toFaa}'
      AND s.day = ${dayOfWeek}
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

  rows2.forEach((row) => {
    row.flighttime = Math.ceil(Math.random() * 8000);
    row.price = Math.ceil((row.flighttime / 8) * 100) / 100;
  });

  res.send({
    data: rows2,
    context: ["N1QL query - scoped to inventory: ", qs2],
  });
});



app.use('/api/tenants/:tenant/', tenants)

function makeKey(key) {
  return key.toLowerCase()
}

tenants.route('/user/login').post(async (req, res) => {
  const tenant = makeKey( req.params.tenant )
  const user = makeKey( req.body.user );
  const password = req.body.password;
  var scope = bucket.scope(tenant)
  var users = scope.collection("users")

  try {
    const result = await users.get(user);

    if (result.value.password !== password) {
      res.status(401).send({
        error: 'Password does not match.',
      });
      return;
    }

    const token = jwt.sign({user}, JWT_KEY);

    res.send({
      data: {token},
      context: [`KV get - scoped to ${tenant}.users: for password field in document ${user}`]
    });
  } catch (err) {
    if (err instanceof couchbase.DocumentNotFoundError) {
      res.status(401).send({
        error: 'User does not exist.',
      });
      return;
    }

    res.status(500).send({error: err})
  }
});

tenants.route('/user/signup').post(async (req, res) => {
  const user = req.body.user
  const userDocKey = makeKey(user)
  const password = req.body.password

  const tenant = makeKey( req.params.tenant )
  var scope = bucket.scope(tenant)
  var users = scope.collection("users")

  try {
    const userDoc = {
      name: user,
      password: password,
      flights: [],
    };

    await users.insert(userDocKey, userDoc);

    const token = jwt.sign({user}, JWT_KEY);

    res.send({
      data: {token},
      context: [`KV insert - scoped to ${tenant}.users: document ${userDocKey}`]
    });
  } catch (err) {
    if (err instanceof couchbase.DocumentExistsError) {
      res.status(409).send({
        error: 'User already exists.',
      });
      return;
    }

    res.status(500).send({error: err})
  }
});

tenants.route('/user/:username/flights')
.get(authUser, async (req, res) => {
  const username = req.params.username
  const userDocKey = makeKey(username)

  const tenant = makeKey( req.params.tenant )
  var scope = bucket.scope(tenant)
  var users = scope.collection("users")
  var bookings = scope.collection("bookings")

  if (username !== req.user.user) {
    res.status(401).send({
      error: 'Username does not match token username.',
    });
    return;
  }

  try {
    const result = await users.get(userDocKey);
    const ids = result.content.bookings || []

    const inflated = await Promise.all(
      ids.map(
        async flightId => (await bookings.get(flightId)).content))

    res.send({
      data: inflated,
      context: `KV get - scoped to ${tenant}.user: for ${ids.length} bookings in document ${userDocKey}`,
    })

  } catch (err) {
    if (err instanceof couchbase.DocumentNotFoundError) {
      res.status(403).send({
        error: 'Could not find user.',
      });
      return;
    }

    res.status(500).send({error: err})
  }
})
.put(authUser, async (req, res) => {
  const username = req.params.username
  const userDocKey = makeKey(username)

  const newFlight = req.body.flights[0]
  const tenant = makeKey( req.params.tenant )

  var scope = bucket.scope(tenant)
  var users = scope.collection("users")
  var bookings = scope.collection("bookings")

  if (username !== req.user.user) {
    res.status(401).send({
      error: 'Username does not match token username.',
    });
    return;
  }

  const flightId = uuid.v4()

  try {
    await bookings.upsert(flightId, newFlight)
  }
  catch (err) {
    res.status(500).send({
      error: 'Failed to add flight data',
    });
    return;
  }

  try {
    await users.mutateIn(userDocKey, [
      couchbase.MutateInSpec.arrayAppend(
        'bookings',
        flightId,
        { createPath: true })])

    res.send({
      data: {
        added: newFlight,
      },
      context:
        [`KV mutateIn - scoped to ${tenant}.users: for bookings subdocument field in document ${userDocKey}`]
    })
    return
  } catch (err) {
    if (err instanceof couchbase.DocumentNotFoundError) {
      res.status(403).send({
        error: 'Could not find user.',
      });
      return;
    }

    res.status(500).send({error: err})
  }
});

app.get('/api/hotels/:description/:location?', async (req, res) => {
  const description = req.params.description;
  const location = req.params.location;
  var scope = bucket.scope("inventory")
  var hotels = scope.collection("hotel")
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

  const result = await cluster.searchQuery('hotels-index', qp, { limit: 100 });
  const rows = result.rows;
  if (rows.length === 0) {
    res.send({
      data: [],
      context: [`FTS search - scoped to: inventory.hotel (no results)\n${JSON.stringify(qp)}`],
    });
    return;
  }

  const addressCols = [
    'address',
    'state',
    'city',
    'country'
  ]

  const cols = [
    'type',
    'name',
    'description',
    ...addressCols
  ]

  const results = await Promise.all(
    rows.map(async (row) => {
      const doc = await hotels.get(row.id, {
        project: cols
      });
      var content = doc.content
      content.address =
        addressCols
        .flatMap(field => content[field] || [])
        .join(', ')
      return content;
    })
  );

  res.send({
    data: results,
    context: [
      `FTS search - scoped to: inventory.hotel within fields ${cols.join(', ')}\n${JSON.stringify(qp)}`]
  });
});

app.listen(8080, () => {
  console.log('Example app listening on port 8080!');
});

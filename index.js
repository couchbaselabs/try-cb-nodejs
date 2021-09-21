'use strict'

var bearerToken = require('express-bearer-token')
var cors = require('cors')
var couchbase = require('couchbase')

var express = require('express')
var jwt = require('jsonwebtoken')
var morgan = require('morgan')
var uuid = require( 'uuid')
var swaggerUi = require('swagger-ui-express')
const swaggerDocument = require('./swagger.json')

// Specify a key for JWT signing.
var JWT_KEY = 'IAMSOSECRETIVE!'

// Create a Couchbase Cluster connection
const CB = {
  host: process.env.CB_HOST || 'db',
  username: process.env.CB_USER || 'Administrator',
  password: process.env.CB_PASS || 'password'
}

var cluster = new couchbase.Cluster(
  `couchbase://${CB.host}`,
  {
    username: CB.username,
    password: CB.password
  }
)

// Open a specific Couchbase bucket, `travel-sample` in this case.
var bucket = cluster.bucket('travel-sample')

// Set up our express application
var app = express()
app.use(morgan('dev'))
app.use(cors())
app.use(express.json())

app.use('/apidocs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

var tenants = express.Router({mergeParams: true})

function authUser(req, res, next) {
  bearerToken()(req, res, () => {
    // Temporary Hack to extract the token from the request
    req.token = req.headers.authorization.split(' ')[1]
    jwt.verify(req.token, JWT_KEY, (err, decoded) => {
      if (err) {
        return res.status(400).send({
          error: 'Invalid JWT token',
          cause: err,
        })
      }

      req.user = decoded
      next()
    })
  })
}

app.get('/', (req, res) => {
  return res.send(
    `<h1>Node.js Travel Sample API</h1>
    A sample API for getting started with Couchbase Server and the Node.js SDK.
    <ul>
      <li><a href="/apidocs">Learn the API with Swagger, interactively</a>
      <li><a href="https://github.com/couchbaselabs/try-cb-nodejs">GitHub</a>
    </ul>`
  )
})

function runAsync (callback) {
  return function (req, res, next) {
    callback(req, res, next)
      .catch(next)
  }
}

app.get('/api/airports',
  runAsync(async (req, res) => {
    const searchTerm = req.query.search
    let where
    let options

    if (searchTerm.length === 3) {
      // FAA code
      where = 'faa = $FAA'
      options = { parameters: { FAA: searchTerm.toUpperCase() } }
    } else if (
      searchTerm.length === 4 &&
      (searchTerm.toUpperCase() === searchTerm ||
        searchTerm.toLowerCase() === searchTerm)
    ) {
      // ICAO code
      where = 'icao = $ICAO'
      options = { parameters: { ICAO: searchTerm.toUpperCase() } }
    } else {
      // Airport name
      where = 'CONTAINS(LOWER(airportname), $AIRPORT)'
      options = { parameters: { AIRPORT: searchTerm.toLowerCase() } }
    }

    let qs = `SELECT airportname from \`travel-sample\`.inventory.airport WHERE ${ where };`

    const result = await cluster.query(qs, options)
    const data = result.rows
    const context = [`N1QL query - scoped to inventory: ${qs}`]
    return res.send({data, context})
  })
)

app.get('/api/flightPaths/:from/:to',
  runAsync(async (req, res) => {
    const fromAirport = req.params.from
    const toAirport = req.params.to
    const leaveDate = new Date(req.query.leave)

    const dayOfWeek = leaveDate.getDay()

    let qs1 = `SELECT faa AS fromFaa
              FROM \`travel-sample\`.inventory.airport
              WHERE airportname = $FROM
              UNION
              SELECT faa AS toFaa
              FROM \`travel-sample\`.inventory.airport
              WHERE airportname = $TO;`

    const options1 = {
      parameters: {
        FROM: fromAirport,
        TO: toAirport,
      }
    }

    const result = await cluster.query(qs1, options1)
    const rows = result.rows
    if (rows.length !== 2) {
      return res.status(404).send({
        error: 'One of the specified airports is invalid.',
        context: [qs1],
      })
    }
    const { fromFaa, toFaa } = { ...rows[0], ...rows[1] }

    let qs2 = `
        SELECT a.name, s.flight, s.utc, r.sourceairport, r.destinationairport, r.equipment
        FROM \`travel-sample\`.inventory.route AS r
        UNNEST r.schedule AS s
        JOIN \`travel-sample\`.inventory.airline AS a ON KEYS r.airlineid
        WHERE r.sourceairport = $FROM
        AND r.destinationairport = $TO
        AND s.day = $DAY
        ORDER BY a.name ASC;
      `
    const options2 = {
      parameters: {
        FROM: fromFaa,
        TO: toFaa,
        DAY: dayOfWeek
      }
    }

    const result2 = await cluster.query(qs2, options2)
    const rows2 = result2.rows
    if (rows2.length === 0) {
      return res.status(404).send({
        error: 'No flights exist between these airports.',
        context: [qs1, qs2],
      })
    }

    rows2.forEach((row) => {
      row.flighttime = Math.ceil(Math.random() * 8000)
      row.price = Math.ceil((row.flighttime / 8) * 100) / 100
    })

    return res.send({
      data: rows2,
      context: ["N1QL query - scoped to inventory: ", qs2],
    })
  })
)

app.use('/api/tenants/:tenant/', tenants)

const makeKey = key => key.toLowerCase()

tenants.route('/user/login').post(
  runAsync(async (req, res) => {
    const tenant = makeKey( req.params.tenant )
    const user = makeKey( req.body.user )
    const password = req.body.password
    var scope = bucket.scope(tenant)
    var users = scope.collection("users")

    try {
      const result = await users.get(user)

      if (result.value.password !== password) {
        return res.status(401).send({
          error: 'Password does not match.',
        })
      }

      const token = jwt.sign({user}, JWT_KEY)

      return res.send({
        data: {token},
        context: [`KV get - scoped to ${tenant}.users: for password field in document ${user}`]
      })
    } catch (err) {
      if (err instanceof couchbase.DocumentNotFoundError) {
        return res.status(401).send({
          error: 'User does not exist.',
        })
      }
      else {
        throw(err)
      }
    }
  })
)

tenants.route('/user/signup').post(
  runAsync(async (req, res) => {
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
      }

      await users.insert(userDocKey, userDoc)

      const token = jwt.sign({user}, JWT_KEY)

      return res.status(201).send({
        data: {token},
        context: [`KV insert - scoped to ${tenant}.users: document ${userDocKey}`]
      })
    } catch (err) {
      if (err instanceof couchbase.DocumentExistsError) {
        return res.status(409).send({
          error: 'User already exists.',
        })
      }
      else {
        throw(err)
      }
    }
  })
)

tenants.route('/user/:username/flights')
.get(authUser,
  runAsync(async (req, res) => {
    const username = req.params.username
    const userDocKey = makeKey(username)

    const tenant = makeKey( req.params.tenant )
    var scope = bucket.scope(tenant)
    var users = scope.collection("users")
    var bookings = scope.collection("bookings")

    if (username !== req.user.user) {
      return res.status(401).send({
        error: 'Username does not match token username.',
      })
    }

    try {
      const result = await users.get(userDocKey)
      const ids = result.content.bookings || []

      const inflated = await Promise.all(
        ids.map(
          async flightId => (await bookings.get(flightId)).content))

      return res.send({
        data: inflated,
        context: `KV get - scoped to ${tenant}.user: for ${ids.length} bookings in document ${userDocKey}`,
      })
    } catch (err) {
      if (err instanceof couchbase.DocumentNotFoundError) {
        return res.status(403).send({
          error: 'Could not find user.',
        })
      }
      else {
        throw(err)
      }
    }
  })
)
.put(authUser,
  runAsync(async (req, res) => {
    const username = req.params.username
    const userDocKey = makeKey(username)

    const newFlight = req.body.flights[0]
    const tenant = makeKey( req.params.tenant )

    var scope = bucket.scope(tenant)
    var users = scope.collection("users")
    var bookings = scope.collection("bookings")

    if (username !== req.user.user) {
      return res.status(401).send({
        error: 'Username does not match token username.',
      })
    }

    const flightId = uuid.v4()

    try {
      await bookings.upsert(flightId, newFlight)
    }
    catch (err) {
      return res.status(500).send({
        error: 'Failed to add flight data',
      })
    }

    try {
      await users.mutateIn(userDocKey, [
        couchbase.MutateInSpec.arrayAppend(
          'bookings',
          flightId,
          { createPath: true })])

      return res.send({
        data: {
          added: newFlight,
        },
        context:
          [`KV mutateIn - scoped to ${tenant}.users: for bookings subdocument field in document ${userDocKey}`]
      })
    } catch (err) {
      if (err instanceof couchbase.DocumentNotFoundError) {
        return res.status(403).send({
          error: 'Could not find user.',
        })
      }
      else {
        throw(err)
      }
    }
  })
)

app.get('/api/hotels/:description/:location?',
  runAsync(async (req, res) => {
    const description = req.params.description
    const location = req.params.location
    var scope = bucket.scope("inventory")
    var hotels = scope.collection("hotel")
    const qp = couchbase.SearchQuery.conjuncts([
      couchbase.SearchQuery.term('hotel').field('type'),
    ])

    if (location && location !== '*') {
      qp.and(
        couchbase.SearchQuery.disjuncts(
          couchbase.SearchQuery.match(location).field('country'),
          couchbase.SearchQuery.match(location).field('city'),
          couchbase.SearchQuery.match(location).field('state'),
          couchbase.SearchQuery.match(location).field('address')
        )
      )
    }
    if (description && description !== '*') {
      qp.and(
        couchbase.SearchQuery.disjuncts(
          couchbase.SearchQuery.match(description).field('description'),
          couchbase.SearchQuery.match(description).field('name')
        )
      )
    }

    const result = await cluster.searchQuery('hotels-index', qp, { limit: 100 })
    const rows = result.rows
    if (rows.length === 0) {
      return res.send({
        data: [],
        context: [`FTS search - scoped to: inventory.hotel (no results)\n${JSON.stringify(qp)}`],
      })
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
        })
        var content = doc.content
        content.address =
          addressCols
          .flatMap(field => content[field] || [])
          .join(', ')
        return content
      })
    )

    return res.send({
      data: results,
      context: [
        `FTS search - scoped to: inventory.hotel within fields ${cols.join(', ')}\n${JSON.stringify(qp)}`]
    })
  })
)

// Error handler. Must be defined after other routes/middleware
app.use((err, req, res, next) => {
  const errText = err.toString()
  if (errText.match(/LCB_ERR_KVENGINE_INVALID_PACKET/)) {
    return res.status(500).send({
      error: "Received LCB_ERR_KVENGINE_INVALID_PACKET error from Couchbase. Please check the SDK release notes and ensure you are using a compatible server version."
    })
  }
  else {
    return res.status(500).send({
      error: `${err.toString()}: ${JSON.stringify(err)}`
    })
  }
  next()
})

app.listen(8080, () => {
  console.log(`Connecting to backend Couchbase server ${CB.host} with ${CB.username}/${CB.password}`)
  console.log('Example app listening on port 8080!')
})

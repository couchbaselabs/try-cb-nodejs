# Couchbase Node.js travel-sample Application REST Backend


This is a sample application for getting started with [Couchbase Server] and the Node.js SDK.
The application runs a single page web UI for demonstrating SQL for Documents (N1QL), Sub-document requests and Full Text Search (FTS) querying capabilities.
It uses Couchbase Server together with the [Express] web framework for [Node.js], [Swagger] for API documentation, [Vue] and [Bootstrap].

The application is a flight planner that allows the user to search for and select a flight route (including the return flight) based on airports and dates.
Airport selection is done dynamically using an autocomplete box bound to N1QL queries on the server side. After selecting a date, it then searches
for applicable air flight routes from a previously populated database. An additional page allows users to search for Hotels using less structured keywords.

![Application](app.png)

## Prerequisites

To download the application you can either download [the archive](https://github.com/couchbaselabs/try-cb-nodejs/archive/master.zip) or clone the repository:

```
git clone https://github.com/couchbaselabs/try-cb-nodejs.git
```

You will need [Docker](https://docs.docker.com/get-docker/) installed on your machine in order to run this application as we have defined a [_Dockerfile_](Dockerfile) and a [_docker-compose.yml_](docker-compose.yml) to run Couchbase Server 7.0.0 beta, the front-end [Vue app](https://github.com/couchbaselabs/try-cb-frontend-v2.git) and the Node.js REST API.

If you wish to run this application against your own configuration of Couchbase Server, you will need version 7.0.0 beta or later with:

* the `travel-sample` bucket setup.
* full text search index on travel-sample bucket called 'hotels-index'

    ```
    curl --fail -s -u <username>:<password> -X PUT \
            http://<host>:8094/api/index/hotels-index \
            -H 'cache-control: no-cache' \
            -H 'content-type: application/json' \
            -d @fts-hotels-index.json
    ```

## Running the application (Docker)

To launch the full application,you can simply run this command from a terminal:

```
docker-compose up
```

> **_NOTE:_** When you run the application for the first time, it will pull/build the relevant docker images, so it might take a bit of time.

This will start the Node.js backend, Couchbase Server 7.0.0-beta and the Vue app.
You can access the backend API on `http://localhost:8080/`, the UI on `http://localhost:8081/` and Couchbase Server at `http://localhost:8091/`.

```
Creating network "try-cb-nodejs_default" with the default driver
Creating couchbase-sandbox-7.0.0-beta ... done
Creating try-cb-api                   ... done
Creating try-cb-fe                    ... done
Attaching to couchbase-sandbox-7.0.0-beta, try-cb-api, try-cb-fe
try-cb-api  |
try-cb-api  | Checking 'hotels-index' setup...
couchbase-sandbox-7.0.0-beta | Starting Couchbase Server -- Web UI available at http://<ip>:8091
couchbase-sandbox-7.0.0-beta | and logs available in /opt/couchbase/var/lib/couchbase/logs
couchbase-sandbox-7.0.0-beta | Configuring Couchbase Server.  Please wait (~60 sec)...
try-cb-api  |
try-cb-api  | Creating hotels-index...
couchbase-sandbox-7.0.0-beta | Configuration completed!
couchbase-sandbox-7.0.0-beta | Couchbase Admin UI: http://localhost:8091
couchbase-sandbox-7.0.0-beta | Login credentials: Administrator / password
try-cb-api  |
try-cb-api  | Waiting for hotels-index to be ready. Please wait...
try-cb-api  | Waiting for hotels-index to be ready. Trying again in 10 seconds.
try-cb-fe   | wait-for-it: waiting 200 seconds for backend:8080
try-cb-api  | Waiting for hotels-index to be ready. Trying again in 10 seconds.
try-cb-api  | Waiting for hotels-index to be ready. Trying again in 10 seconds.
try-cb-api  | Waiting for hotels-index to be ready. Trying again in 10 seconds.
try-cb-api  | Waiting for hotels-index to be ready. Trying again in 10 seconds.
try-cb-api  | Waiting for hotels-index to be ready. Trying again in 10 seconds.
try-cb-api  | Waiting for hotels-index to be ready. Trying again in 10 seconds.
try-cb-api  | Waiting for hotels-index to be ready. Trying again in 10 seconds.
try-cb-api  | Waiting for hotels-index to be ready. Trying again in 10 seconds.
try-cb-api  | Waiting for hotels-index to be ready. Trying again in 10 seconds.
try-cb-api  | Done.
try-cb-api  |
try-cb-api  | Running backend...
try-cb-api  | Example app listening on port 8080!
try-cb-fe   | wait-for-it: backend:8080 is available after 115 seconds
try-cb-fe   |
try-cb-fe   | > try-cb-frontend-v2@0.1.0 serve
try-cb-fe   | > vue-cli-service serve --port 8081
try-cb-fe   |
try-cb-fe   |  INFO  Starting development server...
try-cb-fe   |  DONE  Compiled successfully in 25896ms10:44:13 AM
try-cb-fe   |
try-cb-fe   |
try-cb-fe   |   App running at:
try-cb-fe   |   - Local:   http://localhost:8081/
try-cb-fe   |
try-cb-fe   |   It seems you are running Vue CLI inside a container.
try-cb-fe   |   Access the dev server via http://localhost:<your container's external mapped port>/
try-cb-fe   |
try-cb-fe   |   Note that the development build is not optimized.
try-cb-fe   |   To create a production build, run npm run build.
```

You should then be able to browse the UI, search for US airports and get flight route information. If you are unsure for what to search for, try from SFO to LAX.

To end the application press CONTROL+C in the terminal and wait for docker-compose to gracefully stop your containers.

### REST API reference

We've integrated Swagger/OpenApi version 3 documentation which can be accessed on the backend at `http://localhost:8080/apidocs`

More detail on the design of the API can be found  at [https://github.com/couchbaselabs/try-cb-frontend/blob/master/documentation/try-cb-api-spec-v2.adoc]

## Mix and match services

Instead of running all services, you can start any combination of `backend`, `frontend`, `db` via docker, and take responsibility for starting the other services yourself.

As the provided `docker-compose.yml` sets up dependencies between the services, to make startup as smooth and automatic as possible, we also provide an alternative `mix-and-match.yml`. We'll look at a few useful scenarios here.

### Bring your own database

If you are already running a Couchbase Server, you can pass the database details in:

```
CB_HOST=10.144.211.101 CB_USER=Administrator CB_PSWD=password docker-compose -f mix-and-match.yml up backend frontend
```

The server must already have the `travel-sample` bucket installed.
The Docker image will run the same checks as usual, and also create a `hotels-index`.


### Running the Node.js API application manually

To load all the necessary Node.js libraries for the backend application, run:

```
npm install
```

You can then run the app using your preferred Node toolchain. As you are running the server
on your localhost, and not in a Docker container, you will have to point at it with the
`CB_HOST` environment variable.

The first time you run against a new database image, you may want to use the provided
`wait-for-couchbase.sh` wrapper to ensure that all indexes are created.
For example, using the Docker image provided:

```
docker-compose -f mix-and-match.yml up db
CB_HOST=localhost ./wait-for-couchbase.sh node index.js

# or, if you know the database is already configured and responding
CB_HOST=localhost node index.js
```

If you already have an existing Couchbase server running and correctly configured, you might run:

```
CB_HOST=10.144.211.101 CB_USER=Administrator CB_PSWD=password node index.js
```

It's often convenient to use `nodemon` to auto-restart the app whenever you make a change.

```
npm install -g nodemon
CB_HOST=localhost nodemon index.js
```

To run the front-end Vue application:

```
docker-compose -f mix-and-match.yml up frontend
```

### Running the database or front-end manually

To run the database and/or frontend components manually without Docker, follow the appropriate guides:

* [Couchbase server - getting started](https://docs.couchbase.com/server/current/getting-started/start-here.html)
* [Travel sample frontend](https://github.com/couchbaselabs/try-cb-frontend-v2)

## Configuration Options

By default the application will use the `travel-sample.inventory` scope to query/search flight and hotel data.

It will also separate user account data such as flight bookings and credentials in the `tenant_agent_XX scopes`.

These options can be modified in `index.js`.

[Couchbase Server]: https://www.couchbase.com/
[Node.js SDK]: https://docs.couchbase.com/nodejs-sdk/current/hello-world/overview.html
[Express]: https://expressjs.com/
[Node.js]: https://nodejs.org/
[Swagger]: https://swagger.io/resources/open-api/
[Vue]: https://vuejs.org/
[Bootstrap]: https://getbootstrap.com/

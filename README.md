# Couchbase Python travel-sample Application REST Backend

This is a sample application for getting started with Couchbase Server and the Python SDK.
The application runs a single page web UI for demonstrating SQL for Documents (N1QL), Sub-document requests and Full Text Search (FTS) querying capabilities.
It uses Couchbase Server together with the Python Flask web platform, Swagger for API documentation, Vue and Bootstrap.

The application is a flight planner that allows the user to search for and select a flight route (including the return flight) based on airports and dates.
Airport selection is done dynamically using an autocomplete box bound to N1QL queries on the server side. After selecting a date, it then searches
for applicable air flight routes from a previously populated database. An additional page allows users to search for Hotels using less structured keywords.

![Application](app.png)

## Prerequisites

You will need [Docker](https://docs.docker.com/get-docker/) installed on your machine in order to run this application as we have defined a [_Dockerfile_](Dockerfile) and a [_docker-compose.yml_](docker-compose.yml) to run Couchbase Server 7.0.0 beta, the front-end [Vue app](https://github.com/couchbaselabs/try-cb-frontend-v2.git) and the Python REST API.

If you wish to run this application against your own configuration of Couchbase Server, you will need version 7.0.0 beta or later with the `travel-sample` bucket setup.

Alternatively, to run everything without Docker the following prerequisites are also required:

* Full text search index on travel-sample bucket called 'hotels-index'  

    ```
    curl --fail -s -u <username>:<password> -X PUT \
            http://<host>:8094/api/index/hotels-index \
            -H 'cache-control: no-cache' \
            -H 'content-type: application/json' \
            -d @fts-hotels-index.json
    ```

* Python 3.7+

To download the application you can either download [the archive](https://github.com/couchbaselabs/try-cb-python/archive/master.zip) or clone the repository:

```
git clone https://github.com/couchbaselabs/try-cb-python.git
```

## Running the application (Docker)

The backend application uses several Python libraries that need to be installed, luckily this is all taken care of by the Dockerfile provided.

To launch the full application you can simply run this command from a terminal:

```
docker-compose up
```

> **_NOTE:_** When you run the application for the first time, it will pull/build the relevant docker images, so it might take a bit of time.

This will start the Python backend, Couchbase Server 7.0.0-beta and the Vue app.
You can access the backend API on `http://localhost:8080/`, the UI on `http://localhost:8081/` and Couchbase Server at `http://localhost:8091/`.

```
Creating couchbase-sandbox-7.0.0-beta ... done
Creating try-cb-fe                    ... done
Creating try-cb-api                   ... done
Attaching to couchbase-sandbox-7.0.0-beta, try-cb-fe, try-cb-api
couchbase-sandbox-7.0.0-beta | Starting Couchbase Server -- Web UI available at http://<ip>:8091
couchbase-sandbox-7.0.0-beta | and logs available in /opt/couchbase/var/lib/couchbase/logs
couchbase-sandbox-7.0.0-beta | Configuring Couchbase Server.  Please wait (~60 sec)...
couchbase-sandbox-7.0.0-beta | Configuration completed!
couchbase-sandbox-7.0.0-beta | Couchbase Admin UI: http://localhost:8091 
couchbase-sandbox-7.0.0-beta | Login credentials: Administrator / password
try-cb-api  | 
try-cb-api  | Checking 'hotels-index' setup...
try-cb-fe   | wait-for-it: waiting for backend:8080 without a timeout
try-cb-api  | 
try-cb-api  | Creating hotels-index...
try-cb-api  | {"status":"ok","uuid":"264d87b81c465268"}
try-cb-api  | 
try-cb-api  | Waiting for hotels-index to be ready. Please wait...
try-cb-api  | Waiting for hotels-index to be ready. Trying again in 10 seconds.
try-cb-api  | Waiting for hotels-index to be ready. Trying again in 10 seconds.
try-cb-api  | Waiting for hotels-index to be ready. Trying again in 10 seconds.
try-cb-api  | Waiting for hotels-index to be ready. Trying again in 10 seconds.
try-cb-api  | Waiting for hotels-index to be ready. Trying again in 10 seconds.
try-cb-api  | Done.
try-cb-api  | 
try-cb-api  | Running backend...
try-cb-api  | ('Administrator', 'password')
try-cb-api  | Connecting to: couchbase://db
try-cb-api  | couchbase://db <couchbase.auth.PasswordAuthenticator object at 0x7f3e9123ef10>
try-cb-api  |  * Serving Flask app "travel" (lazy loading)
try-cb-api  |  * Environment: production
try-cb-api  |    WARNING: This is a development server. Do not use it in a production deployment.
try-cb-api  |    Use a production WSGI server instead.
try-cb-api  |  * Debug mode: off
try-cb-api  |  * Running on http://0.0.0.0:8080/ (Press CTRL+C to quit)
try-cb-fe   | wait-for-it: backend:8080 is available after 131 seconds
try-cb-fe   | 
try-cb-fe   | > try-cb-frontend-v2@0.1.0 serve
try-cb-fe   | > vue-cli-service serve --port 8081
try-cb-fe   | 
try-cb-fe   |  INFO  Starting development server...
try-cb-fe   |  DONE  Compiled successfully in 6544ms9:31:00 AM
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
try-cb-fe   | 
```

You should then be able to browse the UI, search for US airports and get flight route information. If you are unsure for what to search for, try from SFO to LAX.

Alternatively, you can choose to only run the backend API and Couchbase Server if that is your preference:

```
docker-compose up backend
```

> **_NOTE:_** We've integrated Swagger/OpenApi version 3 documentation which can be accessed on the backend at `http://localhost:8080/apidocs`

If you wish to run the application against a different setup of Couchbase Server
you can simply run `docker-compose up` with commandline arguments.

```
CB_HOST=10.144.211.101 CB_USER=Administrator CB_PSWD=password docker-compose up 
```

To end the application press CONTROL+C in the terminal and wait for docker-compose to gracefully stop your containers.

## Running the application (without Docker)

To load all the necessary Python librares for the backend application, you can run:

```
LCB_TAG=3.1.0 python3 -m pip install -r requirements.txt
```

Update the _travel.py_ file to reflect the username, password and host you require, or specify with commandline arguments at runtime:

```
python3 travel.py -c localhost -u Administrator -p password
```

Launch the backend application by running the _travel.py_ file from a terminal.

```
('Administrator', 'password')
Connecting to: couchbase://localhost
couchbase://localhost <couchbase.auth.PasswordAuthenticator object at 0x106031850>
 * Serving Flask app "travel" (lazy loading)
 * Environment: production
   WARNING: This is a development server. Do not use it in a production deployment.
   Use a production WSGI server instead.
 * Debug mode: off
 * Running on http://0.0.0.0:8080/ (Press CTRL+C to quit)
```

> **_NOTE:_** We've integrated Swagger/OpenApi version 3 documentation which can be accessed on the backend at `http://localhost:8080/apidocs`

To run the front-end Vue application follow the instructions [here](https://github.com/couchbaselabs/try-cb-frontend-v2).

## Configuration Options

By default the application will use the `travel-sample.inventory` scope to query/search flight and hotel data.

It will also separate user account data such as flight bookings and credentials in the `tenant_agent_XX scopes`.

These options can be modified in `travel.py`.

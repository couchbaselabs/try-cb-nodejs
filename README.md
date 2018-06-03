try-cb-nodejs
===============

A sample application and dataset for getting started with Couchbase 4.5 or later.  The application runs a single page UI for demonstrating query capabilities.   The application uses Couchbase Server +  Node.js + Express + Angular and boostrap.   The application is a flight planner that allows the user to search for and select a flight route (including return flight) based on airports and dates. Airport selection is done dynamically using an angular typeahead bound to cb server query.   Date selection uses date time pickers and then searches for applicable air flight routes from a previously populated database.  You additionally can use Full-Text Search to perform hotel searches.

## Installation and Configuration
The steps below assume you are running a standalone couchbase instance running kv, indexing, fts (in Couchbase 4.5 or later) and query services on the same server where the node application will also be running.

 1. Install a Couchbase Server, and start it.
 
 2. Install Node.js

 3. Make a directory, clone this repo, install dependencies, start the application.  From a terminal:

    **mkdir ~/try-cb   
    git clone https://github.com/couchbaselabs/try-cb-nodejs.git ~/try-cb   
    cd ~/try-cb   
    npm install**   

 4. Start the application.  From a terminal:

    **npm run start**

 5. Open a browser and load the url http://localhost:8080

## REST API DOCUMENTATION
The REST API for this example application can be found at:
[https://github.com/couchbaselabs/try-cb-frontend/blob/master/documentation/try-cb-api-spec-v2.adoc](https://github.com/couchbaselabs/try-cb-frontend/blob/master/documentation/try-cb-api-spec-v2.adoc)

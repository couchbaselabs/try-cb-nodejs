try-cb-nodejs
===============

A sample application and dataset for getting started with Couchbase query.  The application runs a single page UI for demonstrating query capabilities.   The application uses Couchbase Server +  Node.js + Express + Angular.   The application allows the user to dynamically select airports by using an angular typeahead bound to cb server query, and then to search for applicable air flight routes from a previously populated database.  

## Installation
 - [1] Install a Couchbase Server, with integrated query service
 - [2] Create a default bucket
 - [3] Install Node.js
 - [4] Clone this repository
 - [5] Under try-cb/model/db.js change the ip to match that of the Couchbase Server from step 1 and step 2.   Change in on line 6 and line 85 (two places)
 - [6] From the try-cb directory, run "npm install"
 - [7] Run, "node app.js"
 - [8] Configure, per steps below in "Configuration" 
 - [9] From a browser, connect to http://localhost:3000/index.html
 
## Configuration - run only once
The steps below assume the application is running locally from the server curl will be run from.  If not, change the IP in the command string as needed.  

 - [1] This step resets the bucket, from a command line run and wait for the response: curl -v -X POST http://127.0.0.1:3000/api/status/reset   
 - [2] This step loads the bucket with airport data, from a command line run and wait for the response:  curl -v -X POST http://127.0.0.1:3000/api/raw/load/airports
 - [3] This step loads the bucket with route data, from a command line run and wait for the response:  curl -v -X POST http://127.0.0.1:3000/api/raw/load/routes
 - [4] This step loads the bucket with airline data, from a command line run and wait for the response: curl -v -X POST http://127.0.0.1:3000/api/raw/load/airlines
 - [5] This step creates the indexes for CB Query to utilize, from a command line run and wait for the response:  curl -v -X POST http://127.0.0.1:3000/api/raw/index

## REST API DOCUMENTATION
#### GET /api/airport/findAll?search=<_search string_> [**RETURNS: {"airportname":"<_airport name_>"} for typeahead airports passed in the query string in the parameter "search"**] 	
--Used for Typeahead							
--Queries for Airport by Name, FAA code or ICAO code.

#### GET /api/flightPath/findAll?from=<_from airport_>&to=<_to airport_>&leave=<_leave date_>&ret=<_return date_> [**RETURNS: {"sourceairport":"<_faa code_>","destinationairport":"<_faa code_>","name":"<_airline name_>","equipment":"<_list of planes airline uses for this route_>"} of available flight routes**]
--Populates the available flights panel on successful query.  
--Queries for available flight route by FAA codes, and joins against airline information to provide airline name.  

#### POST /api/raw/load/:type [**RETURNS: {JSON OBJECT} indicating complete**]
--Loads the raw json formatted air travel documents from the file in try-cb/model/raw/rawJsonAir.js
--Loads based on <_type_> airports,routes,airlines.

#### POST /api/raw/index [**RETURNS: {JSON OBJECT} indicating complete**]
--Builds indexes needed for CB Query 

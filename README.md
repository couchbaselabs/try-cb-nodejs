try-cb-nodejs
===============

A sample application and dataset for getting started with Couchbase 4.0.  The application runs a single page UI for demonstrating query capabilities.   The application uses Couchbase Server +  Node.js + Express + Angular and boostrap.   The application is a flight planner that allows the user to search for and select a flight route (including return flight) based on airports and dates. Airport selection is done dynamically using an angular typeahead bound to cb server query.   Date selection uses date time pickers and then searches for applicable air flight routes from a previously populated database.  

## Installation and Configuration
 - [1] Install a Couchbase Server, with integrated query service, and start the server.   There is no need to manually configure the server through the admin UI, the rest of this script will **automatically** provision couchbase and the application.
 - [2] Install Node.js
 - [3] Make a directory, Clone this Repo, install dependencies, start application.  From a terminal:
 
        mkidr ~/try-cb   
        git clone https://github.com/ToddGreenstein/try-cb-nodejs.git ~/try-cb   
        cd ~/try-cb   
        npm install   
        node app.js   

 - [4] Open a new terminal and run: curl -v -X POST http://127.0.0.1:3000/api/status/provisionCB
 - [5] Open a browser and load the url http://localhost:3000

## REST API DOCUMENTATION
#### GET /api/airport/findAll?search=<_search string_> [**RETURNS: {"airportname":"<_airport name_>"} for typeahead airports passed in the query string in the parameter "search"**] 	
--Used for Typeahead							
--Queries for Airport by Name, FAA code or ICAO code.

#### GET /api/flightPath/findAll?from=<_from airport_>&to=<_to airport_>&leave=<_leave date_>&ret=<_return date_> [**RETURNS: {"sourceairport":"<_faa code_>","destinationairport":"<_faa code_>","name":"<_airline name_>","equipment":"<_list of planes airline uses for this route_>"} of available flight routes**]
--Populates the available flights panel on successful query.  
--Queries for available flight route by FAA codes, and joins against airline information to provide airline name.  

#### POST /api/status/provisionCB [**RETURNS: {JSON OBJECT} indicating complete**]
--Loads the dataset dynamically based on options in the "config.json" file.   
--If dataset="repo", the application will build a sample bucket called "travel-sample" by loading raw json formatted air travel documents from the file in try-cb/model/raw/rawJsonAir.js and dynamically build scheduling information.  This is useful for learning how to programitically build a bucket, perform ingestions of data and how to become familiar with the CB 2.0 SDK API.  
--If dataset="embedded", the application load the above information from the included sample bucket within couchbase known as "travel-sample"

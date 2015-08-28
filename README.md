try-cb-nodejs
===============

A sample application and dataset for getting started with Couchbase 4.0.  The application runs a single page UI for demonstrating query capabilities.   The application uses Couchbase Server +  Node.js + Express + Angular and boostrap.   The application is a flight planner that allows the user to search for and select a flight route (including return flight) based on airports and dates. Airport selection is done dynamically using an angular typeahead bound to cb server query.   Date selection uses date time pickers and then searches for applicable air flight routes from a previously populated database.  

## Installation and Configuration
The steps below assume you are running a standalone couchbase instance running kv, indexing, and query services on the same server where the node application will also be running.  The config.json file in the root of this application can be edited to handle more complex topologies such as running couchbase server inside a vm.   

 - [1] Install a Couchbase Server, with integrated query service, and start the server.   There is no need to manually configure the server through the admin UI, steps 3 and 4 (below) will **automatically** provision couchbase and the application.   If you've already configured a local instance of Couchbase Server 4.0 or newer, the application can use this instance as long as you specify the credentials to connect to Couchbase within the application configuration file.

 - [2] Install Node.js
 - [3] Make a directory, clone this repo, install dependencies, start the application.  From a terminal:   

    **mkidr ~/try-cb    
    git clone https://github.com/ToddGreenstein/try-cb-nodejs.git ~/try-cb   
    cd ~/try-cb**

    **NOTE**:_If you already have a configured instance of Couchbase Server, edit the "config.json file in the root of the cloned repository and change the username and password fields to match the credentials you entered when you setup couchbase. You can also configure the application to use a remote instance of couchbase or MDS by editing the endPoint, n1qlService and hostname fields.  For further information on MDS, refer to the Couchbase Documentation_   
    
    **sudo npm install node-gyp -g  
     npm install    
     node app.js**
    
 - [4] Open a browser and load the url http://localhost:3000

**NOTE**: Once the application has provisioned the cluster it will update the config.json file and set "autoprovision":false.  The app can then be stopped and started and it will not attempt to provision the cluster again.  

## REST API DOCUMENTATION
#### GET /api/airport/findAll?search=<_search string_> [**RETURNS: {"airportname":"<_airport name_>"} for typeahead airports passed in the query string in the parameter "search"**] 	
--Used for Typeahead   
--Queries for Airport by Name, FAA code or ICAO code.

#### GET /api/flightPath/findAll?from=<_from airport_>&to=<_to airport_>&leave=<_leave date_>&ret=<_return date_> [**RETURNS: {"sourceairport":"<_faa code_>","destinationairport":"<_faa code_>","name":"<_airline name_>","equipment":"<_list of planes airline uses for this route_>"} of available flight routes**]
--Populates the available flights panel on successful query.  
--Queries for available flight route by FAA codes, and joins against airline information to provide airline name.  

#### POST /api/user/login _request body_ {"user":<_user_>,"password":<_encrypted password_>} [**RETURNS:{encrypted JSON Web Token}**]
--Creates a new user.   
--Returns an Encrypted JSON Web Token used by the Application

#### GET /api/user/login?user=<_user_>&password=<_encrypted password_>[**RETURNS:{<_success or failure_>:<_error or encrypted JSON Web Token_>}**]
--Logs in a user   
--Returns success and JSON Web Token OR failure and error message

#### POST /api/user/flights _request body_ {"token":<_JSON Web Token_>,"flights":<_group of flights to book_>} [**RETURNS:{"added":<_number of flights booked in this request_>}**]
--Checks if user is logged in from the JSON Web Token and then if token is correct it will book the list of flights passed in.   
--Returns number of flights added if successful, or error.  

#### POST /api/user/flights?token=<_JSON Web Token_> [**RETURNS:{list of flights previously booked specific to user}**]
--Checks if the user is logged in from the JSON Web Token  and then if token is correct it will return a list of previously booked flights.   
--Returns JSON Array of Documents of previously booked flights, or error.  


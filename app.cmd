#!/bin/sh

/usr/local/bin/couchbase-start &

sleep 10

echo "Starting Travel App -- Web UI available at: http://<ip>:3000"
echo "Note: to find your <ip>, you can use: boot2docker ip"

node app.js


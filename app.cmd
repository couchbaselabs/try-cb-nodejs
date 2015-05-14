#!/bin/sh

/usr/local/bin/couchbase-start &

echo please wait while couchbase is starting...

sleep 10

echo please wait while nodejs is starting...

node app.js

echo Example: if you are using boot2docker, to find your
echo dockerContainerIP, you can use: boot2docker ip
echo
echo ready - please browse to: http://dockerContainerIP:3000

# To build the try-cb-nodejs docker image...
#
#    docker build -t try-cb-nodejs .
#
# To start a couchbase 4.0 DP server from a docker image...
#
#    docker run -it --rm --net=host \
#      -p 8091:8091 -p 8092:8092 -p 8093:8093-p 11211:11211 -p 11210:11210 \
#      couchbase/server:enterprise-4.0.0-dp
#
# To launch the try-cb-nodejs docker image in a container instance...
#
#    docker run -it --rm --net=host -p 3000:3000 try-cb-nodejs
#
FROM node:onbuild

EXPOSE 3000

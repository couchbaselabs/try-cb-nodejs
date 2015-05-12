# To build a docker image...
#
#    docker build -t try-cb-nodejs .
#
# To launch the docker image in a container instance...
#
#    docker run -it --rm try-cb-nodejs
#
FROM node:onbuild

EXPOSE 3000

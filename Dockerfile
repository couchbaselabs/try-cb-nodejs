# This Dockerfile and related *.batinc files are for building a
# "batteries included" docker image, where database, application and
# sample data are all included and pre-installed in a single docker
# image for ease of use.
#
# To build the try-cb-nodejs docker image...
#
#    docker build -t try-cb-nodejs .
#
# To launch the try-cb-nodejs docker image in a container instance...
#
#    docker run -it --rm -p 3000:3000 -p 8091:8091 try-cb-nodejs
#
FROM couchbase/server:enterprise-4.0.0-rc0	

RUN yum -y install gcc-c++

# Originally from https://github.com/joyent/docker-node Dockerfile...
#
# verify gpg and sha256: http://nodejs.org/dist/v0.10.30/SHASUMS256.txt.asc
# gpg: aka "Timothy J Fontaine (Work) <tj.fontaine@joyent.com>"
# gpg: aka "Julien Gilli <jgilli@fastmail.fm>"
RUN gpg --keyserver pool.sks-keyservers.net --recv-keys 7937DFD2AB06298B2293C3187D33FF9D0246406D 114F43EE0176B71C7BC219DD50A3051F888C628D

ENV NODE_VERSION 0.12.2
ENV NPM_VERSION 2.9.1

RUN curl -SLO "http://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-x64.tar.gz" \
    && curl -SLO "http://nodejs.org/dist/v$NODE_VERSION/SHASUMS256.txt.asc" \
    && gpg --verify SHASUMS256.txt.asc \
    && grep " node-v$NODE_VERSION-linux-x64.tar.gz\$" SHASUMS256.txt.asc | sha256sum -c - \
    && tar -xzf "node-v$NODE_VERSION-linux-x64.tar.gz" -C /usr/local --strip-components=1 \
    && rm "node-v$NODE_VERSION-linux-x64.tar.gz" SHASUMS256.txt.asc \
    && npm install -g npm@"$NPM_VERSION" \
    && npm cache clear

# Originally from https://github.com/joyent/docker-node/blob/0.12/onbuild/Dockerfile...
#
RUN mkdir -p /usr/src/app

WORKDIR /usr/src/app

COPY . /usr/src/app

RUN npm install

# Finish couchbase and try-cb-nodejs setup...
#
RUN /usr/src/app/config.batinc

EXPOSE 3000 8091 8092 8093 11210 11211

ENTRYPOINT ["/bin/bash", "-c"]

CMD ["/usr/src/app/app.cmd"]

FROM node:16-buster-slim

LABEL maintainer="Couchbase"

WORKDIR /app

RUN apt-get update && apt-get install -y \
    build-essential python\
    jq curl

COPY . /app 

RUN npm install

EXPOSE 8080

ENTRYPOINT ["./wait-for-couchbase.sh", "node", "index.js"]

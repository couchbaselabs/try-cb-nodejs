FROM node:15-buster-slim

LABEL maintainer="Couchbase"

WORKDIR /app

#RUN apt-get update && apt-get install -y \
#    build-essential cmake \
#    git-all libssl-dev \
#    jq curl

RUN apt-get update && apt-get install -y \
    build-essential python\
    jq curl

COPY . /app 

# Get pip to download and install requirements:
RUN npm install

# Expose ports
EXPOSE 8080

# Set the entrypoint 
ENTRYPOINT ["./entrypoint.sh"]

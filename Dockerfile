FROM ubuntu:18.04

COPY sources.list /etc/apt/sources.list
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        git \
        curl

RUN curl --silent --location https://deb.nodesource.com/setup_8.x | bash -
RUN apt-get install --yes nodejs npm

COPY app.js utils.js package.json /app/
COPY keys/key.pem keys/cert.pem /app/keys/

WORKDIR /app/
RUN npm install

EXPOSE 8443

ENTRYPOINT [ "node", "app.js" ]


FROM mhart/alpine-node:8

RUN apk update && \
    apk upgrade && \
    apk add git

COPY package.json app.js utils.js keys/ /app/
WORKDIR /app/

RUN npm install

EXPOSE 8443

ENTRYPOINT [ "node", "app.js" ]
const express = require('express');
const secrets = require('secrets.js');

const https = require("https");
const fs = require("fs");

const options = {
//   key: fs.readFileSync("/srv/www/keys/my-site-key.pem"),
//   cert: fs.readFileSync("/srv/www/keys/chain.pem")
};

const ReconstructSecret = (shares) => {
    return secrets.combine(shares);
};

const Nonce = (addr) => {

};

const Balance = (addr) => {

};


const app = express();

app.get('/key/:string', function(req, res){
    res.send("Hello world!");
 });

app.listen(8001);

//https.createServer(options, app).listen(8080);

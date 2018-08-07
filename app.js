const express = require('express');
require('express-async-errors');
const bodyParser = require('body-parser');

const utils = require('./utils');

const SHARED_SECRET = {
    "address":"",
    "secrets": []
};

const https = require("https");
const fs = require("fs");

const app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.post('/shares', (req, res) => {
    const split = req.body.split;
    const address = req.body.address;

    if(!(split && address && split.length === 2)) {
        res.status(400).json({
            "error": "bad request"
        });
    }

    SHARED_SECRET.address = address;
    SHARED_SECRET.secrets = split;

    res.status(200).json(SHARED_SECRET);
});

app.post('/withdraw', async (req, res) => {
    const split = req.body.split;
    const to = req.body.to;
    const value = req.body.value;
    let tx;

    const tmp = SHARED_SECRET.secrets.concat(split);
    if(utils.addressMatchShares(SHARED_SECRET.address, tmp)) {
        const privateKey = utils.reConstructPrivateKey(tmp);
        tx = await utils.buildRawTransaction(privateKey, SHARED_SECRET.address,to, value);
        utils.sendSignedTransaction(tx[0], (err, receipt) => {
            if(err) {
                res.status(400).json({
                    "error": "transaction failed",
                })
            } else {
                res.status(200).json({
                    "txid": receipt
                });
            }
        })
    } else {
        res.status(400).json({
            "error": "bad request"
        });
    }
});

app.get('/deposit/:txid', async (req, res) => {
    const txid = req.params.txid;

    try {
        const receipt = await utils.getTransactionReceipt(txid);
        const blkNo = await utils.getBlockNumber();

        res.status(200).json({
            "txid": txid,
            "from": receipt.from,
            "to": receipt.to,
            "status": receipt.status,
            "includedIn": receipt.blockNumber,
            "currentHeight": blkNo,
        });
    } catch(e) {
        res.status(400).json({
            "error":"bad request"
        });
    }
});

https.createServer({
    key: fs.readFileSync('./keys/key.pem'),
    cert: fs.readFileSync('./keys/cert.pem')
}, app).listen(8443);

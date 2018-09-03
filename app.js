const express = require('express');
require('express-async-errors');
const bodyParser = require('body-parser');

const utils = require('./utils');

const SHARED_SECRET_ETH = {
    "address":"",
    "splits": []
};

const SHARED_SECRET_BTC = {
    "address": "",
    "splits": [],
    "network": ""
};

const https = require("https");
const fs = require("fs");

const app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.post('/shares', (req, res) => {
    const splits = req.body.splits;
    const address = req.body.address;

    if(!(splits && address && splits.length === 2)) {
        res.status(400).json({
            "error": "bad request"
        });
    }

    SHARED_SECRET_ETH.address = address;
    SHARED_SECRET_ETH.splits = splits;

    res.status(200).json(SHARED_SECRET_ETH);
});

app.post('/withdraw', async (req, res) => {
    const split = req.body.split;
    const nonce = req.body.nonce;
    const gasPrice = req.body.gasPrice;
    const gasLimit = req.body.gasLimit;
    const to = req.body.to;
    const value = req.body.value;
    let tx;

    const tmp = SHARED_SECRET_ETH.splits.concat(split);
    if(utils.addressMatchShares(SHARED_SECRET_ETH.address, tmp)) {
        const privateKey = utils.reConstructPrivateKey(tmp);
        tx = await utils.buildRawTransaction(privateKey, to, nonce, gasPrice, gasLimit, value);
        res.status(200).json({
            "from": SHARED_SECRET_ETH.address,
            "to": to,
            "rawTx": tx[0],
            "txid": "0x" + tx[1]
        });
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

// --------------- btc -----------------

app.post('/btc/shares', async (req, res) => {
    const splits = req.body.splits;
    const address = req.body.address;
    const network = req.body.network;

    if(!(splits && address && splits.length === 2)) {
        res.status(400).json({
            "error": "bad request"
        });
    }

    SHARED_SECRET_BTC.address = address;
    SHARED_SECRET_BTC.splits = splits;
    SHARED_SECRET_BTC.network = network;

    res.status(200).json(SHARED_SECRET_BTC);
})

app.post('/btc/withdraw', async (req, res) => {
    const split = req.body.split;
    const feeUpperLimit = req.body.feeUpperLimit;
    const toAddrs = req.body.toAddrs;
    const fromAddr = req.body.fromAddr;
    const network = req.body.network;
    const bumpFee = req.body.bumpFee;
    const rate = req.body.rate;

    let totalAmount = 0;
    for(var i = 0; i < toAddrs.length; i++) {
        totalAmount += toAddrs[i].amount;
    }

    const totalBalance = await utils.getBalance(fromAddr);

    if (totalBalance < totalAmount) {
        res.status(400).json({
            "error": "not enough funds"
        })
    }

    const selectedUtxos = await utils.coinSelector(fromAddr, totalAmount + feeUpperLimit);
    const privateKey = utils.reConstructPrivateKey(SHARED_SECRET_BTC.splits.concat(split));

    const shares = SHARED_SECRET_BTC.splits.concat(split);

    if(!utils.btcAddressMatchShares(SHARED_SECRET_BTC.address, network, shares)) {
        res.status(400).json({
            "error": "bad request"
        })
    }

    const tx = utils.BtcTx();

    if (Array.isArray(toAddrs)) {
        for (i = 0; i < toAddrs.length; i++) {
            tx.to(toAddrs[i].address, toAddrs[i].amount);
        }
    } else {
        tx.to(toAddrs.address, toAddrs.amount);
    }

    tx.from(selectedUtxos).change(fromAddr).enableRBF().sign(privateKey);

    if (bumpFee) {
        tx.fee((tx.getFee() * (100 + rate)) / 100).sign(privateKey);
        console.log(tx.getFee())
    }
    const fee = tx.getFee();
    if (fee > feeUpperLimit) {
        res.status(400).json({
            "error": "fee reach upper limit"
        });
    } else {
        try {
            const rawTx = tx.serialize();
            const txid = tx.hash;
            res.status(200).json({
                "rawTx": rawTx,
                "txid": txid
            });
        } catch(e) {
            res.status(400).json({
                "error": "Can't serialize raw transaction"
            });
        }
    }
})

https.createServer({
    key: fs.readFileSync('./keys/key.pem'),
    cert: fs.readFileSync('./keys/cert.pem')
}, app).listen(8443);

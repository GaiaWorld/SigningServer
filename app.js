const express = require('express');
require('express-async-errors');
const bodyParser = require('body-parser');

const utils = require('./utils');
const bitcore = require('bitcore-lib');

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
                "txid": txid,
                "fee": fee
            });
        } catch(e) {
            res.status(400).json({
                "error": "Can't serialize raw transaction"
            });
        }
    }
})

app.post('/btc/re-send', async (req, res) => {
    const originTxid = req.body.originTxid;
    const split = req.body.split;
    const feeRate = req.body.feeRate;
    const feeUpperLimit = req.body.feeUpperLimit;

    const txinfo = await utils.getTxInfo(originTxid);
    if (txinfo.confirmations > 0 && blockheight !== -1) {
        res.status(400).json({
            "error": "Transaction has been succeed"
        })
    }

    if (feeRate <= 0 || Number.isInteger(feeRate)) {
        res.status(400).json({
            "erros": "feeRate must be a positive integer"
        })
    }

    const vin = txinfo.vin;
    const vout = txinfo.vout;
    const utxos = [];
    let fromAddr = "";

    for (var i = 0; i < vin.length; i++) {
        const id = vin[i].txid;
        const vout = vin[i].vout;
        const address = vin[i].addr;
        fromAddr = address; // FIXME
        const satoshis = vin[i].valueSat;

        const addr = bitcore.Address.fromString(address);
        const script = bitcore.Script.buildPublicKeyHashOut(addr);
        const scritpPubkey = script.toHex();

        const utxo = new bitcore.Transaction.UnspentOutput({
            "txid" : id,
            "vout" : vout,
            "address" : address,
            "scriptPubKey" : scritpPubkey,
            "satoshis" : satoshis
        });

        utxos.push(utxo);
    }
    const tx = utils.BtcTx();

    try {
        var privateKey = utils.reConstructPrivateKey(SHARED_SECRET_BTC.splits.concat(split));
    } catch(e) {
        res.status(400).json({
            "error": "Cant re-contruct private key"
        })
    }

    for (i = 0; i < vout.length; i++) {
        if (vout[i].scriptPubKey.addresses[0] !== fromAddr) {
            const value = bitcore.Unit.fromBTC(vout[i].value).toSatoshis();
            const address = vout[i].scriptPubKey.addresses[0];
            tx.to(address, value);
        }
    }

    tx.from(utxos)
        .change(fromAddr)
        .enableRBF()
        .fee((tx.getFee() * (100 + feeRate)) / 100)
        .sign(privateKey);

    if (tx.getFee() > feeUpperLimit) {
        res.status(400).json({
            "error": "fee reach upper limit"
        })
    }

    res.status(200).json({
        "rawTx": tx.serialize(),
        "originTxid": originTxid,
        "newTxid": tx.hash,
        "fee": tx.getFee()
    })
})

https.createServer({
    key: fs.readFileSync('./keys/key.pem'),
    cert: fs.readFileSync('./keys/cert.pem')
}, app).listen(8443);

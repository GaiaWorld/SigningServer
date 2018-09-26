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
            "error":"network error"
        });
        console.log(e)
    }
});

// --------------- btc -----------------

app.post('/btc/shares', async (req, res) => {
    const splits = req.body.splits;
    const address = req.body.address;
    const network = req.body.network;

    if(!(splits && address && splits.length === 2)) {
        res.status(400).json({
            "error": "parameter error"
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
        });
        return;
    }

    let minerFee = await utils.estimateMinerFee();
    let fee = minerFee.low;

    const selectedUtxos = await utils.coinSelector(fromAddr, totalAmount + fee);

    if (!selectedUtxos) {
        res.status(400).json({
            "error": "no appropriate utxo found"
        });
        return;
    }
    const privateKey = utils.reConstructPrivateKey(SHARED_SECRET_BTC.splits.concat(split));

    const shares = SHARED_SECRET_BTC.splits.concat(split);

    try {
        if(!utils.btcAddressMatchShares(SHARED_SECRET_BTC.address, network, shares)) {
            res.status(400).json({
                "error": "Address not match the shares"
            });
            return;
        }
    } catch(e) {
        res.status(400).json({
            "error": "Can't re-construct secret from shares"
        });
        console.log(e);
        return;
    }

    const tx = utils.BtcTx();

    if (Array.isArray(toAddrs)) {
        for (i = 0; i < toAddrs.length; i++) {
            tx.to(toAddrs[i].address, toAddrs[i].amount);
        }
    } else {
        tx.to(toAddrs.address, toAddrs.amount);
    }


    try {
        tx.from(selectedUtxos)
            .change(fromAddr)
            .enableRBF()
            .feePerKb(fee)
            .sign(privateKey);
    } catch(e) {
        console.log(selectedUtxos)
        console.log(e)
        res.status(400).json({
            "error": "Incorrect signing key"
        });
        return;
    }

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
            console.log(e)
            res.status(400).json({
                "error": "Can't serialize raw transaction"
            });
            console.log(e)
        }
    }
})

app.post('/btc/re-send', async (req, res) => {
    const originTxid = req.body.originTxid;
    const split = req.body.split;
    const priority = req.body.priority;
    const feeUpperLimit = req.body.feeUpperLimit;

    try {
        var txinfo = await utils.getTxInfo(originTxid);
    } catch(e) {
        res.status(400).json({
            "error": "re-send an unknow transaction"
        });
        console.log(e);
        return;
    }

    if (txinfo.confirmations > 0 && txinfo.blockheight !== -1) {
        res.status(400).json({
            "error": "Transaction has been succeed"
        });
        return;
    }

    let minerFee = await utils.estimateMinerFee();
    let fee = 0;

    if (priority === "low") {
        fee = minerFee.low;
    } else if (priority === "medium") {
        fee = minerFee.medium;
    } else if (priority === "high") {
        fee = minerFee.high;
    } else {
        res.status(400).json({
            "error": "Please check fee priority"
        });
        return;
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
        });
        console.log(e)
        return;
    }

    for (i = 0; i < vout.length; i++) {
        if (vout[i].scriptPubKey.addresses[0] !== fromAddr) {
            const value = bitcore.Unit.fromBTC(vout[i].value).toSatoshis();
            const address = vout[i].scriptPubKey.addresses[0];
            tx.to(address, value);
        }
    }

    try {
        tx.from(utxos)
        .change(fromAddr)
        .enableRBF()
        .feePerKb(fee)
        .sign(privateKey);
    } catch(e) {
        res.status(400).json({
            "error": "Incorrect siging key"
        });
        console.log(e);
        return;
    }


    if (tx.getFee() > feeUpperLimit) {
        res.status(400).json({
            "error": "fee reach upper limit"
        });
        return;
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

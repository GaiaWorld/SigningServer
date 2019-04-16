const express = require('express');
require('express-async-errors');
const bodyParser = require('body-parser');

const utils = require('./utils');
const bitcore = require('bitcore-lib');

const https = require("https");
const fs = require("fs");

const EthAddresses = new Map();
const BtcAddresses = new Map();

const TxCache = new Map();

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

    EthAddresses.set(address, {splits: splits})

    res.status(200).json(EthAddresses.get(address));
});

app.post('/withdraw', async (req, res) => {
    const from = req.body.from;
    const split = req.body.split;
    const nonce = req.body.nonce;
    const gasPrice = req.body.gasPrice;
    const gasLimit = req.body.gasLimit;
    const to = req.body.to;
    const value = req.body.value;
    let tx;

    const tmp = EthAddresses.get(from).splits.concat(split);

    if(utils.addressMatchShares(from, tmp)) {
        const privateKey = utils.reConstructPrivateKey(tmp);
        tx = await utils.buildRawTransaction(privateKey, to, nonce, gasPrice, gasLimit, value);
        res.status(200).json({
            "from": from,
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
    const network = req.query.network;

    try {
        const receipt = await utils.getTransactionReceipt(txid, network);
        const blkNo = await utils.getBlockNumber(network);

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

    BtcAddresses.set(address, {splits: splits, network: network});

    res.status(200).json(BtcAddresses.get(address));
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

    const totalBalance = await utils.getBalance(fromAddr, network);

    if (totalBalance < totalAmount) {
        res.status(400).json({
            "error": "not enough funds"
        });
        return;
    }

    let minerFee = await utils.estimateMinerFee();
    let fee = minerFee.low;

    const selectedUtxos = await utils.coinSelector(fromAddr, totalAmount + fee, network);

    if (!selectedUtxos) {
        res.status(400).json({
            "error": "no appropriate utxo found"
        });
        return;
    }
    const privateKey = utils.reConstructPrivateKey(BtcAddresses.get(fromAddr).splits.concat(split));
    const shares = BtcAddresses.get(fromAddr).splits.concat(split);

    try {
        if(!utils.btcAddressMatchShares(fromAddr, network, shares)) {
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

    let utxos = []

    for (let ut of selectedUtxos) {
        let u = new bitcore.Transaction.UnspentOutput({
            "txId" : ut.tx_hash,
            "outputIndex" : ut.tx_output_n,
            "address" : fromAddr,
            "script" : bitcore.Script.buildPublicKeyHashOut(fromAddr),
            "satoshis" : ut.value,
        })

        utxos.push(u);
    }

    try {
        tx.from(utxos)
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
            // used for tx resend
            TxCache.set(txid, {inputs: utxos, outputs: toAddrs});
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
    const network = req.body.network;

    const tx = utils.BtcTx();
    let resend = TxCache.get(originTxid);

    if (resend) {
        try {
            var txinfo = await utils.getTxInfo(originTxid, network);
            if (txinfo.confirmations > 0 && txinfo.block_height !== -1) {
                // evict confirmed tx
                TxCache.delete(originTxid)
                res.status(400).json({
                    "error": "Transaction has been succeed"
                });
                return;
            }
        } catch(_e) {
            
        }
    } else {
        res.status(400).json({
            "error": "re-send an unknow transaction"
        });
        console.log(e);
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

    // replaced tx must has the same inputs as old one
    // https://medium.com/@overtorment/bitcoin-replace-by-fee-guide-e10032f9a93f
    try {
        var privateKey = utils.reConstructPrivateKey(BtcAddresses.get(resend.inputs[0].address.toString()).splits.concat(split));
    } catch(e) {
        res.status(400).json({
            "error": "Cant re-contruct private key"
        });
        console.log(e)
        return;
    }

    try {
        for(let toAddr of resend.outputs) {
            tx.to(toAddr.address, toAddr.amount)
        }

        tx.from(resend.inputs)
            .change(resend.inputs[0].address.toString())
            .enableRBF()
            .feePerKb(fee)
            .sign(privateKey)
    } catch(e) {
        res.status(400).json({
            "error": "Incorrect siging key"
        });
        console.log(e);
        return;
    }
        

    // fee reach the upper limit thus not replaciable
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

// clear cache every 30s
setInterval(async () => {
    for (let txid of TxCache.keys()) {
        try {
            const txinfo = await utils.getTxInfo(txid, network);
            if (txinfo.confirmations > 0 && txinfo.block_height !== -1) {
                // evict confirmed tx
                TxCache.delete(txid)
                console.log("remove confirmed txid: ", txid);

                res.status(400).json({
                    "error": "Transaction has been succeed"
                });
                return;
            }
        } catch(_e) {

        }
    }
}, (1000 * 30));

https.createServer({
    key: fs.readFileSync('./keys/key.pem'),
    cert: fs.readFileSync('./keys/cert.pem')
}, app).listen(8443);

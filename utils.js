const Web3 = require('web3');
const Tx = require('ethereumjs-tx');
const secrets = require('secrets.js');
const fetch = require("node-fetch");

const web3Providers = "http://192.168.33.154:8545/";
const web3 = new Web3(new Web3.providers.HttpProvider(web3Providers));

const GasPriceOracle = "https://safe-relay.gnosis.pm/api/v1/gas-station/";


const addressMatchShares = (address, shares) => {
    const privateKey = secrets.combine(shares);
    const x = web3.eth.accounts.privateKeyToAccount('0x'+privateKey);

    return x.address === address;
};

const reConstructPrivateKey = (shares) => {
    return secrets.combine(shares);
}

const getAccountNonce = async (address) => {
    let nonce = await web3.eth.getTransactionCount(address);

    return nonce;
};

const getBalance = async (address) => {
    const balance = await web3.eth.getBalance(address);

    return balance;
};

const getTransactionReceipt = async (txid) => {
    const detail = await web3.eth.getTransactionReceipt(txid);

    return detail;
};

const getBlockNumber = async () => {
    const blkno = await web3.eth.getBlockNumber();

    return blkno;
}

const getGasPriceFromOralce = async () => {
    try {
        const response = await fetch(GasPriceOracle);
        const json = await response.json();

        return json;
    } catch(e) {
        Promise.reject(e);
    }
}

const getGasPrice = async () => {
    const price = await web3.eth.gasPrice();

    return price;
}

const estimateGas = async (callObj) => {
    const gas = await web3.eth.estimateGas(callObj)

    return gas;
}

const buildRawTransaction = async (privateKey, from, to, value) => {
    const gasPrice = await getGasPriceFromOralce();

    //make sure not overlaping previous transaction, use 'pending'
    const nonce = await getAccountNonce(from, "pending");

    // maybe sometime we will call contract
    const gasLimit = await estimateGas({to: to, data: '0x'});

    const rawTx = {
        nonce: web3.utils.toHex(nonce),
        gasPrice: web3.utils.toHex(gasPrice.fast),
        gasLimit: web3.utils.toHex(gasLimit),
        to: to,
        value: web3.utils.toHex(value)
    }
    const tx = new Tx(rawTx);
    tx.sign(new Buffer(privateKey, 'hex'));
    const serializedTx = tx.serialize();
    const txid = tx.hash().toString('hex');
    const rawHex = '0x' + serializedTx.toString('hex');

    return [rawHex, txid];
}

const sendSignedTransaction = (rawHex, cb)  => {
    return web3.eth.sendSignedTransaction(rawHex, cb);
}

module.exports = {
    addressMatchShares: addressMatchShares,
    getAccountNonce: getAccountNonce,
    getBlance: getBalance,
    getTransactionReceipt: getTransactionReceipt,
    getBlockNumber: getBlockNumber,
    reConstructPrivateKey: reConstructPrivateKey,
    buildRawTransaction: buildRawTransaction,
    sendSignedTransaction: sendSignedTransaction
};
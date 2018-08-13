const Web3 = require('web3');
const Tx = require('ethereumjs-tx');
const secrets = require('secrets.js');
const fetch = require("node-fetch");

const web3Providers = "http://192.168.33.115:8545/";
const web3 = new Web3(new Web3.providers.HttpProvider(web3Providers));

const addressMatchShares = (address, shares) => {
    const privateKey = secrets.combine(shares);
    const x = web3.eth.accounts.privateKeyToAccount('0x'+privateKey);

    return x.address === address;
};

const reConstructPrivateKey = (shares) => {
    return secrets.combine(shares);
}

const getTransactionReceipt = async (txid) => {
    const detail = await web3.eth.getTransactionReceipt(txid);

    return detail;
};

const getBlockNumber = async () => {
    const blkno = await web3.eth.getBlockNumber();

    return blkno;
}

const buildRawTransaction = async (privateKey, to, nonce, gasPrice, gasLimit, value) => {
    const rawTx = {
        nonce: web3.utils.toHex(nonce),
        gasPrice: web3.utils.toHex(gasPrice),
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

module.exports = {
    addressMatchShares: addressMatchShares,
    getTransactionReceipt: getTransactionReceipt,
    getBlockNumber: getBlockNumber,
    reConstructPrivateKey: reConstructPrivateKey,
    buildRawTransaction: buildRawTransaction
};

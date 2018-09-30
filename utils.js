const Web3 = require('web3');
const Tx = require('ethereumjs-tx');
const secrets = require('secrets.js');
const fetch = require("node-fetch");
const bitcore = require('bitcore-lib');

//const web3Providers = "http://192.168.33.115:8545/";
const web3Providers = "https://ropsten.infura.io/Y4zS49bjsYwtRU3Tt4Yj";
const web3 = new Web3(new Web3.providers.HttpProvider(web3Providers));

const BtcUrl = "http://192.168.33.115:3002";
const MinerFeeOracle = "https://api.blockcypher.com/v1/btc/main";

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
// ---------------------btc----------------------

// get utxos that confirmations >= 1
const getConfirmedUtxo = async (address) => {
    const endpoint = BtcUrl + `/insight-api/addr/${address}/utxo`;

    let response = await fetch(endpoint);
    let utxos = await response.json();

    return utxos.filter(u => u.confirmations >= 1);
}

const getTxInfo = async (txid) => {
    const endpoint = BtcUrl + `/insight-api/tx/${txid}`;

    let response = await fetch(endpoint);
    if (response.status !== 200) {
        throw new Error("Cant find this transaction")
    }
    let txinfo = await response.json();

    return txinfo;
}

const estimateMinerFee = async () => {
    let response = await fetch(MinerFeeOracle);
    let json = await response.json();

    return {
        "high": json.high_fee_per_kb,
        "medium": json.medium_fee_per_kb,
        "low": json.low_fee_per_kb
    }
}

const getBalance = async (address) => {
    const endpoint = BtcUrl + `/insight-api/addr/${address}/balance`;

    let response = await fetch(endpoint);

    return await response.json();
}

// inspired from: https://zhuanlan.zhihu.com/p/36030990
const coinSelector = async (address, amount) => {
    let totalBalance = await getBalance(address)
    if(totalBalance < amount) {
        throw new Error("Not enough funds");
    }

    const utxos = await getConfirmedUtxo(address);

    // if there is an utxo match `amount`, then return this utxo
    for(var i = 0; i < utxos.length; i++) {
        if (utxos[i].satoshis === amount) {
            return utxos[i];
        }
    }

    // find all utxos that less than amount and check if the sum is equal to amount
    const picked = utxos.filter(u => u.satoshis < amount);
    var sum = 0;
    for(i = 0; i < picked.length; i++) {
        sum += picked[i].satoshis;
    }

    if (sum === amount) {
        return picked;
    }

    // if all those utxo less than amount sumed up less than `amount`,
    // chose the first utxo that greater than `amount`
    if (sum < amount) {
        for (i = 0; i < utxos.length; i++) {
            if (utxos[i].satoshis > amount) {
                return utxos[i];
            }
        }
    }

    // none of the above conditons matched:
    // TODO: sort by mutiple metrics
    utxos.sort((x, y) => x.satoshis < y.satoshis);
    let accumulated = 0;
    let result = [];
    for(i = 0; i < utxos.length; i++) {
        accumulated += utxos[i].satoshis;
        result.push(utxos[i]);
        if (accumulated > amount) {
            return result;
        }
    }
}

const btcAddressMatchShares = (address, network, shares) => {
    let privateKey = secrets.combine(shares);
    privateKey = new bitcore.PrivateKey(privateKey);
    const publicKey = privateKey.toPublicKey();

    if (network === "testnet") {
        var addr = publicKey.toAddress(bitcore.Networks.testnet).toString();
    } else if (network === "livenet") {
        var addr = publicKey.toAddress(bitcore.Networks.livenet).toString();
    } else {
        throw new Error("unsupported network");
    }

    return addr === address;
}

const BtcTx = () => {
    return new bitcore.Transaction();
}

module.exports = {
    addressMatchShares: addressMatchShares,
    getTransactionReceipt: getTransactionReceipt,
    getBlockNumber: getBlockNumber,
    reConstructPrivateKey: reConstructPrivateKey,
    buildRawTransaction: buildRawTransaction,

    // ------ btc --------
    getConfirmedUtxo: getConfirmedUtxo,
    coinSelector: coinSelector,
    getBalance: getBalance,
    btcAddressMatchShares: btcAddressMatchShares,
    BtcTx: BtcTx,
    getTxInfo: getTxInfo,
    estimateMinerFee: estimateMinerFee
};

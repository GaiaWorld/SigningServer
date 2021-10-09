const Web3 = require('web3');
const Tx = require('ethereumjs-tx');
const secrets = require('secrets.js');
const fetch = require("node-fetch");
const bitcore = require('bitcore-lib');

const RopstenWeb3Provider = "https://ropsten.infura.io/v3/80991bc5817c42d4bf65b915303deb7a";
const RinkebyWeb3Provider = "https://rinkeby.infura.io/v3/80991bc5817c42d4bf65b915303deb7a";
const KovanWeb3Provider = "https://kovan.infura.io/v3/80991bc5817c42d4bf65b915303deb7a";
const MainnetWeb3Provider = "https://mainnet.infura.io/v3/80991bc5817c42d4bf65b915303deb7a";

const RopstenWeb3 = new Web3(new Web3.providers.HttpProvider(RopstenWeb3Provider));
const RinkebyWeb3 = new Web3(new Web3.providers.HttpProvider(RinkebyWeb3Provider));
const KovanWeb3 = new Web3(new Web3.providers.HttpProvider(KovanWeb3Provider));
const MainnetWeb3 = new Web3(new Web3.providers.HttpProvider(MainnetWeb3Provider));

const BtcLivenet = "http://localhost:3002/insight-api";
const BtcTestnet = "http://localhost:3001/insight-api"
const MinerFeeOracle = "https://api.blockcypher.com/v1/btc/main";

const addressMatchShares = (address, shares) => {
    const privateKey = secrets.combine(shares);
    const x = MainnetWeb3.eth.accounts.privateKeyToAccount('0x' + privateKey);

    return x.address === address;
};

const reConstructPrivateKey = (shares) => {
    return secrets.combine(shares);
}

const getTransactionReceipt = async (txid, network) => {
    let detail;

    switch (network) {
        case "mainnet":
            detail = await MainnetWeb3.eth.getTransactionReceipt(txid);
            break;
        case "ropsten":
            detail = await RopstenWeb3.eth.getTransactionReceipt(txid);
            break;
        case "rinkeby":
            detail = await RinkebyWeb3.eth.getTransactionReceipt(txid);
            break;
        case "kovan":
            detail = await KovanWeb3.eth.getTransactionReceipt(txid);
            break;
        default:
            // placeholder
            break;
    }

    return detail;
};

const getBlockNumber = async (network) => {
    let blkno;

    switch (network) {
        case "mainnet":
            blkno = await MainnetWeb3.eth.getBlockNumber();
            break;
        case "ropsten":
            blkno = await RopstenWeb3.eth.getBlockNumber();
            break;
        case "rinkeby":
            blkno = await RinkebyWeb3.eth.getBlockNumber();
            break;
        case "kovan":
            blkno = await KovanWeb3.eth.getBlockNumber();
            break;
        default:
            // placeholder
            break;
    }

    return blkno;
}

const buildRawTransaction = async (privateKey, to, nonce, gasPrice, gasLimit, value) => {
    const rawTx = {
        nonce: MainnetWeb3.utils.toHex(nonce),
        gasPrice: MainnetWeb3.utils.toHex(gasPrice),
        gasLimit: MainnetWeb3.utils.toHex(gasLimit),
        to: to,
        value: MainnetWeb3.utils.toHex(value)
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
const getConfirmedUtxo = async (address, network) => {
    let endpoint;

    if (network === "livenet") {
        endpoint = BtcLivenet + `/addr/${address}/utxo`;
    } else if (network === "testnet") {
        endpoint = BtcTestnet + `/addr/${address}/utxo`;
    }

    let response = await fetch(endpoint);
    let utxos = await response.json();

    return utxos.filter(u => u.confirmations >= 1);
}

const getTxInfo = async (txid, network) => {
    let endpoint;

    if (network === "livenet") {
        endpoint = BtcLivenet + `/tx/${txid}`;
    } else if (network === "testnet") {
        endpoint = BtcTestnet + `/tx/${txid}`;
    }

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

const getBalance = async (address, network) => {
    let endpoint;

    if (network === "livenet") {
        endpoint = BtcLivenet + `/addr/${address}/balance`;
    } else if (network === "testnet") {
        endpoint = BtcTestnet + `/addr/${address}/balance`;
    }

    let response = await fetch(endpoint);

    return await response.json();
}

// inspired from: https://zhuanlan.zhihu.com/p/36030990
const coinSelector = async (address, amount, network) => {
    let totalBalance = await getBalance(address, network)
    if (totalBalance < amount) {
        throw new Error("Not enough funds");
    }

    const utxos = await getConfirmedUtxo(address, network);

    // if there is an utxo match `amount`, then return this utxo
    for (var i = 0; i < utxos.length; i++) {
        if (utxos[i].satoshis === amount) {
            return utxos[i];
        }
    }

    // find all utxos that less than amount and check if the sum is equal to amount
    const picked = utxos.filter(u => u.satoshis < amount);
    var sum = 0;
    for (i = 0; i < picked.length; i++) {
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
    for (i = 0; i < utxos.length; i++) {
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


// ---------------------币安链----------------------

// TODO 交易签名
/**
 * 
 * @param {string} signStr 代签名字符串
 * @param {string} key 私钥
 * @returns sign
 */
const bnbWithdrawalSign = async (signStr, privateKey) => {

    // return MainnetWeb3.eth.accounts.sign(signStr, privateKey);
    let arr = JSON.parse(signStr);
    let signStr2 = await MainnetWeb3.utils.soliditySha3(...arr);
    return MainnetWeb3.eth.accounts.sign(signStr2, privateKey);
}

const hexToArrayBuffer = (input) => {
    if (typeof input !== 'string') {
        throw new TypeError('Expected input to be a string')
    }

    if ((input.length % 2) !== 0) {
        throw new RangeError('Expected string to be an even number of characters')
    }

    var input2 = input.replace(/^0x/, '');

    const view = new Uint8Array(input2.length / 2)

    for (let i = 0; i < input2.length; i += 2) {
        view[i / 2] = parseInt(input2.substring(i, i + 2), 16)
    }

    return view
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
    estimateMinerFee: estimateMinerFee,

    // ------- bnb --------
    bnbWithdrawalSign: bnbWithdrawalSign
};
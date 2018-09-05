const secrets = require('secrets.js');
const utils = require('./utils');
require('express-async-errors');

const testAddressMatchShares = () => {
    const privateKey = 'abd952e991fb40a146291e6c537fc0db0d1b6de0a815df11efb7e73e1e50daf8'; // must be '0x' prefixed
    const address = '0x040e7783A06e9b994F6e90DF5b2933C03F1b8F21';
    const shares = secrets.share(privateKey, 5, 3);
    console.log(shares)
    console.assert(utils.addressMatchShares(address, shares.slice(1,4)), true);
};

const testBtcAddressMatchShares = () => {
    const privateKey = 'b26412fd29bab29511990b02a1cd20c5d51d17987d4a80f6447293da5fe024e6';
    const address = 'mzJ1AAKQpMj5eaCL3b4oNuSantXmVgz2tM';
    const shares = secrets.share(privateKey, 5, 3);
    console.log(shares);
    console.assert(utils.btcAddressMatchShares(address, "testnet", shares.slice(1, 4)), true);
}

testBtcAddressMatchShares();


const testCoinSeletor = async () => {
    let address = 'mzJ1AAKQpMj5eaCL3b4oNuSantXmVgz2tM';

    console.log(await utils.coinSelector(address, 453001));
}

testCoinSeletor()

const testGetConfirmedUtxos = async () => {
    let a = await utils.getConfirmedUtxo('myxeUAtbtdqWkG1xBwDyB98MV86wcPvLBW')

    console.log(a)
}

testGetConfirmedUtxos()
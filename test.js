const secrets = require('secrets.js');
const utils = require('./utils');

const testAddressMatchShares = () => {
    const privateKey = 'abd952e991fb40a146291e6c537fc0db0d1b6de0a815df11efb7e73e1e50daf8'; // must be '0x' prefixed
    const address = '0x040e7783A06e9b994F6e90DF5b2933C03F1b8F21';
    const shares = secrets.share(privateKey, 5, 3);
    console.log(shares)
    console.assert(utils.addressMatchShares(address, shares.slice(1,4)), true);
};

testAddressMatchShares();



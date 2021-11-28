const {ethers} = require('ethers');
require('dotenv').config();

const providerURL = 'http://localhost:8545';
const provider = new ethers.providers.JsonRpcProvider(providerURL);
let balance = await provider.getBalance(process.env.ADDRESS);

console.log(balance);

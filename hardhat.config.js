require("@nomiclabs/hardhat-waffle");
require('dotenv').config()

const LOCAL_URL = "http://127.0.0.1:8545/"; 

const PRIVATE_KEY = process.env.PRIVATE_KEY;

module.exports = {
  solidity: "0.7.3",
  networks: {
    localhost: {
      url: LOCAL_URL
    },
    hardhat: {}
  }
};

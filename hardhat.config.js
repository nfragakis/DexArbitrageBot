require("@nomiclabs/hardhat-waffle");

const LOCAL_URL = "http://127.0.0.1:8545/"; 

module.exports = {
  solidity: "0.7.3",
  networks: {
    localhost: {
      url: LOCAL_URL
    },
    hardhat: {}
  }
};

# Uniswap / Sushiswap Arbitrage Bot
Bot that monitors UniswapV2 and Sushiswap routers for  opportunities where a given pair of tokens is priced considerably different on any 2 DEXes.  

Bot identifies opportunities, then buys at a cheaper rate on 1 DEX and sells at the higer rate on the other.

This repo is a proof-of-concept implementation not tested on mainnet, use at your own risk.

## Usage
``` bash
# Clone repo
git clone https://github.com/nfragakis/DexArbitrageBot.git

# install dependencies
npm install

# set environment variables
EXPORT PRIVATE_KEY="{insert your key}"
EXPORT RPC_ENDPOINT="{insert rpc url}"

# run bot
ts-node scripts/app.ts
```

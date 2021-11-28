const ethers = require('ethers');
const BigNumber = ethers.BigNumber;
const {
  Fetcher,
  Token,
  WETH,
  ChainId,
  TradeType,
  Percent,
  Route,
  Trade,
  TokenAmount,
} = require('@uniswap/sdk');

// import abi's
const IERC20_abi = require('../abi/ierc20_abi.json');
const UNI_ROUTER_abi = require('../abi/uni_router_abi.json');
const SUSHI_ROUTER_ABI = require('../abi/sushi_router.json');
require('dotenv').config();


// set to local providor (from forked node)
const providerURL = 'http://localhost:8545';
const provider = new ethers.providers.JsonRpcProvider(providerURL);

// load wallet params from env
const testAccountAddress = process.env.ADDRESS;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// constants
const ETH_ADDRESS = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
const MAX_UINT256 = ethers.constants.MaxUint256;
const ZERO_BN = ethers.constants.Zero;
const MAINNET = ChainId.MAINNET;

const DAI_ADDRESS = "0x6b175474e89094c44da98b954eedeac495271d0f";
const LINK_ADDRESS = "0x514910771af9ca656af840dff83e8264ecf986ca";
const OHM_ADDRESS = "0x383518188c0c6d7730d91b2c03a03c837814a899";

const UNI_ADDRESS = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
const SUSHI_ADDRESS = "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F";

// ARB Tokens
const Tokens = {
  WETH: WETH[MAINNET],
  DAI: new Token(MAINNET, DAI_ADDRESS, 18, 'DAI'),
  LINK: new Token(MAINNET, LINK_ADDRESS, 18, 'LINK'),
  OHM: new Token(MAINNET, OHM_ADDRESS, 9, 'OHM')
}

// instantiate arb contracts
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

const wethContract = new ethers.Contract(Tokens.WETH.address, IERC20_abi, wallet);
const daiContract = new ethers.Contract(Tokens.DAI.address, IERC20_abi, wallet);
const linkContract = new ethers.Contract(Tokens.LINK.address, IERC20_abi, wallet);
const ohmContract = new ethers.Contract(Tokens.OHM.address, IERC20_abi, wallet);

const uniswap = new ethers.Contract(UNI_ADDRESS, UNI_ROUTER_abi, wallet);
const sushiswap = new ethers.Contract(SUSHI_ADDRESS, SUSHI_ROUTER_ABI, wallet);


const getDeadlineAfter = delta => {
  Math.floor(Date.now() / 1000) + (60* Number.parseInt(delta,10))
};

const toHex = n => `0x${n.toString(16)}`;

async function getTokenBalanceInBN(address, tokenContract) {
  const balance = await tokenContract.balanceOf(address);
  return BigNumber.from(balance);
}

async function getTokenBalance(address, tokenContract) {
  const balance = await tokenContract.balanceOf(address);
  const decimals = await tokenContract.decimals();
  return ethers.utils.formatUnits(balance, decimals);
}

async function printAccountBalance(address) {
  const balance = await provider.getBalance(address);

  console.log(address);
  const wethBalance = await getTokenBalance(address, wethContract);
  const daiBalance = await getTokenBalance(address, daiContract);
  const linkBalance = await getTokenBalance(address, linkContract);
  const ohmBalance = await getTokenBalance(address, ohmContract);
  
  console.log(`Account balance: ${ethers.utils.formatUnits(balance,18)} ethers, ${wethBalance} weth, ${daiBalance} DAI, ${linkBalance} LINK, ${ohmBalance} OHM`);
}

async function swapEthToToken(ethAmount, token, userAddress, dexContract) {
  const {
      amountOutMin,
      amountOutMinRaw,
      value
  } = await constructTradeParameters( Tokens.WETH, token, ethAmount );

  console.log(`Value = ${value}`);
  console.log(`Going to swap ${ethAmount} ETH for ${token.symbol} tokens`);
  const tx = await dexContract.swapExactETHForTokens(
      toHex(amountOutMinRaw),
      [ Tokens.WETH.address, token.address ],
      userAddress,
      getDeadlineAfter( 20 ),
      { value }
  );

  await printTxDetails(tx);
  await printAccountBalance(userAddress);
}

async function checkAndApproveTokenForTrade(srcTokenContract, userAddress, srcQty, factoryAddress) {
  console.log(`Evaluating : approve ${srcQty} tokens for trade`);
  if (srcTokenContract.address == ETH_ADDRESS) {
    return;
  }

  let existingAllowance = await srcTokenContract.allowance(userAddress, factoryAddress);
  console.log(`Existing allowance ${existingAllowance}`);

  if (existingAllowance.eq(ZERO_BN)) {
    console.log(`Approving contract to max allowance ${srcQty}`);
    await srcTokenContract.approve(factoryAddress, srcQty);
  } else if (existingAllowance.lt(srcQty)) {
    // if existing allowance is insufficient, reset to zero, then set to MAX_UINT256
    //setting approval to 0 and then to a max is suggestible since  if the address already has an approval, 
    //setting again to a max would bump into error
    console.log(`Approving contract to zero, then max allowance ${srcQty}`);
    await srcTokenContract.approve(factoryAddress, ZERO_BN);
    await srcTokenContract.approve(factoryAddress, srcQty);
  } 
  return;
}


async function constructTradeParameters( tokenA, tokenB, tokenAmount ) {
  const slippageTolerance = new Percent( '50', '100' );
  const pair = await Fetcher.fetchPairData( tokenA, tokenB );
  const route = new Route([ pair ], tokenA );
  const trade = new Trade(
      route,
      new TokenAmount( tokenA, tokenAmount ),
      TradeType.EXACT_INPUT,
  );

  const minimumAmountOut = trade.minimumAmountOut( slippageTolerance );
  console.log(`minimumAmountOut is ${minimumAmountOut.raw}`);

  return {
      amountOutMin : minimumAmountOut,
      amountOutMinRaw : minimumAmountOut.raw,
      value: toHex( trade.inputAmount.raw )
  };
}


async function swap(tokenA, tokenB, userAddress, tokenAContract, dexContract) {
  const inputTokenAmount = await getTokenBalanceInBN(userAddress, tokenAContract);
  const {
      amountOutMin,
      amountOutMinRaw,
      value
  } = await constructTradeParameters( tokenA , tokenB , inputTokenAmount);

  console.log(`Going to swap ${ethers.utils.formatUnits(inputTokenAmount, 18)} ${tokenA.symbol} tokens for ${amountOutMinRaw} ${tokenB.symbol}`);
  await checkAndApproveTokenForTrade(tokenAContract, wallet.address, inputTokenAmount, dexContract.address);

  console.log("Swapping..");
  const tx = await dexContract.swapExactTokensForTokens(
      inputTokenAmount,
      toHex(amountOutMinRaw),
      [ tokenA.address, tokenB.address],
      userAddress,
      getDeadlineAfter( 20 ),
      { gasLimit: 300000}
      );

  await printTxDetails(tx);
  await printAccountBalance(userAddress);
}


async function printTxDetails(tx) {
  console.log(`Transaction hash: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`Transaction was mined in block ${receipt.blockNumber}`);
}


async function searchProfitableArbitrage(args) {
  const { inputToken, outputToken, inputTokenContract, outputTokenContract } = args
  const inputTokenSymbol = inputToken.symbol
  const outputTokenSymbol = outputToken.symbol
  const tradeAmount = BigNumber.from("1000000000000000000");
  const uniRates1 = await uniswap.getAmountsOut(tradeAmount, [ inputToken.address, outputToken.address]);
  console.log(`Uniswap Exchange Rate: ${ethers.utils.formatUnits(uniRates1[0], 18)} ${inputTokenSymbol} = ${ethers.utils.formatUnits(uniRates1[1], 18)} ${outputTokenSymbol}`);

  const uniRates2 = await uniswap.getAmountsOut(tradeAmount, [ outputToken.address, inputToken.address]);
  console.log(`Uniswap Exchange Rate: ${ethers.utils.formatUnits(uniRates2[0], 18)} ${outputTokenSymbol} = ${ethers.utils.formatUnits(uniRates2[1], 18)} ${inputTokenSymbol}`);

  const sushiRates1 = await sushiswap.getAmountsOut(tradeAmount, [ inputToken.address, outputToken.address]);
  console.log(`Sushiswap Exchange Rate: ${ethers.utils.formatUnits(sushiRates1[0], 18)} ${inputTokenSymbol} = ${ethers.utils.formatUnits(sushiRates1[1], 18)} ${outputTokenSymbol}`);

  const sushiRates2 = await sushiswap.getAmountsOut(tradeAmount, [ outputToken.address, inputToken.address]);
  console.log(`Sushiswap Exchange Rate: ${ethers.utils.formatUnits(sushiRates2[0], 18)} ${outputTokenSymbol} = ${ethers.utils.formatUnits(sushiRates2[1], 18)} ${inputTokenSymbol}`);

  const sushiswapRates = {
      buy: sushiRates1[1],
      sell: sushiRates2[1]
  };

  const uniswapRates = {
      buy: uniRates1[1],
      sell: uniRates2[1]

  };

  // profit1 = profit if we buy input token on uniswap and sell it on sushiswap
  const profit1 = tradeAmount * (uniswapRates.sell - sushiswapRates.buy - gasPrice * 0.003);

  // profit2 = profit if we buy input token on sushiswap and sell it on uniswap

  const profit2 = tradeAmount * (sushiswapRates.sell - uniswapRates.buy - gasPrice * 0.003);
  console.log(`Profit from UniswapSushiswap : ${profit1}`)
  console.log(`Profit from SushiswapUniswap : ${profit2}`)

  if(profit1 > 0 && profit1 > profit2) {
      //Execute arb Uniswap  Sushiswap
      console.log(`Arbitrage Found: Make ${profit1} : Sell ${inputTokenSymbol} on Uniswap at ${uniswapRates.sell} and Buy ${outputTokenSymbol} on Sushiswap at ${sushiswapRates.buy}`);
      await swap(inputToken, outputToken, testAccountAddress, inputTokenContract, uniswap);
      await swap(outputToken, inputToken, testAccountAddress, outputTokenContract, sushiswap);
  } else if(profit2 > 0) {
      //Execute arb Sushiswap  Uniswap
      console.log(`Arbitrage Found: Make ${profit2} : Sell ${inputTokenSymbol} on Sushiswap at ${sushiswapRates.sell} and Buy ${outputTokenSymbol} on Uniswap at ${uniswapRates.buy}`);
      await swap(inputToken, outputToken, testAccountAddress, inputTokenContract, sushiswap);
      await swap(outputToken, inputToken, testAccountAddress, outputTokenContract, uniswap);
  }
}

let isMonitoringPrice = false
let isInitialTxDone = false
async function monitorPrice() {
  if(isMonitoringPrice) {
    return
  }

  if (!isInitialTxDone) {
    isInitialTxDone = true
    // convert DAI from ETH 
    const twoEther = BigNumber.from("2000000000000000000");
    console.log(ethers.utils.formatUnits(twoEther));

    await printAccountBalance(testAccountAddress);
    await swapEthToToken(twoEther, Tokens.DAI, testAccountAddress, uniswap);
  }
  await printAccountBalance(testAccountAddress);

  console.log("Checking prices for possible arbitrage opportunities...")
  isMonitoringPrice = true

  try {
    await searchProfitableArbitrage({
      inputToken: Tokens.DAI,
      outputToken: Tokens.LINK,
      inputTokenContract: daiContract, 
      outputTokenContract: linkContract
    });

  } catch (error) {
    console.error(error)
    isMonitoringPrice = false
    return
  }

  isMonitoringPrice = false
}
let priceMonitor = setInterval(async () => { await monitorPrice() }, 1000)
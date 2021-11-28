import {
    sushiswapABI,
    uniswapABI,
    IERC20_ABI
} from "./utils/constants";

import { 
    BigNumber,
    Contract,
    providers,
    utils,
    Wallet
 } from "ethers";

import {
    Fetcher,
    Token,
    WETH,
    ChainId,
    TradeType,
    Percent,
    Route,
    Trade,
    TokenAmount
} from "@uniswap/sdk"

import { TokenMetadata } from "./utils/types";

import * as dotenv from "dotenv"
dotenv.config();

const providerURL: string = 'http://localhost:8545';
const providor: ethers.providers.JsonRpcProvider = new ethers.providers.JsonRpcProvider( providerURL );

/*
CONSTANTS
*/
const ETH_ADDRESS: string = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
const MAX_UINT256: BigNumber = ethers.constants.MaxUint256;
const ZERO_BN: BigNumber = ethers.constants.Zero;
const MAINNET = ChainId.MAINNET;

const DAI_ADDRESS: string = "0x6b175474e89094c44da98b954eedeac495271d0f";
const LINK_ADDRESS: string = "0x514910771af9ca656af840dff83e8264ecf986ca";
const OHM_ADDRESS: string = "0x383518188c0c6d7730d91b2c03a03c837814a899";

const UNI_ADDRESS:string = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
const SUSHI_ADDRESS:string = "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F";


export default class ArbBot {
    // Ethers Provider
    rpc: providers.JsonRpcProvider;

    // Arbitrage Trading Wallet
    wallet: Wallet;

    // Tokens to watch
    token1: TokenMetadata;
    token2: TokenMetadata;



}
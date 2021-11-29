import { Contract } from "ethers"; 
import { CurrencyAmount, Token, JSBI} from "@uniswap/sdk";
import { BigNumber } from "ethers";

export interface TokenMetadata {
    name: string;
    address: string;
    decimals: number;
    contract?: Contract;
    token?: Token;
}

export interface TradeParams {
    amountOutMin: CurrencyAmount;
    amountOutMinRaw: JSBI;
    value: JSBI | string;
}
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

import { TokenMetadata, TradeParams } from "./utils/types";
import { toHex, getDeadlineAfter } from "./utils/helper";

export default class ArbBot {
    // Ethers Provider
    rpc: providers.JsonRpcProvider;

    // Arbitrage Trading Wallet
    wallet: Wallet;

    // Token Metadata
    token1: TokenMetadata;
    token2: TokenMetadata;
    weth: TokenMetadata;

    // Contracts to interact with
    UniContract: Contract;
    SushiContract: Contract;
    WethContract: Contract;
    token1Contract: Contract;
    token2Contract: Contract;

    /**
     * Setup token contracts + RPC details
     * @param {string} rpcEndpoint for network
     * @param {string} privateKey for wallet performing arbs
     * @param {string} address for Uniswap Dex
     * @param {string} address for Sushi Dex
     * @param {string} address for WETH
     * @param {TokenMetadata} object with token info (address, abi, decimals)
     * @param {TokenMetadata} object with token info (address, abi, decimals)
     * @param {string} Dex ChainID 
     */
    constructor(
        rpcEndpoint: string,
        privateKey: string,
        uniAddress: string,
        sushiAddress: string,
        weth: TokenMetadata,
        token1: TokenMetadata,
        token2: TokenMetadata,
        chainID: number
    ) {
        // networking + wallet 
        this.rpc = new providers.JsonRpcProvider(rpcEndpoint);
        this.wallet = new Wallet(privateKey, this.rpc);

        // Setup DEX/ Token details
        this.UniContract = new Contract(uniAddress, uniswapABI, this.wallet);
        this.SushiContract = new Contract(sushiAddress, sushiswapABI, this.wallet);

        this.weth.contract = new Contract(weth.address, IERC20_ABI, this.wallet);
        this.weth.token = new Token(chainID, this.weth.address, this.weth.decimals, this.weth.name);

        this.token1.contract = new Contract(token1.address, IERC20_ABI, this.wallet);
        this.token1.token = new Token(chainID, this.token1.address, this.token1.decimals, this.token1.name);

        this.token2.contract = new Contract(token2.address, IERC20_ABI, this.wallet);
        this.token2.token = new Token(chainID, this.token2.address, this.token2.decimals, this.token2.name);
    }

    /**
     * Grabs token balance of ERC20 tokens
     * @param {TokenMetadata} token 
     * @returns string formatted balance
     */
    async getTokenBalance(token: TokenMetadata): Promise<string> {
        const balance: any = await token.contract.balanceOf(this.wallet.address);
        const decimals: number = token.decimals;
        return utils.formatUnits(balance, decimals);
    }

    /**
     * Prints balance of all tokens in ARB + ETH/WETH
     */
    async printAccountBalance() {
        const EthBalance: BigNumber = await this.rpc.getBalance(this.wallet.address);
        const wethBalance: string = await this.getTokenBalance(this.weth);
        const token1Balance: string = await this.getTokenBalance(this.token1);
        const token2Balance: string = await this.getTokenBalance(this.token2);
        console.log(
            `Account Balance\n
            ETH: ${utils.formatUnits(EthBalance, 18)}\n
            WETH: ${wethBalance}\n
            ${this.token1.name}: ${token1Balance}\n
            ${this.token2.name}: ${token2Balance}
        `)
    }

    async printTxDetails(tx) {
        console.log(`Transaction hash: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`Transaction was mined in block ${receipt.blockNumber}`);
    }

    /**
     * Construct Uni-Style Trade parameters for arb
     * @param {TokenMetadata} tokenA info
     * @param {TokenMetadata} tokenB info
     * @param {BigNumber} amount to swap
     */
    async constructTradeParameters(
        tokenA: Token, 
        tokenB: Token, 
        tokenAmount: string
    ): Promise<TradeParams> {
        const slippageTolerance = new Percent('50', '100');
        const pair = await Fetcher.fetchPairData(tokenA, tokenB);
        const route = new Route([pair], tokenA);
        const trade = new Trade(
            route,
            new TokenAmount(tokenA, tokenAmount),
            TradeType.EXACT_INPUT,
        );

        const minimumAmountOut = trade.minimumAmountOut(slippageTolerance);
        
        return {
            amountOutMin: minimumAmountOut,
            amountOutMinRaw: minimumAmountOut.raw, 
            value: trade.inputAmount.raw,
        };
    }
    /**
     * Dex swap WETH for ERC20 Compliant Token 
     * @param ethAmount {string} amount to swap
     * @param swapFor {TokenMetadata} token to swap for
     * @param dexContract {Contract} DEX performing swap
     */
    async swapEthToToken(
        ethAmount: string, 
        swapFor: TokenMetadata, 
        dexContract: Contract
    ): Promise<void> {
        const {
            amountOutMin,
            amountOutMinRaw,
            value
        } = await this.constructTradeParameters(this.weth.token, swapFor.token, ethAmount);

        console.log(`Swapping ${ethAmount} ETH for ${swapFor.name}`);
        const tx = await dexContract.swapExactEthForTokens(
            toHex(amountOutMinRaw),
            [this.weth.address, swapFor.address],
            this.wallet.address,
            getDeadlineAfter(20),
            { value }
        );

        await this.printTxDetails(tx);
        await this.printAccountBalance();
    }

    /**
     * 
     * @param isMonitoringPrice 
     * @param isInitialTxDone 
     * @param tokenA 
     * @returns 
     */
    async monitorPrice(
        isMonitoringPrice: boolean, 
        isInitialTxDone: boolean,
        tokenA: TokenMetadata
    ): Promise<void> {
        if(isMonitoringPrice) {
            return 
        }

        if (!isInitialTxDone) {
            isInitialTxDone = true;

            // Convert 1 ETH to DAI
            const oneEther = utils.formatUnits(
                BigNumber.from("1000000000000000000")
            );
            console.log(`Swapping ${utils.formatUnits(oneEther)} to ${this.token1.name}`)
            await this.swapEthToToken(oneEther, tokenA, this.UniContract);
        }
        await this.printAccountBalance();

        console.log("Checking ARB options...")
        isMonitoringPrice = true;

    }



}
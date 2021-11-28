import {
    sushiswapABI,
    uniswapABI,
    IERC20_ABI,
    ZERO_BN,
    ETH_ADDRESS
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
    TokenAmount,
    BigintIsh
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

    async getTokenBalanceInBN(token: TokenMetadata): Promise<BigNumber> {
        const balance = await token.contract.balanceOf(this.wallet.address);
        return BigNumber.from(balance);
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
        tokenAmount: BigNumber
    ): Promise<TradeParams> {
        const slippageTolerance = new Percent('50', '100');
        const pair = await Fetcher.fetchPairData(tokenA, tokenB);
        const route = new Route([pair], tokenA);
        const trade = new Trade(
            route,
            new TokenAmount(tokenA, tokenAmount.toHexString()),
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
        ethAmount: BigNumber, 
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

    async checkAndApproveTokenForTrade(
        srcTokenContract: Contract,
        srcQty: BigNumber,
        dexAddress: string
    ): Promise<void> {
        console.log(`Evaluating: approve ${srcQty} tokens for trade`);
        if (srcTokenContract.address == ETH_ADDRESS) {
            return;
        }

        let existingAllowance = await srcTokenContract.allowance(this.wallet.address, dexAddress);
        console.log(`Existing allowance ${existingAllowance}`);

        if (existingAllowance.eq(ZERO_BN)) {
            console.log(`Approving contract to max allowance ${srcQty}`);
            await srcTokenContract.approve(dexAddress, srcQty);
        } else if (existingAllowance.lt(srcQty)) {
            // if existing allowance is insufficient, reset to zero, then set to MAX_UINT256
            //setting approval to 0 and then to a max is suggestible since  if the address already has an approval, 
            //setting again to a max would bump into error
            console.log(`Approving contract to zero, then max allowance ${srcQty}`);
            await srcTokenContract.approve(dexAddress, ZERO_BN);
            await srcTokenContract.approve(dexAddress, srcQty);
        }
        return;
    }

    async swap(
        tokenA: TokenMetadata, 
        tokenB: TokenMetadata, 
        dexContract: Contract
    ): Promise<void> {
        const inputTokenAmount = await this.getTokenBalanceInBN(tokenA);
        const {
            amountOutMin,
            amountOutMinRaw,
            value
        } = await this.constructTradeParameters(tokenA.token, tokenB.token, inputTokenAmount);

        console.log(`Going to swap ${utils.formatUnits(inputTokenAmount, 18)} ${tokenA.name} tokens for ${amountOutMinRaw} ${tokenB.name}`);

        await this.checkAndApproveTokenForTrade(tokenA.contract, inputTokenAmount, dexContract.address);

        console.log("Swapping..");
        const tx = await dexContract.swapExactTokensForTokens(
            inputTokenAmount,
            toHex(amountOutMinRaw),
            [ tokenA.address, tokenB.address],
            this.wallet.address,
            getDeadlineAfter(20),
            { gasLimit: 300000}
            );
        await this.printTxDetails(tx);
        await this.printAccountBalance();
    }

    async searchProfitableArbitrage(tokenA: TokenMetadata, tokenB: TokenMetadata): Promise<void> {
        const tradeAmount = BigNumber.from("1000000000000000000");
        const uniRates1 = await this.UniContract.getAmountsOut(tradeAmount, tokenA.address, tokenB.address);
        console.log(`Uniswap Exchange Rate: ${utils.formatUnits(uniRates1[0], 18)} ${tokenA.name} = ${utils.formatUnits(uniRates1[1], 18)} ${tokenB.name}`);
        const uniRates2 = await this.UniContract.getAmountsOut(tradeAmount, tokenB.address, tokenA.address);
        console.log(`Uniswap Exchange Rate: ${utils.formatUnits(uniRates2[0], 18)} ${tokenB.name} = ${utils.formatUnits(uniRates2[1], 18)} ${tokenA.name}`);

        const sushiRates1 = await this.SushiContract.getAmountsOut(tradeAmount, [ tokenA.address, tokenB.address]);
        console.log(`Sushiswap Exchange Rate: ${utils.formatUnits(sushiRates1[0], 18)} ${tokenA.name} = ${utils.formatUnits(sushiRates1[1], 18)} ${tokenB.name}`);
        const sushiRates2 = await this.SushiContract.getAmountsOut(tradeAmount, [ tokenB.address, tokenA.address]);
        console.log(`Sushiswap Exchange Rate: ${utils.formatUnits(sushiRates2[0], 18)} ${tokenB.name} = ${utils.formatUnits(sushiRates2[1], 18)} ${tokenA.name}`);
        
        const uniswapRates = {
            buy: uniRates1[1],
            sell: uniRates2[1]
        };

        const sushiswapRates = {
            buy: sushiRates1[1],
            sell: sushiRates2[1]
            
        };
        
        // todo estimate gas prices
        const profit1 = tradeAmount.toNumber() * (uniswapRates.sell - sushiswapRates.buy);
        const profit2 = tradeAmount.toNumber() * (sushiswapRates.sell - uniswapRates.buy);
        
        console.log(`Profit from Uniswap<>Sushiswap : ${profit1}`)
        console.log(`Profit from Sushiswap<>Uniswap : ${profit2}`)

        if(profit1 > 0 && profit1 > profit2) {

            //Execute arb Uniswap <=> Sushiswap
            console.log(`Arbitrage Found: Make ${profit1} : Sell ${tokenA.name} on Uniswap at ${uniswapRates.sell} and Buy ${tokenB.name} on Sushiswap at ${sushiswapRates.buy}`);
    
            await this.swap(tokenA, tokenB, this.UniContract);
            await this.swap(tokenB, tokenA, this.SushiContract);
        } else if(profit2 > 0) {
            //Execute arb Sushiswap <=> Uniswap
            console.log(`Arbitrage Found: Make ${profit2} : Sell ${tokenA.name} on Sushiswap at ${sushiswapRates.sell} and Buy ${tokenB.name} on Uniswap at ${uniswapRates.buy}`);
        
            await this.swap(tokenA, tokenB, this.SushiContract);
            await this.swap(tokenB, tokenA, this.UniContract);
        }
    }


    /**
     * 
     * @param isMonitoringPrice 
     * @param isInitialTxDone 
     * @param tokenA 
     * @returns 
     */
    async monitorPrice(
    ): Promise<void> {
        let isMonitoringPrice = false; 
        let isInitialTxDone = false;
        if(isMonitoringPrice) {
            return 
        }

        if (!isInitialTxDone) {
            isInitialTxDone = true;

            // Convert 2 ETH to DAI
            const oneEther = BigNumber.from("2000000000000000000")
            console.log(`Swapping ${utils.formatUnits(oneEther)} to ${this.token1.name}`)
            await this.swapEthToToken(oneEther, this.token1, this.UniContract);
        }
        await this.printAccountBalance();

        console.log("Checking ARB options...")
        isMonitoringPrice = true;

        try {
            await this.searchProfitableArbitrage(this.token1, this.token2);
        } catch (error) {
            console.error(error)
            isMonitoringPrice = false 
            return
        }
        isMonitoringPrice = false
    }
}
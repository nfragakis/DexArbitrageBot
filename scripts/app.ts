import * as dotenv from "dotenv";
import ArbBot from "./ArbBot";
import { TokenMetadata } from "./utils/types";
import { ChainId } from "@uniswap/sdk";

dotenv.config();

(async () => {
    const rpcEndpoint: string = 
        process.env.RPC_ENDPOINT ?? "http://localhost:8545";

    const privateKey: string | undefined = process.env.PRIVATE_KEY;
    const uniAddress: string = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
    const sushiAddress: string = "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F";
    let weth: TokenMetadata = {
        name: "WETH",
        address: "0xc778417e063141139fce010982780140aa0cd5ab",
        decimals: 18
    }
        
    let token1: TokenMetadata = {
        name: "DAI",
        address: "0x5592ec0cfb4dbc12d3ab100b257153436a1f0fea",
        decimals: 18
    };
    let token2: TokenMetadata = {
        name: "BAT",
        address: "0xda5b056cfb861282b4b59d29c9b395bcc238d29b",
        decimals: 18
    };

    const chainID: number = ChainId.RINKEBY;

    if (!privateKey || !uniAddress || !sushiAddress || !token1 || !token2) {
        throw new Error("Missing needed parameters");
    }

    // Initialize ArbBot
    const bot = new ArbBot(
        rpcEndpoint,
        privateKey,
        uniAddress,
        sushiAddress,
        weth,
        token1,
        token2,
        chainID
    )

    let priceMonitor = setInterval(async () => {await bot.monitorPrice() }, 1000);
})();
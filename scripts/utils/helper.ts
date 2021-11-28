import { JSBI } from "@uniswap/sdk";

export const toHex = (n: number | JSBI) => `0x${n.toString(16)}`;

export const getDeadlineAfter = (delta: any) => {
    Math.floor(Date.now() / 1000) + (60 * Number.parseInt(delta, 10))
}
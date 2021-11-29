export const toHex = n => `0x${n.toString(16)}`;

export const getDeadlineAfter = delta => 
    Math.floor(Date.now() / 1000) + (60 * Number.parseInt(delta, 10))

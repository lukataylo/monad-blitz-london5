import { keccak256, toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";

// Deterministic client-side wallet: the private key is derived purely from
// email + password, so the same credentials on any device produce the same
// wallet — cross-device "accounts" with zero server-side key storage and no
// email infra.
//
// SECURITY TRADEOFF (testnet-grade, on purpose): keccak256 of a
// low-entropy string is NOT a proper KDF — there's no salt beyond the fixed
// domain prefix and no work factor, so anyone who learns (or guesses) the
// email+password can recompute the key offline. Good enough for testnet MON
// in a step-challenge game; do NOT reuse this scheme for real funds.
const DOMAIN = "walkthewalk.v1";

export function deriveWallet(
    email: string,
    password: string
): { privateKey: `0x${string}`; address: `0x${string}` } {
    const seed = `${DOMAIN}|${email.trim().toLowerCase()}|${password}`;
    const privateKey = keccak256(toBytes(seed));
    const address = privateKeyToAccount(privateKey).address;
    return { privateKey, address };
}

// Temp password generated client-side at signup ("lime-walrus-otter-42"
// style) and shown on screen once — never emailed, never sent anywhere.
const WORDS = [
    "lime", "cocoa", "maple", "pearl", "ember", "sunny",
    "misty", "pepper", "clover", "walrus", "otter", "heron",
    "panda", "gecko", "lemur", "mango", "tulip", "comet",
    "breeze", "pebble", "willow", "acorn", "dune", "fjord",
];

function randInt(max: number): number {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] % max;
}

export function generatePassword(): string {
    const words: string[] = [];
    while (words.length < 3) {
        const w = WORDS[randInt(WORDS.length)];
        if (!words.includes(w)) words.push(w);
    }
    return `${words.join("-")}-${10 + randInt(90)}`;
}

// Auto-funding: fire-and-forget POST to the faucet, only when a faucet URL
// is configured. Returns true when the drip was accepted.
export async function requestDrip(address: string): Promise<boolean> {
    const base = (import.meta.env.VITE_FAUCET_URL as string | undefined) ?? "";
    if (!base) return false;
    try {
        const res = await fetch(`${base}/drip`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ address }),
        });
        if (!res.ok) {
            console.warn("faucet drip failed", res.status);
            return false;
        }
        return true;
    } catch (e) {
        console.warn("faucet drip failed", e);
        return false;
    }
}

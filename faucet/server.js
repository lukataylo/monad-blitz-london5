import express from "express";
import cors from "cors";
import {
  createWalletClient,
  createPublicClient,
  http,
  isAddress,
  parseEther,
  formatEther,
  getAddress,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "viem/chains";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const FAUCET_PRIVATE_KEY = process.env.FAUCET_PRIVATE_KEY;
if (!FAUCET_PRIVATE_KEY) {
  console.error(
    "FATAL: FAUCET_PRIVATE_KEY environment variable is required.\n" +
      "Set it to the 0x-prefixed private key of the funded faucet wallet."
  );
  process.exit(1);
}

const RPC_URL = process.env.RPC_URL || "https://testnet-rpc.monad.xyz";
const DRIP_MON = process.env.DRIP_MON || "0.15";
const DRIP_WEI = parseEther(DRIP_MON);
const PORT = Number(process.env.PORT) || 3001;

const GAS_LIMIT = 21000n; // Monad charges on gas_limit — keep it exact.

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------
let account;
try {
  account = privateKeyToAccount(FAUCET_PRIVATE_KEY);
} catch (err) {
  console.error("FATAL: FAUCET_PRIVATE_KEY is not a valid private key:", err.message);
  process.exit(1);
}

const transport = http(RPC_URL);
const publicClient = createPublicClient({ chain: monadTestnet, transport });
const walletClient = createWalletClient({ account, chain: monadTestnet, transport });

// ---------------------------------------------------------------------------
// In-memory rate limiting (belt-and-braces on top of the on-chain balance check)
// ---------------------------------------------------------------------------
const MAX_DRIPS_PER_IP_PER_HOUR = 5;
const HOUR_MS = 60 * 60 * 1000;

/** ip -> array of drip timestamps (ms) within the last hour */
const ipDrips = new Map();
/**
 * lowercased address -> last drip timestamp (ms). A cooldown, not a
 * lifetime ban: wallets legitimately run dry mid-hackathon (stakes + gas),
 * and "already funded" with a zero balance was a dead end.
 */
const addressDrips = new Map();
const ADDRESS_COOLDOWN_MS = 10 * 60 * 1000; // one drip per address per 10 min

// Top-up threshold: wallets holding at least this much don't need the
// faucet (covers a 0.1 stake + gas with room to spare). Below it, drip.
const LOW_WATER_WEI = parseEther(process.env.LOW_WATER_MON || "0.2");

function ipRateLimited(ip) {
  const now = Date.now();
  const stamps = (ipDrips.get(ip) || []).filter((t) => now - t < HOUR_MS);
  ipDrips.set(ip, stamps);
  return stamps.length >= MAX_DRIPS_PER_IP_PER_HOUR;
}

function recordIpDrip(ip) {
  const stamps = ipDrips.get(ip) || [];
  stamps.push(Date.now());
  ipDrips.set(ip, stamps);
}

// Periodic cleanup so the maps don't grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [addr, ts] of addressDrips) {
    if (now - ts > ADDRESS_COOLDOWN_MS) addressDrips.delete(addr);
  }
  for (const [ip, stamps] of ipDrips) {
    const fresh = stamps.filter((t) => now - t < HOUR_MS);
    if (fresh.length === 0) ipDrips.delete(ip);
    else ipDrips.set(ip, fresh);
  }
}, 10 * 60 * 1000).unref();

// ---------------------------------------------------------------------------
// Sequential drip queue (avoids nonce races)
// ---------------------------------------------------------------------------
let dripQueue = Promise.resolve();

function enqueueDrip(fn) {
  const run = dripQueue.then(fn, fn);
  // Keep the chain alive even if a drip rejects.
  dripQueue = run.catch(() => {});
  return run;
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
const app = express();

// Behind Railway's edge proxy every socket has the proxy's address; trust the
// first X-Forwarded-For hop so req.ip is the real client and the per-IP
// rate limit isn't one shared global bucket.
app.set("trust proxy", 1);

const ALLOWED_ORIGINS = [
  "https://walk-the-walk-production.up.railway.app",
  "http://localhost:5173",
];

app.use(
  cors({
    origin(origin, callback) {
      // Allow non-browser requests (no Origin header), the explicit list,
      // and any *.up.railway.app origin.
      if (
        !origin ||
        ALLOWED_ORIGINS.includes(origin) ||
        /^https:\/\/[a-z0-9-]+\.up\.railway\.app$/i.test(origin)
      ) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    methods: ["GET", "POST"],
  })
);

app.use(express.json());

app.get("/health", async (_req, res) => {
  try {
    const balance = await publicClient.getBalance({ address: account.address });
    res.json({ ok: true, faucet: account.address, balance: formatEther(balance) });
  } catch (err) {
    res.status(503).json({ ok: false, faucet: account.address, reason: "rpc-unreachable" });
  }
});

app.post("/drip", async (req, res) => {
  const rawAddress = req.body?.address;

  if (typeof rawAddress !== "string" || !isAddress(rawAddress)) {
    return res.status(400).json({ ok: false, reason: "invalid-address" });
  }

  const address = getAddress(rawAddress);
  const addressKey = address.toLowerCase();
  const ip = req.ip || req.socket.remoteAddress || "unknown";

  if (ipRateLimited(ip)) {
    return res.status(429).json({ ok: false, reason: "rate-limited" });
  }
  // Count the attempt NOW (not after the tx inside the queue): otherwise N
  // concurrent requests all pass the check before any of them records.
  recordIpDrip(ip);

  const onCooldown = () => {
    const last = addressDrips.get(addressKey);
    return last != null && Date.now() - last < ADDRESS_COOLDOWN_MS;
  };

  if (onCooldown()) {
    return res.status(409).json({ ok: false, reason: "cooldown" });
  }

  try {
    const result = await enqueueDrip(async () => {
      // Re-check inside the queue so concurrent requests for the same
      // address can't both pass the guards.
      if (onCooldown()) {
        return { status: 409, body: { ok: false, reason: "cooldown" } };
      }

      // Top-up model: fund any wallet that can't afford to play (below the
      // low-water mark), not just brand-new zero-balance ones — accounts
      // that spent their drip on stakes+gas were getting stranded.
      const targetBalance = await publicClient.getBalance({ address });
      if (targetBalance >= LOW_WATER_WEI) {
        addressDrips.set(addressKey, Date.now());
        return { status: 409, body: { ok: false, reason: "already-funded" } };
      }

      // Make sure the faucet itself can cover the drip + gas.
      const faucetBalance = await publicClient.getBalance({ address: account.address });
      const maxFeePerGas = 200_000_000_000n; // reserve ceiling above Monad's ~102 gwei charged limit
      if (faucetBalance < DRIP_WEI + GAS_LIMIT * maxFeePerGas) {
        return { status: 503, body: { ok: false, reason: "faucet-dry" } };
      }

      const txHash = await walletClient.sendTransaction({
        to: address,
        value: DRIP_WEI,
        gas: GAS_LIMIT, // Monad charges on gas_limit — explicit 21000
      });

      addressDrips.set(addressKey, Date.now());
      console.log(`Dripped ${DRIP_MON} MON to ${address} (tx ${txHash})`);
      return { status: 200, body: { ok: true, txHash } };
    });

    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error("Drip failed:", err.message);
    return res.status(503).json({ ok: false, reason: "drip-failed" });
  }
});

app.listen(PORT, () => {
  console.log(`Walk The Walk faucet listening on port ${PORT}`);
  console.log(`Faucet address: ${account.address}`);
  console.log(`RPC: ${RPC_URL}, drip amount: ${DRIP_MON} MON`);
});

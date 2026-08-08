# Forfit Faucet

Tiny stateless faucet microservice that auto-funds brand-new Forfit
wallets on **Monad testnet**. A wallet is only dripped if its on-chain balance
is exactly `0` — so the service needs no database and can't be farmed by
already-funded accounts. In-memory per-IP (5/hour) and per-address
(once each) rate limits sit on top as belt-and-braces.

## Endpoints

- `GET /health` → `{ ok: true, faucet: "0x…", balance: "<MON>" }`
- `POST /drip` with JSON body `{ "address": "0x…" }` →
  - `200 { ok: true, txHash }` — dripped 0.15 MON
  - `400 { ok: false, reason: "invalid-address" }`
  - `409 { ok: false, reason: "already-funded" }` — target balance is non-zero
  - `429 { ok: false, reason: "rate-limited" }` — >5 drips/hour from one IP
  - `503 { ok: false, reason: "faucet-dry" | "drip-failed" }`

Drips are queued sequentially in-process to avoid nonce races. Transactions
are sent with an explicit gas limit of `21000` (Monad charges on gas_limit).

## Environment variables

| Variable             | Required | Default                          | Description                              |
| -------------------- | -------- | -------------------------------- | ---------------------------------------- |
| `FAUCET_PRIVATE_KEY` | **yes**  | —                                | 0x-prefixed private key of the funded faucet wallet. Server exits if missing. |
| `RPC_URL`            | no       | `https://testnet-rpc.monad.xyz`  | Monad testnet RPC endpoint.              |
| `DRIP_MON`           | no       | `0.15`                           | Amount of MON sent per drip.             |
| `PORT`               | no       | `3001`                           | HTTP port (Railway sets this automatically). |

## Run locally

```sh
npm install
FAUCET_PRIVATE_KEY=0x... npm start
curl http://localhost:3001/health
```

## Deploy (Railway)

Deploy this directory as a service. Railway injects `PORT`; you must set
`FAUCET_PRIVATE_KEY` in the service variables and keep the faucet wallet
topped up with testnet MON. CORS allows the Forfit production origin
(`https://walk-the-walk-production.up.railway.app`), `http://localhost:5173`,
and any `*.up.railway.app` origin.

Note: rate-limit state is in-memory, so it resets on redeploy — the on-chain
zero-balance check is the real guard.

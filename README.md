# Walk The Walk 🚶💰

**Stake crypto with your crew. Most steps (or squats) takes the pot.**

A social fitness game on [Monad](https://monad.xyz) testnet, built at Monad Blitz London. Friends stake MON into a shared pool, race each other on steps or camera-counted reps, and when the timer hits zero the contract pays the winner 70% and the runner-up 30% — automatically.

**Live app:** https://walk-the-walk-production.up.railway.app

## Try it in 30 seconds

Open the live app, tap **Log in**, and use the shared demo account (pre-funded with testnet MON):

| | |
|---|---|
| Email | `demo@walkthewalk.xyz` |
| Password | `misty-heron` |

Logging in with these credentials derives the demo wallet on any device — or tap **Create account** to mint your own wallet (the faucet auto-funds new ones with 0.15 MON). Note the demo account is shared: anyone reading this README controls the same wallet, so don't leave real challenges running on it.

---

## How it works

1. **Create an account** — a wallet is derived in your browser from your email + a generated password. No extension, no seed phrase, no server-side keys. A faucet auto-drips 0.15 MON so you can play immediately.
2. **Start a challenge** — pick steps or reps (squats/jumping jacks via your camera), a stake, and a format: step challenges run from a day to a month; camera rep races are live rounds — a 1-minute Minute Madness, the 3-minute Showdown, or 15-minute Endurance. You get an invite link, and you can run several challenges at once — the home screen lists everything ongoing, and the leaderboard keeps a tap-through history of finished ones.
3. **Friends tap the link** — they stake the same amount and they're in.
4. **Move** — phone motion tracking counts steps; the camera + on-device pose detection (MediaPipe) counts reps. Your count moves the instant a rep is seen, rivals' counts stream in live under the camera, and scores auto-sync on-chain (every 5s in short rounds).
5. **Timer ends** — the app settles the challenge on-chain and pushes winnings straight to the winners' wallets. Confetti included.

## Repo layout

| Directory | What it is |
|---|---|
| [`web/`](web/) | The live PWA — Vite + React 18 + viem. In-browser wallet, camera rep counter, iOS-style tab bar, three UI themes (Cream / Midnight / Sorbet, in the Wallet tab). |
| [`contracts/`](contracts/) | Foundry project — [`WalkPool.sol`](contracts/src/WalkPool.sol), the staking/settlement contract. |
| [`faucet/`](faucet/) | Tiny Express service that drips 0.15 MON to brand-new (zero-balance) wallets. |
| [`app/`](app/) | Expo/React Native mobile client (Privy auth) — earlier prototype of the same game. |

## Deployment

| | |
|---|---|
| Chain | Monad Testnet (chain id `10143`) |
| RPC | `https://testnet-rpc.monad.xyz` |
| `WalkPool` contract | [`0x2E0f08bEFFa35D34D60490e7f3f9a92c06Ce1F2F`](https://testnet.monadexplorer.com/address/0x2E0f08bEFFa35D34D60490e7f3f9a92c06Ce1F2F) |
| Web + faucet hosting | Railway (Nixpacks autodetect, `npm start` in each service directory) |

## Quickstart

### Web app

```sh
cd web
npm install
cp .env.example .env    # fill in the values below
npm run dev             # http://localhost:5173
```

`web/.env`:

```sh
# WalkPool contract; unset/zero-address = demo mode (UI works, transactions disabled)
VITE_WALKPOOL_ADDRESS=0x2E0f08bEFFa35D34D60490e7f3f9a92c06Ce1F2F
# Faucet base URL (POST /drip); unset = no auto-funding
VITE_FAUCET_URL=https://<your-faucet>.up.railway.app
```

`npm run build` type-checks and bundles; `npm start` serves the production build (the Railway entrypoint).

### Contracts

```sh
cd contracts
forge build
forge test -vv
# deploy (PRIVATE_KEY in contracts/.env, gitignored):
source .env && forge script script/Deploy.s.sol \
  --rpc-url https://testnet-rpc.monad.xyz --broadcast --private-key $PRIVATE_KEY
```

### Faucet

```sh
cd faucet
npm install
FAUCET_PRIVATE_KEY=0x... npm start   # port 3001
```

Env: `FAUCET_PRIVATE_KEY` (required), `RPC_URL`, `DRIP_MON` (default `0.15`), `PORT`. Endpoints: `GET /health`, `POST /drip {"address":"0x…"}`. Only zero-balance wallets are funded; drips are queued sequentially to avoid nonce races, with per-IP and per-address rate limits on top.

## The contract in 60 seconds

`WalkPool` is a single contract holding many challenges:

```solidity
createChallenge(uint256 stake, uint64 duration, string title, string name, uint8 kind) payable returns (uint256 id)
join(uint256 id, string name) payable          // exact stake, before endTime, once per address
submitSteps(uint256 id, uint256 steps)         // participants only, until endTime, monotonically non-decreasing
settle(uint256 id)                             // anyone, after endTime, once
claim(uint256 id)                              // pull-pattern payout withdrawal
getChallenge(uint256 id) / getParticipants(uint256 id) / nextId()
```

- `kind` 0 = steps, 1 = reps. Names/titles are capped at 32/64 **bytes**.
- Settlement: winner 70%, runner-up 30%, division dust to the winner, ties to the earlier joiner. A solo participant is fully refunded.
- Events (`ChallengeCreated`, `Joined`, `StepsSubmitted`, `Settled`, `Claimed`) drive the app's live board — rep blitzes watch `StepsSubmitted` logs at a 2s cadence.
- Monad quirk worth knowing: **gas is charged on the limit, not usage**, so the app sends every write with a right-sized explicit limit and pre-flights it with `eth_call` so a doomed transaction never burns real gas.

## Architecture notes

- **Zero-friction wallets.** First visit generates a private key straight into `localStorage`; creating an account replaces it with a key derived from `keccak256(domain | email | password)`, so the same credentials produce the same wallet on any device — accounts with no backend at all.
- **Demo mode.** With no (or an invalid) `VITE_WALKPOOL_ADDRESS`, the app boots into a fully navigable UI with transactions disabled — nothing fake is ever rendered from chain state.
- **On-device fitness tracking.** Steps come from the DeviceMotion API; reps come from MediaPipe pose landmarks run entirely in-browser with per-exercise finite-state-machine detectors. No video or motion data ever leaves the phone — only the final number goes on-chain.
- **Self-settling endgame.** Any client that observes the deadline passing fires `settle` (concurrent settles are reconciled via simulation — a "settled" revert is treated as success), then auto-claims its own payout.

## Testing

- **Contracts:** `forge test` — 18 unit tests over create/join/submit/settle/claim, deadline boundaries, dust and refund paths.
- **Web e2e:** Playwright suite driving the production build — onboarding, account creation, deterministic login across devices, tab navigation, wallet view, demo-mode guards, and hostile-URL fuzzing.

## Honest limitations (testnet game, on purpose)

- **Scores are self-reported to the contract.** The phone does real tracking, but nothing stops a motivated cheater from calling `submitSteps` directly. Fine for friends; an oracle/attestation layer would be needed for real money.
- **The password is two dictionary words** and the KDF is a bare keccak — deliberately hackathon-simple. Do not reuse this scheme for anything holding value.
- **No leave/refund path** before a challenge ends, and settlement iterates all participants in one transaction — designed for friend-group scale, not thousands of joiners.

---

Built with React, viem, Foundry, MediaPipe, and Monad testnet. 🏃

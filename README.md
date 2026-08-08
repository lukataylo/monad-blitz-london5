# Forfit 🚶💰

**Stake crypto with your crew. Most steps (or squats) takes the pot.**

**Forfit turns your movements into stakes.** Throw MON into a pot with your friends, pick your format — a 15-minute Blitz, a week-long Classic, or a 1-minute camera squat-off — and race. Your phone counts steps from motion, your camera counts reps with on-device pose detection, and there's no "+1" button to tap your way to a win. Scores stream on-chain while you move, and the instant the timer hits zero the contract pays out on its own: 70% to the winner, 30% to the runner-up, straight to their wallets. No host, no escrow, no trust. No extension or seed phrase either — an email and a password derive your wallet in the browser, and the faucet funds it before you've finished reading this. Get fit, or forfeit.

Built on [Monad](https://monad.xyz) testnet at Monad Blitz London.

**Live app:** https://walk-the-walk-production.up.railway.app

## Try it in 30 seconds

Open the live app, tap **Log in**, and use the shared demo account (pre-funded with testnet MON):

| | |
|---|---|
| Email | `demo@walkthewalk.xyz` |
| Password | `misty-heron` |

Logging in with these credentials derives the demo wallet on any device — or tap **Create account** to mint your own wallet (the faucet auto-funds new wallets). Note the demo account is shared: anyone reading this README controls the same wallet, so don't leave real challenges running on it.

> **Why `walkthewalk` still appears below.** The app was renamed to Forfit late; the old name survives only in identifiers that are load-bearing and cannot be edited without breaking something live — the wallet-derivation domain (changing it changes every derived address, including the funded demo account), the demo email (it's an input to that derivation), `localStorage` keys (one of them holds your private key), the Railway hostname, and the deployed `WalkPool` contract. Everything a user sees says Forfit.

---

## How it works

Creating an account derives a wallet in your browser from your email and a generated password — no extension, no seed phrase, no server-side keys — and a faucet drips test MON so you can play immediately. A full-screen wizard (kind → name → pace → stake → review) starts a challenge: step races run Blitz 15 min, Sprint 1 day, Classic 1 week or Marathon 1 month, while camera rep races are live rounds — Minute Madness 1 min, the 3-minute Showdown, or 15-minute Endurance — staked with a slider, a preset (0.1 / 0.5 / 1 MON), or any amount down to 0.001. Friends tap your invite link or scan its QR, stake the same amount, and they're in. Then you move: phone motion counts steps and the camera plus on-device MediaPipe pose detection counts reps (camera-only — there's no manual "+1" to tap your way to a win), your count updating the instant a rep is seen while rivals' scores stream in live and sync on-chain every 5s in short rounds. When the timer hits zero the app settles on-chain and pushes winnings straight to the winners' wallets, confetti included — and since you can run several challenges at once, the home screen lists everything ongoing while the leaderboard keeps a tap-through history of finished ones.

## Repo layout

| Directory | What it is |
|---|---|
| [`web/`](web/) | The live PWA — Vite + React 18 + viem. In-browser wallet, camera rep counter, iOS-style tab bar, three UI themes (Cream / Midnight / Sorbet, in the Wallet tab). |
| [`contracts/`](contracts/) | Foundry project — [`WalkPool.sol`](contracts/src/WalkPool.sol), the staking/settlement contract. |
| [`faucet/`](faucet/) | Tiny Express service that drips test MON (default 0.15, configurable) to brand-new (zero-balance) wallets. |
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

`npm run build` type-checks and bundles; `npm start` serves the production build (the Railway entrypoint); `npm run lint` runs oxlint.

**Dev-only screen previews.** Some screens need on-chain history that costs real time and real MON to produce. In a dev server, `?preview=ended` and `?preview=live` render those states from a synthetic challenge ([`web/src/lib/previewChallenge.ts`](web/src/lib/previewChallenge.ts)). It's hard-gated on `import.meta.env.DEV`, so production builds can still only ever show data that came from chain.

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
- **On-device fitness tracking.** Steps come from the DeviceMotion API; reps come from MediaPipe pose landmarks run entirely in-browser with per-exercise finite-state-machine detectors (squats, jumping jacks). The pose model is preloaded so the camera is warm before a round starts. No video or motion data ever leaves the phone — only the final number goes on-chain.
- **Kind-aware copy.** The contract stores only `kind` (0/1), but every user-facing string routes through [`lib/kindCopy.ts`](web/src/lib/kindCopy.ts), so a squat challenge never reads like a reskinned step challenge. The specific exercise for `kind` 1 is the creator's local pick, persisted per challenge id.
- **Speed you can see.** Every landed transaction raises a "Live on Monad" toast with its confirmation time and an explorer link — the sub-second block times are the demo.
- **Self-settling endgame.** Any client that observes the deadline passing fires `settle` (concurrent settles are reconciled via simulation — a "settled" revert is treated as success), then auto-claims its own payout.
- **Theming.** Three themes (Cream / Midnight / Sorbet) are pure CSS blocks scoped under `[data-theme]` on `<html>`, picked from the Wallet tab and remembered in `localStorage`.

## Testing

- **Contracts:** `forge test` — 18 unit tests over create/join/submit/settle/claim, deadline boundaries, dust and refund paths.
- **Web:** `npm run build` (`tsc -b` + Vite bundle) and `npm run lint` (oxlint). Web flows were verified by hand and by an ad-hoc Playwright pass during the hackathon; that browser suite isn't checked in.

## Honest limitations (testnet game, on purpose)

- **Scores are self-reported to the contract.** The phone does real tracking, but nothing stops a motivated cheater from calling `submitSteps` directly. Fine for friends; an oracle/attestation layer would be needed for real money.
- **The password is two dictionary words** and the KDF is a bare keccak — deliberately hackathon-simple. Do not reuse this scheme for anything holding value.
- **No leave/refund path** before a challenge ends, and settlement iterates all participants in one transaction — designed for friend-group scale, not thousands of joiners.

---

Built with React, viem, Foundry, MediaPipe, and Monad testnet. 🏃

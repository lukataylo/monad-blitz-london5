# Walk The Walk — 2-Minute Demo Script

**Live:** https://walk-the-walk-production.up.railway.app · **Contract:** [`0x2E0f…1F2F`](https://testnet.monadexplorer.com/address/0x2E0f08bEFFa35D34D60490e7f3f9a92c06Ce1F2F) on Monad Testnet

## Pre-stage (before your slot — 2 min of prep, zero risk)

- Phone 1 logged in as `stage1@walkthewalk.xyz` / `lime-heron` (funded)
- Phone 2 logged in as `stage2@walkthewalk.xyz` / `pearl-otter` (funded)
- Both phones opened once so the camera model is cached; camera permission granted
- Phone 1: create **Squats → 3-min Showdown → 0.1 MON**, stop on the QR screen

## The 2 minutes

| Time | Beat | What the judges see |
|---|---|---|
| 0:00 | **The hook.** "Fitness apps beg you to move. We make your friends' money do it." | Landing page: mascot, one button |
| 0:15 | **Phone 2 scans Phone 1's QR.** One tap: *Stake 0.1 MON & Join* | Real on-chain join, confirmed in ~1s — the toast shows the tx hash + confirmation time |
| 0:30 | **Both phones squat.** | Camera counts reps on-device; your number moves *instantly*, your rival's chip bumps live via a 2-second on-chain event feed. "Everyone scans the same code" — 2 players or 20 |
| 1:30 | **Stop moving. Point at the countdown.** "Nobody presses anything now." | Timer hits zero → the app **settles the pot on-chain by itself** → confetti, podium, *"0.14 MON added to your wallet ✓"* with an explorer link |
| 1:50 | **The close.** "Every rep you watched was a Monad transaction — sub-second finality is what makes a live 3-minute money race possible at all." | Tx toast trail down the screen |

**If anything stalls:** the shared backup account `demo@walkthewalk.xyz` / `misty-heron` is funded; a solo challenge fully refunds, so even a failed join still ends with money moving on-chain.

---

## Why this is realistic, scalable, and production-viable

### The hard part is already real
This is not a mock. Every demo beat runs on deployed infrastructure: a Solidity settlement contract on Monad testnet (create/join/submit/settle/claim, 70/30 split, tie-handling, solo refunds, pull-pattern payouts — 18 Foundry tests), a PWA with on-device MediaPipe pose detection (no video ever leaves the phone), an auto-funding faucet service, and a two-phone join flow verified end-to-end with real transactions in CI-style Playwright runs.

### Why it needs a chain at all
The pot is the product. An escrow that friends can verify, that *no one* — including us — can redirect, with automatic public settlement, is exactly what a contract does better than a Stripe balance in our database. Trust-minimized stakes between people who don't share a bank is the native use case.

### Why specifically Monad
A live rep race writes a score every 5–8 seconds per player. On mainnet Ethereum that's absurd; on Monad testnet it costs fractions of a cent-equivalent and confirms sub-second — fast enough that we render opponents' on-chain scores as a *live* race. High-throughput, low-fee EVM is not a nice-to-have here; the product category (real-time micro-stake games) only exists on chains with this profile.

### The scaling story is honest
- **Per-challenge state is tiny and independent** — one struct + participant array. Challenges don't contend with each other; throughput scales with the chain, and Monad's parallel execution rewards exactly this shape of workload.
- **Zero server-side state for identity.** Wallets derive client-side from credentials; there is no accounts database to scale, breach, or custody. The only backend is a stateless faucet (testnet-only by definition).
- **Client load is bounded by design** — event-driven updates over log polls, per-device RPC provider rotation, and back-off cadences: lessons already learned the hard way at a venue full of phones behind one NAT, and fixed.
- **Costs are engineered, not ignored.** Monad charges the gas *limit*, so every write ships a right-sized explicit limit and is pre-flighted with a free `eth_call` — doomed transactions never burn money. That discipline is what per-rep on-chain writes need to be economically sane in production.

### The road to production is short and known
1. **Anti-cheat**: scores are self-reported today (fine between friends). The upgrade path is signed score attestations from the on-device model, then optional zk/TEE attestation for open-entry pools — the contract interface doesn't change.
2. **Key security**: swap the hackathon KDF for passkeys/WebAuthn-derived signing — again, no contract change.
3. **Real money**: the settlement logic (dust handling, ties, refunds, pull-payouts) is already written the way an audited version would be; it needs an audit, not a redesign.

**The pitch in one line:** group fitness accountability is a proven consumer behavior (people already bet on themselves with strangers' apps as escrow) — we replaced the escrow with a contract, the login with math, and the waiting with Monad.

# WalkPool — Monad Testnet Contracts

Step-challenge staking pools: stake MON, walk, submit steps before the deadline.
After the deadline anyone can settle — the top stepper takes 70% of the pot, the
runner-up 30% (division dust goes to the winner, ties go to the earlier joiner).
Solo challenges are fully refunded. Payouts use a pull pattern (`claim`).

## Deployer address — FUND THIS FIRST

```
0xB9CA61a5F646F7Ad0357Da996E04e896a39226b4
```

Before deploying, send this address testnet MON from the faucet:
**https://testnet.monad.xyz**

The matching private key lives in `contracts/.env` (`PRIVATE_KEY=...`), which is
gitignored — never commit it.

## Network

| | |
|---|---|
| Chain | Monad Testnet |
| Chain ID | 10143 |
| RPC | https://testnet-rpc.monad.xyz |

Note: Monad charges gas on **gas_limit**, not gas_used — over-estimating the
limit costs real (testnet) MON, so keep limits sane.

## Build and test

```sh
forge build
forge test -vv
```

## Deploy

```sh
source .env && forge script script/Deploy.s.sol \
  --rpc-url https://testnet-rpc.monad.xyz \
  --broadcast \
  --private-key $PRIVATE_KEY
```

## Verify (Sourcify)

```sh
forge verify-contract <DEPLOYED_ADDRESS> src/WalkPool.sol:WalkPool \
  --chain-id 10143 \
  --verifier sourcify \
  --verifier-url https://sourcify-api-monad.blockvision.org/
```

## Contract surface

- `createChallenge(uint256 stake, uint64 duration, string name) payable returns (uint256 id)` — creator stakes and auto-joins with a display name
- `join(uint256 id, string name) payable` — match the stake before `endTime`, with a display name
- Display names: max 32 bytes, empty allowed (client renders a fallback)
- `submitSteps(uint256 id, uint256 steps)` — monotonically non-decreasing, until `endTime`
- `settle(uint256 id)` — anyone, strictly after `endTime`; 70/30 split, dust to winner
- `claim(uint256 id)` — pull-pattern payout withdrawal
- Views: `getChallenge(id)`, `getParticipants(id)` → `(address[] addrs, uint256[] steps, uint256[] payouts, string[] names)`
- Events: `ChallengeCreated` (unchanged, name-free), `Joined(id, who, name)` (emitted for the creator inside `createChallenge` too, so all names — creator included — arrive via this one event), `StepsSubmitted`, `Settled`, `Claimed`

ABI: `contracts/abi.json`

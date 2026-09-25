# Implementation notes

[← Back to README](../README.md)

---

### Demo output

```
-- 3) Return threshold proof ----------------------
   Merkle paths resolved: 8 / 8
   Actual P&L sum: +590bp (encoded 800590)
   PASS  true claim (>= +500bp)   ledger records: 800500 (backed by 8 trades)
   PASS  false claim (>= +900bp) rejected: failed assert: claimed floor not met
   PASS  forged trade rejected: failed assert: merkle path does not match the trade

-- 4) Risk limit proof ----------------------------
   PASS  "<= 10% per position" proved   ledger records: 1000 bp
   PASS  false limit (<= 7%) rejected: failed assert: position exceeds the risk limit

-- Final public ledger ----------------------------
   Proven P&L floor:   800500  (actual 800590 stays private)
   Proven weight cap:  1000 bp (actual weights stay private)
```

What lands on the ledger is only the fact that **the P&L sum is at least +500bp**.
Neither the actual +590bp nor the eight individual results are disclosed.

Three adversarial tests all pass:

| Attempt | Result |
|---|---|
| Claim a higher return than reality | rejected — `claimed floor not met` |
| Inflate returns by inserting a trade absent from the log | rejected — `merkle path does not match the trade` |
| Claim a tighter risk limit than reality | rejected — `position exceeds the risk limit` |

### Circuit size

| Circuit | Prover key | Verifier key |
|---|---|---|
| `proveReturnAtLeast` (verifies 8 Merkle paths) | 18.6 MB | 2.1 KB |
| Most circuits | 2.7 MB | 2.1 KB |
| `submitAttestation` | 0.3 MB | 1.3 KB |
| `registerAttestor` | 0.1 MB | 1.3 KB |

Proving is heavy; verification is light. A verifier needs only a 2.1 KB key to
check the trader's claim — and still cannot see the trades.

### Design

| | Public (ledger) | Private (witness) |
|---|---|---|
| Strategy | commitment hash | parameters, opening randomness |
| Trades | Merkle root, count | timestamps, P&L, salts |
| Performance | claim "P&L sum ≥ X" | actual sum, individual results |
| Risk | claim "≤ Y% per position" | actual per-position weights |

Trades are committed to the Merkle tree **as they happen**, so performance cannot
later be computed with the losers removed. For each trade the proving circuit
enforces two things:

1. The leaf of the submitted Merkle path equals that trade's hash — blocks trade substitution
2. The ledger recognises that path's root — blocks inserting trades that never existed

## The core idea — privacy as a type check, not a convention

Compact's information-flow type system is the backbone of this project.
When a private value reaches the public ledger, **compilation is refused.**

```
Exception: potential witness-value disclosure must be declared but is not:
  witness value potentially disclosed: the value of parameter h
  nature of the disclosure: ledger operation might disclose the witness value
```

To publish it you must state the intent with `disclose()`. So what becomes
public is what you *decided* to publish, never what leaked by accident.
Privacy is enforced by the **type checker**, not by convention.

- **witness** — trade log, strategy parameters, positions (private)
- **ledger** — strategy commitment hash, verified performance claims (public)
- **circuit** — the ZK circuit that validates a public claim against private inputs

## How Midnight features are used

Listed with code locations, since this is a judging criterion.
Everything below lives in `contracts/track_record.compact`.

| Midnight feature | Where | Why |
|---|---|---|
| **`witness`** (private input) | `strategyParams`, `nextTrade`, `provenTrades`, `provenPaths`, `portfolioWeights` | Strategy, trades and positions exist only inside the circuit; they never enter a transaction |
| **`ledger`** (public state) | `strategyCommitment`, `tradeLog`, `provenPnlFloor`, `provenMaxWeightBps` | Everything a verifier can see — hashes, roots and claims only |
| **`persistentCommit(value, rand)`** | `commitStrategy`, `commitPortfolio` | Opening randomness is required to open a commitment, so identical parameters still produce different commitments — blocks preimage attacks |
| **`persistentHash<Trade>`** | `recordTrade`, `proveReturnAtLeast` | Hashes a trade into a Merkle leaf; circuit and TypeScript compute the same value |
| **`HistoricMerkleTree<10, Bytes<32>>`** | `tradeLog` | Accumulates trades on-chain as they occur; past roots stay valid, so there is no race on which root a proof targets |
| **`merkleTreePathRoot` + `checkRoot`** | `proveReturnAtLeast` | Confirms the eight submitted trades really are in the committed log — blocks inserting trades |
| **`disclose()`** | every ledger write | The compiler's information-flow check; without it, any path from a witness to the ledger is a compile error |
| **`assert`** | all circuits | A false claim halts here, so no proof data is ever produced |

### What `disclose()` actually caught

Two places where the compiler stopped this project:

1. Writing the commitment hash to the ledger — even a hash is witness-derived, so
   `disclose()` is required.
2. **Checking a Merkle root with `checkRoot`** — the compiler flagged that this
   reveals *which root* the proof targets. Roots are public anyway, so this is an
   intentional disclosure.

The second is a channel a human reviewer would likely miss. That is what it means
for privacy to be a type check rather than a convention.

### Why proving works without a wallet or a node

This uses the circuit-level `/check` and `/prove` endpoints of
`httpClientProvingProvider`. Transaction-level `/prove-tx` requires wallet
balancing, but circuit-level proving is just
`proofData -> proofDataIntoSerializedPreimage -> /prove`.
A reviewer can reproduce real proofs with `npm run live` and no wallet setup.

## On-chain deployment

The contract deploys to a local devnet.

Two contracts are deployed.

```
track_record  86b49d3d59b10ee06208def05cf8753f5e4f854df03c7acd8481860f4d2368b5   block 57  (21s)
attestation   28fbb93db0f685dd2ad33177097508a2f12349d3eb75485487739b86b88c965d   block 60  (19s)
```

**Why two contracts.** The attestation registry is a separate deployment for two
reasons. By design the attestor is a different party from the trader, with
different authority and lifetime. Practically, putting all 14 circuits in one
deployment makes the verifier keys total 28 KB, which exceeds the block limit
(`RpcError 1010: Transaction would exhaust the block limits`). Split into
11 circuits / 23 KB and 3 circuits / 4.8 KB, both go through.

Confirmed through the indexer as a `ContractDeploy`:

```bash
curl -s -X POST http://127.0.0.1:8088/api/v4/graphql -H 'Content-Type: application/json' \
  -d '{"query":"{ contractAction(address:\"<address>\"){ __typename address state } }"}'
# -> {"__typename":"ContractDeploy", "state":"6d69646e696768743a636f6e74726163742d7374617465..."}
```

### Reproducing it

```bash
# 1) Local devnet (requires Node >= 22)
git clone https://github.com/midnightntwrk/midnight-local-dev.git
cd midnight-local-dev && npm install
docker compose -f standalone.yml up -d      # node:9944 indexer:8088 proof:6300

# 2) Fund the deploying account with NIGHT + DUST
#    The genesis seed 0000..0001 is already funded, so no faucet is needed.

# 3) Deploy
cd ../proof-of-track-record
nvm use 22 && npm run deploy
```

### The wallet SDK generation gap

Deployment was blocked for a while. The cause was not the code but a
**generation gap between wallet SDKs.**

| | `@midnight-ntwrk/wallet` 5.0.0 | `testkit-js` `MidnightWalletProvider` |
|---|---|---|
| Key model | Zswap (shielded) only | shielded + unshielded + **dust** |
| DUST balance | no such field in `state()` | recognised and spendable |
| Address from the same seed | derives **differently** | |

Midnight now pays fees in DUST, which is generated by registering NIGHT
(unshielded). Wallet 5.0.0 has no concept of either, so the funded address and
the deploying wallet's address never matched. `testkit-js`'s
`MidnightWalletProvider` implements both `WalletProvider` and `MidnightProvider`,
so it drops straight in.

`deploy.mjs` therefore covers local devnet, Preview and Preprod in one script —
the wallet layer is identical and only the environment differs, selected with
`MN_NETWORK`. All wallet-5.0.0-based scripts were removed: even with faucet funds
they could never have paid a DUST fee.

Observed wallet state:

```
Shielded: {..."250000000000000"...}  Unshielded: "250050000000000"
Dust: "1250000667146900000000000"
```

`testkit-js` requires Node >= 22. Circuit compilation and proof generation work
on Node 20, so only the deployment script needs the newer runtime.

## Development environment

```bash
# Compact toolchain
curl --proto '=https' --tlsv1.2 -LsSf \
  https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
compact update 0.31
export PATH="$HOME/.local/bin:$PATH"

# Proof server (requires Docker)
npm run proof-server
```

## Reproduction check

Verified from a **fresh clone**, following the reviewer's path (2026-09-09).

```
git clone ... && npm install     OK
npm run build                    9 circuits
npm run demo                     5/5 PASS   (no proof server needed)
npm run nav                      5 verdicts including cherry-pick rejection
npm run live                     ZK proof, 4508 bytes
npm run deploy                   on-chain deployment (Node 22)
```

The only prerequisites are Compact toolchain 0.31.1 (`compact update 0.31`),
a Docker proof server for `live`, and a local devnet plus Node 22 for `deploy`.

## Build and run

```bash
npm install
npm run build          # compile circuits (needs Compact toolchain 0.31.1)

# No proof server — circuit behaviour and adversarial tests only
npm run demo           # circuits 1-4
npm run nav            # circuit 5 (demonstrates cherry-pick prevention)

# Proof server required — real ZK proofs
npm run proof-server   # Docker. First run downloads SRS, 1-2 minutes
npm run live           # trade-log proof
npm run nav:proof      # NAV delta proof

# On-chain deployment (local devnet + Node 22)
npm run deploy                      # local devnet (default)
MN_NETWORK=preview npm run deploy   # public testnet (needs tNIGHT from the faucet)
```

Full script list:

| Script | What it does | Prerequisites |
|---|---|---|
| `build` | compile circuits | Compact 0.31.1 |
| `demo` / `nav` / `selection` / `attest` | run circuits + adversarial tests | none |
| `live` / `nav:proof` / `selection:proof` / `attest:proof` | generate real ZK proofs | proof server |
| `live:real` | prove over the real portfolio | proof server + `export` |
| `export` | paper trading → `trades.json` | `Algorithmic_Trading_YL` + yfinance |
| `deploy` | on-chain deployment (local/preview/preprod) | devnet or faucet + **Node 22** |
| `proof-server` | start the proof server | Docker |

When a prerequisite is missing you get an instruction, not a stack trace.

```
$ npm run live                 # proof server is down
X Cannot reach the proof server: http://127.0.0.1:6300
  npm run proof-server

$ node src/deploy.mjs          # running Node 20
X Node 22 or newer is required (currently 20.17.0).
  nvm use 22
```

Compilation writes `contract/` (TypeScript API), `zkir/` (ZK intermediate
representation) and `keys/` (proving and verifying keys) under `build/`.
These are regenerable and are not committed.


## Proving over a real portfolio

The demos use eight sample trades. It also runs on real data: the paper trading
account from
[Algorithmic_Trading_YL](https://github.com/SeoDongOk/Algorithmic_Trading_YL)
(16 S&P 500 positions, entered 2026-09-08).

```bash
npm run export       # ~/.paper_trading/state.json -> trades.json
npm run live:real    # real ZK proof for batch 0 and batch 1
```

> `export` needs the `paper_trading` package and yfinance on `PYTHONPATH`.
> Without that repository use `npm run live` (bundled sample) — same circuits,
> same proof server.

To rule out cherry-picking, positions are sorted **alphabetically by ticker**, cut
into batches of eight, and **both batches are proved**.

```
batch 0 [COP,CRM,CVX,DE,FCX,GILD,JNJ,MRK]     actual -356bp -> claim ">= -400bp"  4508B / 32.9s
batch 1 [MRNA,MSFT,NEM,NVDA,REGN,TGT,VLO,VZ]  actual -285bp -> claim ">= -300bp"  4508B / 31.9s

false claim ">= 0bp" -> circuit rejects (claimed floor not met)
```

**Both batches are losses.** That is the point. This is not a tool for showing off
profits — it checks whether a claim is *true*. A losing portfolio can still prove
"at least -400bp" and cannot prove "at least 0bp".

The claimed figure is the actual sum rounded down to 50bp. The exact value
(-356bp) exists only as a witness.

## Public testnet — verifiable by anyone

The same flow runs on Midnight's **Preview** testnet, so the record does not
depend on a devnet running on the author's machine.

| | Address | Block |
|---|---|---|
| `track_record` (11 circuits) | `7869ee72a2761b29189a6ea9de24065722bd68feee004be565ad027b5f36abdf` | 821701 |
| `attestation` (3 circuits) | `f57c3092ed7605a8f8714021eebd8b80871f6062c99044f2bb1ede7ab3acdca0` | 821705 |

```
block 821705  ContractDeploy   attestation contract
block 821911  ContractCall     registerAttestor
block 821915  ContractCall     submitAttestation   <- NAV commitment
block 821919  ContractCall     proveAttestedNav    <- ZK proof
```

The attested value was a real Binance USDs-M futures account:
`totalMarginBalance = 20.71157147` USDT, read by Primus attestor
`0xdb736b13e2f522dbe18b2015d0291e4b193d8ef6`. The ledger holds only the
commitment `ca89703830c04bd0534bd10e…` — the NAV itself never reaches the chain.

Check it yourself:

```bash
curl -s -X POST https://indexer.preview.midnight.network/api/v4/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ contractAction(address:\"f57c3092ed7605a8f8714021eebd8b80871f6062c99044f2bb1ede7ab3acdca0\"){ __typename address } }"}'
```

Reproduce (needs `wallet-preview.seed` funded from the faucet):

```bash
MN_NETWORK=preview node src/address.mjs          # address for the faucet
MN_NETWORK=preview node src/prepare-testnet.mjs  # register NIGHT for dust
MN_NETWORK=preview npm run deploy
MN_NETWORK=preview node src/attest-onchain.mjs --futures
```

**Three things Preview does differently from a local devnet**, each of which
stopped the deployment until it was handled:

1. `PreviewTestEnvironment` leaves `proofServer` undefined — the proof server is
   yours to run, so the config has no URL and the wallet builder throws on it.
2. testkit's `start(true)` hardcodes a 90-second sync timeout. Preview has 820k+
   blocks; a cold wallet takes 17-20 minutes. `startAndSync()` in `src/wallet.mjs`
   drives `syncWallet` with a longer deadline instead.
3. DUST only starts accruing once a NIGHT UTXO is registered for it — but the
   dust sync does not report complete before that registration exists, so
   "sync then register" deadlocks. `prepare-testnet.mjs` waits on unshielded
   only, registers, then polls for DUST.

The public RPC also drops its websocket intermittently (`1000 Normal Closure`),
so submissions are retried with backoff.

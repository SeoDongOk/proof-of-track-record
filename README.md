# Proof of Track Record

English · **[한국어](README.ko.md)**

**Commit the strategy before you trade. Prove the result after. Neither can be revised.**

Submission for the Midnight Korea Hackathon 2026.

---

## The problem — a number can be real and still lie

Everyone asks the same question about a track record: *did they fake it?*

That is the easy failure. The dangerous one is a number that is **completely
genuine and still misleading**, because you are only shown the strategy that
survived.

> "I ran ten strategies for a year. Here is the one that won."

Every trade is real. Every fill is verifiable. The return is exactly what it
says. And it tells you nothing about what happens next, because the selection
happened *before* the number was generated — and selection leaves no trace.

This is not hypothetical. It happened to the author of this repository.

Backtesting an unsupervised-learning strategy on the S&P 500 produced
**23.63% annualized, Sharpe 0.95** — twice SPY's 11.37%. Then came the digging:

| Verification step | Result |
|---|---|
| Headline performance | 23.63% / Sharpe 0.95 |
| Survivorship bias removed (point-in-time universe) | **14.48%** / Sharpe 0.61 |
| Statistical significance (Newey-West) | excess return **p = 0.566** — indistinguishable from zero |
| Deflated Sharpe (data-snooping adjusted) | **0.55** |

**There was no alpha.** Establishing that took rebuilding the entire pipeline and
scraping 97 months of Wikipedia revisions to reconstruct point-in-time index
membership.

And nothing in the original result was *forged*. The backtest ran correctly on
real prices. It was simply re-runnable — parameters adjusted, universe redefined,
until the numbers looked good. **That process leaves no trace, and someone
reading only the final figure has no way to detect it.**

## Why verifying the numbers is not enough

There are already systems that prove a track record is genuine.
[Obscura](https://blog.horizen.io/trade-with-proof-not-trust-how-obscura-is-making-reputation-private-and-verifiable)
pulls trades from the exchange and proves aggregate PnL without exposing them.
[Proof of Alpha](https://minaprotocol.com/blog/proof-of-alpha) does something
similar on Mina. Both work, and both solve a real problem.

Neither addresses the one above. They prove **the trades you show are real**.
They cannot prove **these are the only trades there were** — or, more precisely,
that this is the only strategy you ran.

Authentication answers "is this number true?"
It does not answer "**was this number selected after the fact?**"

## The approach — pre-commitment, and why it needs ZK

Fix the strategy on-chain *before* the outcome is known. Afterwards, prove the
performance was produced by **that** committed strategy.

Now the claim changes shape. You can only report results from a strategy you
registered before you knew how it would do.

Locking one strategy per contract is not enough on its own — you could deploy ten
contracts and show the one that won. So registrations go into a **shared registry
keyed by trader identity, and the number of registrations is public.**

Running ten and presenting the winner does not stop being possible. It stops being
*hideable*: the verifier reads 10 from the registry and sees they are being shown
one of ten. A record of "1 for 1" and a record of "1 of 10" no longer look alike.

```
Trader registers 10 strategies (parameters never disclosed)
  ledger: strategyCount[trader] = 10

Prove the winner (#7)      -> accepted, and the circuit returns 10
Claim an unregistered one  -> rejected: strategy does not match the registered commitment
Pass #3 off as #7          -> rejected: commitment is bound to its slot
```

Reproduce with `npm run selection`; `npm run selection:proof` generates the real
ZK proof (4508 bytes, 9.7s).

**Why this needs zero-knowledge:** pre-commitment alone is easy. Hash a document,
timestamp it on any chain — that is established practice in empirical research
(OpenTimestamps and similar). But a trader cannot publish the strategy, or the
alpha dies. So the commitment must hide its contents, and the later proof must
show the performance came from *that hidden thing* without opening it.

That is exactly what a ZK circuit does, and it is why a hash alone is not enough:
to prove "return ≥ 15% under the committed strategy" without ZK you would have to
reveal the strategy and every trade so the verifier could recompute it.

This DApp therefore proves three things:

1. **Prior commitment** — strategy parameters are hashed onto the ledger *before*
   trading begins. They cannot be tuned afterwards to flatter the results.
2. **Provenance of returns** — the reported return was computed from the committed
   trade log and the committed account NAV. Individual fills stay private.
3. **Risk compliance** — per-position caps were respected, without disclosing the
   positions.

Privacy is not the headline feature here. It is the thing that makes
pre-commitment usable at all.

## Why use this — versus what exists today

Ways to prove performance already exist. All of them amount to
**showing everything to a trusted third party.**

| Today's approach | How it works | What you give up |
|---|---|---|
| eToro / Bybit copy trading | The platform custodies your account | Locked to that platform. It sees everything. The badge is meaningless elsewhere |
| Prop firms (FTMO etc.) | They lend you *their* account | Your own account's record stays unprovable |
| Fund auditors / administrators | The auditor reads every trade | Cost, months of delay, full disclosure |
| Screenshots / brokerage PDFs | Nothing | Forgeable |

**The common thread: to be verified you must hand over the strategy, and the
verification doesn't travel outside that platform.**

### What is different here

The proof is **portable**, and the verifier needs to see nothing. You can prove
a record earned on Binance to an audience on Twitter without opening the account.

### Why not just put hashes on a chain?

You get a timestamp, and that's where it ends. To prove "return ≥ 15%" you would
still have to publish every trade so the verifier can compute it themselves.

That is precisely why zero-knowledge is needed: **proving a claim derived from
inputs without disclosing the inputs.** It takes both a public ledger
(timestamps, immutability) and ZK (non-disclosure) — Midnight is that combination.

### What you get today, without broker signatures

This system cannot yet prove that the NAV itself is real
(see [Trust model](#trust-model--what-this-stops-and-what-it-does-not)).
Even so, there is one thing it delivers **today, trusting no one**:

> **History cannot be rewritten.**

Pin the strategy hash and the NAV on-chain *before* the outcome is known, and:

- You cannot run ten strategies and show only the winner (strategy-level survivorship)
- You cannot change parameters midway and claim they were always that way
- You cannot insert or drop trades after the fact

This project started from exactly that failure. It is the same backtest described
in [The problem](#the-problem--a-number-can-be-real-and-still-lie) — 23.63% became 14.48% once survivorship bias was
removed, and the excess return carried p = 0.566.

The dangerous part is that the process **leaves no trace**. A backtest can be
re-run until it pleases, and someone looking only at the final number has no way
to know. Prior commitment makes that impossible: you can only claim numbers that
came *after* the commitment.

The nature of the claim changes:

| | The claim |
|---|---|
| Screenshot | "I made this much" (unverifiable) |
| This system (no broker signature) | "These numbers were committed before the outcome was known, and were not revised" |
| This system (with broker signature) | "These numbers came from a balance signed by the exchange" |

The second alone is enough to stop data snooping. The third is the next step.

### Who would not use this

If nobody demands proof, none of this matters. Where a screenshot suffices, this
system has no job. **The value appears when the side putting up the money asks
to verify.**

## Prior art and how this differs

**This idea is not novel.** Others are building it, and at least one is live.
Being honest about that is more useful than claiming a first.

| Project | Status | Data source | Cherry-pick prevention | Stack |
|---|---|---|---|---|
| **[Obscura](https://blog.horizen.io/trade-with-proof-not-trust-how-obscura-is-making-reputation-private-and-verifiable)** (Horizen) | **Live** | Exchange API keys (CEX), wallet signatures (DEX) | Commits to a hash of the full trade set for the period; time-bounded proofs | Horizen L3, custom ZK circuits, **AWS Nitro TEE** |
| **[Proof of Alpha](https://minaprotocol.com/blog/proof-of-alpha)** (o1Labs / Mina) | In development | Binance read-only API | Not addressed — the user picks token pair and date range | Mina zkApp |
| **[ZEROBASE](https://zerobase.website/docs/article/verifiable-scheme-for-hedge-fund-investment-strategies-based-on-zk-interval-proofs/)** | Research | — | — | ZK interval proofs over portfolio risk |
| **This project** | Hackathon | Self-attested (broker signature is future work) | NAV delta binding + on-chain trade commitments | Midnight, Compact |

Obscura in particular solves the harder half: it authenticates the data by
pulling it from the exchange. This project does not — that limitation is stated
plainly in [Trust model](#trust-model--what-this-stops-and-what-it-does-not).

### What is actually different here

**1. No trusted hardware.**
Obscura processes trades inside an AWS Nitro enclave. A TEE is a trust
assumption — you are trusting Amazon's hardware and its attestation chain, and
TEEs have a long history of side-channel breaks. This project has no TEE: the
guarantees come from on-chain commitments and the ZK circuit alone. The price is
that data authenticity is unsolved rather than delegated.

**2. Pre-commitment against data snooping.**
Both Obscura and Proof of Alpha prove *past performance*. Neither prevents:

> "I ran ten strategies for a year and I am showing you the one that won."

That is a different failure from cherry-picking trades, and it is the one that
actually burned this project's author. Committing the strategy hash *before*
trading — circuit 1 here — makes it impossible to claim a strategy you did not
pre-register. Hash-committing a pre-registration document is established practice
in empirical research (OpenTimestamps and similar); the contribution here is
binding it to the performance proof so both are checked together.

**3. Privacy enforced by the type system.**
Compact refuses to compile when a witness value can reach the ledger. That is a
property of the Midnight toolchain, not of this project — but it is a property no
other entry in the table has, and it caught two real leaks during development
(see [The core idea](#the-core-idea--privacy-as-a-type-check-not-a-convention)).

### Honest weaknesses

- Obscura is a shipped product with real users; this is a hackathon submission.
- Obscura and Proof of Alpha both authenticate data from the exchange. This does not.
- Proof of Alpha has o1Labs behind it.

The narrow claim this project can defend is: **a self-attested track record whose
history cannot be rewritten, with no trusted hardware, on Midnight.**

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

## Status

**All circuits verified end to end.** True claims pass; false claims and forgeries
are rejected.

- [x] Compact toolchain (**0.31.1**, matched to the live network; language_version 0.23, runtime 0.16.0)
- [x] **Circuit 1** strategy pre-commitment — `commitStrategy` / `revealMatchesCommitment`
- [x] **Circuit 6** strategy registry — `registerStrategy` / `provenanceOf` (exposes how many attempts were made)
- [x] **Circuit 7** third-party attestation — `registerAttestor` / `submitAttestation` / `proveAttestedNav` (the attestor slot)
- [x] **Circuit 2** trade Merkle commitment — `recordTrade`
- [x] **Circuit 3** return threshold proof — `proveReturnAtLeast`
- [x] **Circuit 4** risk limit proof — `commitPortfolio` / `proveMaxWeight`
- [x] **Circuit 5** NAV delta proof — `openNavPeriod` / `closeNavPeriod` / `proveNavReturnAtLeast`
- [x] **Local demo** (`npm run demo`) — includes adversarial tests
- [x] **Real ZK proof generation** (`npm run live`) — against proof server 8.1.0
- [x] **Proofs over real portfolio data** (`npm run export && npm run live:real`)
- [x] **On-chain deployment** — local devnet (`npm run deploy`)

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
| `proveReturnAtLeast` (verifies 8 Merkle paths) | 9.5 MB | 2.1 KB |
| The other circuits | 2.7 MB | 2.1 KB |

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

## Trust model — what this stops and what it does not

ZK proves that **the computation was honest**; it does not prove that
**the inputs were complete.** Circuit 3 (trade-log sum) has a hole because of
that: the trader chooses what goes into the log, so **simply never committing the
losing trades** leaves a set from which true-but-misleading claims can be made.

Circuit 5 (NAV delta) closes that hole. Commit the **account net asset value** at
the start and end of a period and removing trades changes nothing — the balance
is the balance.

```
Actual trades: 5 wins, 3 losses, sum -400bp   NAV 100,000,000 -> 96,000,000

[1] claim from the 5 winners only (+950bp)  -> rejected: claimed return not met
[2] claim the real result (>= -400bp)       -> accepted, ledger records 9600
[3] inflate by a single bp (>= -399bp)      -> rejected: claimed return not met
[4] halve the opening NAV after the fact    -> rejected: open nav does not match its commitment
```

Reproduce with `npm run nav`. `npm run nav:proof` generates a real ZK proof
(4508 bytes, 7.9s — lighter than circuit 3 since there are no Merkle paths).

### Breaking self-attestation — the attestor slot

Commitments only guarantee *"I did not change what I said."* A NAV invented from
the start passes every later proof honestly.

**This is not a gap that can be engineered away.** Proving an external fact
("my exchange balance is X") from inside a chain requires something that witnessed
it. Obscura uses a TEE plus exchange APIs; zkTLS uses a notary. Different names,
same role. So rather than hide it, this project exposes it as an explicit slot.

The design point is that **signature verification happens outside the circuit**:

1. An attestor reads the balance from the exchange's TLS session and posts
   `(accountId, navCommitment)` on-chain
2. Verifying the attestor's signature is done by the chain and the verifier with
   ordinary tooling — the circuit never touches it
3. The circuit only proves *"my private NAV opens that commitment"*

That works on Compact 0.31 today. In-circuit signature verification would need
0.34's `secp256k1EcdsaVerify`, and this design removes the need for it.

```
Claim NAV with no attestation   -> rejected: no attestation for that account
Attestor posts the real balance -> ledger stores only the commitment
Prove with the real NAV         -> accepted, NAV stays private
Inflate the NAV 3x              -> rejected: nav does not open the attested commitment
Claim an unattested account     -> rejected
```

Reproduce with `npm run attest`; `npm run attest:proof` generates the real ZK
proof (4508 bytes, 2.0s — the lightest circuit here).

**The demo attestor is not trustworthy.** It does not look at a real exchange;
it attests whatever NAV it is handed. It exists to show the wiring.
`src/attestor.mjs` defines the adapter, and `zkTlsAttestor()` is the unimplemented
slot where TLSNotary or Reclaim goes. **That integration is the main outstanding
work.**

Note that "the broker signs the balance" does not actually work: Binance's Ed25519
scheme has the *client* signing requests, and the exchange does not sign its
responses. This is why zkTLS — which needs no cooperation from the exchange — is
the route.

### What this moves, and what remains

| Stopped | Remaining assumption |
|---|---|
| Lying about a committed value | **The attestor is honest** |
| Computing returns with losses omitted | **Identity is not Sybil-resistant on its own** |
| Lowering the opening balance after the fact | |
| Changing the strategy after the fact | |
| Hiding how many strategies were attempted | |
| Inventing a NAV (with an attestor) | |

**On Sybil:** the strategy registry counts per trader identity, so a fresh
identity resets the counter to zero. Binding `accountId` to a **KYC'd exchange
account** is what gives that identity weight — ten identities then require ten
KYC'd accounts, which is expensive and usually not permitted. Without that
binding, an anonymous trader can still start over.

### What was attempted, and why it was deferred

Toolchain 0.31.1 ships no packaged signature verification, so Schnorr was
assembled by hand from the Jubjub primitives. The circuit compiled and the
verification equation held (`s·G == R + e·P`), but it broke down at
**reducing the challenge into the scalar field.**

| Measured | |
|---|---|
| `ecMul` / `ecMulGenerator` scalar bound | `6554484396890773809930967563523245729705921265872317281365359162392183254198` (Jubjub scalar field r−1) |
| `transientHash` output | base-field element (~2^255). **Exceeds the scalar field** |
| `as Uint<248>` | a range check, not truncation — fails on hash output |
| Compact `Uint` maximum width | 248 bits |
| `Bytes<32>` → `Uint` in-circuit | not available (`convertBytesToField` is runtime-only) |
| Usable EC ops | `ecAdd` `ecMul` `ecMulGenerator` `hashToCurve`; points compare with `==` |

The remaining route is a bit-decomposition gadget: take the low 248 bits as a
witness and verify the decomposition in-circuit — but Field wraparound means the
uniqueness of that decomposition has to be argued separately.
**Shipping unreviewed hand-rolled signature verification is worse than shipping
none, so it was reverted.**

The proper answer is `secp256k1EcdsaVerify` in Compact 0.34. That release targets
ledger 9 while the current network runs ledger 8, so the right time to switch is
when the network moves.

## Proving over a real portfolio

The demo above uses eight sample trades. It also runs on real data: the paper
trading account from
[Algorithmic_Trading_YL](https://github.com/SeoDongOk/Algorithmic_Trading_YL)
(16 S&P 500 positions, entered 2026-09-08) is wired in directly.

```bash
npm run export       # ~/.paper_trading/state.json -> trades.json (mark-to-market P&L in bps)
npm run live:real    # real ZK proof for batch 0 and batch 1
```

> `export` needs the `paper_trading` package and yfinance on `PYTHONPATH`.
> Without that repository, use `npm run live` (bundled sample) — same circuits,
> same proof server.

To rule out cherry-picking, positions are sorted **alphabetically by ticker**,
cut into batches of eight, and **both batches are proved**.

```
batch 0 [COP,CRM,CVX,DE,FCX,GILD,JNJ,MRK]     actual -356bp -> claim ">= -400bp"  4508B / 32.9s
batch 1 [MRNA,MSFT,NEM,NVDA,REGN,TGT,VLO,VZ]  actual -285bp -> claim ">= -300bp"  4508B / 31.9s

false claim ">= 0bp" -> circuit rejects (claimed floor not met)
```

**Both batches are losses.** That is the point. This is not a tool for showing off
profits — it is a tool for **checking whether a claim is true**. A losing portfolio
can still prove the true statement "at least -400bp", and cannot prove the false
statement "at least 0bp". The prover chooses what to disclose (a floor of -400bp);
the verifier learns nothing beyond it.

The claimed figure is the actual sum rounded down to 50bp. The exact value
(-356bp) exists only as a witness.

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

```
contract address: 7a3eff6c1c374d715a839c4ec01848f6b465c009218a4b3b4aa6005aece088b9
transaction     : 00cc52e62b94f916749a5fa19edc92b387ac3381cf54eb4ebb292354e3e948d23a
block           : 319          deployment took 23s
```

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

## Background

- The original backtest analysis:
  [Algorithmic_Trading_YL](https://github.com/SeoDongOk/Algorithmic_Trading_YL)
- How survivorship bias erased the alpha:
  [blog post (Korean)](https://seodongok.github.io/blog/2026-09-08-survivorship-bias-kills-alpha)

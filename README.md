# Proof of Track Record

English · **[한국어](README.ko.md)**

**Commit the strategy before you trade. Prove the result after. Neither can be revised.**

Submission for the Midnight Korea Hackathon 2026.

---

## What this is

A trading track record you can prove without showing anyone your trades.

The usual question about a track record is *"did they fake it?"* — but a number
can be completely genuine and still mislead, because you are only shown the
strategy that survived:

> "I ran ten strategies for a year. Here is the one that won."

So this project fixes the strategy on-chain **before** the outcome is known, then
proves the performance came from **that** committed strategy — in zero knowledge,
so the strategy and the individual trades stay private.

The author hit exactly this failure. A backtest showing **23.63% annualized /
Sharpe 0.95** collapsed to **14.48% / Sharpe 0.61** once survivorship bias was
removed, with excess return at **p = 0.566** — indistinguishable from zero.
Nothing was forged. The pipeline was simply re-runnable, and that leaves no trace.
→ [Motivation and prior art](docs/motivation.md)

## Quick start

```bash
npm install
npm run build          # compile circuits (needs Compact toolchain 0.31.1)

npm run demo           # circuits 1-4 + adversarial tests   (no proof server)
npm run nav            # circuit 5 — cherry-pick prevention (no proof server)
npm run selection      # circuit 6 — strategy registry      (no proof server)
npm run attest         # circuit 7 — attestor slot          (no proof server)

npm run proof-server   # Docker. First run downloads SRS, 1-2 minutes
npm run live           # real ZK proof, 4508 bytes
```

Missing a prerequisite gives you an instruction, not a stack trace:

```
$ npm run live                 # proof server is down
X Cannot reach the proof server: http://127.0.0.1:6300
  npm run proof-server
```

Full script table and toolchain setup → [Implementation notes](docs/implementation.md)

## How it works

Seven claims, each a circuit, across two deployed contracts:

| Circuit | Proves | Entry points |
|---|---|---|
| 1 | The strategy was committed **before** trading | `commitStrategy` / `revealMatchesCommitment` |
| 2 | Every trade was logged as it happened | `recordTrade` (Merkle) |
| 3 | The return came from the committed trade log | `proveReturnAtLeast` |
| 4 | Per-position risk caps held | `commitPortfolio` / `proveMaxWeight` |

Three more close the harder holes:

| Circuit | Proves | Entry points |
|---|---|---|
| 5 | The return matches the committed **account NAV**, so losses cannot be dropped | `openNavPeriod` / `closeNavPeriod` / `proveNavReturnAtLeast` |
| 6 | **How many strategies you attempted** is public, so "1 of 10" cannot look like "1 for 1" | `registerStrategy` / `provenanceOf` |
| 7 | The NAV was attested by a third party, not self-declared | `registerAttestor` / `submitAttestation` / `proveAttestedNav` |

The registry is what stops strategy-level cherry-picking:

```
Trader registers 10 strategies (parameters never disclosed)
  ledger: strategyCount[trader] = 10

Prove the winner (#7)      -> accepted, and the circuit returns 10
Claim an unregistered one  -> rejected: strategy does not match the registered commitment
Pass #3 off as #7          -> rejected: commitment is bound to its slot
```

**Why this needs zero-knowledge:** pre-commitment alone is easy — hash a document
and timestamp it anywhere. But a trader cannot publish the strategy, or the alpha
dies. The commitment must hide its contents, and the later proof must show the
performance came from *that hidden thing* without opening it. Without ZK you would
have to reveal the strategy and every trade so the verifier could recompute.

What lands on the ledger is only the claim:

```
Proven P&L floor:   800500  (actual 800590 stays private)
Proven weight cap:  1000 bp (actual weights stay private)
```

## What this stops, and what it does not

ZK proves the **computation** was honest. It does not prove the **inputs** were
complete. Being explicit about where that line falls:

| Stopped | How |
|---|---|
| Claiming a return you did not make | circuits 2-3 — Merkle-committed trade log |
| Computing returns with the losses removed | circuit 5 — NAV is the balance; dropping trades changes nothing |
| Lowering the opening balance after the fact | circuit 5 — the opening NAV is committed |
| Changing the strategy after the fact | circuit 1 |
| Hiding how many strategies you attempted | circuit 6 — the registry count is public |
| Inventing a NAV outright | circuit 7 — **only with an honest attestor** |

| Remaining assumption | Why |
|---|---|
| **The attestor must be honest** | Proving an external fact ("my balance is X") needs something that witnessed it. The demo attestor signs whatever it is handed — `zkTlsAttestor()` in `src/attestor.mjs` is the unimplemented slot where TLSNotary or Reclaim goes. **This is the main outstanding work.** |
| **Identity is not Sybil-resistant** | A fresh identity resets the strategy counter. Binding `accountId` to a KYC'd exchange account is what gives it weight. |

Full reasoning, the attestor design, and what was attempted and deferred (a
hand-rolled Schnorr that was reverted) → [Trust model](docs/trust-model.md)

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

## Status

All circuits verified end to end. True claims pass; false claims and forgeries are
rejected.

- [x] Compact toolchain **0.31.1** (matched to the live network; language_version 0.23, runtime 0.16.0)
- [x] **14 circuits** across two contracts — `track_record` (11) and `attestation` (3)
- [x] **Local demos** with adversarial tests — `demo` / `nav` / `selection` / `attest`
- [x] **Real ZK proofs** against proof server 8.1.0 — 4508 bytes each
- [x] **Proofs over real portfolio data** — `npm run export && npm run live:real`
- [x] **On-chain deployment** — local devnet, both contracts

Verified from a fresh clone of this repository:

```
git clone ... && npm ci          OK
npm run build                    11 + 3 circuits
npm run demo / nav / selection / attest     all pass
npm run live / nav:proof / selection:proof / attest:proof   4508-byte proofs
npm run deploy                   both contracts on-chain (Node 22)
```

## Documentation

| | |
|---|---|
| [Motivation and prior art](docs/motivation.md) | Why authentication is not enough; how this compares to Obscura, Proof of Alpha and ZEROBASE; honest weaknesses |
| [Trust model](docs/trust-model.md) | What each circuit stops, the attestor slot, Sybil resistance, and the Schnorr attempt that was reverted |
| [Implementation notes](docs/implementation.md) | Midnight feature mapping with code locations, what `disclose()` caught, on-chain deployment, the wallet SDK generation gap, full script table |

## Background

- The original backtest analysis:
  [Algorithmic_Trading_YL](https://github.com/SeoDongOk/Algorithmic_Trading_YL)
- How survivorship bias erased the alpha:
  [blog post (Korean)](https://seodongok.github.io/blog/2026-09-08-survivorship-bias-kills-alpha)

## License

Apache-2.0. See [LICENSE](LICENSE).

The Midnight SDKs this builds on are Apache-2.0; the Compact toolchain is MIT.

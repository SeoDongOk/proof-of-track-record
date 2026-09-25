# Proof of Track Record

English · **[한국어](README.ko.md)** — Midnight Korea Hackathon 2026

![tests](https://img.shields.io/badge/tests-28%20passing-5ee0b0)
![circuits](https://img.shields.io/badge/circuits-14-5ee0b0)
![Compact](https://img.shields.io/badge/Compact-0.31.1-e8b45c)
![network](https://img.shields.io/badge/Midnight-preview-8b5cf6)
![license](https://img.shields.io/badge/license-Apache--2.0-blue)


**Commit the strategy before you trade. Prove the result after. Neither can be revised.**

A trading track record you can prove without showing anyone your trades.

The usual question about a track record is *"did they fake it?"* — but the
dangerous case is a number that is completely genuine and still misleading,
because you are only shown the strategy that survived: *"I ran ten strategies for
a year, here is the one that won."* So the strategy is committed on-chain
**before** the outcome is known, and the later proof shows the performance came
from **that** commitment — in zero knowledge, so nothing is disclosed.

This started from the author's own backtest: **23.63% annualized** collapsed to
**14.48%** once survivorship bias was removed, with excess return at **p = 0.566**.
Nothing was forged — the pipeline was simply re-runnable, and that leaves no trace.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="diagrams/architecture-dark.png">
  <img alt="Architecture: the strategy, trades and NAV stay on the private side; only commitments and proven claims reach the ledger" src="diagrams/architecture-light.png">
</picture>

The left column never reaches the chain. `diagrams/architecture.html` is the same
diagram as a self-contained interactive page — clone and open it, or see
[diagrams/](diagrams/) for how it is generated and pinned to the source.

## Quick start

```bash
npm install && npm run build     # needs Compact toolchain 0.31.1

npm run demo                     # circuits 1-4 + adversarial tests
npm run nav                      # circuit 5 — cherry-pick prevention
npm run selection                # circuit 6 — strategy registry
npm run attest                   # circuit 7 — attestor slot

npm run proof-server             # Docker, 1-2 min on first run
npm run live                     # real ZK proof, 4508 bytes

npm test                         # 28 tests: circuit accept/reject, units, attestation
npm run verify                   # check a recorded zkTLS attestation — no account needed
npm run attest:live              # produce a new one (needs Primus credentials)
npm run attest:onchain           # ...and submit it on-chain (local devnet, Node 22)
#   add --futures to attest a real Binance USDs-M account instead of a public price
```

## What it proves

| Circuit | Claim | Blocks |
|---|---|---|
| 1 | the strategy was committed before trading | changing the strategy afterwards |
| 2-3 | the return came from the committed trade log | claiming a return you did not make |
| 4 | per-position risk caps held | overstating risk discipline |
| 5 | the return matches the committed account **NAV** | dropping the losing trades |
| 6 | **how many strategies you attempted** is public | showing 1 of 10 as if it were 1 for 1 |
| 7 | the NAV was attested by a third party | inventing a NAV outright |

What reaches the ledger is only the claim — `P&L floor 800500` while the actual
`800590`, the eight trades and the strategy all stay private.

## What it does not prove

ZK proves the **computation** was honest, not that the **inputs** were real.

- **The attestor must be honest.** `npm run attest:live` runs a real zkTLS
  session through the [Primus](https://primuslabs.xyz) attestor network, which
  reads the exchange endpoint itself — so the NAV is no longer self-declared.
  What remains is trust in that attestor group and in TLS. The bundled
  `demoAttestor()` signs whatever it is handed and is for wiring only.
- **Sybil resistance is inherited, not created.** `accountId` is `sha256(uid)`,
  where the `uid` is read from the exchange by the attestor in the same session as
  the balance — so a new API key is not a new identity, but a new *account* is.
  An identity costs one KYC, not zero. Weak KYC at the exchange is inherited too.

## Status

14 circuits across two contracts, real ZK proofs, a **real zkTLS attestation** of a
Binance futures account through the Primus attestor network, and both contracts
deployed on Midnight's **Preview testnet** — anyone can verify them.

```
block 821701  track_record deployed
block 821705  attestation deployed
block 821911  registerAttestor
block 821915  submitAttestation   <- NAV commitment (the NAV stays private)
block 821919  proveAttestedNav    <- ZK proof
```

| | |
|---|---|
| [Motivation and prior art](docs/motivation.md) | why authentication is not enough; how this compares to Obscura, Proof of Alpha and ZEROBASE |
| [Trust model](docs/trust-model.md) | what each circuit stops, the attestor slot, and the Schnorr attempt that was reverted |
| [Implementation notes](docs/implementation.md) | Midnight feature mapping, what `disclose()` caught, deployment, proofs over a real portfolio, full script table |

Background: [Algorithmic_Trading_YL](https://github.com/SeoDongOk/Algorithmic_Trading_YL)
· [how survivorship bias erased the alpha](https://seodongok.github.io/blog/2026-09-08-survivorship-bias-kills-alpha)

Apache-2.0 — see [LICENSE](LICENSE).

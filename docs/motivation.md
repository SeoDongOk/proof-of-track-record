# Motivation and prior art

[← Back to README](../README.md)

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
(see [Trust model](trust-model.md)).
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
plainly in [Trust model](trust-model.md).

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
(see [Implementation notes](implementation.md)).

### Honest weaknesses

- Obscura is a shipped product with real users; this is a hackathon submission.
- Obscura and Proof of Alpha both authenticate data from the exchange. This does not.
- Proof of Alpha has o1Labs behind it.

The narrow claim this project can defend is: **a self-attested track record whose
history cannot be rewritten, with no trusted hardware, on Midnight.**


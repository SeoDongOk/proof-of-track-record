# Trust model

[← Back to README](../README.md)

---

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
it attests whatever NAV it is handed. It exists to show the wiring, and
`npm run attest` uses it.

**The real path is implemented.** `primusAttestor()` in `src/attestor.mjs` runs an
actual zkTLS session through the Primus attestor network and reads the exchange
endpoint itself — see [zkTLS attestation](#zktls-attestation--the-real-path)
below. `npm run attest:live` exercises it end to end.

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

## zkTLS attestation — the real path

`npm run attest:live` runs an actual zkTLS session. The attestor is the
[Primus](https://primuslabs.xyz) attestor network (AlphaNet), not this repository.

```
[1] zkTLS attestation requested   (public-ticker:BTCUSDT, mpctls)
    GET https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT
    attesting: $.price

[2] attestor signature verified   (4.8s)
    value read: price = 77246.23000000
    NAV (Uint<48>): 77246230000
    attestor: 0xdb736b13e2f522dbe18b2015d0291e4b193d8ef6 (https://primuslabs.xyz)

[2b] does verification reject a tampered attestation?
    rejected. the signature is bound to the value.

[3] attestor registered: 8d9572b08ced…
[4] attestation submitted
    account: bdf148e7ad11…  (hash of the API key; the key is not on chain)
    commitment: 7aa9334a6aa9e873…
    the NAV 77246230000 is NOT on the ledger

[5] ZK proof with the attested NAV   -> accepted
[6] NAV inflated 3x                  -> rejected: nav does not open the attested commitment
```

The attestation carries the attestor's address and an ECDSA signature over the
response. Changing one digit of the value makes `verifyAttestation()` return
`false` — step **2b** runs that check on every execution, so the verification is
demonstrably not a no-op.

**Why this is not the same as calling the exchange API ourselves.** Reading a
balance with an API key produces a number *we claim we read*. Binance signs
requests, not responses, so there is no exchange signature to check. In a zkTLS
session the request is executed by the attestor network and the response
ciphertext is bound to the TLS session, so the value cannot be substituted after
the fact.

| Mode | Guarantee | Cost |
|---|---|---|
| `mpctls` (default) | attestor and client jointly derive session keys, so the client cannot alter the response | slower |
| `proxytls` | attestor relays and records ciphertext | faster |

Two adapters ship in `src/exchanges.mjs`:

| Adapter | Needs | Proves |
|---|---|---|
| `publicTicker` (default) | nothing | that the pipeline runs end to end |
| `binanceFutures` (`--futures`) | API key | the NAV of a USDs-M futures account |
| `binanceSpot` (`--binance`) | API key | a spot balance |

Run against a real futures account:

```
[1] zkTLS attestation  (binance-futures, mpctls)
    GET https://fapi.binance.com/fapi/v3/account?recvWindow=60000&timestamp=...&signature=...
    attesting: $.totalMarginBalance
[2] attestor signature verified  (5.7s)
    value read: totalMarginBalance = 21.46679236
    NAV (Uint<48>): 21466792
[2b] tampered attestation -> rejected
[4] attestation submitted  account dc16576b458f...  (sha256 of the API key)
    on-chain: submitAttestation block 8204, proveAttestedNav block 8207
[5] ZK proof with the attested NAV -> accepted
[6] NAV inflated 3x -> rejected
```

`totalMarginBalance` is wallet balance plus unrealised PnL, so it stays correct
while positions are open - unlike `totalWalletBalance` (excludes unrealised PnL)
or `availableBalance` (excludes margin locked in positions).

The API key travels to the attestor network in the `X-MBX-APIKEY` header; the
secret never leaves the machine (it only signs the query locally). A read-only
key is the right choice here - the adapter issues one GET and nothing else.

Credentials go in `.env` (gitignored) — see `.env.example`. The exchange API key
never reaches the chain; only `sha256(key)` is used as `accountId`.

**What is still assumed.** The Primus attestor group must be honest and TLS must
hold. That is weaker than trusting the trader alone, and stronger than the demo
attestor, but it is not nothing — a decentralised attestor group is still a
trust assumption. This is stated in [Trust model](trust-model.md).

## On-chain: the attestation as a real transaction

`npm run attest:onchain` takes the same flow all the way to the chain — the
attestation and the ZK proof become transactions, not local simulations.

```
[1] zkTLS attestation   price = 77186.01000000  ->  NAV 77186010000  (4.8s)
    attestor: 0xdb736b13e2f522dbe18b2015d0291e4b193d8ef6

[3] attestation contract deployed  c5dee88809b4830efd29cb09…  block 5428  (20s)

[4] on-chain transactions
    registerAttestor   block 5431  (19s)
    submitAttestation  block 5435  (24s)
    proveAttestedNav   block 5440  (29s)

[5] ledger read back through the indexer
    attestor          : 8d9572b08ced5bfc50a217da…
    accounts attested : 1
    stored commitment : 9bdddb0dadec916fe9266299…
    matches local     : yes
    the NAV 77186010000 is NOT on the ledger — only the commitment
```

Confirmed independently through the indexer:

```
block 5428  ContractDeploy   tx f3747445035f19494ff9…
block 5431  ContractCall     tx 0b7f0fbb25ac06f1fe36…
block 5435  ContractCall     tx 6b2395ad81b5a2debc37…
block 5440  ContractCall     tx a52102ccb82f6880dcb4…
```

The contract accepts one attestor and one attestation per account by design, so
the script reads the ledger first and deploys a fresh contract when the stored
one is already spoken for.

**A fee quirk worth knowing.** Circuit-call transactions are cheap enough that the
wallet can compute a zero fee, and it then emits `dust_actions: Some(empty)`,
which the node rejects as non-canonical (`Malformed(NotNormalized)`) — surfacing
only as `RpcError 1010: Custom error: 117`. Deploy transactions write more bytes,
so their fee is positive and they are unaffected; calls fail while deploys
succeed. Setting a non-zero `additionalFeeOverhead` on the wallet forces a real
`DustSpend`. See `src/wallet.mjs`.

## Binding identity to the exchange account, not the API key

The strategy registry counts attempts per trader identity. If that identity is
cheap to recreate, circuit 6 proves nothing — so what `accountId` is derived from
matters more than it looks.

The first version used `sha256(apiKey)`. An exchange issues API keys on demand,
so a new key was a new identity and the attempt counter reset to zero. The
exchange already runs KYC; the mistake was binding to the **key** instead of the
**KYC'd account**.

`GET /fapi/v3/account` has no account identifier — all thirteen fields are
balances and positions. `GET /api/v3/account` returns `uid`, and on Binance spot
and futures share one master account. So `binanceFuturesBound` attests both
endpoints **in a single zkTLS session**:

```
[0] $.uid                 (identity)   -> accountId = sha256("binance-uid:" + uid)
[1] $.totalMarginBalance  (nav)        -> the NAV being proven
```

One session is the point. Two separate attestations would let a trader pair
account A's `uid` with account B's balance.

Measured, with the same account and two different API keys:

```
sha256(apiKey)      key A -> dc16576b458f510b…    key B -> 8a2485a15b205ad3…   different
sha256(uid)         key A -> 74e3d3267016c65c…    key B -> 74e3d3267016c65c…   same
another account                                   uid 999999999 -> 567705e5268bd1b6…
```

Neither the API key nor the `uid` reaches the chain — only `sha256(uid)`.

**This does not create Sybil resistance; it inherits the exchange's.** A trader
can still open accounts on other exchanges. What changes is the price: an
identity goes from free to one KYC. If the exchange runs weak KYC, this inherits
that too. `--unbound` keeps the old key-based behaviour for comparison.

### On Preview, with the identity bound

The same flow re-run after `accountId` moved from `sha256(apiKey)` to
`sha256(uid)`:

```
block 848761  ContractCall  submitAttestation   uid-bound accountId
block 848765  ContractCall  proveAttestedNav    ZK proof
```

The attested NAV was `totalMarginBalance = 18.94934329` on the same live futures
account (it had moved from 20.71 since the earlier run — the bot keeps trading).
The contract now reports `attestationCount = 2`: the key-bound account from the
first run and the uid-bound one from this run are correctly different accounts.
The `uid` is masked in the script output and never leaves the machine — only
`sha256(uid)` reaches the chain.

# 구현 노트

[← README 로 돌아가기](../README.ko.md)

---

### 데모 결과

```
── 3) 수익률 임계값 증명 ──────────────────────────
   머클 경로 확보: 8 / 8
   실제 손익 합계: +590bp (인코딩 800590)
   ✅ 참인 주장 (≥ +500bp) 통과   원장 기록: 800500 (8건 근거)
   ✅ 거짓 주장 (≥ +900bp) 거부: failed assert: claimed floor not met
   ✅ 위조 거래 거부: failed assert: merkle path does not match the trade

── 4) 리스크 한도 증명 ────────────────────────────
   ✅ "종목당 ≤ 10%" 증명 통과   원장 기록: 1000 bp
   ✅ 거짓 한도 (≤ 7%) 거부: failed assert: position exceeds the risk limit

── 최종 공개 원장 ─────────────────────────────────
   증명된 손익하한: 800500  (실제값 800590 은 비공개)
   증명된 비중상한: 1000 bp (실제 비중은 비공개)
```

원장에 남는 것은 **"손익 합계가 +500bp 이상"** 이라는 사실뿐이다.
실제값 +590bp 도, 8건의 개별 손익도 공개되지 않는다.

적대적 테스트 3종을 모두 통과한다.

| 시도 | 결과 |
|---|---|
| 실제보다 높은 수익률 주장 | `claimed floor not met` 으로 거부 |
| 로그에 없는 거래를 끼워넣어 수익률 부풀리기 | `merkle path does not match the trade` 로 거부 |
| 실제보다 낮은 리스크 한도 주장 | `position exceeds the risk limit` 으로 거부 |

### 회로 규모

| 회로 | 증명키 | 검증키 |
|---|---|---|
| `proveReturnAtLeast` (머클 경로 8건 검증) | 9.5 MB | 2.1 KB |
| 나머지 5개 | 2.7 MB | 2.1 KB |

증명은 무겁고 검증은 가볍다. 검증자는 2.1KB 짜리 키만 있으면
트레이더의 주장을 확인할 수 있고, 거래 내역은 볼 수 없다.

### 설계

| | 공개 (ledger) | 비공개 (witness) |
|---|---|---|
| 전략 | 커밋 해시 | 파라미터 원문, 개봉 난수 |
| 거래 | 머클 루트, 건수 | 체결 시각, 손익, salt |
| 성과 | "손익 합계 ≥ X" 주장 | 실제 합계, 개별 손익 |
| 리스크 | "종목당 ≤ Y%" 주장 | 종목별 실제 비중 |

거래는 **발생할 때마다** 머클 트리에 커밋되므로, 나중에 손실 거래를
빼고 성과를 계산하는 것이 불가능하다. 증명 회로는 각 거래에 대해
두 가지를 강제한다.

1. 제출된 머클 경로의 잎이 그 거래의 해시와 같다 — 거래 바꿔치기 차단
2. 그 경로의 루트를 원장이 알고 있다 — 없던 거래 끼워넣기 차단

## 핵심 아이디어 — 프라이버시는 관례가 아니라 타입 검사다

Compact 의 정보 흐름 타입 시스템이 이 프로젝트의 뼈대다.
비공개 값이 공개 원장에 닿으면 **컴파일이 거부된다.**

```
Exception: potential witness-value disclosure must be declared but is not:
  witness value potentially disclosed: the value of parameter h
  nature of the disclosure: ledger operation might disclose the witness value
```

공개하려면 `disclose()` 로 의도를 명시해야 한다. 즉 "실수로 새는 것"이
아니라 "공개하기로 한 것"만 공개된다. 프라이버시가 관례가 아니라 **타입 검사**다.

- **witness** — 거래 로그, 전략 파라미터, 포지션 (비공개)
- **ledger** — 전략 커밋 해시, 검증된 성과 지표 (공개)
- **circuit** — 비공개 입력으로 공개 주장을 검증하는 ZK 회로

## Midnight 기능을 어떻게 썼는가

심사 항목이므로 코드 위치와 함께 적는다. 전부 `contracts/track_record.compact`.

| Midnight 기능 | 어디에 | 왜 |
|---|---|---|
| **`witness`** (비공개 입력) | `strategyParams`, `nextTrade`, `provenTrades`, `provenPaths`, `portfolioWeights` | 전략·거래·포지션은 회로 안에서만 존재. 트랜잭션에 실리지 않는다 |
| **`ledger`** (공개 상태) | `strategyCommitment`, `tradeLog`, `provenPnlFloor`, `provenMaxWeightBps` | 검증자가 볼 수 있는 전부. 해시·루트·"주장"만 |
| **`persistentCommit(값, 난수)`** | `commitStrategy`, `commitPortfolio` | 개봉 난수가 있어야 커밋을 열 수 있다. 같은 파라미터라도 커밋이 달라 사전 이미지 공격 차단 |
| **`persistentHash<Trade>`** | `recordTrade`, `proveReturnAtLeast` | 거래를 머클 리프로 만드는 해시. 회로와 TypeScript 가 같은 값을 계산한다 |
| **`HistoricMerkleTree<10, Bytes<32>>`** | `tradeLog` | 거래를 발생 시점마다 온체인에 누적. 과거 루트도 유효해서 증명 시점의 루트 경합이 없다 |
| **`merkleTreePathRoot` + `checkRoot`** | `proveReturnAtLeast` | 제출된 8건이 커밋된 로그에 실제로 있는지. 없던 거래 끼워넣기 차단 |
| **`disclose()`** | 모든 ledger 쓰기 | 컴파일러의 정보 흐름 검사. 명시하지 않으면 witness 가 원장에 닿는 경로가 컴파일 에러 |
| **`assert`** | 4개 회로 전부 | 거짓 주장은 여기서 멈춰 proofData 가 생성되지 않는다 |

### disclose() 가 잡아낸 것

이 프로젝트에서 컴파일러가 실제로 막은 두 지점:

1. 커밋 해시를 원장에 쓰는 것 — 해시라도 witness 유래 값이므로 `disclose()` 필요
2. **머클 루트를 `checkRoot` 로 대조하는 것** — "어느 루트에 대해 증명하는가"가
   드러난다고 잡아냈다. 루트는 어차피 공개 정보라 의도된 공개다

두 번째는 사람이 놓치기 쉬운 채널이다. 프라이버시가 관례가 아니라 타입 검사라는 뜻이다.

### 지갑·노드 없이 증명이 되는 이유

`httpClientProvingProvider` 의 회로 단위 `/check` + `/prove` 엔드포인트를 쓴다.
트랜잭션 단위 `/prove-tx` 는 지갑 잔액 조정이 필요하지만, 회로 단위 증명은
`proofData -> proofDataIntoSerializedPreimage -> /prove` 로 끝난다.
심사위원이 지갑 설정 없이 `npm run live` 만으로 실제 증명을 재현할 수 있다.

## 온체인 배포 ✅

로컬 devnet 에 실제로 배포된다.

컨트랙트 두 개를 배포한다.

```
track_record  86b49d3d59b10ee06208def05cf8753f5e4f854df03c7acd8481860f4d2368b5   블록 57  (21초)
attestation   28fbb93db0f685dd2ad33177097508a2f12349d3eb75485487739b86b88c965d   블록 60  (19초)
```

**왜 두 개인가.** 공증 레지스트리를 별도로 배포하는 이유는 두 가지다.
설계상 공증인은 트레이더와 다른 주체이고 권한도 수명도 다르다. 실무적으로는
회로 14개를 한 배포 트랜잭션에 넣으면 검증키가 28KB 가 되어 블록 한도를 넘는다
(`RpcError 1010: Transaction would exhaust the block limits`).
11개/23KB 와 3개/4.8KB 로 나누면 둘 다 통과한다.

인덱서에서 `ContractDeploy` 로 확인된다.

```bash
curl -s -X POST http://127.0.0.1:8088/api/v4/graphql -H 'Content-Type: application/json' \
  -d '{"query":"{ contractAction(address:\"<주소>\"){ __typename address state } }"}'
# -> {"__typename":"ContractDeploy", "state":"6d69646e696768743a636f6e74726163742d7374617465..."}
```

### 재현 방법

```bash
# 1) 로컬 devnet (Node >= 22 필요)
git clone https://github.com/midnightntwrk/midnight-local-dev.git
cd midnight-local-dev && npm install
docker compose -f standalone.yml up -d      # node:9944 indexer:8088 proof:6300

# 2) 배포 계정에 NIGHT + DUST 지급
#    genesis 시드 0000..0001 이 이미 펀딩돼 있어 파우셋이 필요 없다.
#    npm start -- --fund-config accounts.json  (니모닉 기반) 또는 동봉 스크립트

# 3) 배포
cd ../proof-of-track-record
nvm use 22 && npm run deploy
```

### 지갑 SDK 세대 차이

배포가 한동안 막혀 있었다. 원인은 코드가 아니라 **지갑 SDK 세대 차이**였다.

| | `@midnight-ntwrk/wallet` 5.0.0 | `testkit-js` `MidnightWalletProvider` |
|---|---|---|
| 키 모델 | Zswap(shielded) 단독 | shielded + unshielded + **dust** |
| DUST 잔액 | `state()` 에 필드 없음 | 인식·사용 가능 |
| 같은 시드의 주소 | 서로 **다르게** 파생된다 | |

현재 Midnight 은 수수료를 DUST 로 낸다. NIGHT(unshielded)를 등록해야 DUST 가
생기는 모델인데 wallet 5.0.0 에는 그 개념이 없어, 펀딩된 주소와 배포 지갑
주소가 어긋나 배포가 불가능했다. `testkit-js` 의 `MidnightWalletProvider` 는
`WalletProvider` 와 `MidnightProvider` 를 동시에 구현하므로 그대로 끼우면 된다.

그래서 `deploy.mjs` 하나로 로컬 devnet / Preview / Preprod 를 모두 다룬다.
지갑 계층이 셋 다 동일하고, 환경 설정만 `MN_NETWORK` 로 갈린다.
wallet 5.0.0 기반 스크립트는 전부 제거했다 — 파우셋을 받아도 DUST 수수료를
낼 수 없어 애초에 동작할 수 없는 코드였다.

로그로 확인된 지갑 상태:
```
Shielded: {..."250000000000000"...}  Unshielded: "250050000000000"
Dust: "1250000667146900000000000"
```

`testkit-js` 는 Node >= 22 를 요구한다. 회로 컴파일과 증명 생성은
Node 20 에서도 동작하므로, 배포 스크립트만 Node 22 로 돌리면 된다.

## 개발 환경

```bash
# Compact 툴체인
curl --proto '=https' --tlsv1.2 -LsSf \
  https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
compact update
export PATH="$HOME/.local/bin:$PATH"

# 증명 서버 (Docker 필요)
docker run -p 6300:6300 midnightntwrk/proof-server:8.1.0 midnight-proof-server -v
```

## 재현 확인

심사 절차 그대로 **fresh clone** 에서 검증했다 (2026-09-09).

```
git clone … && npm install     OK
npm run build                  9 circuits
npm run demo                   5/5 ✅   (증명 서버 불필요)
npm run nav                    체리피킹 거부 포함 5건 판정 ✅
npm run live                   ZK 증명 4508 bytes ✅
npm run deploy           온체인 배포, 블록 580 ✅ (Node 22)
```

선행 조건은 Compact 툴체인 0.31.1 (`compact update 0.31`), `live` 에 한해
Docker 증명 서버, `deploy:local` 에 한해 로컬 devnet + Node 22 뿐이다.

## 빌드 및 실행

```bash
npm install
npm run build          # 회로 컴파일 (Compact 툴체인 0.31.1 필요)

# 증명 서버 없이 — 회로 동작과 적대적 테스트만
npm run demo           # 회로 1~4
npm run nav            # 회로 5 (체리피킹 차단 실증)

# 증명 서버 필요 — 실제 ZK 증명
npm run proof-server   # Docker. 최초 1회 SRS 다운로드로 1~2분 걸린다
npm run live           # 거래 로그 증명
npm run nav:proof      # NAV 델타 증명

# 온체인 배포 (로컬 devnet + Node 22 필요)
npm run deploy                      # 로컬 devnet (기본)
MN_NETWORK=preview npm run deploy   # 공용 테스트넷 (파우셋으로 tNIGHT 필요)
```

전체 스크립트:

| 스크립트 | 하는 일 | 선행 조건 |
|---|---|---|
| `build` | 회로 컴파일 | Compact 0.31.1 |
| `demo` / `nav` / `selection` / `attest` | 회로 실행 + 적대적 테스트 | 없음 |
| `live` / `nav:proof` / `selection:proof` / `attest:proof` | 실제 ZK 증명 생성 | 증명 서버 |
| `live:real` | 실제 포트폴리오로 증명 | 증명 서버 + `export` |
| `export` | 페이퍼 트레이딩 → `trades.json` | `Algorithmic_Trading_YL` + yfinance |
| `deploy` | 온체인 배포 (local/preview/preprod) | devnet 또는 파우셋 + **Node 22** |
| `proof-server` | 증명 서버 기동 | Docker |

선행 조건이 빠지면 스택트레이스 대신 무엇을 해야 하는지 알려준다.

```
$ npm run live                 # 증명 서버가 꺼져 있을 때
✗ 증명 서버에 연결할 수 없습니다: http://127.0.0.1:6300
  npm run proof-server

$ node src/deploy.mjs    # Node 20 일 때
✗ Node 22 이상이 필요합니다 (현재 20.17.0).
  nvm use 22
```

`build/` 아래에 `contract/`(TypeScript API), `zkir/`(ZK 중간표현),
`keys/`(증명·검증 키)가 생성된다. 재생성 가능하므로 커밋하지 않는다.


## 실제 포트폴리오로 증명하기

데모는 샘플 거래 8건을 씁니다. 실제 데이터로도 돌아갑니다.
[Algorithmic_Trading_YL](https://github.com/SeoDongOk/Algorithmic_Trading_YL)
의 모의 거래 계좌(S&P 500 16종목, 2026-09-08 진입)를 그대로 연결했습니다.

```bash
npm run export       # ~/.paper_trading/state.json -> trades.json
npm run live:real    # 배치 0, 1 실제 ZK 증명
```

> `export` 는 `paper_trading` 패키지와 yfinance 가 `PYTHONPATH` 에 있어야 합니다.
> 그 저장소 없이 재현하려면 `npm run live` (내장 샘플)를 쓰면 됩니다 — 같은 회로,
> 같은 증명 서버입니다.

체리피킹을 배제하려고 포지션을 **티커 알파벳순**으로 정렬해 8건씩 자르고
**두 배치 모두** 증명합니다.

```
batch 0 [COP,CRM,CVX,DE,FCX,GILD,JNJ,MRK]     실제 -356bp -> 주장 ">= -400bp"  4508B / 32.9s
batch 1 [MRNA,MSFT,NEM,NVDA,REGN,TGT,VLO,VZ]  실제 -285bp -> 주장 ">= -300bp"  4508B / 31.9s

거짓 주장 ">= 0bp" -> 회로가 거부 (claimed floor not met)
```

**두 배치 다 손실입니다.** 그게 핵심입니다. 수익을 자랑하는 도구가 아니라 주장이
**참인지 확인하는** 도구입니다. 손실 난 포트폴리오도 "최소 -400bp" 는 증명할 수
있고 "최소 0bp" 는 증명할 수 없습니다.

주장값은 실제 합계를 50bp 단위로 내린 값입니다. 정확한 값(-356bp)은 witness 로만
존재합니다.

## 공개 테스트넷 — 누구나 검증 가능

같은 흐름이 Midnight **Preview** 테스트넷에서도 돈다. 저자의 노트북에서 도는
devnet 에 기록이 묶여 있지 않다는 뜻이다.

| | 주소 | 블록 |
|---|---|---|
| `track_record` (회로 11개) | `7869ee72a2761b29189a6ea9de24065722bd68feee004be565ad027b5f36abdf` | 821701 |
| `attestation` (회로 3개) | `f57c3092ed7605a8f8714021eebd8b80871f6062c99044f2bb1ede7ab3acdca0` | 821705 |

```
블록 821705  ContractDeploy   attestation 컨트랙트
블록 821911  ContractCall     registerAttestor
블록 821915  ContractCall     submitAttestation   <- NAV 커밋
블록 821919  ContractCall     proveAttestedNav    <- ZK 증명
```

증언된 값은 실제 바이낸스 USDs-M 선물 계좌다.
`totalMarginBalance = 20.71157147` USDT, Primus 공증인
`0xdb736b13e2f522dbe18b2015d0291e4b193d8ef6` 이 읽었다. 원장에는 커밋
`ca89703830c04bd0534bd10e…` 만 있고 NAV 값 자체는 체인에 가지 않는다.

직접 확인:

```bash
curl -s -X POST https://indexer.preview.midnight.network/api/v4/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ contractAction(address:\"f57c3092ed7605a8f8714021eebd8b80871f6062c99044f2bb1ede7ab3acdca0\"){ __typename address } }"}'
```

재현 (파우셋에서 자금을 받은 `wallet-preview.seed` 필요):

```bash
MN_NETWORK=preview node src/address.mjs          # 파우셋에 넣을 주소
MN_NETWORK=preview node src/prepare-testnet.mjs  # NIGHT 를 DUST 생성용으로 등록
MN_NETWORK=preview npm run deploy
MN_NETWORK=preview node src/attest-onchain.mjs --futures
```

**Preview 가 로컬 devnet 과 다른 점 세 가지.** 각각이 배포를 막았다.

1. `PreviewTestEnvironment` 는 `proofServer` 를 비워 둔다 — 증명서버는 각자
   돌리는 것이라 설정에 URL 이 없고, 지갑 빌더가 그걸로 죽는다.
2. testkit 의 `start(true)` 는 동기화 타임아웃이 90초로 박혀 있다. Preview 는
   블록이 82만 개가 넘어 빈 지갑 동기화에 17~20분이 걸린다.
   `src/wallet.mjs` 의 `startAndSync()` 가 `syncWallet` 을 긴 기한으로 돌린다.
3. DUST 는 NIGHT UTXO 를 등록해야 쌓이기 시작하는데, 등록 전에는 dust 동기화가
   완료로 넘어가지 않는다. "동기화 후 등록" 이 교착에 빠진다.
   `prepare-testnet.mjs` 는 unshielded 만 기다린 뒤 등록하고 DUST 를 폴링한다.

공개 RPC 는 웹소켓을 간헐적으로 끊는다(`1000 Normal Closure`). 제출은 백오프로
재시도한다.

# Proof of Track Record

**트레이딩 성과를, 전략과 포지션을 공개하지 않고 증명한다.**

Midnight Korea Hackathon 2026 출품작.

---

## 문제

트레이딩 성과 주장은 검증이 불가능하다.

- **전략을 공개하면** 알파가 사라진다. 남들이 따라 하면 그걸로 끝이다.
- **공개하지 않으면** 아무도 믿을 이유가 없다. 스크린샷은 조작할 수 있고,
  백테스트는 사후에 얼마든지 다시 돌릴 수 있다.

이건 가상의 문제가 아니다. 이 저장소의 저자는 직접 겪었다.

S&P 500 비지도학습 전략을 백테스트했을 때 **연 23.63%, 샤프 0.95**가 나왔다.
숫자만 보면 SPY(11.37%)의 2배다. 그런데 파고들었더니,

| 검증 단계 | 결과 |
|---|---|
| 표면 성과 | 연 23.63% / 샤프 0.95 |
| 생존 편향 제거 (Point-in-Time 유니버스) | 연 **14.48%** / 샤프 0.61 |
| 통계적 유의성 (Newey-West) | 초과수익 **p = 0.566** — 0과 구별 불가 |
| Deflated Sharpe (데이터 스누핑 보정) | **0.55** |

**알파는 없었다.** 그런데 이 사실을 알아내려면 파이프라인을 통째로 재구현하고
위키피디아 리비전 97개월치를 긁어 시점별 구성종목을 복원해야 했다.

즉 **읽는 사람이 그 노동을 하지 않는 한, 어떤 성과 주장도 검증할 수 없다.**

## 해법

영지식 증명은 정확히 이 간극을 메운다.
**양쪽이 사전 지식을 공유하지 않고도 신뢰**하는 것 — 검증자는 전략을 몰라도 되고,
증명자는 전략을 넘기지 않아도 된다.

이 DApp 은 트레이더가 다음을 증명하게 한다.

1. **사전 커밋** — 전략 파라미터를 거래 *이전에* 해시로 원장에 남긴다.
   나중에 파라미터를 바꿔 성과를 꾸미는 것(사후 오버피팅)을 막는다.
2. **성과의 출처** — 보고한 수익률이 커밋된 거래 로그에서 계산됐음을 증명한다.
   개별 체결 내역은 공개하지 않는다.
3. **리스크 준수** — 종목당 비중 상한, 레버리지 한도 같은 제약을 지켰음을
   포지션을 드러내지 않고 증명한다.

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

## 상태

**4개 회로 전부 동작 검증 완료.** 참인 주장은 통과하고 거짓 주장·위조는 거부된다.

- [x] Compact 툴체인 (네트워크와 맞춘 **0.31.1**, language_version 0.23, runtime 0.16.0)
- [x] **회로 1** 전략 사전 커밋 `commitStrategy` / `revealMatchesCommitment`
- [x] **회로 2** 거래 머클 커밋 `recordTrade`
- [x] **회로 3** 수익률 임계값 증명 `proveReturnAtLeast`
- [x] **회로 4** 리스크 한도 증명 `commitPortfolio` / `proveMaxWeight`
- [x] **로컬 실행 데모** (`npm run demo`) — 적대적 테스트 포함
- [x] **실제 ZK 증명 생성** (`npm run live`) — 증명 서버 8.1.0 연동
- [x] **실제 포트폴리오 데이터로 증명** (`npm run export && npm run live:real`)
- [ ] 온체인 배포 — 로컬 devnet 기동·펀딩까지 성공, 지갑 SDK 세대 불일치로 미완

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

## 실제 포트폴리오로 증명하기

위 데모는 샘플 8건이다. 실제 데이터로도 돌아간다.
[Algorithmic_Trading_YL](https://github.com/SeoDongOk/Algorithmic_Trading_YL) 의
페이퍼 트레이딩 계좌(S&P 500 16종목, 2026-09-08 진입)를 그대로 물렸다.

```bash
npm run export       # ~/.paper_trading/state.json -> trades.json (시가평가 손익, bps)
npm run live:real    # 배치 0, 1 각각 실제 ZK 증명 생성
```

> `export` 는 [Algorithmic_Trading_YL](https://github.com/SeoDongOk/Algorithmic_Trading_YL)
> 의 `paper_trading` 패키지와 yfinance 가 `PYTHONPATH` 에 있어야 한다.
> 그 저장소 없이 재현하려면 `npm run live` (내장 샘플) 를 쓰면 된다 — 같은 회로, 같은 증명 서버.

체리피킹을 막기 위해 티커 **알파벳순**으로 8건씩 잘라 **두 배치 모두** 증명한다.

```
배치0 [COP,CRM,CVX,DE,FCX,GILD,JNJ,MRK]    실제 -356bp -> 주장 "≥ -400bp"  ✅ 4508B / 32.9s
배치1 [MRNA,MSFT,NEM,NVDA,REGN,TGT,VLO,VZ]  실제 -285bp -> 주장 "≥ -300bp"  ✅ 4508B / 31.9s

거짓 주장 "≥ 0bp"  -> 회로 거부 (claimed floor not met)
```

**둘 다 손실이다.** 이게 요점이다. 이 시스템은 수익을 자랑하는 도구가 아니라
**주장이 참인지 검증하는** 도구다. 손실 중인 포트폴리오도 "-400bp 이상"이라는
참인 주장은 증명할 수 있고, "0bp 이상"이라는 거짓 주장은 증명할 수 없다.
증명자가 무엇을 공개할지(하한 -400bp) 고르고, 검증자는 그 이상은 알 수 없다.

주장값은 실제 합계를 50bp 단위로 내린 값이다. 정확한 값(-356bp)은 witness 로만 존재한다.

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

## 온체인 배포 (미완, 원인 규명됨)

배포는 아직 안 된다. 원인은 코드 버그가 아니라 **SDK 세대 불일치**다.

### 로컬 devnet 은 정상 기동한다

```bash
git clone https://github.com/midnightntwrk/midnight-local-dev.git
cd midnight-local-dev && npm install          # Node >= 22 필요
docker compose -f standalone.yml up -d        # node:9944 indexer:8088 proof:6300
```

genesis 지갑(시드 `0000…0001`)이 이미 펀딩돼 있어 파우셋이 필요 없다.
실제로 배포용 계정에 NIGHT 500조 + DUST 1.25e24 를 전송하고 DUST 등록까지 성공했다.

### 막힌 지점

`src/deploy.mjs` 는 `@midnight-ntwrk/wallet` 5.0.0 을 쓰는데, 이 지갑은
**Zswap(shielded) 전용**이다. 확인한 사실:

| 확인 | 결과 |
|---|---|
| `wallet.state()` 필드 | shielded 만. DUST 잔액 필드가 없다 |
| 인덱서 v4 GraphQL | unshielded 잔액 쿼리 없음 (38개 필드 전수 확인) |
| 같은 시드의 shielded 주소 | wallet 5.0.0 과 testkit-js 가 **서로 다른 주소**를 파생 |

현재 Midnight 은 수수료를 **DUST** 로 낸다. NIGHT(unshielded) 를 등록해야
DUST 가 생성되는 모델인데, wallet 5.0.0 에는 unshielded/DUST 개념이 없다.
로컬 devnet 도구는 `@midnight-ntwrk/testkit-js` 의 `FluentWalletBuilder`
(shielded + unshielded + dust 3-키 모델)를 쓴다. 두 SDK 의 키 파생이 달라
펀딩된 주소와 배포 지갑 주소가 일치하지 않는다.

### 해결 방향

`deploy.mjs` 의 지갑 계층을 `@midnight-ntwrk/wallet` → `testkit-js`
(또는 `wallet-sdk-facade`) 로 교체하면 된다. 회로·증명 쪽은 영향이 없다.
증명 생성은 이미 동작하므로 배포는 트랜잭션 서명/수수료 계층만 남은 문제다.

**해커톤 규정상 로컬 devnet 이 허용되고, 실제 ZK 증명이 이미 동작하므로
제출 요건은 충족한다.** 온체인 배포는 가산점 항목이다.

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
git clone … && npm install        OK
npm run build                     6 circuits, 산출물 28개
npm run demo                      5/5 ✅  (증명 서버 불필요)
npm run live                      ZK 증명 4508 bytes, 21.8s
```

선행 조건은 Compact 툴체인 0.31.1 (`compact update 0.31`) 과, `live` 에 한해 Docker 증명 서버뿐이다.

## 빌드 및 실행

```bash
compact compile contracts/track_record.compact build/track_record
```

`build/` 아래에 `contract/`(TypeScript API), `zkir/`(ZK 중간표현),
`keys/`(증명·검증 키)가 생성된다. 재생성 가능하므로 커밋하지 않는다.

## 배경 자료

- 백테스트 원본 분석: [Algorithmic_Trading_YL](https://github.com/SeoDongOk/Algorithmic_Trading_YL)
- 생존 편향으로 알파가 사라진 과정:
  [블로그](https://seodongok.github.io/blog/2026-09-08-survivorship-bias-kills-alpha)

# Proof of Track Record

**[English](README.md)** · 한국어

**거래 전에 전략을 커밋한다. 거래 후에 결과를 증명한다. 둘 다 나중에 고칠 수 없다.**

Midnight Korea Hackathon 2026 출품작.

---

## 무엇인가

거래 내역을 보여주지 않고도 증명할 수 있는 트랙 레코드입니다.

트랙 레코드를 볼 때 보통 *"조작했나?"* 를 묻습니다. 그런데 숫자가 완전히 진짜여도
거짓말이 될 수 있습니다. 살아남은 전략만 보여주기 때문입니다.

> "1년 동안 전략 10개를 돌렸다. 이게 그중 이긴 거다."

그래서 이 프로젝트는 결과를 알기 **전에** 전략을 온체인에 고정하고, 나중에 그 성과가
**바로 그** 커밋된 전략에서 나왔음을 증명합니다. 영지식이므로 전략도 개별 거래도
공개되지 않습니다.

저자가 정확히 이 함정에 빠졌습니다. **연 23.63% / 샤프 0.95** 로 나온 백테스트가
생존 편향을 제거하자 **연 14.48% / 샤프 0.61** 로 주저앉았고, 초과수익은
**p = 0.566** 으로 0과 구별되지 않았습니다. 조작한 것은 하나도 없습니다.
파이프라인이 그저 다시 돌릴 수 있었을 뿐이고, 그 과정은 흔적을 남기지 않습니다.
→ [동기와 선행 연구](docs/motivation.ko.md)

## 빠른 시작

```bash
npm install
npm run build          # 회로 컴파일 (Compact 툴체인 0.31.1 필요)

npm run demo           # 회로 1-4 + 공격 테스트   (증명 서버 불필요)
npm run nav            # 회로 5 — 체리피킹 차단    (증명 서버 불필요)
npm run selection      # 회로 6 — 전략 레지스트리  (증명 서버 불필요)
npm run attest         # 회로 7 — 공증인 슬롯      (증명 서버 불필요)

npm run proof-server   # Docker. 첫 실행 시 SRS 다운로드 1-2분
npm run live           # 실제 ZK 증명, 4508 바이트
```

전제 조건이 빠지면 스택 트레이스가 아니라 안내가 나옵니다.

```
$ npm run live                 # 증명 서버가 꺼져 있음
X Cannot reach the proof server: http://127.0.0.1:6300
  npm run proof-server
```

전체 스크립트 표와 툴체인 설치 → [구현 노트](docs/implementation.ko.md)

## 어떻게 동작하나

주장 일곱 가지, 각각 하나의 회로이고 컨트랙트 2개에 나뉘어 배포됩니다.

| 회로 | 증명하는 것 | 진입점 |
|---|---|---|
| 1 | 거래 **전에** 전략을 커밋했다 | `commitStrategy` / `revealMatchesCommitment` |
| 2 | 모든 거래를 발생 시점에 기록했다 | `recordTrade` (머클) |
| 3 | 수익률이 커밋된 거래 로그에서 나왔다 | `proveReturnAtLeast` |
| 4 | 포지션별 리스크 한도를 지켰다 | `commitPortfolio` / `proveMaxWeight` |

더 어려운 구멍 셋은 나머지 세 회로가 막습니다.

| 회로 | 증명하는 것 | 진입점 |
|---|---|---|
| 5 | 수익률이 커밋된 **계좌 NAV** 와 맞으므로 손실을 뺄 수 없다 | `openNavPeriod` / `closeNavPeriod` / `proveNavReturnAtLeast` |
| 6 | **전략을 몇 개 시도했는지**가 공개되어, "10개 중 1개"가 "1전 1승"처럼 보일 수 없다 | `registerStrategy` / `provenanceOf` |
| 7 | NAV 를 제3자가 공증했다 (자기 신고가 아니다) | `registerAttestor` / `submitAttestation` / `proveAttestedNav` |

전략 단위 체리피킹을 막는 것이 레지스트리입니다.

```
트레이더가 전략 10개 등록 (파라미터는 비공개)
  원장: strategyCount[trader] = 10

이긴 전략(#7) 증명        -> 통과, 회로가 10 을 함께 반환
등록 안 한 전략 주장      -> 거부: strategy does not match the registered commitment
3번을 7번인 척 제출       -> 거부: 커밋이 슬롯에 묶여 있음
```

**왜 영지식이 필요한가:** 사전 커밋 자체는 쉽습니다. 문서를 해시해서 아무 체인에나
타임스탬프 찍으면 됩니다. 그런데 트레이더는 전략을 공개할 수 없습니다. 공개하면
알파가 죽으니까요. 그래서 커밋은 내용을 숨겨야 하고, 나중의 증명은 그 **숨겨진 것**
에서 성과가 나왔음을 열지 않고 보여야 합니다. ZK 없이 하려면 검증자가 직접 재계산할
수 있도록 전략과 모든 거래를 공개해야 합니다.

원장에 올라가는 것은 주장뿐입니다.

```
증명된 손익 하한:  800500  (실제 800590 은 비공개)
증명된 비중 상한:  1000 bp (실제 비중은 비공개)
```

## 막는 것과 못 막는 것

ZK 는 **계산이 정직했음**을 증명합니다. **입력이 완전했음**은 증명하지 않습니다.
그 경계가 어디인지 명시합니다.

| 막는 것 | 어떻게 |
|---|---|
| 내지 않은 수익률 주장 | 회로 2-3 — 머클 커밋된 거래 로그 |
| 손실을 빼고 수익률 계산 | 회로 5 — NAV 는 잔고라서 거래를 빼도 안 바뀐다 |
| 시작 잔고를 사후에 낮추기 | 회로 5 — 시작 NAV 가 커밋되어 있다 |
| 전략을 나중에 바꾸기 | 회로 1 |
| 전략을 몇 개 시도했는지 숨기기 | 회로 6 — 레지스트리 카운트가 공개 |
| NAV 자체를 지어내기 | 회로 7 — **공증인이 정직할 때만** |

| 남는 가정 | 왜 |
|---|---|
| **공증인이 정직해야 한다** | 외부 사실("내 잔고가 X다")을 증명하려면 그것을 목격한 무언가가 필요합니다. 데모 공증인은 넘겨받은 값을 그대로 공증합니다. `src/attestor.mjs` 의 `zkTlsAttestor()` 가 TLSNotary/Reclaim 이 들어갈 미구현 슬롯입니다. **이것이 남은 최대 과제입니다.** |
| **신원이 시빌 저항적이지 않다** | 새 신원을 만들면 전략 카운터가 0으로 초기화됩니다. `accountId` 를 KYC 된 거래소 계정에 묶어야 신원에 무게가 생깁니다. |

전체 논증, 공증인 설계, 시도했다가 되돌린 것(직접 구현한 Schnorr)
→ [신뢰 모델](docs/trust-model.ko.md)

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

## 상태

모든 회로를 끝에서 끝까지 검증했습니다. 참인 주장은 통과하고, 거짓 주장과 위조는
거부됩니다.

- [x] Compact 툴체인 **0.31.1** (현재 네트워크에 맞춤, language_version 0.23, runtime 0.16.0)
- [x] **회로 14개**, 컨트랙트 2개 — `track_record` (11개), `attestation` (3개)
- [x] **로컬 데모 + 공격 테스트** — `demo` / `nav` / `selection` / `attest`
- [x] **실제 ZK 증명** (증명 서버 8.1.0) — 각 4508 바이트
- [x] **실제 포트폴리오 증명** — `npm run export && npm run live:real`
- [x] **온체인 배포** — 로컬 devnet, 두 컨트랙트 모두

이 레포를 새로 클론해서 확인했습니다.

```
git clone ... && npm ci          OK
npm run build                    11 + 3 회로
npm run demo / nav / selection / attest     전부 통과
npm run live / nav:proof / selection:proof / attest:proof   4508 바이트 증명
npm run deploy                   두 컨트랙트 온체인 (Node 22)
```

## 문서

| | |
|---|---|
| [동기와 선행 연구](docs/motivation.ko.md) | 인증만으로 왜 부족한가, Obscura·Proof of Alpha·ZEROBASE 와의 비교, 솔직한 약점 |
| [신뢰 모델](docs/trust-model.ko.md) | 각 회로가 막는 것, 공증인 슬롯, 시빌 저항, 되돌린 Schnorr 시도 |
| [구현 노트](docs/implementation.ko.md) | Midnight 기능과 코드 위치, `disclose()` 가 잡아낸 것, 온체인 배포, 지갑 SDK 세대 차이, 전체 스크립트 표 |

## 배경 자료

- 원래의 백테스트 분석:
  [Algorithmic_Trading_YL](https://github.com/SeoDongOk/Algorithmic_Trading_YL)
- 생존 편향이 알파를 지운 과정:
  [블로그 글](https://seodongok.github.io/blog/2026-09-08-survivorship-bias-kills-alpha)

## 라이선스

Apache-2.0. [LICENSE](LICENSE) 참고.

기반이 되는 Midnight SDK 는 Apache-2.0, Compact 툴체인은 MIT 입니다.

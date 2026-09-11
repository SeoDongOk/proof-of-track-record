# Proof of Track Record

**[English](README.md)** · 한국어

**거래 전에 전략을 커밋하고, 거래 후에 결과를 증명한다. 둘 다 고쳐 쓸 수 없다.**

Midnight Korea Hackathon 2026 출품작.

---

## 문제 — 숫자가 진짜여도 거짓말이 된다

트랙 레코드를 보면 다들 같은 걸 묻는다. *조작했나?*

그건 쉬운 쪽 실패다. 위험한 건 **완전히 진짜인데도 오해를 만드는** 숫자다.
살아남은 전략만 보게 되기 때문이다.

> "전략 10개를 1년간 돌렸습니다. 지금 보여드리는 건 이긴 하나입니다."

모든 거래가 실제다. 체결 하나하나 검증된다. 수익률도 적힌 그대로다.
그런데 앞으로 어떻게 될지에 대해서는 아무것도 말해주지 않는다.
선택이 **숫자가 만들어지기 전에** 일어났고, 선택은 흔적을 남기지 않기 때문이다.

가상의 이야기가 아니다. 이 저장소의 저자가 직접 겪었다.

S&P 500 비지도학습 전략을 백테스트했을 때 **연 23.63%, 샤프 0.95**가 나왔다.
SPY(11.37%)의 2배다. 그런데 파고들었더니,

| 검증 단계 | 결과 |
|---|---|
| 표면 성과 | 연 23.63% / 샤프 0.95 |
| 생존 편향 제거 (Point-in-Time 유니버스) | 연 **14.48%** / 샤프 0.61 |
| 통계적 유의성 (Newey-West) | 초과수익 **p = 0.566** — 0과 구별 불가 |
| Deflated Sharpe (데이터 스누핑 보정) | **0.55** |

**알파는 없었다.** 이걸 알아내려면 파이프라인을 통째로 재구현하고
위키피디아 리비전 97개월치를 긁어 시점별 구성종목을 복원해야 했다.

그리고 원래 결과에 **조작은 없었다.** 백테스트는 실제 가격으로 정확히 돌았다.
다만 다시 돌릴 수 있었을 뿐이다 — 파라미터를 바꾸고, 유니버스를 다시 정의하고,
숫자가 마음에 들 때까지. **그 과정은 흔적을 남기지 않고, 최종 수치만 보는
사람은 알아낼 방법이 없다.**

## 숫자를 검증하는 것만으로는 부족하다

트랙 레코드가 진짜인지 증명하는 시스템은 이미 있다.
[Obscura](https://blog.horizen.io/trade-with-proof-not-trust-how-obscura-is-making-reputation-private-and-verifiable)
는 거래소에서 거래를 끌어와 노출 없이 총 손익을 증명한다.
[Proof of Alpha](https://minaprotocol.com/blog/proof-of-alpha) 도 Mina 에서
비슷한 걸 한다. 둘 다 잘 동작하고, 실제 문제를 푼다.

다만 위 문제는 다루지 않는다. 둘은 **보여준 거래가 진짜임**을 증명한다.
**그게 거래의 전부였음** — 더 정확히는 그게 당신이 돌린 유일한 전략이었음 —
은 증명하지 못한다.

출처 인증은 "이 숫자가 참인가"에 답한다.
"**이 숫자가 사후에 선택된 것인가**"에는 답하지 않는다.

## 해법 — 사전 커밋, 그리고 왜 ZK 가 필요한가

결과를 알기 **전에** 전략을 온체인에 못 박는다. 그다음, 성과가 **그** 커밋된
전략에서 나왔음을 증명한다.

그러면 주장의 성격이 바뀐다. 결과를 알기 전에 등록해 둔 전략의 성적만
보고할 수 있다.

컨트랙트 하나에 전략 하나를 잠그는 것만으로는 부족하다. 컨트랙트를 10개
배포하고 이긴 것만 보여주면 그만이기 때문이다. 그래서 등록은 **트레이더
식별자를 키로 하는 공유 레지스트리**에 쌓이고, **등록 개수가 공개**된다.

10개를 돌려 이긴 하나를 내미는 게 불가능해지는 건 아니다. **숨길 수 없게**
될 뿐이다. 검증자는 레지스트리에서 10 을 읽고, 10개 중 하나를 보고 있음을
안다. "1전 1승" 과 "10개 중 1개" 가 더는 같아 보이지 않는다.

```
트레이더가 전략 10개 등록 (파라미터는 비공개)
  원장: strategyCount[trader] = 10

이긴 7번 증명       -> 통과, 회로가 10 을 함께 반환
미등록 전략 주장    -> 거부: strategy does not match the registered commitment
3번을 7번인 척 제출 -> 거부: 커밋이 슬롯에 묶여 있다
```

`npm run selection` 으로 재현. `npm run selection:proof` 는 실제 ZK 증명을
만든다 (4508 bytes, 9.7s).

**왜 영지식이 필요한가:** 사전 커밋만이라면 쉽다. 문서를 해시해서 아무 체인에나
타임스탬프를 찍으면 된다 — 실증 연구에서 확립된 관행이다(OpenTimestamps 등).
그런데 트레이더는 전략을 공개할 수 없다. 공개하면 알파가 죽는다.
따라서 커밋은 내용을 숨겨야 하고, 나중의 증명은 성과가 **그 숨겨진 것**에서
나왔음을 열어보지 않고 보여야 한다.

ZK 회로가 정확히 그 일을 한다. 해시만으로는 안 되는 이유도 여기다.
ZK 없이 "커밋된 전략으로 수익률 15% 이상"을 증명하려면 결국 전략과 모든 거래를
공개해서 검증자가 직접 다시 계산하게 해야 한다.

그래서 이 DApp 은 세 가지를 증명한다.

1. **사전 커밋** — 전략 파라미터를 거래 *이전에* 해시로 원장에 남긴다.
   나중에 파라미터를 바꿔 성과를 꾸밀 수 없다.
2. **성과의 출처** — 보고한 수익률이 커밋된 거래 로그와 커밋된 계좌 NAV 에서
   계산됐음을 증명한다. 개별 체결은 공개하지 않는다.
3. **리스크 준수** — 종목당 비중 상한을 지켰음을 포지션을 드러내지 않고 증명한다.

프라이버시가 이 프로젝트의 간판은 아니다. 사전 커밋을 **쓸 수 있게 만드는**
조건일 뿐이다.

## 왜 이걸 쓰나 — 기존 방법과의 차이

성과를 증명하는 방법은 이미 있다. 전부 **믿을 만한 제3자에게 전부 보여주는 것**이다.

| 오늘의 방법 | 어떻게 동작하나 | 무엇을 포기하나 |
|---|---|---|
| eToro·바이비트 카피트레이딩 | 플랫폼이 계좌를 위탁 보관 | 그 플랫폼에서만 거래 가능. 플랫폼이 전부 봄. 배지가 밖에서는 무의미 |
| 프랍펌 (FTMO 등) | 회사 계좌를 빌려줌 | 내 계좌의 기록은 증명 불가 |
| 펀드 감사·행정사 | 감사인이 전 거래를 열람 | 비용·수개월 지연·전면 공개 |
| 스크린샷 / 거래내역 PDF | 없음 | 위조 가능 |

**공통점: 검증받으려면 전략을 넘겨야 하고, 검증 결과는 그 플랫폼 밖으로 못 나간다.**

### 이 프로젝트가 다른 점

증명이 **이동 가능(portable)** 하고, 검증자가 아무것도 볼 필요가 없다.
바이낸스에서 거래한 기록을 트위터 청중에게, 계좌를 공개하지 않고 증명할 수 있다.

### 해시만 체인에 올리면 안 되나?

타임스탬프는 되지만 그걸로 끝이다. "수익률 15% 이상"을 증명하려면
결국 거래를 전부 공개해서 검증자가 직접 계산하게 해야 한다.

영지식이 필요한 이유가 여기다. **입력을 공개하지 않고 입력에서 유도된 주장을 증명**하는 것.
공개 원장(타임스탬프·불변성)과 ZK(비공개) 둘 다 있어야 성립하며, Midnight 이 그 조합이다.

### 브로커 서명 없이도 오늘 쓸 수 있는 것

이 시스템은 아직 "NAV 가 진짜다"를 증명하지 못한다([신뢰 모델](#신뢰-모델--이-시스템이-막는-것과-못-막는-것)).
그래도 **오늘 당장, 아무도 신뢰하지 않고** 얻는 게 하나 있다.

> **역사를 고쳐 쓸 수 없다.**

전략 해시와 NAV 를 결과가 나오기 **전에** 온체인에 못 박으면:

- 전략 10개를 돌려놓고 이긴 것만 보여줄 수 없다 (전략 단위 생존 편향)
- 중간에 파라미터를 바꿔놓고 "원래 이랬다"고 할 수 없다
- 나중에 거래를 끼워넣거나 뺄 수 없다

이 프로젝트가 여기서 출발했다. 위 [문제](#문제--숫자가-진짜여도-거짓말이-된다)에 적은 그 백테스트다 —
연 23.63% 가 생존 편향을 제거하니 14.48% 가 됐고, 초과수익 p 값은 0.566 이었다.

문제는 그 과정이 **아무 흔적도 남기지 않는다**는 것이다. 백테스트는 마음에 들
때까지 다시 돌릴 수 있고, 최종 결과만 보는 사람은 그 사실을 알 방법이 없다.
사전 커밋은 그걸 불가능하게 만든다. 커밋한 뒤에 나온 숫자만 주장할 수 있다.

즉 주장의 성격이 다르다.

| | 주장 |
|---|---|
| 스크린샷 | "제가 이만큼 벌었습니다" (검증 불가) |
| 이 시스템 (브로커 서명 없이) | "이 숫자는 결과를 알기 전에 커밋됐고 이후 수정되지 않았습니다" |
| 이 시스템 (브로커 서명 포함) | "이 숫자는 거래소가 서명한 잔고에서 나왔습니다" |

두 번째만으로도 데이터 스누핑은 막힌다. 세 번째는 다음 단계다.

### 누가 안 쓰나

증명을 요구하는 쪽이 없으면 의미가 없다. 스크린샷으로 충분한 관계에서는
이 시스템이 할 일이 없다. **돈을 맡기는 쪽이 검증을 요구할 때** 값이 생긴다.

## 선행 연구와 차이점

**이 아이디어는 새롭지 않다.** 같은 걸 만드는 곳이 있고, 그중 하나는 이미 라이브다.
최초라고 주장하는 것보다 이 사실을 밝히는 편이 낫다.

| 프로젝트 | 상태 | 데이터 출처 | 체리피킹 차단 | 스택 |
|---|---|---|---|---|
| **[Obscura](https://blog.horizen.io/trade-with-proof-not-trust-how-obscura-is-making-reputation-private-and-verifiable)** (Horizen) | **라이브** | 거래소 API 키(CEX), 지갑 서명(DEX) | 기간 전체 거래집합의 해시에 커밋 + 시간 구간 고정 | Horizen L3, 자체 ZK 회로, **AWS Nitro TEE** |
| **[Proof of Alpha](https://minaprotocol.com/blog/proof-of-alpha)** (o1Labs / Mina) | 개발 중 | 바이낸스 읽기전용 API | 미해결 — 사용자가 종목쌍과 기간을 고른다 | Mina zkApp |
| **[ZEROBASE](https://zerobase.website/docs/article/verifiable-scheme-for-hedge-fund-investment-strategies-based-on-zk-interval-proofs/)** | 연구 | — | — | 포트폴리오 리스크 구간 증명 |
| **이 프로젝트** | 해커톤 | 자기증명 (브로커 서명은 다음 과제) | NAV 델타 바인딩 + 온체인 거래 커밋 | Midnight, Compact |

특히 Obscura 는 더 어려운 절반을 풀었다. 거래소에서 직접 데이터를 끌어와
출처를 인증한다. 이 프로젝트는 그걸 못 한다 —
[신뢰 모델](#신뢰-모델--이-시스템이-막는-것과-못-막는-것)에 그대로 적어 두었다.

### 그래서 실제로 다른 점

**1. 신뢰 하드웨어를 쓰지 않는다.**
Obscura 는 AWS Nitro 엔클레이브 안에서 거래를 처리한다. TEE 는 그 자체가
신뢰 가정이다 — 아마존의 하드웨어와 그 증명 체인을 믿어야 하고, TEE 는
부채널 공격으로 뚫린 역사가 길다. 이 프로젝트에는 TEE 가 없다. 보장은
온체인 커밋과 ZK 회로에서만 나온다. 대가로 데이터 출처 인증은 위임하지
못하고 미해결로 남는다.

**2. 데이터 스누핑에 대한 사전 커밋.**
Obscura 도 Proof of Alpha 도 *과거 성과*를 증명한다. 둘 다 이건 못 막는다.

> "전략 10개를 1년간 돌렸고, 지금 보여주는 건 이긴 하나입니다."

이건 거래 체리피킹과 다른 종류의 실패이고, 이 저장소 저자가 실제로 당한 쪽이다.
거래 **이전에** 전략 해시를 커밋하는 것(여기 회로 1)이 사전 등록하지 않은
전략을 주장할 수 없게 만든다. 사전 등록 문서를 해시 커밋하는 것 자체는
실증 연구에서 확립된 관행이다(OpenTimestamps 등). 이 프로젝트의 몫은
그걸 성과 증명과 묶어 한 번에 검증되게 한 것이다.

**3. 프라이버시를 타입 시스템이 강제한다.**
Compact 은 witness 값이 원장에 닿을 수 있으면 컴파일을 거부한다. 이건
Midnight 툴체인의 성질이지 이 프로젝트의 공은 아니지만, 위 표의 다른
어떤 항목에도 없는 성질이고 개발 중 실제 누출 두 건을 잡았다
([핵심 아이디어](#핵심-아이디어--프라이버시는-관례가-아니라-타입-검사다)).

### 정직한 약점

- Obscura 는 사용자가 있는 출시 제품이고 이건 해커톤 제출물이다.
- Obscura 와 Proof of Alpha 는 거래소에서 데이터 출처를 인증한다. 이건 못 한다.
- Proof of Alpha 뒤에는 o1Labs 가 있다.

이 프로젝트가 방어할 수 있는 좁은 주장은 이것이다:
**신뢰 하드웨어 없이, 역사를 고쳐 쓸 수 없는 자기증명 트랙 레코드를 Midnight 위에서.**

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
- [x] **회로 6** 전략 레지스트리 `registerStrategy` / `provenanceOf` (시행 횟수를 공개)
- [x] **회로 7** 제3자 증언 `registerAttestor` / `submitAttestation` / `proveAttestedNav` (공증인 슬롯)
- [x] **회로 2** 거래 머클 커밋 `recordTrade`
- [x] **회로 3** 수익률 임계값 증명 `proveReturnAtLeast`
- [x] **회로 4** 리스크 한도 증명 `commitPortfolio` / `proveMaxWeight`
- [x] **회로 5** NAV 델타 증명 `openNavPeriod` / `closeNavPeriod` / `proveNavReturnAtLeast`
- [x] **로컬 실행 데모** (`npm run demo`) — 적대적 테스트 포함
- [x] **실제 ZK 증명 생성** (`npm run live`) — 증명 서버 8.1.0 연동
- [x] **실제 포트폴리오 데이터로 증명** (`npm run export && npm run live:real`)
- [x] **온체인 배포** — 로컬 devnet, 블록 319 (`npm run deploy`)

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

## 신뢰 모델 — 이 시스템이 막는 것과 못 막는 것

ZK 는 "계산이 정직했다"를 증명하지 **"입력이 전부다"를 증명하지 않는다.**
회로 3(거래 로그 합계)에는 그래서 구멍이 있다. 로그에 무엇을 넣을지 고르는
주체가 트레이더 본인이므로, **손실 거래를 애초에 커밋하지 않으면**
남은 것만으로 참인 주장을 만들 수 있다.

회로 5(NAV 델타)가 이 구멍을 막는다. 기간 시작·종료의 **계좌 순자산**을
커밋하면 거래를 빼도 잔고는 그대로다.

```
실제 거래: 5승 3패, 합계 -400bp    NAV 100,000,000 -> 96,000,000

[1] 이긴 5건만 골라낸 주장 (+950bp)  -> 거부: claimed return not met
[2] 실제 성과 주장 (>= -400bp)       -> 통과, 원장 기록 9600
[3] 1bp 만 부풀려도 (>= -399bp)      -> 거부: claimed return not met
[4] 시작 NAV 를 사후에 절반으로       -> 거부: open nav does not match its commitment
```

`npm run nav` 로 재현. `npm run nav:proof` 는 실제 ZK 증명을 만든다
(4508 bytes, 7.9s — 머클 경로가 없어 회로 3보다 가볍다).

### 자기증명을 끊는 법 — 공증인 슬롯

커밋은 *"내가 말한 값을 안 바꿨다"* 만 보장한다. 처음부터 지어낸 NAV 는
이후 모든 증명을 정직하게 통과한다.

**이건 설계로 없앨 수 있는 한계가 아니다.** 체인 안에서 바깥 사실
("내 거래소 잔고가 X 다")을 증명하려면 그걸 목격한 무언가가 반드시 필요하다.
Obscura 는 TEE + 거래소 API 로, zkTLS 는 공증인으로 푼다. 이름만 다를 뿐
같은 역할이다. 그래서 숨기지 않고 슬롯으로 드러낸다.

설계의 요점은 **서명 검증을 회로 밖으로 뺀다**는 것이다.

1. 공증인이 거래소 TLS 세션에서 잔고를 읽고 `(계좌ID, NAV커밋)` 을 온체인에 올린다
2. 공증인 서명 검증은 체인과 검증자가 일반 도구로 한다 — 회로는 관여하지 않는다
3. 회로는 *"내 비공개 NAV 가 그 커밋을 연다"* 만 증명한다

덕분에 Compact 0.31 에서 오늘 동작한다. 회로 안에서 서명을 검증하려면
0.34 의 `secp256k1EcdsaVerify` 가 필요한데, 이 설계는 그럴 필요를 없앤다.

```
공증 없이 NAV 주장      -> 거부: no attestation for that account
공증인이 실제 잔고 증언  -> 원장에는 커밋만 오른다
진짜 NAV 로 증명        -> 통과, NAV 는 비공개
NAV 를 3배로 부풀림      -> 거부: nav does not open the attested commitment
미증언 계좌로 주장      -> 거부
```

`npm run attest` 로 재현. `npm run attest:proof` 는 실제 ZK 증명을 만든다
(4508 bytes, 2.0s — 여기서 가장 가벼운 회로).

**데모 공증인은 신뢰 가치가 없다.** 실제 거래소를 보지 않고 주어진 NAV 를
그대로 증언한다. 배선을 보여주기 위한 것이다. `src/attestor.mjs` 가 어댑터를
정의하고, `zkTlsAttestor()` 가 TLSNotary/Reclaim 이 들어갈 미구현 슬롯이다.
**그 연동이 남은 핵심 작업이다.**

참고로 "브로커가 잔고에 서명" 은 실제로는 성립하지 않는다. 바이낸스의 Ed25519
는 *클라이언트* 가 요청에 서명하는 방향이고 거래소는 응답에 서명하지 않는다.
거래소 협조가 필요 없는 zkTLS 가 경로인 이유다.

### 무엇이 옮겨가고 무엇이 남나

| 막는다 | 남는 가정 |
|---|---|
| 커밋한 값에 대해 거짓말하기 | **공증인이 정직해야 한다** |
| 손실 거래를 빼고 계산하기 | **신원 자체에는 Sybil 저항이 없다** |
| 사후에 시작 잔고 낮추기 | |
| 전략을 사후에 바꾸기 | |
| 몇 개를 시도했는지 숨기기 | |
| NAV 날조 (공증인이 있을 때) | |

**Sybil 에 관해:** 전략 레지스트리는 트레이더 신원별로 세므로, 신원을 새로
만들면 카운터가 0 부터 시작한다. `accountId` 를 **KYC 된 거래소 계좌**에
묶는 것이 그 신원에 무게를 준다 — 신원 10개를 만들려면 KYC 계좌 10개가
필요하고, 비싸며 대개 허용되지 않는다. 그 연결이 없으면 익명 트레이더는
여전히 처음부터 다시 시작할 수 있다.

### 시도했고, 왜 미뤘는지

0.31.1 에는 서명 검증이 패키지로 없어 Jubjub 연산으로 Schnorr 을 직접 조립해 봤다.
회로 자체는 컴파일까지 됐지만(`s·G == R + e·P`), **챌린지를 스칼라로 줄이는 지점**에서
막혔다.

| 확인한 사실 | |
|---|---|
| `ecMul`/`ecMulGenerator` 스칼라 상한 | `6554484396890773809930967563523245729705921265872317281365359162392183254198` (Jubjub 스칼라체 r−1) |
| `transientHash` 출력 | 기저체 원소 (~2^255). **스칼라체를 넘는다** |
| `as Uint<248>` | 잘라내기가 아니라 **범위 검사**. 해시 출력에 쓰면 실패 |
| Compact `Uint` 최대 폭 | 248비트 |
| `Bytes<32>` → `Uint` 변환 | 회로 안에 없음 (`convertBytesToField` 는 런타임 전용) |
| 사용 가능한 EC | `ecAdd` `ecMul` `ecMulGenerator` `hashToCurve`, 점 비교는 `==` |

남은 길은 해시를 비트 분해해 하위 248비트를 witness 로 받고 그 분해가
맞는지 회로에서 검증하는 가젯인데, Field 랩어라운드 때문에 분해의 유일성을
따로 보장해야 한다. **검토받지 않은 손수 만든 서명 검증을 제출물에 넣는 것은
없는 것보다 나쁘다고 판단해 되돌렸다.**

정공법은 Compact 0.34 의 `secp256k1EcdsaVerify` 다. 다만 0.34 는 ledger 9 대상이고
현재 네트워크는 ledger 8 이라, 네트워크가 올라오면 그때 교체하는 것이 맞다.

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

## 온체인 배포 ✅

로컬 devnet 에 실제로 배포된다.

```
컨트랙트 주소: 7a3eff6c1c374d715a839c4ec01848f6b465c009218a4b3b4aa6005aece088b9
트랜잭션     : 00cc52e62b94f916749a5fa19edc92b387ac3381cf54eb4ebb292354e3e948d23a
블록         : 319          배포 소요: 23초
```

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

## 배경 자료

- 백테스트 원본 분석: [Algorithmic_Trading_YL](https://github.com/SeoDongOk/Algorithmic_Trading_YL)
- 생존 편향으로 알파가 사라진 과정:
  [블로그](https://seodongok.github.io/blog/2026-09-08-survivorship-bias-kills-alpha)

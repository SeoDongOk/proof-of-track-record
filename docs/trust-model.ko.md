# 신뢰 모델

[← README 로 돌아가기](../README.ko.md)

---

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
그대로 증언한다. 배선을 보여주기 위한 것이고 `npm run attest` 가 이걸 쓴다.

**실제 경로는 구현되어 있다.** `src/attestor.mjs` 의 `primusAttestor()` 가
Primus 공증인 네트워크를 통해 실제 zkTLS 세션을 돌려 거래소 엔드포인트를 직접
읽는다. 아래 [zkTLS 공증](#zktls-공증--실제-경로) 참고.
`npm run attest:live` 로 전 구간을 돌려볼 수 있다.

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

## zkTLS 공증 — 실제 경로

`npm run attest:live` 는 실제 zkTLS 세션을 돈다. 공증인은 이 저장소가 아니라
[Primus](https://primuslabs.xyz) 공증인 네트워크(AlphaNet)다.

```
[1] zkTLS 공증 요청  (public-ticker:BTCUSDT, mpctls)
    GET https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT
    증언 대상: $.price

[2] 공증인 서명 검증 통과  (4.8s)
    읽어온 값: price = 77246.23000000
    NAV(Uint<48>): 77246230000
    공증인: 0xdb736b13e2f522dbe18b2015d0291e4b193d8ef6 (https://primuslabs.xyz)

[2b] 증언 값을 변조하면 검증이 거부하는가
    거부됨. 서명이 값에 묶여 있다.

[3] 공증인 등록: 8d9572b08ced…
[4] 증언 제출
    계좌: bdf148e7ad11…  (API 키의 해시. 키는 체인에 없다)
    커밋: 7aa9334a6aa9e873…
    원장에 NAV 값 77246230000 은 없다

[5] 증언된 NAV 로 ZK 증명  -> 통과
[6] NAV 를 3배로 부풀림     -> 거부: nav does not open the attested commitment
```

증언에는 공증인 주소와 응답에 대한 ECDSA 서명이 들어 있다. 값의 숫자 하나만
바꿔도 `verifyAttestation()` 이 `false` 를 돌려준다. **2b** 단계가 매 실행마다
그 확인을 하므로, 검증이 형식적이지 않다는 것이 실행 결과로 남는다.

**우리가 직접 거래소 API 를 부르는 것과 왜 다른가.** API 키로 잔고를 읽으면
그건 *우리가 읽었다고 주장하는* 숫자다. 바이낸스는 요청에 서명하지 응답에
서명하지 않으므로 검증할 거래소 서명이 애초에 없다. zkTLS 세션에서는 요청을
공증인 네트워크가 실행하고 응답 암호문이 TLS 세션에 묶이므로, 사후에 값을
바꿔치기할 수 없다.

| 모드 | 보장 | 비용 |
|---|---|---|
| `mpctls` (기본) | 공증인과 클라이언트가 세션 키를 나눠 가져, 클라이언트가 응답을 고칠 수 없다 | 느리다 |
| `proxytls` | 공증인이 중계하며 암호문을 기록 | 빠르다 |

`src/exchanges.mjs` 에 어댑터 둘이 들어 있다.

| 어댑터 | 필요한 것 | 증명하는 것 |
|---|---|---|
| `publicTicker` (기본) | 없음 | 파이프라인이 끝까지 돈다 |
| `binanceFutures` (`--futures`) | API 키 | USDs-M 선물 계좌의 NAV |
| `binanceSpot` (`--binance`) | API 키 | 현물 잔고 |

실제 선물 계좌로 돌린 결과:

```
[1] zkTLS 공증  (binance-futures, mpctls)
    GET https://fapi.binance.com/fapi/v3/account?recvWindow=60000&timestamp=...&signature=...
    증언 대상: $.totalMarginBalance
[2] 공증인 서명 검증 통과  (5.7s)
    읽어온 값: totalMarginBalance = 21.46679236
    NAV(Uint<48>): 21466792
[2b] 변조된 증언 -> 거부
[4] 증언 제출  계좌 dc16576b458f...  (API 키의 sha256)
    온체인: submitAttestation 블록 8204, proveAttestedNav 블록 8207
[5] 증언된 NAV 로 ZK 증명 -> 통과
[6] NAV 3배 부풀림 -> 거부
```

`totalMarginBalance` 는 지갑잔고 + 미실현손익이라 포지션을 들고 있는 중에도
값이 맞다. `totalWalletBalance` 는 미실현손익이 빠지고, `availableBalance` 는
증거금으로 묶인 금액이 빠진다.

API 키는 `X-MBX-APIKEY` 헤더로 공증인 네트워크를 지나간다. 시크릿은 로컬에서
쿼리에 서명할 뿐 나가지 않는다. 어댑터는 GET 하나만 보내므로 읽기 전용 키가
맞는 선택이다.

자격증명은 `.env` 에 넣는다(gitignore 됨). `.env.example` 참고. 거래소 API 키는
체인에 가지 않는다. `accountId` 로는 `sha256(키)` 만 쓴다.

**여전히 남는 가정.** Primus 공증인 그룹이 정직해야 하고 TLS 가 깨지지 않아야
한다. 트레이더 혼자를 믿는 것보다는 낫고 데모 공증인보다는 훨씬 낫지만,
분산 공증인 그룹도 결국 신뢰 가정이다. [신뢰 모델](trust-model.ko.md)에 적어 둔다.

## 온체인: 공증을 실제 트랜잭션으로

`npm run attest:onchain` 은 같은 흐름을 체인까지 끌고 간다. 공증과 ZK 증명이
로컬 시뮬레이션이 아니라 트랜잭션이 된다.

```
[1] zkTLS 공증   price = 77186.01000000  ->  NAV 77186010000  (4.8s)
    공증인: 0xdb736b13e2f522dbe18b2015d0291e4b193d8ef6

[3] attestation 컨트랙트 배포  c5dee88809b4830efd29cb09…  블록 5428  (20s)

[4] 온체인 트랜잭션
    registerAttestor   블록 5431  (19s)
    submitAttestation  블록 5435  (24s)
    proveAttestedNav   블록 5440  (29s)

[5] 인디서에서 원장 되읽기
    공증인      : 8d9572b08ced5bfc50a217da…
    증언된 계좌 : 1
    저장된 커밋 : 9bdddb0dadec916fe9266299…
    로컬 커밋과 일치: 예
    NAV 77186010000 은 원장에 없다 — 커밋만 있다
```

인디서로 독립 확인:

```
블록 5428  ContractDeploy   tx f3747445035f19494ff9…
블록 5431  ContractCall     tx 0b7f0fbb25ac06f1fe36…
블록 5435  ContractCall     tx 6b2395ad81b5a2debc37…
블록 5440  ContractCall     tx a52102ccb82f6880dcb4…
```

컨트랙트는 설계상 공증인 1명, 계좌당 증언 1건만 받는다. 그래서 스크립트가
원장을 먼저 읽고, 기존 컨트랙트가 이미 쓰였으면 새로 배포한다.

**알아둘 만한 수수료 함정.** 회로 호출 트랜잭션은 비용이 작아 지갑이 수수료를
0 으로 계산할 수 있다. 그러면 `dust_actions: Some(empty)` 를 붙이는데, 노드는
이걸 비정규 형식으로 거부한다(`Malformed(NotNormalized)`). 클라이언트에는
`RpcError 1010: Custom error: 117` 로만 올라와 원인이 드러나지 않는다.
배포 트랜잭션은 쓰는 바이트가 많아 수수료가 양수라 이 문제를 비껴가므로,
**배포는 되는데 호출만 실패하는** 형태로 보인다. 지갑에
`additionalFeeOverhead` 를 0 보다 크게 주면 실제 `DustSpend` 가 만들어진다.
`src/wallet.mjs` 참고.

## 신원을 API 키가 아니라 거래소 계정에 묶기

전략 레지스트리는 트레이더 신원별로 시행 횟수를 센다. 그 신원을 싸게 다시 만들 수
있으면 회로 6 은 아무것도 증명하지 못한다. `accountId` 를 무엇에서 뽑느냐가
보기보다 중요한 이유다.

첫 버전은 `sha256(apiKey)` 를 썼다. 거래소는 API 키를 요청하면 바로 발급하므로,
새 키가 곧 새 신원이 되고 시행 카운터가 0 으로 초기화됐다. 거래소는 이미 KYC 를
하고 있었다. 잘못은 그 **KYC 된 계정**이 아니라 **키**에 묶은 쪽에 있었다.

`GET /fapi/v3/account` 에는 계정 식별자가 없다. 13개 필드가 전부 잔고와 포지션이다.
`GET /api/v3/account` 는 `uid` 를 준다. 바이낸스는 스팟과 선물이 같은 마스터
계정이므로, `binanceFuturesBound` 는 두 엔드포인트를 **한 zkTLS 세션에서** 공증한다.

```
[0] $.uid                 (identity)   -> accountId = sha256("binance-uid:" + uid)
[1] $.totalMarginBalance  (nav)        -> 증명할 NAV
```

한 세션이라는 점이 핵심이다. 따로 두 번 공증하면 A 계정의 `uid` 와 B 계정의
잔고를 짝지어 제출할 수 있다.

같은 계정, 다른 API 키로 측정한 결과:

```
sha256(apiKey)      키 A -> dc16576b458f510b…    키 B -> 8a2485a15b205ad3…   다름
sha256(uid)         키 A -> 74e3d3267016c65c…    키 B -> 74e3d3267016c65c…   같음
다른 계정                                        uid 999999999 -> 567705e5268bd1b6…
```

API 키도 `uid` 도 체인에 가지 않는다. 올라가는 것은 `sha256(uid)` 뿐이다.

**이건 시빌 저항을 만드는 게 아니라 거래소의 것을 상속하는 것이다.** 다른 거래소에
계정을 열면 여전히 신원이 늘어난다. 바뀌는 건 가격이다 — 신원 하나가 공짜에서
**KYC 1회**가 된다. 거래소 KYC 가 부실하면 그 부실함도 그대로 상속한다.
비교용으로 `--unbound` 를 주면 기존 키 기반 동작으로 떨어진다.

### Preview 에서, 신원을 묶은 뒤

`accountId` 를 `sha256(apiKey)` 에서 `sha256(uid)` 로 바꾼 뒤 같은 흐름을 다시 돌렸다.

```
블록 848761  ContractCall  submitAttestation   uid 기반 accountId
블록 848765  ContractCall  proveAttestedNav    ZK 증명
```

증언된 NAV 는 같은 실계좌의 `totalMarginBalance = 18.94934329` 다
(앞선 실행의 20.71 에서 움직였다 — 봇이 계속 거래 중이다).
컨트랙트의 `attestationCount` 가 이제 2 다. 첫 실행의 키 기반 계좌와 이번의
uid 기반 계좌가 **서로 다른 계좌로** 올바르게 인식됐다는 뜻이다.
`uid` 는 스크립트 출력에서 마스킹되고 머신 밖으로 나가지 않는다.
체인에 가는 것은 `sha256(uid)` 뿐이다.

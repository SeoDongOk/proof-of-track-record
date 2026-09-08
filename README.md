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

## Midnight 을 어떻게 쓰는가

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

초기 단계. 환경 검증 완료.

- [x] Compact 툴체인 0.34.0 (aarch64-darwin 네이티브)
- [x] 최소 컨트랙트 컴파일 → ZK 회로 생성 확인
- [x] 증명 서버용 Docker 구동
- [ ] 거래 로그 머클 커밋 회로
- [ ] 수익률 임계값 증명 회로
- [ ] 리스크 한도 증명 회로
- [ ] CLI 데모 (증명 생성 → 검증)

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

## 빌드

```bash
compact compile contracts/smoke.compact build/smoke
```

`build/` 아래에 `contract/`(TypeScript API), `zkir/`(ZK 중간표현),
`keys/`(증명·검증 키)가 생성된다. 재생성 가능하므로 커밋하지 않는다.

## 배경 자료

- 백테스트 원본 분석: [Algorithmic_Trading_YL](https://github.com/SeoDongOk/Algorithmic_Trading_YL)
- 생존 편향으로 알파가 사라진 과정:
  [블로그](https://seodongok.github.io/blog/2026-09-08-survivorship-bias-kills-alpha)

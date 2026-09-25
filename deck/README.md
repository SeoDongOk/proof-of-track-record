# Deck

`proof-of-track-record.pptx` — 14장. Google Drive 에 올리면 Slides 로 열린다.

## 다시 만들기

내용을 고칠 때 PowerPoint 를 열지 말고 아래를 돌린다.

```bash
bash deck/capture.sh              # 터미널 출력을 실제로 실행해 캡처
python deck/render-terminal.py    # 캡처를 이미지로
python deck/build-deck.py         # 덱 조립
```

## 구성

| | | 근거 |
|---|---|---|
| figs/backtest.png | 생존 편향 제거 전후 | Algorithmic_Trading_YL |
| figs/stats.png | Newey-West p 값, Deflated Sharpe | 같음 |
| figs/nav.png | 거래 로그 vs NAV | 회로 5 설계 |
| figs/onchain.png | Preview 블록 7건 | 공개 인디서 |
| figs/cap-nav.png | `npm run nav` **실제 출력** | captures/nav.txt |
| figs/cap-verify.png | `npm run verify` **실제 출력** | captures/verify.txt |
| figs/cap-test.png | `npm test` **실제 출력** | captures/test.txt |
| figs/cap-disclose.png | 컴파일러가 disclose 누락을 막는 **실제 에러** | captures/disclose-error.txt |

캡처는 전부 실행 결과다. 손으로 쓴 화면이 아니다.

## 데모 영상

`demo-script.md` — 3분 이내 나레이션. `demo-run.sh` 를 돌리며 녹화한다(27초).

## 폰트

터미널 캡처는 **D2Coding** 을 쓴다. Menlo 는 한글이 □ 로 깨진다.

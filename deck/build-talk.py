#!/usr/bin/env python3
"""발표용 덱 — 12장. 읽기용(build-deck.py, 16장)에서 캡처·통계를 걷어내고
본문을 줄였다. 문장은 3인칭·명사형으로 끝낸다. 말로 할 것은 슬라이드에 없다.

    python deck/build-talk.py        →  deck/proof-of-track-record-talk.pptx

읽기용과 도표·색·좌표 헬퍼를 공유한다(deck/pptxlib.py). 숫자를 고칠 때는
두 파일을 같이 본다.
"""
from pptxlib import *

# 1 표지
s = slide()
text(s, 'Proof of Track Record', 1.0, 2.4, 11.3, 1.0, 48, bold=True)
text(s, '거래를 공개하지 않고 증명하는 트랙 레코드', 1.0, 3.6, 11.3, .6, 22, DIM)
text(s, '거래 전 전략 커밋  ·  거래 후 결과 증명  ·  둘 다 수정 불가', 1.0, 4.4, 11.3, .6, 17, ACC)
text(s, 'Midnight Korea Hackathon 2026 · 서동옥', 1.0, 6.4, 11.3, .4, 14, DIM)

# 2 문제
s = slide()
tag(s, '문제', 1.0, .8)
text(s, '전부 진짜인 숫자로\n만들어지는 거짓말', 1.0, 1.3, 11.3, 1.6, 38, bold=True)
text(s, '"1년 동안 돌린 전략 열 개 중 제일 잘 된 하나"', 1.0, 3.4, 11.3, .6, 22, AMB)
text(s, '거래, 체결, 수익률 전부 진짜\n'
        '먼저 일어난 선택, 남지 않는 선택의 흔적', 1.0, 4.4, 11.3, 1.2, 20, DIM)

# 3 발표자의 백테스트
s = slide()
tag(s, '발표자의 백테스트 — S&P 500, 2018-11 ~ 2023-09', .7, .45)
pic(s, 'deck/figs/backtest.png', .45, 1.0, 12.45)
text(s, '생존 편향 하나 제거에 사라진 연 9.15%p', .7, 6.15, 12.0, .45, 20, AMB, bold=True)
text(s, '조작 없음  ·  다시 돌릴 수 있었을 뿐', .7, 6.65, 12.0, .5, 17, DIM)

# 4 한 사람만의 일이 아님
s = slide()
tag(s, '한 사람만의 일이 아님', .7, .45)
text(s, '같은 보정, 같은 결과', .7, .85, 12.0, .7, 32, bold=True)
pic_fit(s, 'deck/figs/industry.png', 1.65, 4.5)
text(s, '39% 감소는 특이값이 아닌 업계 평균', .7, 6.35, 12.0, .45, 19, AMB, bold=True)
text(s, 'Malkiel & Saha (TASS 3,500개 펀드) · McLean & Pontiff, Journal of Finance 2016 (예측변수 97개)',
     .7, 6.85, 12.0, .4, 13, DIM)

# 5 반복되는 이유
s = slide()
tag(s, '반복되는 이유', 1.0, .8)
text(s, '개인의 문제가 아닌\n구조의 문제', 1.0, 1.25, 11.3, 1.4, 34, bold=True)
text(s, '사라지는 실패', 1.0, 3.1, 11.3, .45, 22, ACC, bold=True)
text(s, 'DB 에서 빠지는 망한 펀드, 발표되지 않는 안 된 전략', 1.0, 3.6, 11.3, .5, 18, DIM)
text(s, '기록되지 않는 시도 횟수', 1.0, 4.4, 11.3, .45, 22, ACC, bold=True)
text(s, '검증된 팩터 316개  ·  시도 횟수 없이는 계산 불가능한 유의성', 1.0, 4.9, 11.3, .5, 18, DIM)
text(s, '남지 않는 흔적', 1.0, 5.7, 11.3, .45, 22, ACC, bold=True)
text(s, '최종 숫자만으로는 첫 시도인지 열 번째인지 구별 불가', 1.0, 6.2, 11.3, .5, 18, DIM)

# 6 해법
s = slide()
tag(s, '해법 — 흔적을 남기는 구조', 1.0, .8)
text(s, '결과를 알기 전, 전략 커밋', 1.0, 1.3, 11.3, .9, 36, bold=True)
text(s, '성과가 그 전략에서 나왔다는 영지식 증명', 1.0, 2.4, 11.3, .6, 21)
text(s, '영지식이 필요한 이유', 1.0, 3.5, 11.3, .5, 21, ACC, bold=True)
text(s, '공개하는 순간 사라지는 알파\n'
        '숨긴 채 커밋, 열지 않은 채 증명', 1.0, 4.1, 11.3, 1.0, 18, DIM)
text(s, '거래 전  —  원장에 오르는 것은 전략의 해시뿐\n'
        '거래 후  —  원장에 오르는 것은 "수익률 X 이상" 이라는 사실뿐',
     1.0, 5.6, 11.3, .9, 18, ACC, bold=True)

# 7 구조
s = slide()
tag(s, '구조', .7, .45)
text(s, '증명하는 트레이더, 검증하는 투자자', .7, .85, 12.0, .6, 30, bold=True)
pic_fit(s, 'deck/figs/flow.png', 1.65, 4.5)
text(s, '체인에 오르는 것은 커밋과 증명뿐  ·  전략, 거래, 잔고는 체인 밖', .7, 6.35, 12.0, .5, 19, ACC, bold=True)

# 8 차단하는 공격 7가지 — 5·6 강조
s = slide()
tag(s, '회로 7개, 각각 막는 공격 하나', 1.0, .7)
text(s, '차단하는 공격 7가지', 1.0, 1.15, 11.3, .7, 32, bold=True)
rows = [('1','전략을 나중에 바꾸기', '전략 해시를 거래 전에 커밋', False),
        ('2-3','없는 수익률 주장', '수익률이 커밋된 거래 로그에서 나왔음을 증명', False),
        ('4','리스크 관리 과장', '포지션 한도가 지켜졌음을 증명', False),
        ('5','손실 거래를 빼고 계산하기', '수익률이 커밋된 계좌 잔고와 맞음을 증명', True),
        ('6','시행 횟수를 숨기기', '시도한 전략 수 공개', True),
        ('7','NAV 자체를 지어내기', '제3자의 잔고 증언', False)]
y = 2.25
for n, d, how, hot in rows:
    text(s, n, 1.0, y, .8, .45, 19, ACC if hot else DIM, bold=True)
    text(s, d, 1.85, y, 4.6, .45, 19, ACC if hot else DIM, bold=hot)
    text(s, how, 6.6, y+.05, 6.0, .45, 15, FG if hot else DIM)
    y += .62
text(s, '차별점은 5번과 6번  ·  Obscura, Proof of Alpha 는 과거 성과 인증까지, 시도 횟수는 다루지 않음',
     1.0, 6.3, 11.3, .6, 17, AMB)

# 9 회로 5
s = slide()
tag(s, '회로 5 — 손실을 뺀 계산 불가', .7, .45)
pic(s, 'deck/figs/nav.png', .45, 1.0, 12.45)
text(s, '부풀린 주장 3건 거부  ·  실제 성과 그대로인 주장 1건 통과', .7, 6.35, 12.0, .5, 18, ACC, bold=True)

# 10 Midnight
s = slide()
tag(s, 'Midnight 활용', 1.0, .8)
text(s, '타입 검사가 강제하는\n프라이버시', 1.0, 1.25, 11.3, 1.4, 34, bold=True)
text(s, 'disclose() 하나를 뺐을 때의 컴파일 결과', 1.0, 2.85, 11.3, .4, 16, DIM)
pic(s, 'deck/figs/cap-disclose.png', 1.0, 3.25, 10.6)
text(s, '파일, 줄, 프로그램 경로까지 지목  ·  개발 중 이렇게 잡힌 누락 2건', 1.0, 6.3, 11.3, .5, 17, ACC)

# 11 실제 동작
s = slide()
tag(s, '실제 동작', .7, .45)
text(s, 'Midnight Preview 공개 테스트넷', .7, .85, 12.0, .6, 30, bold=True)
pic_fit(s, 'deck/figs/onchain.png', 1.6, 3.2)
text(s, '원장에는 커밋만  ·  NAV 값은 체인 밖', .7, 5.0, 12.0, .5, 21, ACC, bold=True)
text(s, '증언된 값은 실제 바이낸스 선물 계좌 잔고\n'
        'Primus 공증인이 거래소 TLS 세션에서 직접 읽은 값, 자기 신고 아님', .7, 5.65, 12.0, 1.0, 16, DIM)

# 12 남은 가정, 직접 확인
s = slide()
tag(s, '남은 가정, 그리고 직접 확인', 1.0, .8)
text(s, '사라지지 않고\n옮겨진 신뢰 가정', 1.0, 1.25, 11.3, 1.4, 34, bold=True)
text(s, '공증인', 1.0, 3.0, 11.3, .4, 19, AMB, bold=True)
text(s, '트레이더 대신 믿는 Primus 공증인 그룹과 TLS  ·  분산돼 있어 낫지만 여전히 가정',
     1.0, 3.45, 11.3, .5, 18, DIM)
text(s, '시빌', 1.0, 4.2, 11.3, .4, 19, AMB, bold=True)
text(s, '거래소 uid 에 묶인 계정 식별자  ·  신원 하나의 비용은 0 에서 KYC 한 번으로\n'
        '만든 시빌 저항이 아니라 거래소에서 빌린 시빌 저항', 1.0, 4.65, 11.3, .9, 18, DIM)
text(s, '계정 없이 1초 안에 직접 확인 가능  —  테스트 28개 · 회로 5 시연 · 증언 검증',
     1.0, 5.9, 11.3, .5, 19, FG, bold=True)
text(s, 'github.com/SeoDongOk/proof-of-track-record', 1.0, 6.5, 11.3, .5, 22, ACC, bold=True)

save('deck/proof-of-track-record-talk.pptx')

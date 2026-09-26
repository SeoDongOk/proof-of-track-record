#!/usr/bin/env python3
"""덱 생성. 도표는 deck/figs/ 에서 가져온다.

    python deck/build-deck.py

내용을 고칠 때 PowerPoint 를 열지 말고 이 파일을 고친다.
"""
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
import os

os.chdir(os.path.dirname(os.path.abspath(__file__)) + '/..')

BG  = RGBColor(0x0C,0x11,0x1B); FG  = RGBColor(0xEC,0xF1,0xF7)
DIM = RGBColor(0x8B,0x9A,0xAF); ACC = RGBColor(0x5E,0xE0,0xB0)
RED = RGBColor(0xF0,0x6E,0x6E); AMB = RGBColor(0xE8,0xB4,0x5C)
KR  = 'Apple SD Gothic Neo'

prs = Presentation()
prs.slide_width, prs.slide_height = Inches(13.333), Inches(7.5)

def slide():
    s = prs.slides.add_slide(prs.slide_layouts[6])
    bg = s.shapes.add_shape(1, 0, 0, prs.slide_width, prs.slide_height)
    bg.fill.solid(); bg.fill.fore_color.rgb = BG; bg.line.fill.background()
    bg.shadow.inherit = False
    return s

def text(s, txt, x, y, w, h, size=20, color=FG, bold=False, align=PP_ALIGN.LEFT, sp=1.25, font=KR):
    tb = s.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = tb.text_frame; tf.word_wrap = True
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    for i, line in enumerate(txt.split('\n')):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.text = line; p.alignment = align; p.line_spacing = sp
        for r in p.runs:
            r.font.size = Pt(size); r.font.color.rgb = color
            r.font.bold = bold; r.font.name = font
    return tb

mono = lambda s, t, x, y, w, h, size=14, color=ACC: text(s, t, x, y, w, h, size, color, sp=1.35, font='Menlo')
tag  = lambda s, t, x, y, color=DIM, size=13: text(s, t, x, y, 8, 0.35, size=size, color=color)
pic  = lambda s, p, x, y, w: s.shapes.add_picture(p, Inches(x), Inches(y), width=Inches(w))

def pic_fit(s, path, y, max_h, sw=13.333):
    """높이에 맞춰 넣고 가로 중앙 정렬. 폭 기준으로 넣으면 세로가 넘치는 이미지용."""
    from PIL import Image
    iw, ih = Image.open(path).size
    w = max_h * iw / ih
    if w > sw - 0.9: w = sw - 0.9; max_h = w * ih / iw
    return s.shapes.add_picture(path, Inches((sw - w) / 2), Inches(y), width=Inches(w))

# 1 표지
s = slide()
text(s, 'Proof of Track Record', 1.0, 2.4, 11.3, 1.0, 48, bold=True)
text(s, '거래를 공개하지 않고 증명하는 트랙 레코드', 1.0, 3.6, 11.3, .6, 22, DIM)
text(s, '거래 전에 전략을 커밋한다. 거래 후에 결과를 증명한다. 둘 다 고칠 수 없다.', 1.0, 4.4, 11.3, .6, 17, ACC)
text(s, 'Midnight Korea Hackathon 2026 · 서동옥', 1.0, 6.4, 11.3, .4, 14, DIM)

# 2 문제
s = slide()
tag(s, '문제', 1.0, .8)
text(s, '숫자가 전부 진짜인데도\n거짓말이 될 수 있다', 1.0, 1.3, 11.3, 1.6, 38, bold=True)
text(s, '"전략 열 개를 1년 돌렸습니다. 이게 그중 제일 잘 된 겁니다."', 1.0, 3.3, 11.3, .6, 22, AMB)
text(s, '거래도, 체결도, 수익률도 전부 진짜다.\n'
        '그런데 다음에 어떻게 될지는 아무것도 말해주지 않는다.\n'
        '고르는 게 먼저였고, 고른 흔적은 남지 않는다.', 1.0, 4.3, 11.3, 1.8, 20, DIM)

# 3 백테스트 (차트)
s = slide()
tag(s, '내 백테스트 — S&P 500, 2018-11 ~ 2023-09', .7, .45)
pic(s, 'deck/figs/backtest.png', .45, 1.0, 12.45)
text(s, '생존 편향 하나 걷어내니 연 9.15%p 가 사라졌다.', .7, 6.15, 12.0, .45, 20, AMB, bold=True)
text(s, '조작은 없었다. 다시 돌릴 수 있었을 뿐이고, 그건 흔적을 남기지 않는다.',
     .7, 6.65, 12.0, .5, 17, DIM)

# 3b 통계적 유의성 — 근거
s = slide()
tag(s, '수치로 보면', .7, .45)
text(s, '알파는 처음부터 없었다', .7, .85, 12.0, .7, 30, bold=True)
pic(s, 'deck/figs/stats.png', .45, 1.7, 12.45)
text(s, '출처: 내 백테스트 (Algorithmic_Trading_YL). 시점별 S&P 500 구성종목을 복원해 재측정.\n'
        '2018-11 ~ 2023-09, 60개월.',
     .7, 6.35, 12.0, .9, 15, DIM)

# 3c 나만의 일이 아니다 — 같은 패턴이 반복된다
s = slide()
tag(s, '나만의 일이 아니다', .7, .45)
text(s, '같은 보정, 같은 결과', .7, .85, 12.0, .7, 32, bold=True)
pic_fit(s, 'deck/figs/industry.png', 1.65, 4.5)
text(s, '내 39% 는 특이값이 아니다. 업계 평균이다.', .7, 6.35, 12.0, .45, 19, AMB, bold=True)
text(s, 'Malkiel & Saha (TASS 3,500개 펀드) · McLean & Pontiff, Journal of Finance 2016 (예측변수 97개)',
     .7, 6.85, 12.0, .4, 13, DIM)

# 3d 왜 반복되는가 — 구조의 문제
s = slide()
tag(s, '왜 반복되나', 1.0, .8)
text(s, '개인의 문제가 아니라\n구조의 문제다', 1.0, 1.25, 11.3, 1.4, 34, bold=True)
text(s, '실패는 사라진다', 1.0, 3.1, 11.3, .45, 21, ACC, bold=True)
text(s, '망한 펀드는 DB 에서 빠지고, 안 된 전략은 발표되지 않는다.', 1.0, 3.6, 11.3, .5, 18, DIM)
text(s, '시도 횟수는 기록되지 않는다', 1.0, 4.4, 11.3, .45, 21, ACC, bold=True)
text(s, '팩터 316개. 그래서 Harvey·Liu·Zhu 는 t 기준을 3.0 으로 올리자고 했다.\n'
        '몇 번 시도했는지 모르면 유의성을 계산할 수 없다.', 1.0, 4.9, 11.3, .9, 18, DIM)
text(s, '흔적이 남지 않는다', 1.0, 6.0, 11.3, .45, 21, ACC, bold=True)
text(s, '최종 숫자만 보면 첫 시도인지 열 번째인지 모른다.', 1.0, 6.5, 11.3, .5, 18, DIM)

# 4 해법
s = slide()
tag(s, '해법 — 흔적을 남기게 만든다', 1.0, .8)
text(s, '결과를 알기 전에 전략을 커밋한다', 1.0, 1.3, 11.3, .9, 36, bold=True)
text(s, '성과가 그 전략에서 나왔음을 영지식으로 증명한다.', 1.0, 2.4, 11.3, .6, 21)
text(s, '왜 영지식인가', 1.0, 3.5, 11.3, .5, 21, ACC, bold=True)
text(s, '커밋만 하려면 해시 하나면 충분하다. 그런데 전략은 공개할 수 없다.\n'
        '공개하는 순간 알파는 사라진다.\n\n'
        '그래서 숨긴 채 커밋하고, 열지 않은 채 증명해야 한다.\n'
        '영지식이 아니면 검증자에게 전략과 거래를 전부 보여줘야 한다.', 1.0, 4.15, 11.3, 2.0, 18, DIM)
text(s, '거래 전  —  전략의 해시만 원장에 올린다\n'
        '거래 후  —  "수익률이 X 이상" 이라는 사실만 원장에 올린다',
     1.0, 6.25, 11.3, .9, 18, ACC, bold=True)

# 5 회로
s = slide()
tag(s, '회로 7개, 각각 하나의 공격을 막는다', 1.0, .7)
text(s, '무엇을 막는가', 1.0, 1.15, 11.3, .7, 32, bold=True)
rows = [('1','전략을 나중에 바꾸기', '전략 해시를 거래 전에 커밋', FG),
        ('2-3','없는 수익률 주장', '수익률이 커밋된 거래 로그에서 나왔음을 증명', FG),
        ('4','리스크 관리 과장', '포지션 한도가 지켜졌음을 증명', FG),
        ('5','손실 거래를 빼고 계산하기', '수익률이 커밋된 계좌 잔고와 맞음을 증명', ACC),
        ('6','시행 횟수를 숨기기', '시도한 전략 수가 공개된다', ACC),
        ('7','NAV 자체를 지어내기', '잔고를 제3자가 증언한다', FG)]
y = 2.25
for n, d, how, c in rows:
    text(s, n, 1.0, y, .8, .45, 19, DIM, bold=True)
    text(s, d, 1.85, y, 4.6, .45, 19, c)
    text(s, how, 6.6, y+.05, 6.0, .45, 15, DIM)
    y += .62
text(s, '5번과 6번이 차별점이다. Obscura, Proof of Alpha 는 과거 성과를 인증한다.\n'
        '몇 번 시도했는지는 다루지 않는다.', 1.0, 6.2, 11.3, 1.0, 17, DIM)

# 6 NAV 도표
s = slide()
tag(s, '회로 5 — 손실을 빼고 계산할 수 없다', .7, .45)
pic(s, 'deck/figs/nav.png', .45, 1.0, 12.45)
text(s, '부풀린 주장 3건은 거부된다. 실제 성과 그대로인 주장 1건만 통과한다.', .7, 6.35, 12.0, .5, 18, ACC, bold=True)

# 6b 실행 캡처 — 근거
s = slide()
tag(s, '회로 5 실행 결과', .7, .4)
pic_fit(s, 'deck/figs/cap-nav.png', .85, 6.0)
text(s, '거부 3, 통과 1', .7, 7.0, 12.0, .4, 15, ACC, bold=True)

# 7 아키텍처
s = slide()
tag(s, '구조 — 왼쪽은 체인에 닿지 않는다', .6, .35)
pic_fit(s, 'diagrams/architecture-dark.png', .8, 6.3)

# 8 Midnight
s = slide()
tag(s, 'Midnight 을 어떻게 썼는가', 1.0, .8)
text(s, '프라이버시를\n타입 검사가 강제한다', 1.0, 1.25, 11.3, 1.4, 34, bold=True)
text(s, 'disclose() 하나를 빼면 컴파일이 멈춘다', 1.0, 2.85, 11.3, .4, 16, DIM)
pic(s, 'deck/figs/cap-disclose.png', 1.0, 3.25, 10.6)
text(s, '파일, 줄, 프로그램 경로까지 짚어 준다.', 1.0, 6.25, 11.3, .5, 17, ACC)
text(s, '개발 중 두 건이 이렇게 잡혔다. 하나는 checkRoot — 어느 루트를 증명하는지\n'
        '드러난다는 지적. 사람이면 놓쳤을 채널이다.', 1.0, 6.75, 11.3, .7, 15, DIM)

# 9 온체인 타임라인
s = slide()
tag(s, '실제로 동작한다', .7, .45)
text(s, 'Midnight Preview 공개 테스트넷', .7, .85, 12.0, .6, 30, bold=True)
pic_fit(s, 'deck/figs/onchain.png', 1.6, 3.2)
text(s, '원장에는 커밋만 있다. NAV 값은 체인에 가지 않는다.', .7, 5.0, 12.0, .5, 21, ACC, bold=True)
text(s, '증언된 값은 실제 바이낸스 선물 계좌 잔고다. Primus 공증인이 거래소 TLS 세션에서\n'
        '직접 읽었다. 자기 신고가 아니다.', .7, 5.65, 12.0, 1.0, 16, DIM)

# 10 한계
s = slide()
tag(s, '못 하는 것', 1.0, .8)
text(s, '신뢰 가정은 사라지지 않았다.\n옮겼을 뿐이다.', 1.0, 1.25, 11.3, 1.4, 34, bold=True)
text(s, '공증인', 1.0, 3.1, 11.3, .4, 19, AMB, bold=True)
text(s, '트레이더를 믿는 대신 Primus 공증인 그룹과 TLS 를 믿는다.\n'
        '분산돼 있어 낫지만, 가정은 가정이다.', 1.0, 3.55, 11.3, .9, 18, DIM)
text(s, '시빌', 1.0, 4.7, 11.3, .4, 19, AMB, bold=True)
text(s, '계정 식별자를 거래소 uid 에 묶었다. 신원 하나를 만드는 비용이 0 에서 KYC 한 번이 됐다.\n'
        '시빌 저항을 만든 게 아니라 거래소 것을 빌렸다.\n'
        '거래소가 다르면 신원은 다시 늘어난다.', 1.0, 5.15, 11.3, 1.3, 18, DIM)

# 10b 계정 없이 검증 — 근거
s = slide()
tag(s, '심사자가 직접 확인할 수 있다', .7, .45)
text(s, '계정 없이, 1초 안에', .7, .85, 12.0, .6, 30, bold=True)
# 두 장을 위아래로. 각각 높이를 제한해 슬라이드를 넘지 않게 한다.
# 두 장을 넣으려니 서로 겹쳤다. verify 하나만 크게 쓰고 test 는 숫자로.
pic(s, 'deck/figs/cap-verify.png', .6, 1.75, 12.1)
text(s, '실제 zkTLS 증언의 서명을 오프라인에서 확인한다. 한 글자만 바꿔도 거부된다.',
     .7, 6.55, 12.0, .5, 17, ACC, bold=True)

# 11 직접 확인
s = slide()
tag(s, '직접 확인해 보세요', 1.0, .8)
text(s, '계정도 설치도 필요 없습니다', 1.0, 1.25, 11.3, .8, 34, bold=True)
text(s, '테스트 28개', 1.0, 2.6, 3.5, .5, 22, ACC, bold=True)
text(s, '회로가 거부해야 하는 13가지가\n단언으로 고정돼 있다', 1.0, 3.1, 3.5, 1.0, 16, DIM)
text(s, '회로 5 시연', 4.9, 2.6, 3.5, .5, 22, ACC, bold=True)
text(s, '부풀린 주장 3건 거부,\n실제 성과 1건 통과', 4.9, 3.1, 3.5, 1.0, 16, DIM)
text(s, '증언 검증', 8.8, 2.6, 3.5, .5, 22, ACC, bold=True)
text(s, '저장소에 든 실제 zkTLS 증언을\n오프라인에서 확인', 8.8, 3.1, 3.5, 1.0, 16, DIM)
text(s, '셋 다 1초 안에 끝난다. 실행 방법은 README 에 있다.', 1.0, 4.6, 11.3, .5, 18, DIM)
text(s, 'github.com/SeoDongOk/proof-of-track-record', 1.0, 6.2, 11.3, .5, 22, ACC, bold=True)

prs.save('deck/proof-of-track-record.pptx')
print(f'  ✅ deck/proof-of-track-record.pptx  ({len(prs.slides._sldIdLst)}장)')

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
text(s, '"1년 동안 전략 10개를 돌렸다. 이게 그중 이긴 거다."', 1.0, 3.3, 11.3, .6, 22, AMB)
text(s, '모든 거래가 실제고, 모든 체결이 검증 가능하고, 수익률도 정확하다.\n'
        '그런데 다음에 무슨 일이 일어날지는 아무것도 말해주지 않는다.\n'
        '선택이 숫자보다 먼저 일어났고, 선택은 흔적을 남기지 않기 때문이다.', 1.0, 4.3, 11.3, 1.8, 19, DIM)

# 3 백테스트 (차트)
s = slide()
tag(s, '이건 나에게 실제로 있었던 일이다 — S&P 500 백테스트', .7, .45)
pic(s, 'deck/figs/backtest.png', .45, 1.0, 12.45)
text(s, '초과수익 p 값이 0.083 에서 0.566 으로. 알파는 처음부터 없었다.\n'
        '조작한 것은 하나도 없다. 파이프라인이 그저 다시 돌릴 수 있었을 뿐이다.',
     .7, 6.25, 12.0, 1.0, 17, DIM)

# 3b 통계적 유의성 — 근거
s = slide()
tag(s, '수치로 보면', .7, .45)
text(s, '알파는 처음부터 없었다', .7, .85, 12.0, .7, 30, bold=True)
pic(s, 'deck/figs/stats.png', .45, 1.7, 12.45)
text(s, '출처: github.com/SeoDongOk/Algorithmic_Trading_YL — 97개월치 위키피디아 리비전으로\n'
        '시점별 S&P500 구성종목을 복원해 재측정. 2018-11 ~ 2023-09, 60개월.',
     .7, 6.35, 12.0, .9, 15, DIM)

# 4 해법
s = slide()
tag(s, '해법', 1.0, .8)
text(s, '결과를 알기 전에 전략을 커밋한다', 1.0, 1.3, 11.3, .9, 36, bold=True)
text(s, '그리고 성과가 바로 그 커밋된 전략에서 나왔음을 영지식으로 증명한다.', 1.0, 2.4, 11.3, .6, 21)
text(s, '왜 영지식이어야 하나', 1.0, 3.5, 11.3, .5, 20, ACC, bold=True)
text(s, '사전 커밋만이면 해시로 충분하다. 그런데 트레이더는 전략을 공개할 수 없다.\n'
        '공개하면 알파가 죽는다.\n\n'
        '커밋은 내용을 숨겨야 하고, 나중의 증명은 성과가 그 숨겨진 것에서 나왔음을\n'
        '열어보지 않고 보여야 한다. ZK 없이 하려면 검증자가 직접 재계산하도록\n'
        '전략과 모든 거래를 공개해야 한다.', 1.0, 4.2, 11.3, 2.4, 18, DIM)

# 5 회로
s = slide()
tag(s, '회로 7개, 각각 하나의 공격을 막는다', 1.0, .7)
text(s, '무엇을 막는가', 1.0, 1.15, 11.3, .7, 32, bold=True)
rows = [('1','전략을 나중에 바꾸기', 'commitStrategy  :77', FG),
        ('2-3','내지 않은 수익률 주장', 'proveReturnAtLeast  :185', FG),
        ('4','리스크 관리 과장', 'proveMaxWeight  :242', FG),
        ('5','손실 거래를 빼고 계산하기', 'proveNavReturnAtLeast  :318', ACC),
        ('6','시행 횟수를 숨기기', 'registerStrategy  :95', ACC),
        ('7','NAV 자체를 지어내기', 'proveAttestedNav  :82', FG)]
y = 2.25
for n, d, src, c in rows:
    text(s, n, 1.0, y, .8, .45, 19, DIM, bold=True)
    text(s, d, 1.85, y, 5.3, .45, 19, c)
    text(s, src, 7.3, y+.03, 5.0, .45, 14, DIM, font='Menlo')
    y += .62
text(s, '5번과 6번이 차별점이다. Obscura 와 Proof of Alpha 는 과거 성과를 인증하지만,\n'
        '"몇 개를 돌렸는지" 는 다루지 않는다.  ← contracts/track_record.compact',
     1.0, 6.2, 11.3, 1.0, 16, DIM)

# 6 NAV 도표
s = slide()
tag(s, '회로 5 — 손실을 빼고 계산할 수 없다', .7, .45)
pic(s, 'deck/figs/nav.png', .45, 1.0, 12.45)
text(s, 'npm run nav  ·  거부 3 + 통과 1,  0.3초', .7, 6.35, 12.0, .5, 17, ACC, bold=True)

# 6b 실행 캡처 — 근거
s = slide()
tag(s, '말이 아니라 실행 결과', .7, .4)
pic_fit(s, 'deck/figs/cap-nav.png', .85, 6.0)
text(s, '거부 3 · 통과 1 · 0.2초 · 자격증명 불필요', .7, 7.0, 12.0, .4, 15, ACC, bold=True)

# 7 아키텍처
s = slide()
tag(s, '구조 — 왼쪽 열은 체인에 닿지 않는다', .6, .35)
pic_fit(s, 'diagrams/architecture-dark.png', .8, 6.3)

# 8 Midnight
s = slide()
tag(s, 'Midnight 을 어떻게 썼는가', 1.0, .8)
text(s, '프라이버시가 관례가 아니라\n타입 검사로 강제된다', 1.0, 1.25, 11.3, 1.4, 34, bold=True)
text(s, 'disclose() 를 하나 지우고 컴파일하면 — 실제 출력', 1.0, 2.85, 11.3, .4, 15, DIM)
pic(s, 'deck/figs/cap-disclose.png', .9, 3.3, 11.5)
text(s, '파일·줄·"프로그램을 통과한 경로"까지 짚어 준다. 공개되는 것은\n'
        '내가 공개하기로 결정한 것이지 새어 나간 것이 아니다.',
     1.0, 6.15, 11.3, 1.0, 17, ACC)

# 9 온체인 타임라인
s = slide()
tag(s, '실제로 동작한다', .7, .45)
text(s, 'Midnight Preview 공개 테스트넷', .7, .85, 12.0, .6, 30, bold=True)
pic(s, 'deck/figs/onchain.png', .45, 1.75, 12.45)
text(s, '증언된 값은 실제 바이낸스 USDⓈ-M 선물 계좌의 잔고다. Primus zkTLS 공증인\n'
        '0xdb736b13… 이 거래소 TLS 세션에서 직접 읽었다 — 자기 신고가 아니다.',
     .7, 5.95, 12.0, .9, 16, DIM)
mono(s, "curl -s -X POST https://indexer.preview.midnight.network/api/v4/graphql \\\n"
        "  -d '{\"query\":\"{ contractAction(address:\\\"f57c3092…\\\"){ __typename } }\"}'",
     .7, 6.75, 12.0, .6, 12, ACC)

# 10 한계
s = slide()
tag(s, '못 하는 것', 1.0, .8)
text(s, '신뢰 가정은 사라지지 않았다.\n옮겼을 뿐이다.', 1.0, 1.25, 11.3, 1.4, 34, bold=True)
text(s, '공증인', 1.0, 3.1, 11.3, .4, 19, AMB, bold=True)
text(s, '"트레이더가 정직하다" → "Primus 공증인 그룹이 정직하고 TLS 가 안 깨졌다".\n'
        '분산 공증인 그룹이라 훨씬 낫지만 여전히 가정이다.', 1.0, 3.55, 11.3, .9, 18, DIM)
text(s, '시빌', 1.0, 4.7, 11.3, .4, 19, AMB, bold=True)
text(s, 'accountId 를 거래소 계정 식별자(uid)에 묶어, 신원 하나의 가격을\n'
        '0 에서 KYC 1회로 올렸다. 시빌 저항을 만드는 게 아니라 거래소의 것을 상속한다.\n'
        '다른 거래소를 쓰면 신원은 여전히 늘어난다.', 1.0, 5.15, 11.3, 1.3, 18, DIM)

# 10b 계정 없이 검증 — 근거
s = slide()
tag(s, '심사자가 계정 없이 확인할 수 있다', .7, .45)
text(s, 'npm run verify · npm test', .7, .85, 12.0, .6, 28, bold=True)
# 두 장을 위아래로. 각각 높이를 제한해 슬라이드를 넘지 않게 한다.
pic_fit(s, 'deck/figs/cap-verify.png', 1.6, 2.5)
pic_fit(s, 'deck/figs/cap-test.png', 4.35, 2.5)

# 11 직접 확인
s = slide()
tag(s, '직접 확인해 보세요', 1.0, .8)
text(s, '계정도 도커도 필요 없습니다', 1.0, 1.25, 11.3, .8, 34, bold=True)
mono(s, 'git clone https://github.com/SeoDongOk/proof-of-track-record\n'
        'npm ci && npm run build          # 약 40초, 회로 14개\n\n'
        'npm test                         # 28개 통과,  0.8초\n'
        'npm run nav                      # 거부 3 + 통과 1,  0.2초\n'
        'npm run verify                   # zkTLS 증언 서명 검증,  0.2초',
     1.0, 2.5, 11.3, 2.2, 16)
text(s, 'npm run verify 는 저장소에 들어 있는 실제 zkTLS 증언의 서명을 오프라인에서\n'
        '확인하고, 값을 한 글자 바꾼 사본이 거부되는 것까지 같은 실행에서 보여줍니다.',
     1.0, 5.0, 11.3, 1.0, 18, DIM)
text(s, 'github.com/SeoDongOk/proof-of-track-record', 1.0, 6.2, 11.3, .5, 20, ACC, bold=True)

prs.save('deck/proof-of-track-record.pptx')
print(f'  ✅ deck/proof-of-track-record.pptx  ({len(prs.slides._sldIdLst)}장)')

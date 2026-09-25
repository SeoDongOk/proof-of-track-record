#!/usr/bin/env python3
"""캡처한 터미널 출력을 이미지로 렌더링한다.

내용은 deck/captures/*.txt 의 **실제 실행 결과**다. 손으로 쓴 것이 아니다.
    python deck/render-terminal.py
"""
from PIL import Image, ImageDraw, ImageFont
import os, re

os.chdir(os.path.dirname(os.path.abspath(__file__)) + '/..')

BG=(12,17,27); FG=(236,241,247); DIM=(139,154,175)
ACC=(94,224,176); RED=(240,110,110); AMB=(232,180,92); TITLE=(180,200,225)

# D2Coding — 한글 글리프가 있는 고정폭. Menlo 는 한글이 □ 로 깨진다.
MONO = '/Users/seodong-og/Library/Fonts/D2Coding-Ver1.3.2-20180524.ttc'
def font(sz, idx=0):
    try: return ImageFont.truetype(MONO, sz, index=idx)
    except Exception: return ImageFont.load_default()

def colour(line):
    """줄 내용으로 색을 정한다. 거부는 빨강, 통과는 초록.

    'fail 0' / 'cancelled 0' 처럼 0 이 붙은 줄은 좋은 소식이다. 빨강으로 칠하면
    테스트가 깨진 것처럼 보인다 — 실제로 그렇게 나와서 고쳤다.
    """
    if re.search(r'\b(fail|failed|cancelled|skipped|todo)\s+0\b', line): return DIM
    if re.search(r'거부|rejected|✗|❌|not ok|fail', line): return RED
    if re.search(r'통과|accepted|✅|^ok |검증 통과', line.strip()): return ACC
    if re.search(r'^\s*\[\d|^\s*──|^# ', line): return TITLE
    if re.search(r'^\s{2,}', line) and not line.strip().startswith('['): return DIM
    return FG

def render(src, out, title=None, width=1700, pad=34, size=25, lead=1.46, max_lines=None):
    lines = open(src, encoding='utf-8').read().rstrip('\n').split('\n')
    # ANSI 제거
    lines = [re.sub(r'\x1b\[[0-9;]*m', '', l) for l in lines]
    if max_lines: lines = lines[:max_lines]
    f = font(size); ft = font(int(size*1.05))
    lh = int(size*lead)
    top = pad + (int(size*2.0) if title else 0)
    h = top + lh*len(lines) + pad
    im = Image.new('RGB', (width, h), BG); d = ImageDraw.Draw(im)

    # 창 크롬 — 실제 터미널처럼 보이게
    d.rounded_rectangle([6,6,width-6,h-6], radius=12, outline=(30,42,61), width=2)
    for i,c in enumerate([(255,95,86),(255,189,46),(39,201,63)]):
        d.ellipse([24+i*20, 20, 34+i*20, 30], fill=c)
    if title:
        d.text((width//2, 25), title, font=ft, fill=DIM, anchor='mm')
        d.line([(6, 46),(width-6, 46)], fill=(30,42,61), width=2)

    y = top
    for l in lines:
        d.text((pad, y), l, font=f, fill=colour(l))
        y += lh
    im.save(out)
    print(f'  ✅ {out}  {width}x{h}  ({len(lines)}줄)')

os.makedirs('deck/figs', exist_ok=True)
render('deck/captures/nav.txt',    'deck/figs/cap-nav.png',    'npm run nav')
render('deck/captures/verify.txt', 'deck/figs/cap-verify.png', 'npm run verify')
render('deck/captures/test.txt',   'deck/figs/cap-test.png',   'npm test')
render('deck/captures/disclose-error.txt', 'deck/figs/cap-disclose.png',
       'compact compile  —  disclose() 를 하나 지우면')

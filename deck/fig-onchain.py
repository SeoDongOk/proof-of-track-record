#!/usr/bin/env python3
"""Preview 테스트넷 타임라인 도표. 블록 번호는 deck/onchain.txt 와 같다.

    python deck/fig-onchain.py   →  deck/figs/onchain.png
"""
import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager as fm

os.chdir(os.path.dirname(os.path.abspath(__file__)) + '/..')
BG, FG, DIM, ACC, AMB = '#0C111B', '#ECF1F7', '#8B9AAF', '#5EE0B0', '#E8B45C'
plt.rcParams['font.family'] = 'Apple SD Gothic Neo'

events = [  # (블록, 한글 라벨, 온체인 호출명, 색)
    (821701, '컨트랙트 배포',   'track_record',      ACC),
    (821705, '공증 컨트랙트 배포', 'attestation',     ACC),
    (821911, '공증인 등록',     'registerAttestor',  DIM),
    (821915, 'NAV 커밋',       'submitAttestation', AMB),
    (821919, 'ZK 증명',        'proveAttestedNav',  AMB),
    (848761, '계정 바인딩 커밋', 'submitAttestation', ACC),
    (848765, 'ZK 증명',        'proveAttestedNav',  ACC),
]
fig, ax = plt.subplots(figsize=(11.9, 3.2), dpi=200)
fig.patch.set_facecolor(BG); ax.set_facecolor(BG); ax.axis('off')
xs = list(range(len(events)))
ax.plot([-.15, len(events) - .85], [0, 0], color='#2A3446', lw=3, zorder=1)
for x, (blk, ko, fn, c) in zip(xs, events):
    ax.scatter([x], [0], s=260, color=c, zorder=3)
    ax.text(x, .42, ko, ha='center', va='bottom', fontsize=13, color=c, weight='bold')
    ax.text(x, .22, fn, ha='center', va='bottom', fontsize=8.5, color=DIM, family='Menlo')
    ax.text(x, -.32, f'{blk:,}'.replace(',', ''), ha='center', va='top', fontsize=12, color=FG)
ax.text(-.15, -.9, '블록 번호  ·  Midnight Preview  ·  공개 인디서에서 누구나 조회할 수 있다',
        ha='left', va='top', fontsize=10, color=DIM)
ax.set_xlim(-.4, len(events) - .6); ax.set_ylim(-1.1, 1.0)
fig.savefig('deck/figs/onchain.png', facecolor=BG, bbox_inches='tight', pad_inches=.15)
print('  ✅ deck/figs/onchain.png')

#!/usr/bin/env python3
"""업계 비교 도표. 보정 후 수익률이 얼마나 줄었는가.

    python deck/fig-industry.py   →  deck/figs/industry.png

출처: Algorithmic_Trading_YL(발표자 백테스트), Malkiel & Saha(TASS),
      McLean & Pontiff, Journal of Finance 2016.
"""
import os
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
os.chdir(os.path.dirname(os.path.abspath(__file__)) + '/..')
plt.rcParams['font.family']='Apple SD Gothic Neo'; plt.rcParams['axes.unicode_minus']=False
BG='#0C111B'; FG='#ECF1F7'; DIM='#8B9AAF'; ACC='#5EE0B0'; RED='#F06E6E'; AMB='#E8B45C'

f, ax = plt.subplots(figsize=(12.4,5.0)); f.patch.set_facecolor(BG); ax.set_facecolor(BG)
for s in ax.spines.values(): s.set_visible(False)
ax.tick_params(colors=DIM, labelsize=12)
items = [
 ('S&P 500 백테스트\n생존 편향 제거',        38.7, AMB,  '23.63% → 14.48%'),
 ('헤지펀드 3,500개\n생존·백필 편향 제거',   45.4, RED,  '16.45% → 8.98%'),
 ('학술 예측변수 97개\n표본 외',            26.0, RED,  'McLean & Pontiff'),
 ('학술 예측변수 97개\n논문 발표 후',        58.0, RED,  'McLean & Pontiff'),
]
ys = range(len(items))
ax.barh([-i for i in ys], [v for _,v,_,_ in items], height=.52, color=[c for _,_,c,_ in items], alpha=.9)
for i,(lbl,v,c,note) in enumerate(items):
    ax.text(v+1.2, -i, f'-{v:.0f}%', va='center', color=FG, fontsize=17, fontweight='bold')
    ax.text(v+7.5, -i, note, va='center', color=DIM, fontsize=12)
ax.set_yticks([-i for i in ys]); ax.set_yticklabels([l for l,_,_,_ in items], color=FG, fontsize=12.5)
ax.set_xlim(0, 88); ax.set_xlabel('보정 후 수익률 감소폭', color=DIM, fontsize=12.5, labelpad=10)
ax.grid(axis='x', color='#1E2A3D', lw=.8); ax.set_axisbelow(True)
ax.set_xticks([0,20,40,60]); ax.set_xticklabels(['0%','20%','40%','60%'], color=DIM)
f.subplots_adjust(left=0.20, right=0.98, top=0.96, bottom=0.16)
f.savefig('deck/figs/industry.png', dpi=170, facecolor=BG); plt.close(f)
print('  ✅ deck/figs/industry.png')

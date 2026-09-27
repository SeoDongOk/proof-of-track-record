#!/usr/bin/env python3
"""회로 5 도표. 거래 로그는 골라낼 수 있지만 잔고는 그대로다.

    python deck/fig-nav.py   →  deck/figs/nav.png

거래 값은 src/nav-demo.mjs 와 같다: 5승(300,250,180,120,100) 3패(-600,-450,-300),
합계 -400bp, 승리만 합치면 +950bp.
"""
import os
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch
os.chdir(os.path.dirname(os.path.abspath(__file__)) + '/..')
plt.rcParams['font.family']='Apple SD Gothic Neo'; plt.rcParams['axes.unicode_minus']=False
BG='#0C111B'; FG='#ECF1F7'; DIM='#8B9AAF'; ACC='#5EE0B0'; RED='#F06E6E'; AMB='#E8B45C'
f, ax = plt.subplots(figsize=(12.4,5.0)); f.patch.set_facecolor(BG); ax.set_facecolor(BG)
ax.set_xlim(0,12.4); ax.set_ylim(0,5.0); ax.axis('off')
def box(x,y,w,h,c,txt,fs=13,tc=None):
    ax.add_patch(FancyBboxPatch((x,y),w,h,boxstyle='round,pad=0.05',fc=c,ec=c,alpha=.16,lw=1.5))
    ax.add_patch(FancyBboxPatch((x,y),w,h,boxstyle='round,pad=0.05',fc='none',ec=c,lw=1.5))
    ax.text(x+w/2,y+h/2,txt,ha='center',va='center',color=tc or c,fontsize=fs,fontweight='bold')
GAP=0.86; W=0.66
ax.text(0.2,4.6,'거래 로그 기준 (회로 3)',color=DIM,fontsize=14,fontweight='bold')
pn=[('+300',ACC),('-600',RED),('+250',ACC),('-450',RED),('+180',ACC),('-300',RED),('+120',ACC),('+100',ACC)]
for i,(v,c) in enumerate(pn): box(0.2+i*GAP,3.62,W,0.62,c,v,fs=11.5)
ax.text(7.5,3.93,'→  손실 3건을 뺀 커밋',color=AMB,fontsize=13.5,va='center')
for i,(v,c) in enumerate(pn):
    if c!=RED: box(0.2+i*GAP,2.68,W,0.62,c,v,fs=11.5)
ax.text(7.5,2.99,'"+950bp"  ← 참이지만 오해를 부르는 숫자',color=RED,fontsize=13.5,va='center',fontweight='bold')
ax.plot([0.2,12.2],[2.25,2.25],color='#1E2A3D',lw=1.4)
ax.text(0.2,1.82,'NAV 기준 (회로 5)',color=DIM,fontsize=14,fontweight='bold')
box(0.2,0.68,3.1,0.95,ACC,'기간 시작 NAV\n100,000,000',fs=13,tc=FG)
box(4.7,0.68,3.1,0.95,ACC,'기간 종료 NAV\n96,000,000',fs=13,tc=FG)
ax.add_patch(FancyArrowPatch((3.45,1.16),(4.55,1.16),arrowstyle='->',color=DIM,lw=2,mutation_scale=18))
ax.text(8.2,1.16,'-400bp',color=FG,fontsize=18,fontweight='bold',va='center')
ax.text(9.8,1.16,'거래를 빼도\n바뀌지 않는 잔고',color=ACC,fontsize=13.5,va='center',fontweight='bold')
f.subplots_adjust(left=0.01,right=0.99,top=0.99,bottom=0.01)
f.savefig('deck/figs/nav.png',dpi=170,facecolor=BG); plt.close(f)
print('  ✅ deck/figs/nav.png')

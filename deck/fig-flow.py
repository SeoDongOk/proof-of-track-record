#!/usr/bin/env python3
"""구조 도식. 체인 밖(비공개)과 체인 위(공개)를 한 장에.

    python deck/fig-flow.py   →  deck/figs/flow.png
"""
import os
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch
os.chdir(os.path.dirname(os.path.abspath(__file__)) + '/..')
plt.rcParams['font.family']='Apple SD Gothic Neo'; plt.rcParams['axes.unicode_minus']=False
BG='#0C111B'; FG='#ECF1F7'; DIM='#8B9AAF'; ACC='#5EE0B0'; RED='#F06E6E'; AMB='#E8B45C'; PUR='#A78BFA'
f, ax = plt.subplots(figsize=(12.4,4.8)); f.patch.set_facecolor(BG); ax.set_facecolor(BG)
ax.set_xlim(0,12.4); ax.set_ylim(0,4.8); ax.axis('off')

def box(x,y,w,h,c,title,sub,ts=15,ss=11.5):
    ax.add_patch(FancyBboxPatch((x,y),w,h,boxstyle='round,pad=0.06',fc=c,ec=c,alpha=.14,lw=1.6))
    ax.add_patch(FancyBboxPatch((x,y),w,h,boxstyle='round,pad=0.06',fc='none',ec=c,lw=1.6))
    ax.text(x+w/2,y+h-0.38,title,ha='center',va='center',color=c,fontsize=ts,fontweight='bold')
    ax.text(x+w/2,y+(h-0.5)/2-0.02,sub,ha='center',va='center',color=FG,fontsize=ss,linespacing=1.45)

def arrow(p,q,label,c=DIM,dy=0.16,fs=11.5):
    ax.add_patch(FancyArrowPatch(p,q,arrowstyle='->',color=c,lw=2,mutation_scale=18))
    ax.text((p[0]+q[0])/2,(p[1]+q[1])/2+dy,label,ha='center',va='bottom',color=c,fontsize=fs,fontweight='bold')

# 영역
ax.plot([4.55,4.55],[0.25,4.35],color='#2A3446',lw=1.5,ls='--')
ax.text(0.3,4.5,'체인 밖  ·  비공개',color=RED,fontsize=12.5,fontweight='bold',va='center')
ax.text(4.8,4.5,'체인 위  ·  공개',color=ACC,fontsize=12.5,fontweight='bold',va='center')

# 박스
box(0.3,2.75,3.0,1.35,ACC,'트레이더','전략 · 거래 · 잔고')
box(0.3,0.55,3.0,1.35,AMB,'공증인 (Primus)','거래소 TLS 세션에서\n잔고를 읽고 서명')
box(5.3,1.05,3.4,2.75,PUR,'Midnight 원장','전략 해시\n시도한 전략 수\n잔고 커밋\n수익률 하한 증명',ss=12.5)
box(10.0,1.75,2.1,1.35,FG,'검증자','투자자 · 배분자')

# 화살표
arrow((3.35,3.55),(5.25,3.05),'거래 전: 전략 해시 커밋\n거래 후: ZK 증명',ACC,dy=0.22)
arrow((3.35,1.15),(5.25,1.75),'잔고 증언 (서명)',AMB,dy=-0.55)
arrow((8.75,2.42),(9.95,2.42),'커밋과 증명만',DIM,dy=0.12)

f.subplots_adjust(left=0.005,right=0.995,top=0.99,bottom=0.01)
f.savefig('deck/figs/flow.png',dpi=170,facecolor=BG); plt.close(f)
print('  ✅ deck/figs/flow.png')

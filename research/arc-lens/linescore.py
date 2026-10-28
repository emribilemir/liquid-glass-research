import numpy as np, os, glob
from PIL import Image
L=lambda p:np.asarray(Image.open(p).convert('RGB'),float)@[.2126,.7152,.0722]
S='../music/'; names=['mgm%03d.png'%i for i in range(0,84,6)]
yy,xx=np.mgrid[0:270,0:1562]; cx=134
dist=np.hypot(xx+.5-cx,yy+.5-134); edge=54-dist; ang=np.degrees(np.arctan2(yy+.5-134,cx-(xx+.5))); half=xx+.5<cx
bins=np.arange(-60,61,15)
def prof(d):
    res=[]
    for nm in names:
        a=L(f'{d}/{nm}'); b=L(S+'set/bg/'+nm); row=[]
        for px in (1,2,3):
            m=half&(edge>px-1)&(edge<=px); row.append([np.median((a-b)[m&(ang>=lo)&(ang<hi)]) for lo,hi in zip(bins[:-1],bins[1:])])
        res.append(row)
    P=np.nanmedian(np.array(res),0); return P[:2]-P[2]       # outermost two pixels relative to the third (removes face tone)
M=prof(S+'set/apple')
print('music px1-px3',M[0].round(),' px2-px3',M[1].round())
out=[]
for d in sorted(glob.glob('r-*')):
    P=prof(d); out.append((np.abs(P-M).mean(),d,P))
for e,d,P in sorted(out)[:6]: print('%-12s err %.2f  px1 %s  px2 %s'%(d,e,P[0].round(),P[1].round()))

# Scroll frames in motion: native (apple/moNN.png, ScrollLab frames local/motion/native, 8 device px per step) against
# fit.mjs renders of the same page offsets (r-shipped/, r-arcrel/; FITDIR set with bg/ = content.png crops). Run in that dir.
import numpy as np, sys
from PIL import Image
load=lambda p:np.asarray(Image.open(p).convert('RGB'),float)
N=60; top,h=80,110; r=h/2; cy=top+r
yy,xx=np.mgrid[0:270,0:1562]
dx=np.clip(xx+.5,80+r,1482-r)-(xx+.5); dy=cy-(yy+.5); edge=r-np.hypot(dx,dy)   # device px from the rim, inside >0
caps=(xx<80+r)|(xx>=1482-r)
bands={'rim 0-2pt':(edge>0)&(edge<=4)&~caps,'rim 2-7pt':(edge>4)&(edge<=14)&~caps,'rim 7-14pt':(edge>14)&(edge<=28)&~caps,
       'face':(edge>28),'caps 0-3pt':(edge>0)&(edge<=6)&caps}
F={k:[load(f'{d}/mo{i:02d}.png') for i in range(N)] for k,d in [('native','apple'),('shipped','r-shipped'),('arc','r-arcrel')]}
print('%-12s %18s %18s   %26s'%('band','error shipped','error arc','frame-to-frame change  native / shipped / arc  |change error| shipped / arc'))
for b,m in bands.items():
    e={k:np.mean([np.abs(F[k][i]-F['native'][i]).mean(2)[m].mean() for i in range(N)]) for k in ['shipped','arc']}
    ch={k:np.mean([np.abs(F[k][i+1]-F[k][i]).mean(2)[m].mean() for i in range(N-1)]) for k in F}
    ce={k:np.mean([np.abs((F[k][i+1]-F[k][i])-(F['native'][i+1]-F['native'][i])).mean(2)[m].mean() for i in range(N-1)]) for k in ['shipped','arc']}
    print('%-12s %18.2f %18.2f   %8.2f %8.2f %8.2f      %8.2f %8.2f'%(b,e['shipped'],e['arc'],ch['native'],ch['shipped'],ch['arc'],ce['shipped'],ce['arc']))

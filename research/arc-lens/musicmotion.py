# Run in a dir with set/apple (Music frames), r-shipped, r-arcrel (fit.mjs renders of set/bg). See RESEARCH.md.
# Apple Music scrolled 1pt per frame (swipe -150 150), page behind the player rebuilt from what scrolls out above it.
# Per band: error to Music and frame-to-frame change (Music / ours) and |change error|; clean columns only (no icons,
# no animated artwork), plus the outer 3pt of both round ends.
import numpy as np, os
from PIL import Image
load=lambda p:np.asarray(Image.open(p).convert('RGB'),float)
names=sorted(os.listdir('set/apple')); N=len(names)
top,h=80,108; r=h/2; cy=top+r
yy,xx=np.mgrid[0:270,0:1562]
dx=np.clip(xx+.5,80+r,1482-r)-(xx+.5); dy=cy-(yy+.5); edge=r-np.hypot(dx,dy)
clean=(xx>=860)&(xx<1240); caps=(xx<80+r)|(xx>=1482-r)
bands={'rim 0-2pt':(edge>0)&(edge<=4)&clean,'rim 2-7pt':(edge>4)&(edge<=14)&clean,'rim 7-14pt':(edge>14)&(edge<=28)&clean,
       'face':(edge>28)&clean,'caps 0-3pt':(edge>0)&(edge<=6)&caps}
F={k:[load(f'{d}/{n}') for n in names] for k,d in [('music','set/apple'),('shipped','r-shipped'),('arc','r-arcrel')]}
print(f'{N} frames, 1pt apart')
print('%-11s %8s %8s   %22s   %16s'%('band','err ship','err arc','change music/ship/arc','change err ship/arc'))
for b,m in bands.items():
    e={k:np.mean([np.abs(F[k][i]-F['music'][i]).mean(2)[m].mean() for i in range(N)]) for k in ['shipped','arc']}
    ch={k:np.mean([np.abs(F[k][i+1]-F[k][i]).mean(2)[m].mean() for i in range(N-1)]) for k in F}
    ce={k:np.mean([np.abs((F[k][i+1]-F[k][i])-(F['music'][i+1]-F['music'][i])).mean(2)[m].mean() for i in range(N-1)]) for k in ['shipped','arc']}
    print('%-11s %8.2f %8.2f   %6.2f %6.2f %6.2f   %8.2f %6.2f'%(b,e['shipped'],e['arc'],ch['music'],ch['shipped'],ch['arc'],ce['shipped'],ce['arc']))
# mean brightness of the outer 2pt (top and bottom, clean columns): our mirror band was too bright in the line sweep
m=bands['rim 0-2pt']
print('outer 2pt mean level music %.1f shipped %.1f arc %.1f'%tuple(np.mean([F[k][i].mean(2)[m].mean() for i in range(N)]) for k in ['music','shipped','arc']))

# Jaggedness along the round ends' outer ring: pixels at 0-1, 1-2, 2-3 device px inside the edge, ordered by angle;
# mean |v - mean of its two neighbours along the arc| (high-pass along the curve), luma. Upper and lower quarters of
# each end (the icons sit near the ends' middles in Music's frames).
import numpy as np, sys
from PIL import Image
def jag(path,right_x,cx_left=134,r=54,cy=134):
    a=np.asarray(Image.open(path).convert('RGB'),float)@[.2126,.7152,.0722]
    out={}
    for side,cx,sgn in (('left',cx_left,-1),('right',right_x-r,1)):
        res=[]
        for k in (0,1,2):
            pts=[]
            for th in np.linspace(.18*np.pi,.47*np.pi,400):          # 32-85 deg from the end's middle, both quarters
                for s in (-1,1):
                    rr=r-(k+.5); x=cx+sgn*rr*np.cos(th); y=cy+s*rr*np.sin(th)
                    pts.append((s,th,a[int(y),int(x)]))
            v=[];
            for s in (-1,1):
                q=np.array([p[2] for p in pts if p[0]==s]); v.append(np.abs(q[1:-1]-(q[:-2]+q[2:])/2).mean())
            res.append(np.mean(v))
        out[side]=res
    return out
for path,rx,label in [(a.split(':')[0],int(a.split(':')[1]),a.split(':')[2]) for a in sys.argv[1:]]:
    j=jag(path,rx); print('%-22s left %s  right %s'%(label,' '.join('%.2f'%x for x in j['left']),' '.join('%.2f'%x for x in j['right'])))

# Line at s = 8..24pt below the bar's top in 0.125pt steps. For each render set: the line's image in the mirror band
# (display 0-7pt) and in the flat band (display >= 12.5pt): centroid and total light against s, and how far each
# departs from a smooth curve (jitter = rms residual from a cubic fit over a sliding window).
import numpy as np, sys
from PIL import Image
sets=sys.argv[1:]
S=8+np.arange(129)*0.125
def prof(d):
    P=np.array([np.asarray(Image.open(f'{d}/mgs{i:03d}.png').convert('L'),float)[80:140,600:1400].mean(1) for i in range(129)])
    return P-P.min(0)                            # light above each row's dark level, rows 0..29.5pt from the top edge
def smooth_resid(y,win=9):
    out=[]
    for i in range(len(y)-win+1):
        x=np.arange(win); c=np.polyfit(x,y[i:i+win],2); out.append(y[i+win//2]-np.polyval(c,win//2))
    return np.sqrt(np.mean(np.square(out)))
for d in sets:
    P=prof(d); rows=np.arange(P.shape[1])/2+.25
    for name,m in [('mirror 0-7pt',rows<7),('flat >=13pt',rows>=13)]:
        L=P[:,m].sum(1); ok=L>L.max()*.2
        c=(P[:,m]*rows[m]).sum(1)/np.maximum(L,1e-6)
        seg=np.where(ok)[0]
        cj=smooth_resid(c[seg]) if len(seg)>12 else float('nan'); lj=smooth_resid(L[seg]/L[seg].mean()) if len(seg)>12 else float('nan')
        print(f'{d:14s} {name:13s} visible for s {S[seg[0]]:.2f}-{S[seg[-1]]:.2f}pt  centroid jitter {cj:.3f}pt  light flicker {100*lj:.1f}%')

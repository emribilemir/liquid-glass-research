# Sub-pixel sweep backgrounds (2x, 781x135pt, bar top at 40pt): a 1pt white line on black at 8..24pt from the bar's
# top (mgs*, horizontal) or from its left end (mgv*, vertical), every 0.125pt (a quarter device pixel), box-filtered.
#   python3 sweepgen.py <dir>/bg     then native.sh (Lab3, BAR_Y=40) and fit.mjs eval with FITDIR=<dir>/
import sys, numpy as np
from PIL import Image
out=sys.argv[1]; W,H=1562,270
for i in range(129):
    s=8+i*0.125; a=(40+s-0.5)*2; b=(40+s+0.5)*2
    for name,n,axis in (('mgs',H,1),('mgv',W,0)):
        k=np.arange(n); v=np.round(255*np.clip(np.minimum(k+1,b)-np.maximum(k,a),0,1)).astype(np.uint8)
        img=np.repeat(v[:,None],W,1) if axis else np.repeat(v[None,:],H,0)
        Image.fromarray(np.stack([img]*3,2)).save(f'{out}/{name}{i:03d}.png')

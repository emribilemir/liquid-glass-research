# glyphs.py <png> x0 y0 w h thr : connected dark blobs (device px) inside the region, merged per column gap >= 6px
import sys, numpy as np
from PIL import Image
f=sys.argv[1];x0,y0,w,h=map(int,sys.argv[2:6]);thr=float(sys.argv[6])
a=np.asarray(Image.open(f).convert('RGB')).astype(float)[y0:y0+h,x0:x0+w]
L=a@np.array([.2126,.7152,.0722]); m=L<thr
cols=np.where(m.any(0))[0]
groups=[];start=prev=None
for c in cols:
  if start is None: start=prev=c
  elif c-prev>=6: groups.append((start,prev)); start=prev=c
  else: prev=c
if start is not None: groups.append((start,prev))
for s,e in groups:
  rows=np.where(m[:,s:e+1].any(1))[0]
  print('x %6.1f-%6.1f pt  w %5.1f  y %5.1f-%5.1f h %5.1f  (device x %d-%d)'%(s/2,(e+1)/2,(e-s+1)/2,rows[0]/2,(rows[-1]+1)/2,(rows[-1]-rows[0]+1)/2,x0+s,x0+e))

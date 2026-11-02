# abox.py <png> : glyph bounding boxes in Apple's mini player buttons (AX rects, window pt; player at window 370,642)
import sys, numpy as np
from PIL import Image
a=np.asarray(Image.open(sys.argv[1]).convert('RGB')).astype(float)
L=a@np.array([.2126,.7152,.0722]); ch=a.max(2)-a.min(2)
lo,hi=float(sys.argv[2]),float(sys.argv[3])
btn={'shuffle':(9,13,28,28),'prev':(37,13,28,28),'play':(65,9,36,36),'next':(101,13,28,28),'repeat':(129,13,28,28),'lyrics':(581,9,36,36),'queue':(618,9,36,36),'volume':(655,9,36,36)}
for n,(x,y,w,h) in btn.items():
  X0,Y0=int((370+x)*2),int((642+y)*2);m=(L[Y0:Y0+2*h,X0:X0+2*w]>lo)&(L[Y0:Y0+2*h,X0:X0+2*w]<hi)&(ch[Y0:Y0+2*h,X0:X0+2*w]<int(sys.argv[4]))
  ys,xs=np.where(m)
  if not len(xs): print(n,'none');continue
  print('%-8s glyph %5.1f x %5.1f pt  at (%5.1f,%5.1f) in button %dx%d; centre offset (%+.1f,%+.1f)'%(n,(xs.max()-xs.min()+1)/2,(ys.max()-ys.min()+1)/2,xs.min()/2,ys.min()/2,w,h,(xs.min()+xs.max()+1)/4-w/2,(ys.min()+ys.max()+1)/4-h/2))

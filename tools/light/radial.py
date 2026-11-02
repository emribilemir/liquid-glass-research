# radial.py <png> cx cy r0 r1 : luminance along rays from (cx,cy) every 45 deg, device px, bilinear
import sys, numpy as np
from PIL import Image
a=np.asarray(Image.open(sys.argv[1]).convert('RGB')).astype(float)@np.array([.2126,.7152,.0722])
cx,cy,r0,r1=map(float,sys.argv[2:6])
def s(x,y):
  x-=.5;y-=.5;x0,y0=int(np.floor(x)),int(np.floor(y));fx,fy=x-x0,y-y0
  return a[y0,x0]*(1-fx)*(1-fy)+a[y0,x0+1]*fx*(1-fy)+a[y0+1,x0]*(1-fx)*fy+a[y0+1,x0+1]*fx*fy
rs=np.arange(r0,r1+.01,1)
print('r   '+' '.join('%4.0f'%r for r in rs))
for d in [90,135,180,225,270]:
  t=np.radians(d);print('%3d '%d+' '.join('%4.0f'%s(cx+r*np.cos(t),cy-r*np.sin(t)) for r in rs))

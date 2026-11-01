# python3 compare.py <apple menu.png> <chromium render.png> [out.png]: rms of a Chromium render (render.mjs) against
# Apple's menu over the same stripes (text masked), per region, and the rim profile of each edge.
import sys, numpy as np
from PIL import Image
from scipy.ndimage import binary_dilation
menu=np.asarray(Image.open(sys.argv[1]).convert('L')).astype(float)
pr=np.asarray(Image.open(sys.argv[2]).convert('L')).astype(float)
X0,Y0,X1,Y1=301,267,656,716;W,H=X1-X0+1,Y1-Y0+1;K=2;R=26
M=menu[Y0:Y1+1,X0:X1+1];Q=pr[Y0+1:Y1+2,X0+1:X1+2]  # Chromium snaps the box to whole CSS px: ours sits 1 device px lower and to the right
yy,xx=np.mgrid[0:H,0:W]+.5
qx=np.abs(xx-W/2)-(W/2-R);qy=np.abs(yy-H/2)-(H/2-R)
dist=-(np.hypot(np.maximum(qx,0),np.maximum(qy,0))+np.minimum(np.maximum(qx,qy),0)-R)
mask=~binary_dilation(M>200,iterations=5)&(dist>2.5)
vert=np.minimum(yy,H-yy)<np.minimum(xx,W-xx);top=vert&(yy<H/2)
corner=(np.minimum(xx,W-xx)<30*K)&(np.minimum(yy,H-yy)<30*K)
out={'all':mask,'rim<18pt':mask&(dist<36),'top':mask&top&(dist<36),'bottom':mask&vert&~top&(dist<36),'sides':mask&~vert&(dist<36),'corners':mask&corner,'centre':mask&(dist>=60)}
print(' '.join(f'{k} {np.sqrt(np.mean((Q-M)[s]**2)):.2f}' for k,s in out.items()), ' mean apple %.1f ours %.1f'%(M[mask].mean(),Q[mask].mean()))
def prof(I,e):
  if e=='top': return [I[o,60:W-60].mean() for o in range(5)]
  if e=='bottom': return [I[H-1-o,60:W-60].mean() for o in range(5)]
  if e=='left': return [I[60:H-60,o].mean() for o in range(5)]
  return [I[60:H-60,W-1-o].mean() for o in range(5)]
for e in ['top','bottom','left','right']: print(e.ljust(6),'apple',[round(v) for v in prof(M,e)],' ours',[round(v) for v in prof(Q,e)])
if len(sys.argv)>3: Image.fromarray(np.hstack([M,Q,np.clip(np.abs(Q-M)*2,0,255)]).astype(np.uint8)).save(sys.argv[3])

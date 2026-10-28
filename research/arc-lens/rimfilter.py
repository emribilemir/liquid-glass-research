import numpy as np
from PIL import Image
import os; R=os.path.dirname(os.path.abspath(__file__))+'/../fit/'
A,H=26.26,13.27
arc=lambda t:np.sqrt((2-np.clip(t,0,1))*np.clip(t,0,1))
src=lambda d:d+A*(1-arc(d/H))           # pt from the top edge, display -> source
def bgval(name,y):                       # analytic hstripes / h-lines in pt from bar top
    if name=='hstripes': return (np.mod(y,10)<2)*1.0
    v=int(name[1:]); return ((y>=v-.5)&(y<v+.5))*1.0
for name in ['hstripes','h4','h8','h15']:
    nat=np.asarray(Image.open(R+'apple/'+name+'.png').convert('L'),float)
    cols=nat[:,600:1400].mean(1)          # middle of the bar, away from the round ends
    print(name,' row(pt)  native  point   footprint-avg  (pred scaled to native range)')
    rows=[];P=[];F=[]
    for r in range(80,80+32):            # outer 16pt, device rows
        d0=(r-80)/2; dc=d0+.25
        point=bgval(name,np.array([src(dc)]))[0]
        sub=np.linspace(d0+1/64,d0+.5-1/64,32); foot=bgval(name,src(sub)).mean()
        rows.append(cols[r]);P.append(point);F.append(foot)
    rows=np.array(rows);P=np.array(P);F=np.array(F)
    for pred,label in ((P,'point'),(F,'footprint')):
        X=np.c_[pred,np.ones_like(pred)]; c,*_=np.linalg.lstsq(X[4:],rows[4:],rcond=None)   # skip highlight rows
        print('  %-9s fit residual rms %.1f'%(label,np.sqrt(np.mean((X[4:]@c-rows[4:])**2))))
    for i in range(0,32,1): print('  %5.2f %6.1f %5.2f %5.2f'%((i)/2,rows[i],P[i],F[i]))

import json, math, sys
import numpy as np
from scipy.optimize import least_squares
import os; R=os.path.dirname(os.path.abspath(__file__))+'/../'
top=np.array([[r[0],r[3]] for r in json.load(open(R+'probe-top-native.json'))])
left=np.array([[r[0],r[1]] for r in json.load(open(R+'probe-left-native.json'))])
top=top[top[:,0]<=20]; left=left[left[:,0]<=20]
def arc(t): t=np.clip(t,0,1); return np.sqrt((2-t)*t)
def src_arc(d,A,H,off=0.25):
    # evaluate at device-pixel centre (0.25pt) and average over the 0.5pt pixel with 8 sub-samples
    s=np.zeros_like(d)
    for k in range(8):
        dd=d+(k+.5)/16
        s+=dd+A*(1-arc(dd/H))
    return s/8
def src_pow(d,A,H,p,q):
    s=np.zeros_like(d)
    for k in range(8):
        dd=d+(k+.5)/16; t=np.clip(dd/H,0,1)
        s+=dd+A*(1-(1-(1-t)**p)**(1/q))
    return s/8
def fit(name,data,f,x0):
    d,y=data[:,0],data[:,1]
    r=least_squares(lambda x:f(d,*x)-y,x0)
    res=f(d,*r.x)-y
    print(f'{name}: params={np.round(r.x,3).tolist()} rms={np.sqrt(np.mean(res**2)):.3f}pt max={np.abs(res).max():.2f}pt')
    return r.x
print('top edge (Music geometry, SwiftUI glass, focused)')
a=fit(' circle arc A(1-sqrt((2-t)t))',top,src_arc,[21,12.5])
b=fit(' generalised arc 1-(1-(1-t)^p)^(1/q)',top,src_pow,[21,12.5,2,2])
print('left round end')
fit(' circle arc',left,src_arc,[17,12.5])
fit(' generalised arc',left,src_pow,[17,12.5,2,2])
# medfa defaults at scale: outer lobe -13 over H=10 at scaleRef 75 -> S = 27/75 for a 54pt-high capsule (in px; their px ~ pt?)
S=27/75
print('medfa outer lobe alone, scaled to Music height: A=%.2f H=%.2f'%(13*S,10*S))
d=top[:,0]
print(' d   measured  arc-fit  gen-fit  medfa-outer')
for i in range(len(d)):
    print(f'{d[i]:4.1f} {top[i,1]:7.2f} {src_arc(d[i:i+1],*a)[0]:8.2f} {src_pow(d[i:i+1],*b)[0]:8.2f} {src_arc(d[i:i+1],13*S,10*S)[0]:8.2f}')

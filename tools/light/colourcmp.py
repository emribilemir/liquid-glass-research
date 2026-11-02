import json, numpy as np
from PIL import Image
J=json.load(open('lab/flats.json'));lab=np.asarray(Image.open('lab/lab-light.png').convert('RGB')).astype(float)
def s(img,x,y):
  x-=.5;y-=.5;x0,y0=int(np.floor(x)),int(np.floor(y));fx,fy=x-x0,y-y0
  return img[y0,x0]*(1-fx)*(1-fy)+img[y0,x0+1]*fx*(1-fy)+img[y0+1,x0]*(1-fx)*fy+img[y0+1,x0+1]*fx*fy
lum=lambda c: float(np.dot(c,[.2126,.7152,.0722]))
def circ(img,cx,cy):
  at=lambda d,r: s(img,cx+r*np.cos(np.radians(d)),cy-r*np.sin(np.radians(d)))
  face=np.mean([at(d,r) for d in (90,270) for r in (21.5,23.5,25.5)],0)
  return dict(face=face,top=lum(at(90,36.5)),bot=lum(at(270,36.5)),end=lum(at(180,36.5)),light=lum(at(90,35.5))-lum(face),light2=lum(at(90,34.5))-lum(face))
def pill(img,x,y):  # device px of the top edge row at column x; y = first glass row
  col=img[:,x]; face=np.mean(img[y+16:y+22,x],0)
  return dict(top=lum(img[y-1,x]),light=lum(img[y,x])-lum(face),light2=lum(img[y+1,x])-lum(face),face=face)
rows=[]
for n,T in J['tiles'].items():
  A=circ(lab,(T['x']+34)*2,(T['y']+34)*2)
  Ap=pill(lab,(T['x']+16+60)*2,(T['y']+70)*2)
  r={'n':n,'page':T['rgb'],'A':A,'Ap':Ap}
  for tag in ['before','after','after2']:
    o=np.asarray(Image.open(f'ours/colours/{tag}-{n}.png').convert('RGB')).astype(float)
    r[tag]=circ(o,912,74); r[tag+'p']=pill(o,1074,1290)
  rows.append(r)
f=lambda c:'%3d,%3d,%3d'%tuple(np.round(c))
print('BUTTON 36pt: face rgb | line top/end/bottom (lum) | light inside top (+px1/+px2)')
print('%-8s %-12s | %-35s | %-41s | %s'%('colour','page','face Apple / before / after','line top/end/bot Apple | before | after','light A | b | a'))
for r in rows:
  A,b,a=r['A'],r['before'],r['after']
  print('%-8s %-12s | %s / %s / %s | %3.0f/%3.0f/%3.0f | %3.0f/%3.0f/%3.0f | %3.0f/%3.0f/%3.0f | %+3.0f%+3.0f | %+3.0f%+3.0f | %+3.0f%+3.0f'%(r['n'],'%d,%d,%d'%tuple(r['page']),f(A['face']),f(b['face']),f(a['face']),A['top'],A['end'],A['bot'],b['top'],b['end'],b['bot'],a['top'],a['end'],a['bot'],A['light'],A['light2'],b['light'],b['light2'],a['light'],a['light2']))
print('\nPLAYER 54pt, top edge: line | light +px1 +px2 | face')
for r in rows:
  A,b,a=r['Ap'],r['beforep'],r['afterp']
  print('%-8s line %3.0f | %3.0f | %3.0f   light %+3.0f%+3.0f | %+3.0f%+3.0f | %+3.0f%+3.0f   face %s / %s / %s'%(r['n'],A['top'],b['top'],a['top'],A['light'],A['light2'],b['light'],b['light2'],a['light'],a['light2'],f(A['face']),f(b['face']),f(a['face'])))
json.dump([{k:(v if not isinstance(v,dict) else {kk:(vv.tolist() if hasattr(vv,'tolist') else vv) for kk,vv in v.items()}) for k,v in r.items()} for r in rows],open('colours.json','w'))

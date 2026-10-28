# Width of the line's image against where it lands (display distance from the edge), native vs ours: the extra blur
# Apple applies there is sqrt(w_native^2 - w_ours^2). Mirror band only (the line's image nearest the edge).
import numpy as np, sys
from PIL import Image
def prof(d,kind,i):
    a=np.asarray(Image.open(f'{d}/{kind}{i:03d}.png').convert('L'),float)
    return a[80:120,600:1400].mean(1) if kind=='mgs' else a[132:137,80:120].mean(0)
sets=sys.argv[1:]
for kind in ('mgs','mgv'):
    print('==',kind,'  display pos (pt): width (px) per set')
    base={d:np.array([prof(d,kind,i) for i in range(129)]) for d in sets}
    for d in sets: base[d]=base[d]-base[d].min(0)
    rows={}
    for d in sets:
        for i in range(129):
            v=base[d][i][:16]                                   # mirror band: display 0-8pt
            if v.sum()<20: continue
            pos=np.arange(16); c=(v*pos).sum()/v.sum(); w=np.sqrt((v*(pos-c)**2).sum()/v.sum())
            rows.setdefault(round(c/2*2)/2,{}).setdefault(d,[]).append((w,v.sum(),v.max()))
    for k in sorted(rows):
        print('  %4.1fpt '%k+'  '.join('%s w %.2f light %4.0f peak %3.0f'%(d[:8],*np.mean(rows[k][d],0)) if d in rows[k] else '%s -'%d[:8] for d in sets))

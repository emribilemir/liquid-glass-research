# sbs.py <music recdir> <copy recdir> <outdir> [zoom]: Music (left) and the copy (right) frame by frame, the copy's
# time mapped onto Music's piecewise between matching script steps (rec's real event times drift from the plan).
import sys, os, numpy as np
from PIL import Image, ImageDraw
m, c, out = sys.argv[1:4]; z = int(sys.argv[4]) if len(sys.argv) > 4 else 2
os.makedirs(out, exist_ok=True)
def tl(d):
  rows = [l.split() for l in open(os.path.join(d, 'timeline.tsv'))]
  return [(float(p[2]), int(p[1])) for p in rows if p[0] == 'frame'], [float(p[4]) for p in rows if p[0] == 'event']
mf, me = tl(m); cf, ce = tl(c)
def tocopy(t):
  k = max([i for i, e in enumerate(me) if e <= t], default=-1)
  if k < 0: return t - me[0] + ce[0]
  if k + 1 >= len(me): return t - me[k] + ce[k]
  return ce[k] + (t - me[k]) / (me[k + 1] - me[k]) * (ce[k + 1] - ce[k])
for n, (t, i) in enumerate(mf):
  a = Image.open(os.path.join(m, 'f%04d.png' % i)).convert('RGB')
  ct = tocopy(t); j = min(cf, key=lambda f: abs(f[0] - ct))[1]
  b = Image.open(os.path.join(c, 'f%04d.png' % j)).convert('RGB')
  W, H = a.width * z, a.height * z
  im = Image.new('RGB', (W * 2 + 8, H + 20), (255, 255, 255)); d = ImageDraw.Draw(im)
  im.paste(a.resize((W, H), Image.NEAREST), (0, 20)); im.paste(b.resize((W, H), Image.NEAREST), (W + 8, 20))
  d.text((4, 4), 'Apple Music  %.2fs' % t, fill=(0, 0, 0)); d.text((W + 12, 4), 'Chromium copy', fill=(0, 0, 0))
  im.save(os.path.join(out, 's%04d.png' % n))
print(len(mf))

# segs.py <recdir> [tref]: settled light (luminance over the frame at tref, default 1.4 s) on the Share and More
# segments of the capsule (crop px centres 193 and 263, a strip below the glyphs) before every scripted step.
import sys, os, numpy as np
from PIL import Image
d = sys.argv[1]; tref = float(sys.argv[2]) if len(sys.argv) > 2 else 1.4
rows = [l.split() for l in open(os.path.join(d, 'timeline.tsv'))]
fr = [(float(p[2]), int(p[1])) for p in rows if p[0] == 'frame']; ev = [(float(p[4]), p[1], p[2], p[3]) for p in rows if p[0] == 'event']
L = lambda i: np.asarray(Image.open(os.path.join(d, 'f%04d.png' % i)).convert('RGB'), dtype=np.float32) @ np.array([.2126, .7152, .0722])
near = lambda t: min(fr, key=lambda f: abs(f[0] - t))[1]
seg = lambda a, c: a[72:80, c - 14:c + 14].mean()
b = L(near(tref))
for k, e in enumerate(ev):
  t = (ev[k + 1][0] if k + 1 < len(ev) else fr[-1][0]) - 0.03; a = L(near(t))
  print('%-22s share %+5.1f  more %+5.1f' % ('%s @%s,%s' % e[1:], seg(a, 193) - seg(b, 193), seg(a, 263) - seg(b, 263)))

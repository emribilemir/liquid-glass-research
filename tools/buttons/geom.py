# geom.py <recdir> cx cy [step] [halfw halfh]: tracks a glass button's outline per frame. From (cx,cy) (crop px) it
# walks out left/right along row cy and up/down along column cx and puts each edge at the strongest luminance step
# (sub-pixel by parabola) in a window around the previous edge; prints width/height/centre and the mean brightness.
import sys, os, numpy as np
from PIL import Image
a = sys.argv[1:]; d = a[0]; cx, cy = float(a[1]), float(a[2]); step = int(a[3]) if len(a) > 3 else 2
hw, hh = (float(a[4]), float(a[5])) if len(a) > 5 else (36, 36)
rows = [l.split() for l in open(os.path.join(d, 'timeline.tsv'))]
frames = [(float(p[2]), int(p[1])) for p in rows if p[0] == 'frame']
events = [(float(p[4]), p[1], p[2], p[3]) for p in rows if p[0] == 'event']
def lum(i):
  x = np.asarray(Image.open(os.path.join(d, 'f%04d.png' % i)).convert('RGB'), dtype=np.float32)
  return x @ np.array([.2126, .7152, .0722], np.float32)
def edge(p, c, sign, guess):
  # strongest outward drop of brightness (inside brighter than outside) between guess-14 and guess+14
  lo, hi = int(max(1, c + sign * (guess - 14))), int(c + sign * (guess + 14))
  idx = range(min(lo, hi), max(lo, hi))
  g = np.array([(p[k] - p[k + sign]) for k in idx])
  k = int(np.argmax(g)); off = 0.0
  if 0 < k < len(g) - 1:
    den = g[k - 1] - 2 * g[k] + g[k + 1]; off = 0.5 * (g[k - 1] - g[k + 1]) / den if den else 0
  return abs(list(idx)[k] + off + sign * 0.5 - c)
ei = 0; L = R = T = B = None
for t, i in frames[::step]:
  while ei < len(events) and events[ei][0] <= t: print('   -- %s @%s,%s %.3f' % (events[ei][1], events[ei][2], events[ei][3], events[ei][0])); ei += 1
  y = lum(i); row = y[int(cy)]; col = y[:, int(cx)]
  L = edge(row, cx, -1, L or hw); R = edge(row, cx, 1, R or hw); T = edge(col, cy, -1, T or hh); B = edge(col, cy, 1, B or hh)
  inner = y[int(cy) - 20:int(cy) + 20, int(cx - hw) + 6:int(cx - hw) + 18].mean()
  print('%6.3f  w %5.1f h %5.1f  L %5.1f R %5.1f T %5.1f B %5.1f  centre %+5.1f %+5.1f  rim-in %5.1f' % (t, L + R, T + B, L, R, T, B, (R - L) / 2, (B - T) / 2, inner))

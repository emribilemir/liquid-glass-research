# series.py <recdir> cx cy r [step]: per-frame mean RGB inside a circle (crop px) and the luminance-weighted centroid
# offset of the change from the first frame, to see fades, pointer-following light and growth over time.
import sys, os, numpy as np
from PIL import Image
d = sys.argv[1]; cx, cy, r = map(float, sys.argv[2:5]); step = int(sys.argv[5]) if len(sys.argv) > 5 else 3
frames = [(float(p[2]), int(p[1])) for p in (l.split() for l in open(os.path.join(d, 'timeline.tsv'))) if p[0] == 'frame']
events = [(float(p[4]), p[1], p[2], p[3]) for p in (l.split() for l in open(os.path.join(d, 'timeline.tsv'))) if p[0] == 'event']
load = lambda i: np.asarray(Image.open(os.path.join(d, 'f%04d.png' % i)).convert('RGB'), dtype=np.float32)
a0 = load(frames[0][1]); H, W = a0.shape[:2]
yy, xx = np.mgrid[0:H, 0:W]; m = (xx - cx) ** 2 + (yy - cy) ** 2 <= r * r
ei = 0
for t, i in frames[::step]:
  while ei < len(events) and events[ei][0] <= t: print('   -- %s @%s,%s %.3f' % (events[ei][1], events[ei][2], events[ei][3], events[ei][0])); ei += 1
  a = load(i); mean = a[m].mean(0)
  dl = (a - a0).mean(2); dl[~m] = 0; w = np.abs(dl); s = w.sum()
  c = ((xx * w).sum() / s - cx, (yy * w).sum() / s - cy) if s > 0 else (0, 0)
  print('%6.3f  rgb %5.1f %5.1f %5.1f  |d| %5.2f  centroid %+5.1f %+5.1f' % (t, *mean, w[m].mean(), *c))

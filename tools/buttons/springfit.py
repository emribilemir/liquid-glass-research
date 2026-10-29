# springfit.py <recdir> cx cy hw <t_event> <from_w> <to_w> [window_s]: fits SwiftUI-style spring(response, dampingFraction)
# plus a start delay to the button width (crop px, row cy) after an event, from every frame.
import sys, os, numpy as np
from PIL import Image
d = sys.argv[1]; cx, cy, hw, te, w0, w1 = map(float, sys.argv[2:8]); win = float(sys.argv[8]) if len(sys.argv) > 8 else 0.6
fr = [(float(p[2]), int(p[1])) for p in (l.split() for l in open(os.path.join(d, 'timeline.tsv'))) if p[0] == 'frame']
def width(i):
  y = np.asarray(Image.open(os.path.join(d, 'f%04d.png' % i)).convert('RGB'), dtype=np.float32) @ np.array([.2126, .7152, .0722])
  row = y[int(cy)]; out = []
  for s in (-1, 1):
    idx = list(range(int(cx + s * (hw - 10)), int(cx + s * (hw + 14)), s)); g = np.array([row[k] - row[k + s] for k in idx]); k = int(np.argmax(g)); o = 0
    if 0 < k < len(g) - 1: den = g[k-1] - 2*g[k] + g[k+1]; o = 0.5 * (g[k-1] - g[k+1]) / den if den else 0
    out.append(abs(idx[k] + s * o + s * .5 - cx))
  return sum(out)
pts = [(t - te, width(i)) for t, i in fr if te - 0.05 <= t <= te + win]
T = np.array([p[0] for p in pts]); W = np.array([p[1] for p in pts])
def spring(t, resp, zeta):
  w = 2 * np.pi / resp; t = np.maximum(t, 0)
  if zeta < 1:
    wd = w * np.sqrt(1 - zeta ** 2); x = np.exp(-zeta * w * t) * (np.cos(wd * t) + zeta * w / wd * np.sin(wd * t))
  else: x = np.exp(-w * t) * (1 + w * t)
  return 1 - x
best = None
for resp in np.arange(0.1, 0.8, 0.005):
  for zeta in np.arange(0.3, 1.01, 0.01):
    for delay in np.arange(-0.03, 0.05, 0.005):
      m = w0 + (w1 - w0) * spring(T - delay, resp, zeta); e = np.mean((m - W) ** 2)
      if best is None or e < best[0]: best = (e, resp, zeta, delay)
e, resp, zeta, delay = best
print('response %.3fs dampingFraction %.2f delay %+.3fs rms %.2fpx  (n=%d)' % (resp, zeta, delay, e ** .5, len(T)))
for t, w in zip(T, W): print('  %+.3f %6.2f  model %6.2f' % (t, w, w0 + (w1 - w0) * spring(np.array([t - delay]), resp, zeta)[0]))

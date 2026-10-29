# rimprof.py <pattern> <rendersdir> [cx cy]: luminance by angle and radius (device px) around the 36pt circle,
# macOS lab vs a Chromium render.
import sys, numpy as np
from PIL import Image
n, R = sys.argv[1], sys.argv[2]; cx, cy = (float(sys.argv[3]), float(sys.argv[4])) if len(sys.argv) > 4 else (192, 52)
L = lambda p: np.asarray(Image.open(p).convert('RGB')).astype(float) @ np.array([.2126, .7152, .0722])
def samp(a, r, deg):
  t = np.radians(deg); x = cx + r * np.cos(t) - .5; y = cy - r * np.sin(t) - .5; x0, y0 = int(np.floor(x)), int(np.floor(y)); fx, fy = x - x0, y - y0
  return a[y0, x0] * (1 - fx) * (1 - fy) + a[y0, x0 + 1] * fx * (1 - fy) + a[y0 + 1, x0] * (1 - fx) * fy + a[y0 + 1, x0 + 1] * fx * fy
lab, our = L(f'research/buttons/fit/lab/{n}.png'), L(f'{R}/{n}.png'); rs = np.arange(31, 39.5, 1)
print(n, 'r:', ' '.join('%4.0f' % r for r in rs))
for deg in range(0, 360, 45): print(' %3d lab ' % deg + ' '.join('%4.0f' % samp(lab, r, deg) for r in rs), '| ours ' + ' '.join('%4.0f' % samp(our, r, deg) for r in rs))

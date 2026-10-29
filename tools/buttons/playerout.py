# playerout.py <dir>...: edge read-out of the player probes (research/buttons/player-out): colour excess over the flat
# capture on the centre row at the left/right ends and down the middle column at the top edge, per recording dir.
import sys, numpy as np
from PIL import Image
L = lambda d, n: np.asarray(Image.open(f'{d}/{n}.png').convert('RGB')).astype(int)
cy = 134
for d in sys.argv[1:]:
  g = L(d, 'g064'); print('==', d)
  for e in (1, 4, 8):
    a = L(d, f'red-l{e:02d}'); r = [int((a[cy, x, 0] - a[cy, x, 1]) - (g[cy, x, 0] - g[cy, x, 1])) for x in (80, 81, 82, 84, 88, 104, 120)]
    b = L(d, f'blue-r{e:02d}'); bl = [int((b[cy, x, 2] - b[cy, x, 0]) - (g[cy, x, 2] - g[cy, x, 0])) for x in (1483, 1482, 1481, 1479, 1475, 1460)]
    t = L(d, f'green-t{e:02d}'); gr = [int((t[y, 780, 1] - t[y, 780, 0]) - (g[y, 780, 1] - g[y, 780, 0])) for y in (80, 81, 82, 84, 88, 104)]
    print('  %dpt out  left end red %-32s right end blue %-28s top green %s' % (e, r, bl, gr))

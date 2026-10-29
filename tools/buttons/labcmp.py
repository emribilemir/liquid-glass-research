# labcmp.py <music.png> <lab.png>... --c cx,cy,r: error (mean abs per channel) between a Music frame and lab
# captures by ring around a round glass (crop px), the glyph masked out (Music's bright pixels, dilated by 3px).
import sys, numpy as np
from PIL import Image
from scipy.ndimage import binary_dilation
a = sys.argv[1:]; i = a.index('--c'); cx, cy, R = map(float, a[i + 1].split(',')); del a[i:i + 2]
m = np.asarray(Image.open(a[0]).convert('RGB')).astype(float)
yy, xx = np.mgrid[0:m.shape[0], 0:m.shape[1]]; r = np.hypot(xx - cx, yy - cy)
glyph = binary_dilation((m.mean(2) > 150) & (r < R - 4), iterations=3)
rings = [('inside', r < R - 4), ('rim', (r >= R - 4) & (r < R)), ('outside', (r >= R) & (r < R + 4))]
for p in a[1:]:
  l = np.asarray(Image.open(p).convert('RGB')).astype(float); d = np.abs(l - m).mean(2)
  print('%-40s ' % p.split('/')[-1] + '  '.join('%s %.2f' % (n, d[k & ~glyph].mean()) for n, k in rings))

# fitview.py <rendersdir> <out.png> name...: per pattern a row: background | macOS lab | Chromium render | diff x3.
import sys, numpy as np
from PIL import Image
R, out, names = sys.argv[1], sys.argv[2], sys.argv[3:]
F = 'research/buttons/fit'
rows = []
for n in names:
  b, l, r = (np.asarray(Image.open(p).convert('RGB')).astype(int)[0:100, 140:440] for p in (f'{F}/bg/{n}.png', f'{F}/lab/{n}.png', f'{R}/{n}.png'))
  d = np.clip(128 + (r - l) * 3, 0, 255)
  rows.append(np.concatenate([b, np.full((100, 6, 3), 255), l, np.full((100, 6, 3), 255), r, np.full((100, 6, 3), 255), d], 1))
im = np.concatenate([np.concatenate([x, np.full((6, x.shape[1], 3), 255)], 0) for x in rows], 0).astype(np.uint8)
Image.fromarray(im).resize((im.shape[1] * 2, im.shape[0] * 2), Image.NEAREST).save(out)

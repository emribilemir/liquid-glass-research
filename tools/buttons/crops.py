# crops.py <recdir> <out.png> x y w h zoom t1 t2 ... [--diff tref gain]: crops (crop px) the frames nearest each time,
# enlarged; with --diff adds a second row of signed differences to the frame at tref (grey 128 = no change).
import sys, os, numpy as np
from PIL import Image, ImageDraw
a = sys.argv[1:]; diff = None
if '--diff' in a: i = a.index('--diff'); diff = (float(a[i + 1]), float(a[i + 2])); del a[i:i + 3]
d, out = a[0], a[1]; x, y, w, h, z = map(int, a[2:7]); times = [float(t) for t in a[7:]]
fr = [(float(p[2]), int(p[1])) for p in (l.split() for l in open(os.path.join(d, 'timeline.tsv'))) if p[0] == 'frame']
near = lambda t: min(fr, key=lambda f: abs(f[0] - t))
load = lambda i: np.asarray(Image.open(os.path.join(d, 'f%04d.png' % i)).convert('RGB'), dtype=np.float32)[y:y + h, x:x + w]
rows = 2 if diff else 1
sheet = Image.new('RGB', (len(times) * (w * z + 6), rows * (h * z + 18)), (255, 255, 255)); dr = ImageDraw.Draw(sheet)
ref = load(near(diff[0])[1]) if diff else None
for k, t in enumerate(times):
  ft, fi = near(t); im = load(fi); X = k * (w * z + 6)
  dr.text((X + 2, 2), '%.2fs' % ft, fill=(0, 0, 0))
  sheet.paste(Image.fromarray(im.astype(np.uint8)).resize((w * z, h * z), Image.NEAREST), (X, 18))
  if diff:
    dd = np.clip(128 + (im - ref) * diff[1], 0, 255).astype(np.uint8)
    sheet.paste(Image.fromarray(dd).resize((w * z, h * z), Image.NEAREST), (X, h * z + 36))
sheet.save(out)

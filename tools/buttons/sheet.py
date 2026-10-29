# sheet.py <recdir> <out.png> t1 t2 ...: picks the frame nearest each time (s) from timeline.tsv and tiles them in a
# column, labelled with the time and the latest event before it. Optional --zoom N scales up (nearest).
import sys, os
from PIL import Image, ImageDraw
args = sys.argv[1:]
zoom = 1
if '--zoom' in args: i = args.index('--zoom'); zoom = int(args[i + 1]); del args[i:i + 2]
d, out, times = args[0], args[1], [float(t) for t in args[2:]]
frames, events = [], []
for line in open(os.path.join(d, 'timeline.tsv')):
  p = line.split()
  if p[0] == 'frame': frames.append((float(p[2]), int(p[1])))
  else: events.append((float(p[4]), p[1], p[2], p[3]))
tiles = []
for t in times:
  ft, fi = min(frames, key=lambda f: abs(f[0] - t))
  ev = [e for e in events if e[0] <= ft]
  label = '%.2fs  %s' % (ft, ('%s @%s,%s' % ev[-1][1:]) if ev else '')
  im = Image.open(os.path.join(d, 'f%04d.png' % fi)).convert('RGB')
  if zoom > 1: im = im.resize((im.width * zoom, im.height * zoom), Image.NEAREST)
  tiles.append((label, im))
W = max(im.width for _, im in tiles); H = sum(im.height + 22 for _, im in tiles)
sheet = Image.new('RGB', (W, H), (255, 255, 255)); dr = ImageDraw.Draw(sheet); y = 0
for label, im in tiles:
  dr.text((4, y + 4), label, fill=(0, 0, 0)); sheet.paste(im, (0, y + 22)); y += im.height + 22
sheet.save(out)

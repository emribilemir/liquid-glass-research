# compare.py <music recdir> <copy recdir> cx cy [halfw halfh]: for each scripted step (matched by order), the settled
# state just before the next step in both recordings: outline size, centre offset and brightness inside the left part.
import sys, os, subprocess
a = sys.argv[1:]; extra = a[4:6]
def run(d):
  rows = [l.split() for l in open(os.path.join(d, 'timeline.tsv'))]
  ev = [(float(p[4]), p[1], p[2], p[3]) for p in rows if p[0] == 'event']
  g = subprocess.run([sys.executable, os.path.join(os.path.dirname(__file__), 'geom.py'), d, a[2], a[3], '1', *(extra or ['36', '36'])], capture_output=True, text=True).stdout
  st = [(float(l.split()[0]), l.split()) for l in g.splitlines() if not l.startswith('   --')]
  out = []
  for k, e in enumerate(ev):
    nxt = ev[k + 1][0] if k + 1 < len(ev) else st[-1][0] + 0.01
    s = max((x for x in st if x[0] < nxt - 0.02), key=lambda x: x[0])[1]
    out.append((e[1] + ' @' + e[2] + ',' + e[3], float(s[2]), float(s[4]), float(s[14]), float(s[15]), float(s[17])))
  return out
m, c = run(a[0]), run(a[1])
print('%-24s %22s   %22s' % ('step (settled)', 'Music w h dx dy light', 'copy w h dx dy light'))
for x, y in zip(m, c): print('%-24s %5.1f %5.1f %+4.1f %+4.1f %5.1f   %5.1f %5.1f %+4.1f %+4.1f %5.1f' % (x[0], *x[1:], *y[1:]))

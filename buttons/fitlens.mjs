// Fits the lens (lens.js, the player's glass) at button sizes against macOS's glass captured by tools/buttons/BtnLab:
// a 36pt circle at (78,8) and a 73x36pt capsule at (140,8) over research/buttons/fit/bg/*.png (240x110pt, 2x),
// references in research/buttons/fit/lab/. Error: mean abs per channel inside each shape and 3px around it.
//   node buttons/fitlens.mjs eval '<json overrides>' [outdir]
//   node buttons/fitlens.mjs fit  '<json overrides>' [param,...]   coordinate descent over the listed params
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url)), root = path.join(here, '..');
const fitdir = process.env.FITDIR ? path.resolve(process.env.FITDIR) : path.join(root, 'research/buttons/fit');
const names = (process.env.PATTERNS || fs.readdirSync(path.join(fitdir, 'lab')).filter(f => f.endsWith('.png')).map(f => f.slice(0, -4)).join(',')).split(',');
const weights = { 'music-back': 4, scene: 3, grid: 2, checker: 2, vstripes: 2, hstripes: 2 };

function png(buf) {
  let i = 8, idat = [], w, h, ct;
  while (i < buf.length) { const l = buf.readUInt32BE(i), t = buf.toString('ascii', i + 4, i + 8), c = buf.subarray(i + 8, i + 8 + l); if (t === 'IHDR') { w = c.readUInt32BE(0); h = c.readUInt32BE(4); ct = c[9]; } if (t === 'IDAT') idat.push(c); i += 12 + l; }
  const raw = zlib.inflateSync(Buffer.concat(idat)), bpp = ct === 6 ? 4 : 3, stride = w * bpp, out = new Uint8Array(w * h * 3);
  let prev = new Uint8Array(stride), p = 0;
  for (let y = 0; y < h; y++) { const f = raw[p], line = Uint8Array.from(raw.subarray(p + 1, p + 1 + stride)); p += 1 + stride;
    for (let j = 0; j < stride; j++) { const a = j >= bpp ? line[j - bpp] : 0, b = prev[j], c = j >= bpp ? prev[j - bpp] : 0;
      if (f === 1) line[j] = (line[j] + a) & 255; else if (f === 2) line[j] = (line[j] + b) & 255; else if (f === 3) line[j] = (line[j] + ((a + b) >> 1)) & 255;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); line[j] = (line[j] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255; } }
    for (let x = 0; x < w; x++) for (let k = 0; k < 3; k++) out[(y * w + x) * 3 + k] = line[x * bpp + k];
    prev = line; }
  return { w, h, d: out };
}
const lab = Object.fromEntries(names.map(n => [n, png(fs.readFileSync(path.join(fitdir, 'lab', n + '.png')))]));
const bgs = Object.fromEntries(names.map(n => [n, 'data:image/png;base64,' + fs.readFileSync(path.join(fitdir, 'bg', n + '.png')).toString('base64')]));
// Shapes in device px: distance outside each shape (<= 3px counts), from its centre line.
// SHAPES='[[x,y,w,h],...]' (pt) for another geometry, e.g. the player: [[40,40,701,54]] over research/buttons/player-out.
const shapeList = JSON.parse(process.env.SHAPES || '[[78,8,36,36],[140,8,73,36]]'), shapes = shapeList.map(([x, y, w, h]) => ({ x, y, w, h }));
const first = png(fs.readFileSync(path.join(fitdir, 'lab', names[0] + '.png'))), W = first.w, H = first.h, region = new Int8Array(W * H).fill(-1);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) shapes.forEach((s, k) => {
  const px = (x + .5) / 2, py = (y + .5) / 2, r = s.h / 2, cx = Math.min(s.x + s.w - r, Math.max(s.x + r, px)), d = Math.hypot(px - cx, py - (s.y + r)) - r;
  if (d * 2 <= 3) region[y * W + x] = k * 2 + (d <= 0 ? 0 : 1);
});
function error(a, b) {
  const sums = shapes.flatMap(() => [0, 0]), counts = shapes.flatMap(() => [0, 0]);
  for (let i = 0; i < W * H; i++) { const k = region[i]; if (k < 0) continue; let e = 0; for (let c = 0; c < 3; c++) e += Math.abs(a.d[i * 3 + c] - b.d[i * 3 + c]); sums[k] += e / 3; counts[k]++; }
  return sums.map((s, k) => s / counts[k]);
}

const css = fs.readFileSync(path.join(here, 'glass-buttons.css'), 'utf8'), lens = fs.readFileSync(path.join(here, 'lens.js'), 'utf8');
const browser = await chromium.launch(process.env.PWB ? { executablePath: process.env.PWB } : { channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: W / 2, height: H / 2 }, deviceScaleFactor: 2 });
await page.setContent(`<!doctype html><style>html,body{margin:0;background:#000}${css}${process.env.EXTRA_CSS || ""}</style><img id="bg" style="position:absolute;left:0;top:0;width:${W / 2}px;height:${H / 2}px"><div id="shapes"></div><script>${lens}</script>`);
await page.evaluate(shapeList => {
  window.build = over => {
    document.querySelectorAll('svg[aria-hidden] filter[id^=lg-lens]').forEach(f => f.remove());
    const host = document.getElementById('shapes'); host.textContent = '';
    for (const s of shapeList) {
      // As glass-buttons.js: the shape box holds the rim; the face (the lens) is larger by the margin of page it reads.
      const box = document.createElement('div'), f = document.createElement('div'), m = over.margin || 0; f.className = 'lg-glass-face';
      Object.assign(box.style, { position: 'absolute', left: s[0] + 'px', top: s[1] + 'px', width: s[2] + 'px', height: s[3] + 'px', isolation: 'isolate' });
      f.style.inset = -m + 'px'; box.append(f); host.append(box); lgRim(box); lgLens(f, over);
    }
  };
}, shapeList);
async function render(over, name) {
  await page.evaluate(([src, over]) => new Promise((res, rej) => { const img = document.getElementById('bg'); img.onload = () => { try { build(over) } catch (e) { rej(e) } requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(res, 30))); }; img.src = src; }), [bgs[name], over]);
  return page.screenshot({ type: 'png' });
}
async function score(over, outdir) {
  const parts = {}; let total = 0, wsum = 0;
  for (const n of names) {
    const shot = await render(over, n); if (outdir) fs.writeFileSync(path.join(outdir, n + '.png'), shot);
    const e = error(png(shot), lab[n]); parts[n] = e.map(v => +v.toFixed(2));
    const w = weights[n] || 1; total += w * e.reduce((a, b) => a + b, 0) / e.length; wsum += w;
  }
  return { total: total / wsum, parts };
}

const [mode, json = '{}', arg] = process.argv.slice(2);
let over = JSON.parse(json);
if (mode === 'eval') {
  if (arg) fs.mkdirSync(arg, { recursive: true });
  const s = await score(over, arg); console.log('total', s.total.toFixed(3)); for (const [n, e] of Object.entries(s.parts)) console.log(n.padEnd(12), e.join('  '));
} else if (mode === 'fit') {
  const base = { pre: .4, darken: .7, darkenBlur: 13.5, gain: 1.05, lensA: 1.01, lensH: .495, highlightTo: 2, highlightPow: 3.5, pageMix: .65, thinMix: .3, hlScale: 1, toneLift: 0 };
  const params = (arg || 'lensA,lensH,pre,darken,darkenBlur,gain,hlScale,highlightPow').split(',');
  const apply = o => { const r = { ...o }; if (o.hlScale !== undefined) r.highlight = [.13, .085, .032, .019, .014, .011, .009, .007, .005, .004, .003, .002, .001, .0005, 0].map(v => v * o.hlScale); delete r.hlScale; delete r.toneLift; return r; };
  over = { ...base, ...over };
  for (const f of (arg || '').split(',')) if (f && over[f] === undefined) over[f] = 1;
  let best = await score(apply(over)); console.log('start', best.total.toFixed(3));
  for (let round = 0; round < (+process.env.ROUNDS || 3); round++) for (const f of params) {
    let step = Math.abs(over[f]) * .15 || .05;
    for (let tries = 0; tries < 6; tries++) {
      let moved = false;
      for (const dir of [1, -1]) {
        const q = { ...over, [f]: +(over[f] + dir * step).toFixed(4) }, s = await score(apply(q));
        if (s.total < best.total - 1e-3) { over = q; best = s; moved = true; console.log(round, f, q[f], best.total.toFixed(3)); break; }
      }
      if (!moved) step /= 2;
    }
  }
  console.log('best', best.total.toFixed(3), JSON.stringify(over));
}
await browser.close();

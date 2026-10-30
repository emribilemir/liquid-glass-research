// Apple Music's player against mcloud's, over Music's own focused frames (research/fit/bg/mf*.png = the page behind
// the player, research/fit/apple/mf*.png = Music's frame; player 701x54pt at x 40, top 40.5).
//   node buttons/player.mjs <outdir> [variant...]      variants: mcloud | new | lens3 (default mcloud, new)
// mcloud: the player as shipped on mcloud's research branch, built from the same functions (lens.js): two layers,
// ::before bends (#am-glass-bend), ::after does the rest (#am-glass), a 1px transparent border, the CSS hairline.
// new: the same two layers 12pt larger with the edge read (the page past the edge), the colour gain by luminance
// (gainL), the hue-keeping highlight and the hairline from the page under it (lgRimF, w 0.8). Prints the error (mean abs per channel) by region; Music's
// icons are masked: only x in the outer 13pt of each end and the glyph-free stretches of the middle count.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url)), root = path.join(here, '..');
const [out = 'player-out', ...vs] = process.argv.slice(2), variants = vs.length ? vs : ['mcloud', 'new'];
fs.mkdirSync(out, { recursive: true });
const frames = fs.readdirSync(path.join(root, 'research/fit/apple')).filter(f => /^mf\d+\.png$/.test(f)).map(f => f.slice(0, -4));
const tone = JSON.parse(fs.readFileSync(path.join(root, 'research/buttons/tone.json'), 'utf8'));
const button = JSON.parse(fs.readFileSync(path.join(root, 'research/buttons/params-button.json'), 'utf8'));
// The new variant: the player's own fitted look, plus what the buttons showed macOS's glass does.
const newState = { hlHue: true, margin: 12, outerDist: 11.5, outerBlur: 3, outerMix: button.outerMix, outerEnd: button.outerEnd, outerW: button.outerW,
  washBlur: button.washBlur, washMix: 0, washLocal: button.washLocal, pageMix: 0, gainL: tone.gainL, ...JSON.parse(process.env.OVER || '{}') };

function png(buf) {
  let i = 8, idat = [], w, h, ct;
  while (i < buf.length) { const l = buf.readUInt32BE(i), t = buf.toString('ascii', i + 4, i + 8), c = buf.subarray(i + 8, i + 8 + l); if (t === 'IHDR') { w = c.readUInt32BE(0); h = c.readUInt32BE(4); ct = c[9]; } if (t === 'IDAT') idat.push(c); i += 12 + l; }
  const raw = zlib.inflateSync(Buffer.concat(idat)), bpp = ct === 6 ? 4 : 3, stride = w * bpp, o = new Uint8Array(w * h * 3);
  let prev = new Uint8Array(stride), p = 0;
  for (let y = 0; y < h; y++) { const f = raw[p], line = Uint8Array.from(raw.subarray(p + 1, p + 1 + stride)); p += 1 + stride;
    for (let j = 0; j < stride; j++) { const a = j >= bpp ? line[j - bpp] : 0, b = prev[j], c = j >= bpp ? prev[j - bpp] : 0;
      if (f === 1) line[j] = (line[j] + a) & 255; else if (f === 2) line[j] = (line[j] + b) & 255; else if (f === 3) line[j] = (line[j] + ((a + b) >> 1)) & 255;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); line[j] = (line[j] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255; } }
    for (let x = 0; x < w; x++) for (let k = 0; k < 3; k++) o[(y * w + x) * 3 + k] = line[x * bpp + k];
    prev = line; }
  return { w, h, d: o };
}
// Regions in device px: distance to the pill's edge d (negative inside). Columns: Music's icons excluded.
// Music's player sits at 40.5pt; Chromium snaps a filtered layer to whole CSS px but not its clip-path, which moved
// the lens maps a device pixel off the visible glass. So the page is drawn 0.5pt higher, the player at 40, and Music's
// frame is read one device row lower (SHIFT=0 turns this off).
// Music's dark rim pixels sit at x 80 and 1481: its player is 700pt wide from 40.5 (mcloud rounds to even widths too),
// so the page also moves 0.5pt left and Music's frame is read one device column further right.
const SHIFT = process.env.SHIFT === '0' ? 0 : 1, X = 40.5 - SHIFT / 2, Y = 40.5 - SHIFT / 2, BW = +(process.env.BW || 700), BH = 54, R = BH / 2;
const cols = x => x < 106 || x >= 1456 || (x >= 420 && x < 700) || (x >= 860 && x < 1180);
function regions(W, H) {
  const reg = new Int8Array(W * H).fill(-1);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!cols(x)) continue;
    const px = (x + .5) / 2, py = (y + .5) / 2, cx = Math.min(X + BW - R, Math.max(X + R, px)), d = (Math.hypot(px - cx, py - (Y + R)) - R) * 2;
    reg[y * W + x] = d > 4 ? -1 : d > 0 ? 2 : d > -6 ? 1 : 0;   // 0 inside, 1 the outer 3pt of the glass, 2 the 2pt outside
  }
  return reg;
}
const names = ['inside', 'edge 3pt', 'outside 2pt'];

const lens = fs.readFileSync(path.join(here, 'lens.js'), 'utf8'), css = fs.readFileSync(path.join(here, 'glass-buttons.css'), 'utf8');
const browser = await chromium.launch(process.env.PWB ? { executablePath: process.env.PWB } : { channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 781, height: 113 }, deviceScaleFactor: 2 });
await page.setContent(`<!doctype html><style>html,body{margin:0;background:#000}${css}
#p{position:absolute;left:${X}px;top:${Y}px;width:${BW}px;height:${BH}px;box-sizing:border-box;border:1px solid transparent;border-radius:999px;z-index:1;box-shadow:0 4px 8px #00000005}
#p.mcloud::before,#p.mcloud::after{content:'';position:absolute;inset:-1px;z-index:-1;border-radius:inherit;pointer-events:none}
#p.mcloud::before{backdrop-filter:url(#am-glass-bend)}#p.mcloud::after{backdrop-filter:url(#am-glass)}
.am-glass-rim{position:absolute;inset:calc(-1px - var(--am-hair,.5px));z-index:-1;border-radius:999px;border:var(--am-hair,.5px) solid #0000008c;pointer-events:none;-webkit-mask-image:linear-gradient(90deg,#000,#0000006c 6.9px,#00000020 13.75px,#00000004 20.6px,#0000 27.5px,#0000 calc(100% - 27.5px),#00000004 calc(100% - 20.6px),#00000020 calc(100% - 13.75px),#0000006c calc(100% - 6.9px),#000)}
.layer{position:absolute;pointer-events:none;z-index:-1}
#p .lg-glass-rimf{inset:-2px}#p .lg-glass-rim{z-index:${process.env.RIMZ || 0};--lg-rim:${process.env.RIM || .45};--lg-rim-w:${process.env.RIMW || 1};--lg-rim-o:${process.env.RIMO || .5};inset:-2px;width:calc(100% + 4px);height:calc(100% + 4px);-webkit-mask-image:linear-gradient(90deg,#000,#0000006c 7.75px,#00000020 14.5px,#00000004 21.25px,#0000 28px,#0000 calc(100% - 28px),#00000004 calc(100% - 21.25px),#00000020 calc(100% - 14.5px),#0000006c calc(100% - 7.75px),#000)}
</style><img id="bg" style="position:absolute;left:${-SHIFT / 2}px;top:${-SHIFT / 2}px;width:781px;height:113px"><div id="p"></div><script>${lens}</script>`);
await page.evaluate(([newState, rimf]) => {
  const { glassFilter, glassLens, glassStates, svg } = lgGlassInternals;
  if (!svg.isConnected) document.body.append(svg);
  window.build = variant => {
    const p = document.getElementById('p'); p.textContent = ''; p.className = variant;
    svg.querySelectorAll('filter[id^=am-glass]').forEach(f => f.remove());
    if (variant === 'mcloud') {
      // mcloud's playerGlass(): the two filters, exact on whole-pixel screens; glassLens(player, {...focused, line: 0}).
      p.style.setProperty('--am-hair', 1 / devicePixelRatio + 'px');
      svg.insertAdjacentHTML('afterbegin', glassFilter('am-glass-bend', glassStates.focused, 'bend', true) + glassFilter('am-glass', glassStates.focused, 'face', true));
      p.append(Object.assign(document.createElement('div'), { className: 'am-glass-rim' }));
      glassLens(p, { ...glassStates.focused, line: 0 }, ['am-glass-bend', 'am-glass']);
    } else if (variant === 'lens3') {
      // As mcloud ships it: lgLens's three layers (bend, mid, tone) in a face 12pt larger than the border box.
      const face = document.createElement('div'), m = newState.margin; face.className = 'lg-glass-face'; Object.assign(face.style, { position: 'absolute', inset: `${-1 - m}px`, zIndex: '-1' });
      p.append(face); lgLens(face, { state: 'focused', ...newState }); lgRimF(p, rimf);
    } else {
      const state = { ...glassStates.focused, line: 0, ...newState }, m = state.margin;
      svg.insertAdjacentHTML('afterbegin', glassFilter('am-glass-bend', state, 'bend', true) + glassFilter('am-glass', state, 'face', true));
      const layers = ['am-glass-bend', 'am-glass'].map(id => { const l = document.createElement('div'); l.className = 'layer';
        Object.assign(l.style, { inset: `${-1 - m}px`, clipPath: `inset(${m}px round 999px)`, backdropFilter: `url(#${id})` }); p.append(l); return l; });
      if (rimf) lgRimF(p, rimf); else lgRim(p); glassLens(layers[0], state, ['am-glass-bend', 'am-glass']);
    }
  };
}, [newState, JSON.parse(process.env.RIMF || '{"w":0.8,"s":0.8}')]);

const sums = {};
for (const variant of variants) {
  const acc = names.map(() => [0, 0]);
  for (const f of frames) {
    const bg = 'data:image/png;base64,' + fs.readFileSync(path.join(root, 'research/fit/bg', f + '.png')).toString('base64');
    await page.evaluate(([src, v]) => new Promise((res, rej) => { const img = document.getElementById('bg'); img.onload = () => { try { build(v) } catch (e) { rej(e) } requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(res, 50))); }; img.src = src; }), [bg, variant]);
    const shot = await page.screenshot({ type: 'png' }); fs.writeFileSync(path.join(out, `${variant}-${f}.png`), shot);
    const a = png(shot), b = png(fs.readFileSync(path.join(root, 'research/fit/apple', f + '.png'))), reg = regions(a.w, a.h);
    for (let i = 0; i < a.w * (a.h - SHIFT) - SHIFT; i++) { const k = reg[i]; if (k < 0) continue; const j = i + SHIFT * a.w + SHIFT; let e = 0; for (let c = 0; c < 3; c++) e += Math.abs(a.d[i * 3 + c] - b.d[j * 3 + c]); acc[k][0] += e / 3; acc[k][1]++; }
  }
  sums[variant] = acc.map(([s, n]) => s / n);
  console.log(variant.padEnd(7), names.map((n, k) => `${n} ${sums[variant][k].toFixed(2)}`).join('   '));
}
await browser.close();

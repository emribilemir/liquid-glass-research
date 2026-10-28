// The glass split over stacked layers (live Spotify, debug port 9229). An SVG filter recomputes a result for every
// primitive that reads it (measured: k self-averaging steps cost 2^k), so the shipped #am-glass runs its bend ~6 times
// a frame. Here the bend is one layer and the rest reads it as a backdrop (a texture: cheap to read many times).
//   base     the shipped filter on #am-player
//   split    layer 1 = bend, layer 2 = darken + tone + highlight (same picture, to check)
//   splitAA  split + in layer 2: a vertical blur where the bend magnifies, and the darken result mixed in near the rim
//   splitAAn splitAA with the blur along the edge normal (vertical on the straight edges, sideways toward the ends)
//   oneAA    the same AA in the single filter (the expensive way)
// MODES, N as in ab3. SHOT=1 saves base/split crops of the player (children hidden) and prints their difference.
import { createRequire } from 'module'; import fs from 'fs';
const require = createRequire('/Users/emirbilici/mcloud/');
const { chromium } = require('playwright');
const browser = await chromium.connectOverCDP('http://127.0.0.1:9229');
const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('xpui'));
await page.evaluate(() => Spicetify.Platform.History.push('/')); await page.waitForTimeout(2500);
await page.evaluate(() => {
  const P = document.getElementById('am-player'), f = document.getElementById('am-glass'), base = f.innerHTML, svg = f.ownerSVGElement;
  const R = P.getBoundingClientRect(), w = R.width, h = R.height, k = devicePixelRatio, W = Math.round(w * k), H = Math.round(h * k), r = h / 2;
  const mask = fn => { const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'), d = x.createImageData(W, H);
    for (let y = 0; y < H; y++) for (let X = 0; X < W; X++) { const px = (X + .5) / k, py = (y + .5) / k, dx = Math.min(w - r, Math.max(r, px)) - px, dy = r - py, e = Math.max(0, r - Math.hypot(dx, dy)), i = (y * W + X) * 4; d.data[i] = d.data[i + 1] = d.data[i + 2] = 255; d.data[i + 3] = Math.round(255 * fn(e)); }
    x.putImageData(d, 0, 0); return name => `<feImage result="${name}" preserveAspectRatio="none" width="${w}" height="${h}" href="${c.toDataURL()}"/>`; };
  const A = r, Hh = r / 2, comp = e => { const t = Math.min(1, e / Hh); if (t >= 1) return 1; return Math.abs(1 - A / Hh * (1 - t) / Math.sqrt(Math.max(1e-4, t * (2 - t)))); };
  const magN = (e, ny2) => Math.min(1, Math.max(0, (1 / Math.max(comp(e), .05) - 1) / 2)), maskN = fn => { const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'), d = x.createImageData(W, H);
    for (let y = 0; y < H; y++) for (let X = 0; X < W; X++) { const px = (X + .5) / k, py = (y + .5) / k, dx = Math.min(w - r, Math.max(r, px)) - px, dy = r - py, l = Math.hypot(dx, dy) || 1, e = Math.max(0, r - l), i = (y * W + X) * 4; d.data[i] = d.data[i + 1] = d.data[i + 2] = 255; d.data[i + 3] = Math.round(255 * fn(e, (dy / l) ** 2)); }
    x.putImageData(d, 0, 0); return name => `<feImage result="${name}" preserveAspectRatio="none" width="${w}" height="${h}" href="${c.toDataURL()}"/>`; };
  const magV = maskN((e, ny2) => magN(e) * ny2)('amv'), magH = maskN((e, ny2) => magN(e) * (1 - ny2))('amh');
  const magnify = mask(e => Math.min(1, Math.max(0, (1 / Math.max(comp(e), .05) - 1) / 2)))('am1'), rimDark = mask(e => { const u = Math.min(1, e / 12); return .6 * (1 - u * u * (3 - 2 * u)); })('am2');
  const parse = html => { const t = document.createElement('div'); t.innerHTML = '<svg>' + html + '</svg>'; return t.firstChild; };
  const after = (el, html) => { let ref = el; for (const n of [...parse(html).childNodes]) { ref.after(n); ref = n; } };
  // Layer 1: everything up to the bend. Layer 2: the rest, reading the backdrop (layer 1's result) where it read "core".
  const s1 = parse(base), d1 = s1.querySelector('feDisplacementMap'); while (d1.nextElementSibling) d1.nextElementSibling.remove();
  const s2 = parse(base), d2 = s2.querySelector('feDisplacementMap'); let n = d2.nextElementSibling; const first = n;
  for (let e = d2; e; ) { const prev = e.previousElementSibling; if (e.tagName !== 'feImage') e.remove(); e = prev; }
  if (!first.getAttribute('in')) first.setAttribute('in', 'SourceGraphic');
  s2.querySelectorAll('[in="core"],[in2="core"]').forEach(e => { if (e.getAttribute('in') === 'core') e.setAttribute('in', 'SourceGraphic'); if (e.getAttribute('in2') === 'core') e.setAttribute('in2', 'SourceGraphic'); });
  const withAA = (s, src, normal) => { const fst = [...s.children].find(e => e.tagName !== 'feImage');
    const pre = normal ? `<feGaussianBlur in="${src}" stdDeviation="0 1" edgeMode="duplicate" result="pb"/><feGaussianBlur in="${src}" stdDeviation="1 0" edgeMode="duplicate" result="pbh"/>` + magV + magH + `<feComposite in="pb" in2="amv" operator="in" result="pm"/><feComposite in="pbh" in2="amh" operator="in" result="pmh"/><feComposite in="pm" in2="${src}" operator="over" result="c1"/><feComposite in="pmh" in2="c1" operator="over" result="core"/>`
      : `<feGaussianBlur in="${src}" stdDeviation="0 1" edgeMode="duplicate" result="pb"/>` + magnify + `<feComposite in="pb" in2="am1" operator="in" result="pm"/><feComposite in="pm" in2="${src}" operator="over" result="core"/>`;
    const t = parse(pre); for (const c of [...t.childNodes]) fst.before(c);
    s.querySelectorAll('[in="SourceGraphic"],[in2="SourceGraphic"]').forEach(e => { if (['pb', 'pbh', 'core', 'c1'].includes(e.getAttribute('result'))) return; if (e.getAttribute('in') === 'SourceGraphic') e.setAttribute('in', 'core'); if (e.getAttribute('in2') === 'SourceGraphic') e.setAttribute('in2', 'core'); });
    if (fst.getAttribute('in') === 'SourceGraphic') fst.setAttribute('in', 'core');
    const bl = s.querySelector('feBlend'); bl.setAttribute('result', 'dk'); const dc = bl.nextElementSibling; dc.setAttribute('in2', 'dk'); dc.setAttribute('result', 'dk2');
    after(dc, rimDark + '<feComposite in="dk" in2="am2" operator="in" result="bm"/><feComposite in="bm" in2="dk2" operator="over"/>'); return s; };
  const mk = (id, html) => { let e = document.getElementById(id); if (!e) { e = document.createElementNS('http://www.w3.org/2000/svg', 'filter'); e.id = id; for (const a of ['x', 'y', 'width', 'height', 'color-interpolation-filters']) e.setAttribute(a, f.getAttribute(a)); svg.append(e); } e.innerHTML = html; };
  mk('am-x1', s1.innerHTML); mk('am-x2', s2.innerHTML); mk('am-x2aa', withAA(parse(s2.innerHTML), 'SourceGraphic').innerHTML); mk('am-x2aan', withAA(parse(s2.innerHTML), 'SourceGraphic', 1).innerHTML);
  const one = parse(base), dd = one.querySelector('feDisplacementMap'); dd.setAttribute('result', 'bent'); one.querySelectorAll('[in="core"],[in2="core"]').forEach(e => { if (e.getAttribute('in') === 'core') e.setAttribute('in', 'bent'); if (e.getAttribute('in2') === 'core') e.setAttribute('in2', 'bent'); });
  { const nx = dd.nextElementSibling; if (!nx.getAttribute('in')) nx.setAttribute('in', 'bent'); }
  { const t = parse(`<feGaussianBlur in="bent" stdDeviation="0 1" edgeMode="duplicate" result="pb"/>` + magnify + `<feComposite in="pb" in2="am1" operator="in" result="pm"/><feComposite in="pm" in2="bent" operator="over" result="core2"/>`); let ref = dd; for (const c of [...t.childNodes]) { ref.after(c); ref = c; } }
  one.querySelectorAll('[in="bent"],[in2="bent"]').forEach(e => { if (['pb', 'pm', 'core2'].includes(e.getAttribute('result'))) return; if (e.getAttribute('in') === 'bent') e.setAttribute('in', 'core2'); if (e.getAttribute('in2') === 'bent') e.setAttribute('in2', 'core2'); });
  const bl1 = one.querySelector('feBlend'); bl1.setAttribute('result', 'dk'); const dc1 = bl1.nextElementSibling; dc1.setAttribute('in2', 'dk'); dc1.setAttribute('result', 'dk2'); after(dc1, rimDark + '<feComposite in="dk" in2="am2" operator="in" result="bm"/><feComposite in="bm" in2="dk2" operator="over"/>');
  mk('am-xone', one.innerHTML);
  const layer = id => { const e = document.createElement('div'); e.id = id; e.style.cssText = `position:fixed;left:${R.left}px;top:${R.top}px;width:${w}px;height:${h}px;border-radius:999px;z-index:59;pointer-events:none;display:none`; document.body.append(e); return e; };
  const L1 = layer('am-xl1'), L2 = layer('am-xl2');
  window.__set = m => { P.style.backdropFilter = m === 'base' ? '' : m === 'oneAA' ? 'url(#am-xone)' : 'none'; const sp = m.startsWith('split'); L1.style.display = L2.style.display = sp ? '' : 'none';
    L1.style.backdropFilter = 'url(#am-x1)'; L2.style.backdropFilter = m === 'splitAAn' ? 'url(#am-x2aan)' : m === 'splitAA' ? 'url(#am-x2aa)' : 'url(#am-x2)'; };
  window.__rect = { x: R.left, y: R.top, width: w, height: h };
});
const run = () => page.evaluate(async () => { const v = document.querySelector('.main-view-container__scroll-node > [data-overlayscrollbars-viewport]'), start = v.scrollTop, times = [];
  await new Promise(res => { let last = performance.now(), t0 = last; const step = now => { times.push(now - last); last = now; v.scrollTop = start + Math.sin((now - t0) / 400) * 300 + 300; if (now - t0 < 3000) requestAnimationFrame(step); else res(); }; requestAnimationFrame(step); });
  v.scrollTop = start; times.sort((a, b) => a - b); return { p95: +times[Math.floor(times.length * .95)].toFixed(1), drops: times.filter(t => t > 20).length, n: times.length }; });
if (process.env.SHOT) {
  const rect = await page.evaluate(() => window.__rect), out = process.env.SHOT;
  await page.evaluate(() => { for (const c of document.getElementById('am-player').children) c.style.visibility = 'hidden'; });
  for (const m of ['base', 'split', 'splitAA', 'oneAA']) { await page.evaluate(m => window.__set(m), m); await page.waitForTimeout(600); fs.writeFileSync(`${out}/${m}.png`, await page.screenshot({ clip: { x: rect.x - 8, y: rect.y - 8, width: rect.width + 16, height: rect.height + 16 } })); }
  await page.evaluate(() => { for (const c of document.getElementById('am-player').children) c.style.visibility = ''; window.__set('base'); });
} else {
  const modes = (process.env.MODES || 'base,split,splitAA,oneAA').split(','), res = Object.fromEntries(modes.map(m => [m, []]));
  for (let k = 0; k < +(process.env.N || 5); k++) for (const mode of modes) { await page.evaluate(m => window.__set(m), mode); await page.waitForTimeout(1500); res[mode].push(await run()); }
  await page.evaluate(() => window.__set('base'));
  for (const m of modes) { const r = res[m]; console.log(m.padEnd(8), 'drops', r.map(x => x.drops).join(' '), ' total', r.reduce((a, b) => a + b.drops, 0), ' p95', r.map(x => x.p95).join(' '), ' frames', r.map(x => x.n).join(' ')); }
}
await browser.close().catch(() => {});

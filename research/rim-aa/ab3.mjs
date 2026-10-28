// Frame cost of rim variants in the live Spotify client (debug port 9229), built from the theme's own #am-glass:
//   base     the shipped filter
//   bleed    + a mask feImage and two composites mixing toward the darken halo near the rim
//   mip      + one blurred copy of the page, displaced again, mixed in by a mask
//   post     + one blur after the bend, mixed in by a mask
//   final    the research candidate (vertical blur where the bend magnifies + darkening near the rim)
//   collapse - the map build (3 feImage + 2 feColorMatrix + feComposite -> 1 feImage used as the map): cost probe only,
//              the picture is wrong
// MODES=base,bleed,... N=rounds. Each run: 3s sinusoidal scroll of the home page; frames > 20ms and p95.
import { createRequire } from 'module';
const require = createRequire('/Users/emirbilici/mcloud/');
const { chromium } = require('playwright');
const browser = await chromium.connectOverCDP('http://127.0.0.1:9229');
const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('xpui'));
await page.evaluate(() => Spicetify.Platform.History.push('/')); await page.waitForTimeout(2500);
await page.evaluate(() => {
  const f = document.getElementById('am-glass'), base = f.innerHTML, ns = 'http://www.w3.org/2000/svg';
  const { width: w, height: h } = document.getElementById('am-player').getBoundingClientRect(), k = devicePixelRatio, W = Math.round(w * k), H = Math.round(h * k), r = h / 2;
  const mask = fn => { const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'), d = x.createImageData(W, H);
    for (let y = 0; y < H; y++) for (let X = 0; X < W; X++) { const px = (X + .5) / k, py = (y + .5) / k, dx = Math.min(w - r, Math.max(r, px)) - px, dy = r - py, e = Math.max(0, r - Math.hypot(dx, dy)), i = (y * W + X) * 4; d.data[i] = d.data[i + 1] = d.data[i + 2] = 255; d.data[i + 3] = Math.round(255 * fn(e)); }
    x.putImageData(d, 0, 0); return name => `<feImage result="${name}" preserveAspectRatio="none" width="${w}" height="${h}" href="${c.toDataURL()}"/>`; };
  const A = r, Hh = r / 2, comp = e => { const t = Math.min(1, e / Hh); if (t >= 1) return 1; return Math.abs(1 - A / Hh * (1 - t) / Math.sqrt(Math.max(1e-4, t * (2 - t)))); };
  const squeeze = mask(e => Math.min(1, Math.max(0, (comp(e) - 1) / 2)))('mm'), rim = mask(e => { const u = Math.min(1, e / 7); return .3 * (1 - u * u * (3 - 2 * u)); })('mm');
  // The candidate: a vertical blur where the bend magnifies (by 1/c - 1, /2), and the darken result mixed in near the rim.
  const magnify = mask(e => Math.min(1, Math.max(0, (1 / Math.max(comp(e), .05) - 1) / 2)))('am1'), rimDark = mask(e => { const u = Math.min(1, e / 12); return .6 * (1 - u * u * (3 - 2 * u)); })('am2');
  const parse = () => { const t = document.createElement('div'); t.innerHTML = '<svg>' + base + '</svg>'; return t.firstChild; };
  const after = (s, el, html) => { const t = document.createElement('div'); t.innerHTML = '<svg>' + html + '</svg>'; let ref = el; for (const n of [...t.firstChild.childNodes]) { ref.after(n); ref = n; } };
  const disp = s => s.querySelector('feDisplacementMap'), V = window.__v = { base };
  let s = parse(); const dk = [...s.querySelectorAll('feComposite')].find(c => c.getAttribute('in') === 'core' && c.getAttribute('operator') === 'arithmetic'); dk.setAttribute('result', 'dk2');
  after(s, dk, rim + '<feComposite in="halo" in2="mm" operator="in" result="bm"/><feComposite in="bm" in2="dk2" operator="over"/>'); V.bleed = s.innerHTML;
  s = parse(); let d = disp(s); after(s, d, `<feGaussianBlur in="SourceGraphic" stdDeviation="1.2" edgeMode="duplicate" result="b1"/><feDisplacementMap in="b1" in2="map" scale="${d.getAttribute('scale')}" xChannelSelector="R" yChannelSelector="B" result="d1"/>` + squeeze + '<feComposite in="d1" in2="mm" operator="in" result="m1"/><feComposite in="m1" in2="core" operator="over" result="core"/>'); V.mip = s.innerHTML;
  s = parse(); d = disp(s); after(s, d, '<feGaussianBlur in="core" stdDeviation="1" edgeMode="duplicate" result="pb"/>' + squeeze + '<feComposite in="pb" in2="mm" operator="in" result="pm"/><feComposite in="pm" in2="core" operator="over" result="core"/>'); V.post = s.innerHTML;
  const final = s => { const d = disp(s); after(s, d, '<feGaussianBlur in="core" stdDeviation="0 1" edgeMode="duplicate" result="pb"/>' + magnify + '<feComposite in="pb" in2="am1" operator="in" result="pm"/><feComposite in="pm" in2="core" operator="over" result="core"/>');
    const bl = s.querySelector('feBlend'); bl.setAttribute('result', 'dk'); const dc = bl.nextElementSibling; dc.setAttribute('in2', 'dk'); dc.setAttribute('result', 'dk2');
    after(s, dc, rimDark + '<feComposite in="dk" in2="am2" operator="in" result="bm"/><feComposite in="bm" in2="dk2" operator="over"/>'); return s; };
  V.final = final(parse()).innerHTML;
  // Parts of the candidate, to find what costs: the magnified-zone blur alone (vertical, isotropic, nearly vertical), the rim darkening alone.
  const mag = sd => { const s = parse(), d = disp(s); after(s, d, `<feGaussianBlur in="core" stdDeviation="${sd}" edgeMode="duplicate" result="pb"/>` + magnify + '<feComposite in="pb" in2="am1" operator="in" result="pm"/><feComposite in="pm" in2="core" operator="over" result="core"/>'); return s.innerHTML; };
  // Does a result used twice get computed twice? k no-op steps, each averaging the previous result with itself: with
  // reuse the cost grows by k cheap composites; with recomputation the bend runs 2^k times.
  const fan = k => { const s = parse(), d = disp(s); let html = '', prev = 'core'; for (let j = 0; j < k; j++) { html += `<feComposite in="${prev}" in2="${prev}" operator="arithmetic" k2=".5" k3=".5" result="f${j}"/>`; prev = 'f' + j; } after(s, d, html + `<feComposite in="${prev}" in2="${prev}" operator="arithmetic" k2="1" result="core"/>`); return s.innerHTML; };
  V.fan2 = fan(2); V.fan4 = fan(4); V.fan6 = fan(6);
  V.magV = mag('0 1'); V.magIso = mag('1'); V.magNear = mag('0.05 1');
  { const s = parse(), bl = s.querySelector('feBlend'); bl.setAttribute('result', 'dk'); const dc = bl.nextElementSibling; dc.setAttribute('in2', 'dk'); dc.setAttribute('result', 'dk2'); after(s, dc, rimDark + '<feComposite in="dk" in2="am2" operator="in" result="bm"/><feComposite in="bm" in2="dk2" operator="over"/>'); V.darkOnly = s.innerHTML; }
  s = parse(); const imgs = s.querySelectorAll('feImage'); imgs[0].setAttribute('result', 'map'); imgs[1].remove(); [...s.querySelectorAll('feColorMatrix')].slice(0, 2).forEach(n => n.remove()); [...s.querySelectorAll('feComposite')].find(c => c.getAttribute('result') === 'map').remove(); V.collapse = s.innerHTML; V.finalCollapse = final(s).innerHTML;
});
const run = () => page.evaluate(async () => { const v = document.querySelector('.main-view-container__scroll-node > [data-overlayscrollbars-viewport]'), start = v.scrollTop, times = [];
  await new Promise(res => { let last = performance.now(), t0 = last; const step = now => { times.push(now - last); last = now; v.scrollTop = start + Math.sin((now - t0) / 400) * 300 + 300; if (now - t0 < 3000) requestAnimationFrame(step); else res(); }; requestAnimationFrame(step); });
  v.scrollTop = start; times.sort((a, b) => a - b); return { p95: +times[Math.floor(times.length * .95)].toFixed(1), drops: times.filter(t => t > 20).length, n: times.length }; });
const modes = (process.env.MODES || 'base,final,collapse,finalCollapse,mip').split(','), res = Object.fromEntries(modes.map(m => [m, []]));
for (let k = 0; k < +(process.env.N || 5); k++) for (const mode of modes) {
  await page.evaluate(m => { document.getElementById('am-glass').innerHTML = window.__v[m]; }, mode);
  await page.waitForTimeout(500); res[mode].push(await run());
}
await page.evaluate(() => { document.getElementById('am-glass').innerHTML = window.__v.base; });
for (const m of modes) { const r = res[m]; console.log(m.padEnd(9), 'drops', r.map(x => x.drops).join(' '), ' total', r.reduce((a, b) => a + b.drops, 0), ' p95', r.map(x => x.p95).join(' '), ' frames', r.map(x => x.n).join(' ')); }
await browser.close().catch(() => {});

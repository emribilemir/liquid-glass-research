import { createRequire } from 'module';
const require = createRequire('/Users/emirbilici/mcloud/');
const { chromium } = require('playwright');
const browser = await chromium.connectOverCDP('http://127.0.0.1:9229');
const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('xpui'));
await page.evaluate(() => Spicetify.Platform.History.push('/')); await page.waitForTimeout(2500);
await page.evaluate(() => { const f = document.getElementById('am-glass'); window.__v = { aa: f.innerHTML };
  const parse = () => { const t = document.createElement('div'); t.innerHTML = '<svg>' + f.innerHTML + '</svg>'; return t.firstChild; };
  const chain = s => { const b = [...s.querySelectorAll('feGaussianBlur')].find(b => b.getAttribute('in') === 'SourceGraphic' && b.getAttribute('stdDeviation') === '1'); const c = [b]; for (let k = 0; k < 4; k++) c.push(c[k].nextElementSibling); return c; };
  let s = parse(); chain(s).forEach(x => x.remove()); window.__v.noaa = s.innerHTML;
  // Caps only: run the AA chain in two small primitive subregions (left and right cap).
  const { width: W, height: H } = document.getElementById('am-player').getBoundingClientRect(), r = H / 2;
  s = parse(); const c = chain(s), over = c[4];
  for (const [side, x0] of [['L', 0], ['R', W - r - 1]]) {
    const parts = c.slice(0, 4).map(n => n.cloneNode(true));
    parts.forEach((n, k) => { n.setAttribute('x', k === 0 ? Math.max(0, x0 - 8) : x0); n.setAttribute('y', 0); n.setAttribute('width', (k === 0 ? r + 17 : r + 1)); n.setAttribute('height', H); });
    parts[3].setAttribute('result', 'aa' + side);
    const o = over.cloneNode(true); o.setAttribute('in', 'aa' + side);
    for (const n of [...parts, o]) over.parentNode.insertBefore(n, over);
  }
  c.forEach(x => x.remove()); window.__v.caps = s.innerHTML;
  // Post: soften the displaced result in the rim instead of displacing a second, blurred copy.
  s = parse(); const p = chain(s); p[0].setAttribute('in', 'core'); p[0].setAttribute('stdDeviation', '.6'); p[1].remove(); p[3].setAttribute('in', 'aaPost'); p[0].setAttribute('result', 'aaPost');
  window.__v.post = s.innerHTML; });
const run = () => page.evaluate(async () => { const v = document.querySelector('.main-view-container__scroll-node > [data-overlayscrollbars-viewport]'), start = v.scrollTop, times = [];
  await new Promise(res => { let last = performance.now(), t0 = last; const step = now => { times.push(now - last); last = now; v.scrollTop = start + Math.sin((now - t0) / 400) * 300 + 300; if (now - t0 < 3000) requestAnimationFrame(step); else res(); }; requestAnimationFrame(step); });
  v.scrollTop = start; times.sort((a, b) => a - b); return { p95: +times[Math.floor(times.length * .95)].toFixed(1), drops: times.filter(t => t > 20).length }; });
const modes = (process.env.MODES || 'noaa,aa,caps').split(','), res = Object.fromEntries(modes.map(m => [m, []]));
for (let k = 0; k < +(process.env.N || 5); k++) for (const mode of modes) {
  await page.evaluate(m => { document.getElementById('am-glass').innerHTML = window.__v[m]; }, mode);
  await page.waitForTimeout(400); res[mode].push(await run());
}
if (process.env.SHOW) await page.evaluate(m => { document.getElementById('am-glass').innerHTML = window.__v[m]; }, process.env.SHOW);
else await page.evaluate(() => { document.getElementById('am-glass').innerHTML = window.__v.aa; });
for (const m of modes) console.log(m, JSON.stringify(res[m]), 'drops total', res[m].reduce((a, b) => a + b.drops, 0));
await browser.close().catch(() => {});

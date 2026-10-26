import { createRequire } from 'module';
const require = createRequire('/Users/emirbilici/mcloud/');
const { chromium } = require('playwright');
const browser = await chromium.connectOverCDP('http://127.0.0.1:9229');
const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('xpui'));
await page.evaluate(() => Spicetify.Platform.History.push('/')); await page.waitForTimeout(2500);
// Keep a copy of the filter with and without the anti-aliasing pass.
await page.evaluate(() => { const f = document.getElementById('am-glass'); window.__withAA = f.innerHTML;
  const t = document.createElement('div'); t.innerHTML = '<svg>' + f.innerHTML + '</svg>'; const s = t.firstChild;
  const blurs = [...s.querySelectorAll('feGaussianBlur')].filter(b => b.getAttribute('in') === 'SourceGraphic' && b.getAttribute('stdDeviation') === '1');
  for (const b of blurs) { let n = b; const rm = [n]; for (let k = 0; k < 4; k++) { n = n.nextElementSibling; rm.push(n); } rm.forEach(x => x.remove()); }
  window.__noAA = s.innerHTML; });
const run = () => page.evaluate(async () => { const v = document.querySelector('.main-view-container__scroll-node > [data-overlayscrollbars-viewport]'), start = v.scrollTop, times = [];
  await new Promise(res => { let last = performance.now(), t0 = last; const step = now => { times.push(now - last); last = now; v.scrollTop = start + Math.sin((now - t0) / 400) * 300 + 300; if (now - t0 < 3000) requestAnimationFrame(step); else res(); }; requestAnimationFrame(step); });
  v.scrollTop = start; times.sort((a, b) => a - b); return { p95: +times[Math.floor(times.length * .95)].toFixed(1), drops: times.filter(t => t > 20).length }; });
const res = { aa: [], noaa: [] };
for (let k = 0; k < 4; k++) for (const mode of ['aa', 'noaa']) {
  await page.evaluate(m => { document.getElementById('am-glass').innerHTML = m === 'aa' ? window.__withAA : window.__noAA; }, mode);
  await page.waitForTimeout(400); res[mode].push(await run());
}
await page.evaluate(() => { document.getElementById('am-glass').innerHTML = window.__withAA; });
console.log(JSON.stringify(res));
await browser.close().catch(() => {});

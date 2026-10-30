// node buttons/bench.mjs: frame times in a visible Chrome window (the GPU path; headless renders in software) while
// a page scrolls under the demo's toolbar buttons, for no backdrop, the CSS blur fallback and the lens; then the lens
// while Back is pressed and released over and over (the face resizes, so its maps are redrawn every frame).
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1000,700'] });
const page = await browser.newPage({ viewport: { width: 980, height: 600 }, deviceScaleFactor: 2 });
async function run(mode, press, extra = '', label = '') {
  await page.goto('file://' + path.join(here, 'index.html') + `?anim&glass=${mode}${extra}`);
  await page.waitForTimeout(800);
  if (press) page.evaluate(async () => {}); // no-op, presses are driven below
  const frames = page.evaluate(() => new Promise(res => { const t = []; let last = performance.now(); const end = last + 4000;
    const f = now => { t.push(now - last); last = now; if (now < end) requestAnimationFrame(f); else res(t); }; requestAnimationFrame(f); }));
  if (press) for (let i = 0; i < 8; i++) { await page.mouse.move(226, 26); await page.mouse.down(); await page.waitForTimeout(250); await page.mouse.up(); await page.waitForTimeout(200); }
  const t = (await frames).slice(5).sort((a, b) => a - b), mean = t.reduce((a, b) => a + b, 0) / t.length;
  console.log(`${(label || mode + (press ? ' + presses' : '')).padEnd(34)} frames ${t.length}  mean ${mean.toFixed(1)}ms  p95 ${t[Math.floor(t.length * .95)].toFixed(1)}ms  >20ms ${t.filter(x => x > 20).length}`);
}
if (process.argv[2] === 'parts') {
  const L = o => '&lens=' + encodeURIComponent(JSON.stringify(o));
  await run('lens', false, '', 'lens (all)');
  await run('lens', false, '&rim=svg', 'lens, svg hairline');
  await run('lens', false, '&rim=svg' + L({ margin: 0 }), 'lens, no margin, svg hairline');
  await run('lens', false, '&rim=svg' + L({ margin: 0, darken: 0 }), '  + no darken halo');
  await run('lens', false, '&rim=svg' + L({ margin: 0, darken: 0, gainL: null, hlHue: false }), '  + plain colour/highlight');
  await run('lens', false, '&rim=svg' + L({ state: 'focused', margin: 0 }), "player's lens (as mcloud), svg");
} else { for (const m of ['none', 'blur', 'lens']) await run(m, false); await run('lens', true); await run('blur', true); }
await browser.close();

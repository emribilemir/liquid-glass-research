// node buttons/verify.mjs <script.txt> <outdir> x y w h: plays a tools/buttons/rec script (move/down/up/drag/wait, window
// points) against buttons/index.html in Chrome at 2x on a virtual clock, and saves one frame every 1/60 s of the clip
// (window points) plus timeline.tsv in rec's format, so geom.py / springfit.py / sheet.py read Music and the copy alike.
// Needs `npm i --no-save playwright` and Google Chrome (or PWB=<path to a Chromium>).
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [script, out, x, y, w, h] = process.argv.slice(2);
const clip = { x: +x, y: +y, width: +w, height: +h };
fs.mkdirSync(out, { recursive: true });
const steps = fs.readFileSync(script, 'utf8').split('\n').map(l => l.trim().split(/\s+/)).filter(s => s[0] && !s[0].startsWith('#'));

// Same timing as rec: 300ms lead-in, moves in 8ms steps, 400ms tail.
const acts = []; let t = 0.3, pos = null, down = false, log = '';
const at = (dt, fn) => acts.push({ t: (t += dt), fn });
for (const s of steps) {
  const [cmd, a, b, c] = s;
  if (cmd === 'move' || cmd === 'drag') {
    const to = [+a, +b], ms = +(c || 0), from = pos || to, n = Math.max(1, Math.floor(ms / 8));
    acts.push({ t, mark: `${cmd}-start`, p: from });
    for (let i = 1; i <= n; i++) { const k = i / n, p = [from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k]; at(n > 1 ? 0.008 : 0, pg => pg.mouse.move(...p)) }
    pos = to; acts.push({ t, mark: `${cmd}-end`, p: to });
  } else if (cmd === 'down') { down = true; at(0, pg => pg.mouse.down()); acts.push({ t, mark: 'down', p: pos }) }
  else if (cmd === 'up') { down = false; at(0, pg => pg.mouse.up()); acts.push({ t, mark: 'up', p: pos }) }
  else if (cmd === 'wait') t += +a / 1000;
}
const end = t + 0.4;

const browser = await chromium.launch(process.env.PWB ? { executablePath: process.env.PWB } : { channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 980, height: 600 }, deviceScaleFactor: 2 });
const here = path.dirname(fileURLToPath(import.meta.url));
await page.goto('file://' + path.join(here, 'index.html') + '?manual');
await page.waitForFunction(() => window.lgClock);
let clock = 0, frame = 0, ai = 0;
const advance = async to => { if (to > clock) { await page.evaluate(ms => lgClock.advance(ms), (to - clock) * 1000); clock = to } };
for (let ft = 0; ft <= end; ft += 1 / 60) {
  while (ai < acts.length && acts[ai].t <= ft) {
    const a = acts[ai++]; await advance(a.t);
    if (a.fn) await a.fn(page); else log += `event ${a.mark} ${a.p[0].toFixed(1)} ${a.p[1].toFixed(1)} ${a.t.toFixed(4)}\n`;
  }
  await advance(ft);
  await page.screenshot({ path: path.join(out, `f${String(frame).padStart(4, '0')}.png`), clip });
  log += `frame ${frame++} ${ft.toFixed(4)}\n`;
}
fs.writeFileSync(path.join(out, 'timeline.tsv'), log);
console.log('frames', frame);
await browser.close();

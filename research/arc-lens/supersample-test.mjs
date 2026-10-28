// Does a backdrop filter on a 2x element shrunk by transform: scale(.5) sample the backdrop at 2x (supersampling)?
// Page: 2x screen, a background image, a capsule bar 701x54 at (40,40) with only the arc displacement (A = r, H = r/2).
import { createRequire } from 'module'; import fs from 'fs';
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const [bgPath, out, ssArg] = process.argv.slice(2), ss = Number(ssArg);
const browser = await chromium.launch({ executablePath: process.env.PWB });
const page = await browser.newPage({ viewport: { width: 781, height: 135 }, deviceScaleFactor: 2 });
const bg = 'data:image/png;base64,' + fs.readFileSync(bgPath).toString('base64');
await page.setContent(`<body style="margin:0;background:#000"><img id=bg src="${bg}" style="position:absolute;left:0;top:0;width:781px">
<div id=bar style="position:absolute;left:40px;top:40px;width:${701*ss}px;height:${54*ss}px;border-radius:${27*ss}px;transform:scale(${1/ss});transform-origin:0 0"></div>
<svg width=0 height=0 style="position:absolute"><filter id=g x=0 y=0 width=100% height=100% color-interpolation-filters=sRGB></filter></svg></body>`);
await page.evaluate(ss => new Promise(res => {
  const w = 701 * ss, h = 54 * ss, r = h / 2, k = 2 / ss, W = Math.round(w * k), H = Math.round(h * k), A = r, Hh = r / 2;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'), mx = x.createImageData(W, H), my = x.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let X = 0; X < W; X++) {
    const px = (X + .5) / k, py = (y + .5) / k, dx = Math.min(w - r, Math.max(r, px)) - px, dy = r - py, len = Math.hypot(dx, dy) || 1, e = Math.max(0, r - len), t = Math.min(1, e / Hh);
    const s = A * (1 - Math.sqrt((2 - t) * t)) / A / len, i = (y * W + X) * 4;
    mx.data[i] = mx.data[i + 1] = mx.data[i + 2] = Math.round(128 + 127 * s * dx); my.data[i] = my.data[i + 1] = my.data[i + 2] = Math.round(128 + 127 * s * dy); mx.data[i + 3] = my.data[i + 3] = 255;
  }
  const url = d => { x.putImageData(d, 0, 0); return c.toDataURL(); };
  document.getElementById('g').innerHTML = `<feImage result="mx" preserveAspectRatio="none" width=${w} height=${h} href="${url(mx)}"/><feImage result="my" preserveAspectRatio="none" width=${w} height=${h} href="${url(my)}"/>`
    + '<feColorMatrix in="mx" values="1 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 0 0 1" result="x2"/><feColorMatrix in="my" values="0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 0 1" result="y2"/><feComposite in="x2" in2="y2" operator="arithmetic" k2="1" k3="1" result="map"/>'
    + `<feDisplacementMap in="SourceGraphic" in2="map" scale="${2 * A}" xChannelSelector="R" yChannelSelector="B"/>`;
  document.getElementById('bar').style.backdropFilter = 'url(#g)';
  requestAnimationFrame(() => requestAnimationFrame(res));
}), ss);
await page.screenshot({ path: out }); await browser.close();

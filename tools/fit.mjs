// Fits the theme's SVG glass to Apple's native glass: renders the same backgrounds with a parametric filter in
// Chromium (2x) and compares against captures of NSGlassView (fit/apple/*.png).
//   node fit.mjs eval '<json params>' [outdir]   -> prints the error per pattern (and saves renders)
//   node fit.mjs fit  '<json params>'            -> coordinate descent from these params, prints the best
import { createRequire } from 'module';
import zlib from 'zlib';
import fs from 'fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
// Fit data: research/fit/bg (backgrounds) and research/fit/apple (native captures).
// FITDIR points at another set laid out the same way (bg/, apple/), e.g. scroll frames.
const here = process.env.FITDIR || new URL('../research/fit/', import.meta.url).pathname;
const patterns = (process.env.PATTERNS || 'scene,vstripes,hstripes,grays,h1,h4,h8,h15,h27,v1,v4,v8,v15').split(',');
const weights = { mg00: 3, mg03: 3, mg06: 3, mg09: 3, mg12: 3, mg15: 3, mg18: 3, mg21: 3, mg24: 3, mg27: 3, mg30: 3, scene: 4, scene2: 4, grays: 2, grid: 3, checker: 3, vedge: 2, hedge: 2, mf00: 3, mf03: 3, mf06: 3, mf09: 3, mf12: 3, mf15: 3, mf18: 3, mf21: 3, mf24: 3, mf27: 3, mf30: 3 };

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
const apple = Object.fromEntries(patterns.map(n => [n, png(fs.readFileSync(`${here}apple/${n}.png`))]));

// The page: background image, bar with backdrop-filter, filter rebuilt from params by window.build(params).
const page_html = `<!doctype html><html><body style="margin:0;background:#000">
<img id="bg" style="position:absolute;left:0;top:0;width:781px;display:block">
<div id="bar" style="position:absolute;left:40px;top:40px;width:701px;height:55px;border-radius:27.5px"></div>
<div id="bar2" style="position:absolute;left:40px;top:40px;width:701px;height:55px;border-radius:27.5px;display:none"></div>
<svg width="0" height="0" style="position:absolute"><filter id="g" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"></filter><filter id="g2" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"></filter></svg>
<script>
window.build = p => {
  const w = 701, h = p.barH || 55, r = h / 2, bar = document.getElementById('bar'), f = document.getElementById('g');
  bar.style.top = (p.barTop ?? 40) + 'px'; bar.style.height = h + 'px'; bar.style.borderRadius = r + 'px';
  // Shift (pt, inward positive) by distance from the edge: piecewise linear through p.knots/p.shift.
  // Or QuartzCore's lens curve, shift = A*(1 - sqrt((2-t)*t)), t = d/H (p.arcA/p.arcH in pt, or p.arcKA/p.arcKH times
  // the radius), sampled every 0.25pt.
  if (p.arcKA) p = { ...p, arcA: p.arcKA * r, arcH: p.arcKH * r };
  if (p.arcA) { const H = p.arcH, n = Math.ceil(H / .25) + 2; p = { ...p, knots: Array.from({ length: n }, (_, i) => Math.min(i * .25, H + .5)), shift: Array.from({ length: n }, (_, i) => { const t = Math.min(1, i * .25 / H); return p.arcA * (1 - Math.sqrt((2 - t) * t)); }) }; }
  const K = p.knots, V = p.shift, shiftAt = d => { if (d >= K[K.length - 1]) return 0; let i = 0; while (d > K[i + 1]) i++; const t = (d - K[i]) / (K[i + 1] - K[i]); return V[i] + (V[i + 1] - V[i]) * t; };
  const max = Math.max(1e-3, ...V.map(Math.abs));
  // Rim anti-aliasing. Where the bend squeezes the page (compression |d source / d display| > 1), Apple averages each
  // pixel's footprint; feDisplacementMap point-samples. The blur an area sample needs there is the footprint beyond one
  // pixel as a box: pixel * sqrt(c^2 - 1) / sqrt(12) (times p.aaK). p.mip: blurred copies at these stdDeviations, each
  // displaced, blended per pixel by that need. p.taps: N displacements spread along the normal over the footprint
  // beyond one pixel ((c - 1) pixels), identical where c <= 1, averaged. p.post: one blur after the bend (stdDeviation
  // p.post), mixed in by clamp((c - 1) / p.postC): Apple's squeezed rim is soft on screen, not just in the page. With
  // p.postMag also where the bend magnifies (c < 1, by 1/c - 1): nearest-neighbour magnification shows page pixels as blocks;
  // p.postMag = 2: only there. p.postAniso: blur vertically only (the straight edges magnify along y).
  const comp = d => { const e = .05, a = Math.max(0, d - e), b = d + e; return Math.abs(1 + (shiftAt(b) - shiftAt(a)) / (b - a)); };
  const k = p.mapScale || 1, W = w * k, H = h * k;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  const mx = x.createImageData(W, H), my = x.createImageData(W, H), mr = x.createImageData(W, H), mh = x.createImageData(W, H), ml = x.createImageData(W, H), mm = x.createImageData(W, H), sxi = x.createImageData(W, H), mb = x.createImageData(W, H), mrm = x.createImageData(W, H), mtv = x.createImageData(W, H), mth = x.createImageData(W, H), syi = x.createImageData(W, H), spx = new Float32Array(W * H), spy = new Float32Array(W * H);
  // Highlight along the top and bottom edges: strength by distance from the edge (table every 0.5px), times the
  // vertical part of the edge normal, so the round ends' middles get none.
  const hiAt = d => p.hiA !== undefined ? p.hiA * Math.exp(-d / Math.max(.05, p.hiB)) : hiTable(d);
  const hiTable = d => { const t = p.hi || [], f = d / .5; if (!t.length || f >= t.length - 1) return 0; const i = Math.floor(f); return t[i] + (t[i + 1] - t[i]) * (f - i); };
  for (let y = 0; y < H; y++) for (let X = 0; X < W; X++) {
    const px = (X + .5) / k, py = (y + .5) / k;
    const dx = Math.min(w - r, Math.max(r, px)) - px, dy = r - py, len = Math.hypot(dx, dy) || 1, edge = r - len, i = (y * W + X) * 4;
    mh.data[i] = mh.data[i + 1] = mh.data[i + 2] = Math.round(255 * Math.min(1, hiAt(Math.max(0, edge)) / (p.hiMax || 1) * Math.abs(dy / len) ** (p.hiPow || 1.5))); mh.data[i + 3] = 255;
    // Dark edge line (multiplies the glass, so it shows over bright content only): 1 - p.line at the rim, smoothstep to 1
    // at p.lineW, times |n_x|^p.linePow (the top and bottom edges' highlight table already absorbs it there).
    { const u = Math.min(1, Math.max(0, edge) / (p.lineW || 1)); ml.data[i] = ml.data[i + 1] = ml.data[i + 2] = Math.round(255 * (1 - (p.line || 0) * (1 - u * u * (3 - 2 * u)) * Math.abs(dx / len) ** (p.linePow || 0))); ml.data[i + 3] = 255; }
    // p.dither: jitter each pixel's sample point along the normal across its footprint beyond one pixel ((c - 1) / 2
    // pixels either way, times p.dither), with interleaved gradient noise (blue-ish): squeezed detail lands on a
    // fraction of the rim pixels instead of all or none; zero where c <= 1, so the face stays exact. No extra pass.
    const jit = p.dither ? (() => { const n = (52.9829189 * ((.06711056 * X + .00583715 * y) % 1)) % 1; return (2 * n - 1) * Math.max(0, comp(Math.max(0, edge)) - 1) / 2 / k * p.dither; })() : 0;
    const t = (shiftAt(Math.max(0, edge)) + jit) / max / len;
    // Edge bleed: near the rim the glass mixes toward the darken halo's wide blur, p.bleed at the edge fading out by
    // p.bleedW (smoothstep). Thin bright detail in the rim dims; flat colour does not change.
    if (p.bleed) { const u = Math.min(1, Math.max(0, edge) / p.bleedW); mb.data[i] = mb.data[i + 1] = mb.data[i + 2] = 255; mb.data[i + 3] = Math.round(255 * p.bleed * (1 - u * u * (3 - 2 * u))); }
    if (p.rimMip) { const cc = comp(Math.max(0, edge)); mrm.data[i] = mrm.data[i + 1] = mrm.data[i + 2] = 255; mrm.data[i + 3] = Math.round(255 * Math.min(1, Math.max(0, (cc - (p.rimMipC || 2.5)) / 2))); }
    if (p.mip || p.taps || p.post) { const cc = comp(Math.max(0, edge)), pix = 1 / k, need = pix * Math.sqrt(Math.max(0, cc * cc - 1) / 12) * (p.aaK || 1);
      if (p.mip) { const L = [p.preBlur, ...p.mip], sg = Math.hypot(p.preBlur, need); for (let j = 1; j < L.length && j <= 3; j++) mm.data[i + j - 1] = Math.round(255 * Math.min(1, Math.max(0, (sg - L[j - 1]) / (L[j] - L[j - 1])))); mm.data[i + 3] = 255; }
      if (p.post) { const mg = 1 / Math.max(cc, .05) - 1, sq = p.postMag === 2 ? mg : p.postMag ? Math.max(cc - 1, mg) : cc - 1; const wq = Math.min(1, Math.max(0, sq / (p.postC || 4))), ny2 = (dy / len) ** 2;
        // p.tanDiv: at the round ends the bend points at the end's centre, so along the curve the page is magnified by
        // (r - d) / (r - d - shift): ~100x at the edge, ~3x at 1px. Blur along the curve there too (vertical by n_x^2,
        // sideways by n_y^2), weighted by (that - 1) / p.tanDiv; into p.tanBlur's own pair of blurs if given.
        const e0 = Math.max(0, edge), mt = dx ? (r - e0) / Math.max(.05, Math.abs(r - e0 - shiftAt(e0))) : 1, wt = p.tanDiv ? Math.min(1, Math.max(0, (mt - 1) / p.tanDiv)) : 0;
        if (p.postAniso === 2) { mm.data[i] = Math.round(255 * Math.min(1, wq * ny2 + (p.tanBlur ? 0 : wt * (1 - ny2)))); mm.data[i + 1] = Math.round(255 * Math.min(1, wq * (1 - ny2) + (p.tanBlur ? 0 : wt * ny2))); if (p.tanBlur) { mtv.data[i + 3] = Math.round(255 * wt * (1 - ny2)); mth.data[i + 3] = Math.round(255 * wt * ny2); mtv.data[i] = mtv.data[i + 1] = mtv.data[i + 2] = mth.data[i] = mth.data[i + 1] = mth.data[i + 2] = 255; } } else mm.data[i] = Math.round(255 * wq); mm.data[i + 3] = 255; }
      if (p.taps) { const hs = Math.max(0, cc - 1) / 2 * pix * (p.aaK || 1); spx[i / 4] = hs * dx / len; spy[i / 4] = hs * dy / len; } }
    const facing = (-dx * .5 + dy * .866) / len, light = Math.min(1, .15 + Math.max(0, facing) ** 1.5 + .5 * Math.max(0, -facing) ** 1.5);
    const band = 1 - Math.min(1, Math.max(0, edge) / p.rimWidth) ** 2;
    const xv = Math.round(128 + 127 * t * dx), yv = Math.round(128 + 127 * t * dy), rv = Math.round(255 * Math.min(1, p.rim * light * band));
    mx.data[i] = mx.data[i + 1] = mx.data[i + 2] = xv; my.data[i] = my.data[i + 1] = my.data[i + 2] = yv; mr.data[i] = mr.data[i + 1] = mr.data[i + 2] = rv;
    mx.data[i + 3] = my.data[i + 3] = mr.data[i + 3] = 255;
  }
  const url = d => { x.putImageData(d, 0, 0); return c.toDataURL(); };
  // p.bilin: exact bilinear sampling. The geometry is fixed and the page moves in whole device pixels, so for every
  // device pixel the 4 page pixels around its source point and their weights are fixed: 4 nearest-pixel
  // displacements landing on those pixels' centres, blended by fixed weight masks. Where the shift is 0 the weights
  // are 0 and the face is the page itself. Offsets in CSS px, the map encodes offset / bs + 0.5.
  let bil = null;
  if (p.bilin) {
    const taps = [0, 1, 2, 3].map(() => ({ x: x.createImageData(W, H), y: x.createImageData(W, H) })), fx = x.createImageData(W, H), fy = x.createImageData(W, H);
    const off = new Float32Array(W * H * 8); let omax = 1;
    for (let yy = 0; yy < H; yy++) for (let X = 0; X < W; X++) {
      const px = (X + .5) / k, py = (yy + .5) / k, dx = Math.min(w - r, Math.max(r, px)) - px, dy = r - py, len = Math.hypot(dx, dy) || 1, e0 = Math.max(0, r - len), sh = shiftAt(e0) * (p.bilinK || 1);
      // source point in device px, then the 4 pixel centres around it
      const sx = (px + sh * dx / len) * k - .5, sy = (py + sh * dy / len) * k - .5, ix = Math.floor(sx), iy = Math.floor(sy), q = yy * W + X, o = q * 4;
      fx.data[o] = fx.data[o + 1] = fx.data[o + 2] = fy.data[o] = fy.data[o + 1] = fy.data[o + 2] = 255; fx.data[o + 3] = Math.round(255 * (sx - ix)); fy.data[o + 3] = Math.round(255 * (sy - iy));
      [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([a, b], j) => { off[q * 8 + j * 2] = (ix + a - X) / k; off[q * 8 + j * 2 + 1] = (iy + b - yy) / k; });
      for (let j = 0; j < 8; j++) omax = Math.max(omax, Math.abs(off[q * 8 + j]));
    }
    const bs = 2 * (omax + 1);
    for (let q = 0; q < W * H; q++) for (let j = 0; j < 4; j++) { const o = q * 4, vx = Math.round(255 * (off[q * 8 + j * 2] / bs + .5)), vy = Math.round(255 * (off[q * 8 + j * 2 + 1] / bs + .5));
      taps[j].x.data[o] = taps[j].x.data[o + 1] = taps[j].x.data[o + 2] = vx; taps[j].y.data[o] = taps[j].y.data[o + 1] = taps[j].y.data[o + 2] = vy; taps[j].x.data[o + 3] = taps[j].y.data[o + 3] = 255; }
    bil = { taps, fx, fy, bs };
  }
  const img = (name, d) => '<feImage result="' + name + '" preserveAspectRatio="none" width="701" height="' + h + '" href="' + url(d) + '"/>';
  const S = 2 * max, disp = (i, m, res) => '<feDisplacementMap in="' + i + '" in2="' + m + '" scale="' + S + '" xChannelSelector="R" yChannelSelector="B"' + (res ? ' result="' + res + '"' : '') + '/>';
  let aa = disp('pre', 'map');
  if (bil) {
    const im = (n, d) => '<feImage result="' + n + '" preserveAspectRatio="none" width="701" height="' + h + '" href="' + url(d) + '"/>';
    aa = bil.taps.map((t, j) => im('bx' + j, t.x) + im('by' + j, t.y) + '<feColorMatrix in="bx' + j + '" values="1 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 0 0 1" result="bx' + j + 'm"/><feColorMatrix in="by' + j + '" values="0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 0 1" result="by' + j + 'm"/><feComposite in="bx' + j + 'm" in2="by' + j + 'm" operator="arithmetic" k2="1" k3="1" result="bm' + j + '"/>'
      + '<feDisplacementMap in="' + (p.bilinSrc || 'pre') + '" in2="bm' + j + '" scale="' + bil.bs + '" xChannelSelector="R" yChannelSelector="B" result="tp' + j + '"/>').join('')
      + im('bfx', bil.fx) + im('bfy', bil.fy)
      + '<feComposite in="tp1" in2="bfx" operator="in" result="t1m"/><feComposite in="t1m" in2="tp0" operator="over" result="r0"/>'
      + '<feComposite in="tp3" in2="bfx" operator="in" result="t3m"/><feComposite in="t3m" in2="tp2" operator="over" result="r1"/>'
      + '<feComposite in="r1" in2="bfy" operator="in" result="r1m"/><feComposite in="r1m" in2="r0" operator="over" result="bl"/>'
      // p.rimMip: where the bend squeezes the page hardest (outermost pixels), a blurred copy displaced once, as a mip level.
      + (p.rimMip ? '<feGaussianBlur in="SourceGraphic" stdDeviation="' + p.rimMip + '" edgeMode="duplicate" result="rmb"/>' + disp('rmb', 'map', 'rmd') + im('mrm', mrm) + '<feComposite in="rmd" in2="mrm" operator="in" result="rmm"/><feComposite in="rmm" in2="bl" operator="over" result="bl"/>' : '')
      + (p.post ? '' : '<feOffset in="bl"/>');
  }
  if (p.post && p.postAniso === 2) {
    // Along the normal: a vertical blur weighted by n_y^2 and a horizontal one by n_x^2 (the round ends magnify sideways).
    aa = img('mm', mm) + (bil ? aa + '<feOffset in="bl" result="d0"/>' : disp('pre', 'map', 'd0')) + '<feGaussianBlur in="d0" stdDeviation="0 ' + p.post + '" edgeMode="duplicate" result="pv"/><feGaussianBlur in="d0" stdDeviation="' + p.post + ' 0" edgeMode="duplicate" result="ph"/>'
      + '<feColorMatrix in="mm" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 1 0 0 0 0" result="wv"/><feColorMatrix in="mm" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 1 0 0 0" result="wh"/>'
      + '<feComposite in="pv" in2="wv" operator="in" result="mv"/><feComposite in="ph" in2="wh" operator="in" result="mh2"/><feComposite in="mv" in2="d0" operator="over" result="d1"/><feComposite in="mh2" in2="d1" operator="over"' + (p.tanBlur ? ' result="d2"' : '') + '/>'
      + (p.tanBlur ? img('mtv', mtv) + img('mth', mth) + '<feGaussianBlur in="d0" stdDeviation="0 ' + p.tanBlur + '" edgeMode="duplicate" result="tv"/><feGaussianBlur in="d0" stdDeviation="' + p.tanBlur + ' 0" edgeMode="duplicate" result="th"/><feComposite in="tv" in2="mtv" operator="in" result="tvm"/><feComposite in="th" in2="mth" operator="in" result="thm"/><feComposite in="tvm" in2="d2" operator="over" result="d3"/><feComposite in="thm" in2="d3" operator="over"/>' : '');
  } else if (p.post) {
    aa = img('mm', mm) + disp('pre', 'map', 'd0') + '<feGaussianBlur in="d0" stdDeviation="' + (p.postAniso ? '0 ' : '') + p.post + '" edgeMode="duplicate" result="pb"/><feColorMatrix in="mm" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 1 0 0 0 0" result="wp"/><feComposite in="pb" in2="wp" operator="in" result="pm"/><feComposite in="pm" in2="d0" operator="over"/>';
  } else if (p.mip) {
    const L = [p.preBlur, ...p.mip].slice(0, 4);
    aa = img('mm', mm) + disp('pre', 'map', 'acc0') + L.slice(1).map((sd, j) => '<feGaussianBlur in="SourceGraphic" stdDeviation="' + sd + '" edgeMode="duplicate" result="b' + (j + 1) + '"/>' + disp('b' + (j + 1), 'map', 'd' + (j + 1))
      + '<feColorMatrix in="mm" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 ' + ['1 0 0', '0 1 0', '0 0 1'][j] + ' 0 0" result="w' + (j + 1) + '"/><feComposite in="d' + (j + 1) + '" in2="w' + (j + 1) + '" operator="in" result="m' + (j + 1) + '"/><feComposite in="m' + (j + 1) + '" in2="acc' + j + '" operator="over" result="acc' + (j + 1) + '"/>').join('');
  } else if (p.taps) {
    let smax = 1e-6; for (let q = 0; q < spx.length; q++) smax = Math.max(smax, Math.abs(spx[q]), Math.abs(spy[q]));
    for (let q = 0; q < spx.length; q++) { const o = q * 4, a = Math.round(128 + 127 * spx[q] / smax), b = Math.round(128 + 127 * spy[q] / smax); sxi.data[o] = sxi.data[o + 1] = sxi.data[o + 2] = a; syi.data[o] = syi.data[o + 1] = syi.data[o + 2] = b; sxi.data[o + 3] = syi.data[o + 3] = 255; }
    const N = p.taps; aa = img('sx', sxi) + img('sy', syi) + '<feColorMatrix in="sx" values="1 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 0 0 1" result="sx2"/><feColorMatrix in="sy" values="0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 0 1" result="sy2"/><feComposite in="sx2" in2="sy2" operator="arithmetic" k2="1" k3="1" result="spread"/>';
    // k3 stays positive (negative taps use the inverted spread): with k3 < 0 the composite's alpha drops below 1 and
    // the premultiplied map shifts everywhere.
    aa += '<feColorMatrix in="spread" values="-1 0 0 0 1 0 -1 0 0 1 0 0 -1 0 1 0 0 0 0 1" result="spreadN"/>';
    let names = [];
    for (let j = 0; j < N; j++) { const g = (2 * (j + .5) / N - 1) * smax / max, a = Math.abs(g); aa += '<feComposite in="map" in2="' + (g < 0 ? 'spreadN' : 'spread') + '" operator="arithmetic" k2="1" k3="' + a + '" k4="' + (-a * (g < 0 ? 127 : 128) / 255) + '" result="mp' + j + '"/>' + disp('pre', 'mp' + j, 't' + j); names.push('t' + j); }
    let n = 0; while (names.length > 1) { const next = []; for (let j = 0; j < names.length; j += 2) { const res = 'v' + n++; aa += '<feComposite in="' + names[j] + '" in2="' + names[j + 1] + '" operator="arithmetic" k2=".5" k3=".5" result="' + res + '"/>'; next.push(res); } names = next; }
  }
  const lineImg = p.line ? '<feImage result="ml" preserveAspectRatio="none" width="701" height="' + h + '" href="' + url(ml) + '"/>' : '';
  const hiImg = p.hi ? '<feImage result="mh" preserveAspectRatio="none" width="701" height="' + h + '" href="' + url(mh) + '"/>' : '';
  const lut = p.lut.map(v => (v / 255).toFixed(4)).join(' '), tf = 'type="table" tableValues="' + lut + '"';
  f.setAttribute('color-interpolation-filters', p.linear ? 'linearRGB' : 'sRGB');
  f.innerHTML = hiImg + lineImg + '<feImage result="mx" preserveAspectRatio="none" width="701" height="' + h + '" href="' + url(mx) + '"/>'
    + '<feImage result="my" preserveAspectRatio="none" width="701" height="' + h + '" href="' + url(my) + '"/>'
    + '<feImage result="mr" preserveAspectRatio="none" width="701" height="' + h + '" href="' + url(mr) + '"/>'
    + '<feColorMatrix in="mx" values="1 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 0 0 1" result="x"/><feColorMatrix in="my" values="0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 0 1" result="y"/>'
    + '<feComposite in="x" in2="y" operator="arithmetic" k2="1" k3="1" result="map"/>'
    + '<feGaussianBlur in="SourceGraphic" stdDeviation="' + Math.max(0, p.preBlur) + '" edgeMode="duplicate" result="pre"/>'
    + aa
    + '<feGaussianBlur stdDeviation="' + Math.max(0, p.blur) + '" edgeMode="duplicate" result="core"/>'
    // p.nmin: a narrow darken (min with a p.nminBlur blur, mixed at p.nmin): thin bright detail dims, width and flat colour stay.
    + (p.nmin ? '<feGaussianBlur in="core" stdDeviation="' + p.nminBlur + '" edgeMode="duplicate" result="nb"/><feBlend in="core" in2="nb" mode="darken" result="nd"/><feComposite in="core" in2="nd" operator="arithmetic" k2="' + (1 - p.nmin) + '" k3="' + p.nmin + '" result="core"/>' : '')
    // Darken mix: bright pixels pulled toward the darker surroundings (min with a wide blur), dark ones kept.
    + (p.darkMix ? '<feGaussianBlur in="core" stdDeviation="' + p.darkBlur + '" edgeMode="duplicate" result="dhalo"/><feBlend in="core" in2="dhalo" mode="darken" result="dk"/><feComposite in="core" in2="dk" operator="arithmetic" k2="' + (1 - p.darkMix) + '" k3="' + p.darkMix + '" result="core"/>'
      + (p.bleed ? img('mb', mb) + '<feComposite in="' + (p.bleedDk ? 'dk' : 'dhalo') + '" in2="mb" operator="in" result="bm"/><feComposite in="bm" in2="core" operator="over" result="core"/>' : '') : '')
    + (p.wideMix ? '<feGaussianBlur in="core" stdDeviation="' + p.wideBlur + '" edgeMode="duplicate" result="halo"/><feComposite in="core" in2="halo" operator="arithmetic" k2="' + (1 - p.wideMix) + '" k3="' + p.wideMix + '"/>' : '')
    + '<feColorMatrix type="saturate" values="' + p.sat + '"/>'
    + (p.lumTone
      // Tone by luminance, keeping hue: out = a*in + b(Y), b(Y) = T(Y) - a*Y, stored as (b+1)/2 in a grey image.
      ? '<feColorMatrix values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 0 1" result="soft"/><feColorMatrix values=".2126 .7152 .0722 0 0 .2126 .7152 .0722 0 0 .2126 .7152 .0722 0 0 0 0 0 1 0"/>'
        + '<feComponentTransfer result="off">' + ['R','G','B'].map(c => '<feFunc' + c + ' type="table" tableValues="' + p.lut.map((t, k) => (((t / 255) - p.a * k / (p.lut.length - 1)) + 1) / 2).map(v => v.toFixed(4)).join(' ') + '"/>').join('') + '</feComponentTransfer>'
        + '<feComposite in="soft" in2="off" operator="arithmetic" k2="' + p.a + '" k3="2" k4="-1" result="glass"/>'
        + (p.hi ? '<feComposite in="glass" in2="mh" operator="arithmetic" k1="' + (-p.hiMax) + '" k2="1" k3="' + (p.hiC * p.hiMax) + '" result="glass"/>' : '')
        // A multiply blend: feComposite arithmetic with k1 = -0.4 came out wrong across the whole bar in Chromium.
        + (p.line ? '<feBlend in="glass" in2="ml" mode="multiply" result="glass"/>' : '')
      : '<feComponentTransfer result="glass"><feFuncR ' + tf + '/><feFuncG ' + tf + '/><feFuncB ' + tf + '/></feComponentTransfer>')
    + '<feColorMatrix in="mr" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0 0" result="rim"/>'
    + '<feFlood flood-color="' + p.rimColor + '"/><feComposite in2="rim" operator="in"/><feComposite in2="glass" operator="over"/>';
  // p.layers: as in the theme, the bend (up to "core") on the bar and the rest on a second bar above it, reading the
  // first one's result as its backdrop: a filter recomputes a result for every primitive that reads it.
  const bar2 = document.getElementById('bar2'), f2 = document.getElementById('g2');
  bar2.style.display = p.layers ? '' : 'none';
  if (p.layers) {
    const all = f.innerHTML, cut = all.indexOf('result="core"', all.indexOf('stdDeviation="' + Math.max(0, p.blur) + '" edgeMode="duplicate" result="core"')) + 'result="core"/>'.length;
    const images = [...f.querySelectorAll('feImage')].map(e => e.outerHTML).join('');
    f.innerHTML = all.slice(0, cut); f2.innerHTML = images + '<feOffset in="SourceGraphic" result="core"/>' + all.slice(cut);
    for (const k of ['top', 'height', 'borderRadius']) bar2.style[k] = bar.style[k]; bar2.style.backdropFilter = 'url(#g2)';
  }
  bar.style.backdropFilter = 'url(#g)';
};
</script></body></html>`;

const browser = await chromium.launch({ executablePath: process.env.PWB });
const page = await browser.newPage({ viewport: { width: 781, height: 135 }, deviceScaleFactor: 2 });
await page.setContent(page_html);
const bgs = Object.fromEntries(patterns.map(n => [n, 'data:image/png;base64,' + fs.readFileSync(`${here}bg/${n}.png`).toString('base64')]));

async function render(p, name) {
  // Music's own frames: its player sits at 40.5pt and is 54pt tall in those crops; the lab's is 40pt and 55pt.
  p = name.startsWith('mf') ? { ...p, barTop: 40.5, barH: 54 } : name.startsWith('mg') ? { ...p, barTop: 40, barH: 54 } : { ...p, barTop: 40, barH: 55 };
  await page.evaluate(([src, p]) => new Promise(res => { const img = document.getElementById('bg'); img.onload = () => { window.build(p); requestAnimationFrame(() => requestAnimationFrame(res)); }; img.src = src; }), [bgs[name], p]);
  return png(await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 781, height: apple[name].h / 2 } }));
}
// Error inside the bar (plus 1pt), mean abs per channel.
// Captures of Apple Music's own player (mf*) carry its icons; compare only the stretches between them there.
const glyphFree = x => (x >= 420 && x < 700) || (x >= 860 && x < 1180);
function error(a, b, name = '') {
  let e = 0, n = 0;
  for (let y = 78; y < 192 && y < a.h; y++) for (let x = 78; x < 1484; x += 2) { if (name.startsWith('mgm') ? !(x >= 860 && x < 1240 || x < 92 || x >= 1470) : (name.startsWith('mf') || name.startsWith('mg')) && !glyphFree(x)) continue; const o = (y * a.w + x) * 3; for (let k = 0; k < 3; k++) { e += Math.abs(a.d[o + k] - b.d[o + k]); n++; } }
  return e / n;
}
async function score(p, save) {
  let total = 0, wsum = 0; const parts = {};
  for (const n of patterns) { const img = await render(p, n); const e = error(img, apple[n], n); parts[n] = +e.toFixed(2); const w = weights[n] || (n.startsWith('mgm') ? 3 : 1); total += e * w; wsum += w;
    if (save) fs.writeFileSync(`${save}/${n}.png`, await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 781, height: apple[n].h / 2 } })); }
  return { total: +(total / wsum).toFixed(3), parts };
}

const [mode, json, outdir] = process.argv.slice(2);
let p = JSON.parse(json);
if (mode === 'eval') { if (outdir) fs.mkdirSync(outdir, { recursive: true }); console.log(JSON.stringify(await score(p, outdir))); }
else {
  // Coordinate descent over the numeric fields listed in FIT (comma list; array fields fit per element).
  const fields = (process.env.FIT || 'blur,sat').split(',');
  let best = await score(p); console.log('start', best.total, JSON.stringify(best.parts));
  for (let round = 0, step = 1; round < Number(process.env.ROUNDS || 4); round++, step /= 2) {
    for (const f of fields) {
      const idxs = Array.isArray(p[f]) ? p[f].map((_, i) => i) : [null];
      for (const i of idxs) {
        const base = i === null ? p[f] : p[f][i], d = (process.env['STEP_' + f] ? Number(process.env['STEP_' + f]) : Math.max(.05, Math.abs(base) * .3 || 1)) * step;
        for (const dir of [1, -1]) {
          for (;;) {
            const q = structuredClone(p); if (i === null) q[f] = +(q[f] + dir * d).toFixed(4); else q[f][i] = +(q[f][i] + dir * d).toFixed(4);
            if (f === 'lut') q.lut[i] = Math.max(0, Math.min(255, q.lut[i]));
            if (f === 'hi') q.hi[i] = Math.max(0, q.hi[i]);   // a highlight cannot darken
            const s = await score(q); if (s.total < best.total - 1e-3) { p = q; best = s; console.log(f, i ?? '', i === null ? p[f] : p[f][i], best.total); } else break;
          }
        }
      }
    }
  }
  console.log('BEST', best.total, JSON.stringify(best.parts)); console.log(JSON.stringify(p));
}
await browser.close();

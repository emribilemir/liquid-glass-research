// Apple Music's toolbar glass buttons (Back, the Share + More capsule), rebuilt for Chromium from measurements of
// Music on macOS 27 (research/RESEARCH.md, "Toolbar glass buttons"). Markup:
//   <div class="lg-glass" data-lg-zone=".toolbar"><button class="lg-seg">…</button><button class="lg-seg">…</button></div>
// Load lens.js first for the glass itself. One .lg-seg makes a round/capsule button whose whole face lights on hover; several make a group where each segment
// lights a circle of its own. Values are in CSS px (= points). window.lgClock.manual() + lgClock.advance(ms) step
// time by hand (used by verify.mjs to capture exact frames).
(() => {
  const M = {
    grow: 2.2,                                      // pt added to the long axis while pressed (36pt -> 38.2, 72pt -> 74.2)
    press: { response: 0.265, damping: 0.48 },      // springs fitted to Music's frames (rms 0.25px @2x)
    release: { response: 0.17, damping: 0.75 },
    fill: { response: 0.12, damping: 1 },           // hover/press light fades (~0.1s, no overshoot)
    pressFill: { response: 0.25, damping: 1 },
    flex: { response: 0.35, damping: 1 },
    hover: 0.11, hoverGroup: 0.10,                  // white over the glass under the pointer: whole button / segment circle
    pressed: 0.13,                                  // extra white over a single button while pressed
    glow: 0.13,                                     // pressed light across a group, at the pointer (half 35pt away, 0.3 at 55pt)
    falloffK: 5, falloffP: 0.575,                   // pressed light outside the button: 1 / (1 + (d/K)^P), d in pt
    flexMax: 0.35, flexRange: 60,                   // rubber-band pull toward a dragged pointer: max pt, tanh range pt
    inset: 3,                                       // segment light circle: height - 2*inset
    lens: { state: 'button' },                      // lens.js's glassStates.button (fitted at button size)
    rim: { w: .85, s: .8 },                         // hairline strength and colour kept (lens.js lgRimF; BtnLab)
  };
  let manual = false, virt = 0;
  const now = () => manual ? virt : performance.now() / 1000;
  window.lgClock = { manual() { manual = true; virt = last = performance.now() / 1000 }, advance(ms) { virt += ms / 1000; tick(true) } };

  class Spring {
    constructor(x) { this.x = this.t = x; this.v = 0; this.set(x, M.fill) }
    set(t, { response, damping }) { this.t = t; this.k = (2 * Math.PI / response) ** 2; this.c = 4 * Math.PI * damping / response }
    step(dt) { for (let s = dt; s > 1e-9; s -= 0.002) { const h = Math.min(0.002, s); this.v += (this.k * (this.t - this.x) - this.c * this.v) * h; this.x += this.v * h } }
    get idle() { return Math.abs(this.t - this.x) < 1e-4 && Math.abs(this.v) < 1e-3 }
  }

  const live = new Set();
  let raf = 0, last = 0;
  function wake() { if (!raf && !manual) { last = now(); raf = requestAnimationFrame(() => { raf = 0; tick() }) } }
  function tick(force) {
    const t = now(), dt = Math.min(0.05, Math.max(0, t - last)); last = t;
    for (const g of live) { g.step(dt); if (g.idle) live.delete(g) }
    if (live.size && !manual) wake()
  }

  class Glass {
    constructor(el) {
      this.el = el; this.segs = [...el.querySelectorAll('.lg-seg')]; this.group = this.segs.length > 1;
      this.zone = (el.dataset.lgZone && (el.closest(el.dataset.lgZone) || document.querySelector(el.dataset.lgZone))) || document.body;
      this.scale = new Spring(1); this.fx = new Spring(0); this.fy = new Spring(0);
      this.light = this.segs.map(() => new Spring(0));    // hover light per segment
      this.push = this.segs.map(() => new Spring(0));     // extra light while pressed, per segment
      this.glow = new Spring(0);
      this.down = -1; this.over = -1; this.p = null;
      el.classList.toggle('lg-group', this.group);
      // The lens lives on its own face, resized while pressed so the lens is redrawn at the new size: scaling a
      // backdrop-filter resamples its result and blurs the rim. The segments (glyphs, lights) scale about the centre.
      this.face = document.createElement('div'); this.face.className = 'lg-glass-face'; el.prepend(this.face);
      this.rim = window.lgRimMode === 'svg' && window.lgRim ? lgRim(el) : window.lgRimF ? lgRimF(el, M.rim) : null;   // the hairline, in the page's colour
      const cx = el.offsetWidth / 2, cy = el.offsetHeight / 2;
      this.segs.forEach(s => { s.style.transformOrigin = `${cx - s.offsetLeft}px ${cy - s.offsetTop}px` });
      el.addEventListener('pointerdown', e => this.press(e));
      el.addEventListener('pointermove', e => this.move(e));
      el.addEventListener('pointerleave', e => this.move(e));
      el.addEventListener('pointerup', e => this.up(e));
      el.addEventListener('pointercancel', e => this.up(e, true));
      el.addEventListener('lostpointercapture', e => this.up(e, true));
    }
    get idle() { return [this.scale, this.fx, this.fy, this.glow, ...this.light, ...this.push].every(s => s.idle) }
    seg(e) { return this.segs.findIndex(s => { const r = s.getBoundingClientRect(); return e.clientX >= r.left && e.clientX < r.right && e.clientY >= r.top && e.clientY < r.bottom }) }
    press(e) {
      if (e.button !== 0) return;
      this.el.setPointerCapture(e.pointerId);
      this.scale.set(1 + M.grow / Math.max(this.el.offsetWidth, this.el.offsetHeight), M.press);
      this.down = this.seg(e); this.move(e)
    }
    up(e, cancel) {
      if (this.down < 0) return;
      const target = this.down; this.down = -1;
      this.scale.set(1, M.release); this.fx.set(0, M.flex); this.fy.set(0, M.flex);
      this.move(e);
      if (!cancel && this.seg(e) === target) this.segs[target].dispatchEvent(new CustomEvent('lg-activate', { bubbles: true }))
    }
    move(e) {
      const r = this.el.getBoundingClientRect(), zr = this.zone.getBoundingClientRect();
      const inside = e.type !== 'pointerleave' && e.clientX >= r.left && e.clientX < r.right && e.clientY >= r.top && e.clientY < r.bottom;
      const inZone = e.clientX >= zr.left && e.clientX < zr.right && e.clientY >= zr.top && e.clientY < zr.bottom;
      this.over = inside ? this.seg(e) : -1;
      this.p = [Math.min(Math.max(e.clientX - r.left, 0), r.width), Math.min(Math.max(e.clientY - r.top, 0), r.height)];
      const pressed = this.down >= 0;
      // Hover light: instant on the segment under the pointer in a group (Music switches it between two frames), a
      // quick fade on a single button. While pressed and dragged out, the pressed button keeps its light within the
      // toolbar and loses it outside.
      this.segs.forEach((_, i) => {
        const on = i === this.over || (pressed && i === this.down && inZone);
        if (this.group) { this.light[i].x = this.light[i].t = on ? 1 : 0; this.light[i].v = 0 } else this.light[i].set(on ? 1 : 0, M.fill)
      });
      // Pressed light: a single button lights evenly; a group lights around the pointer (held to the glass's edge), so
      // the pressed segment keeps some light when dragged to its neighbour. Both fall off with the pointer's distance.
      const d = pressed ? this.dist(this.el, e) : 0;
      const f = pressed ? 1 / (1 + (d / M.falloffK) ** M.falloffP) : 0;
      this.segs.forEach((_, i) => this.push[i].set(i === this.down && !this.group ? f : 0, M.pressFill));
      this.glow.set(pressed && this.group ? f : 0, M.pressFill);
      // Rubber band: the glass leans a fraction of a point toward a pointer dragged away from it.
      if (pressed && !inside) {
        const cx = r.width / 2, cy = r.height / 2, dx = e.clientX - r.left - cx, dy = e.clientY - r.top - cy, len = Math.hypot(dx, dy) || 1;
        const pull = M.flexMax * Math.tanh(Math.max(0, len - Math.max(cx, cy)) / M.flexRange);
        this.fx.set(dx / len * pull, M.flex); this.fy.set(dy / len * pull, M.flex)
      } else if (pressed) { this.fx.set(0, M.flex); this.fy.set(0, M.flex) }
      live.add(this); wake(); if (manual) this.render()
    }
    dist(el, e) {
      const r = el.getBoundingClientRect();
      return Math.hypot(Math.max(r.left - e.clientX, 0, e.clientX - r.right), Math.max(r.top - e.clientY, 0, e.clientY - r.bottom))
    }
    step(dt) { for (const s of [this.scale, this.fx, this.fy, this.glow, ...this.light, ...this.push]) s.step(dt); this.render() }
    render() {
      const s = this.el.style, k = this.scale.x, gx = (k - 1) * this.el.offsetWidth / 2, gy = (k - 1) * this.el.offsetHeight / 2;
      s.setProperty('--lg-t', `translate(${this.fx.x.toFixed(3)}px,${this.fy.x.toFixed(3)}px)`);
      const m = window.lgGlassInternals ? ({ ...lgGlassInternals.glassStates.button, ...window.lgLensOver }.margin || 0) : 0;
      this.face.style.inset = `${(-gy - m).toFixed(3)}px ${(-gx - m).toFixed(3)}px`; if (this.rim) Object.assign(this.rim.style, { left: `${(-gx - 1).toFixed(3)}px`, top: `${(-gy - 1).toFixed(3)}px`, width: `calc(100% + ${(2 * gx + 2).toFixed(3)}px)`, height: `calc(100% + ${(2 * gy + 2).toFixed(3)}px)` });
      const t = Math.abs(k - 1) < 1e-4 ? '' : `scale(${k.toFixed(4)})`; this.segs.forEach(seg => { seg.style.transform = t });
      if (this.p) { s.setProperty('--lg-px', (this.p[0] + gx + m).toFixed(1) + 'px'); s.setProperty('--lg-py', (this.p[1] + gy + m).toFixed(1) + 'px') }
      s.setProperty('--lg-glow', (this.glow.x * M.glow).toFixed(4));
      const hover = this.group ? M.hoverGroup : M.hover;
      this.segs.forEach((seg, i) => seg.style.setProperty('--lg-light', (this.light[i].x * hover + this.push[i].x * M.pressed).toFixed(4)))
    }
  }

  const init = root => root.querySelectorAll('.lg-glass:not([data-lg-ready])').forEach(el => {
    el.dataset.lgReady = ''; el.lgGlass = new Glass(el);
    if (window.lgLens) { el.lgGlass.face.style.inset = -({ ...lgGlassInternals.glassStates.button, ...window.lgLensOver }.margin || 0) + 'px'; lgLens(el.lgGlass.face, { ...M.lens, ...window.lgLensOver }) } // drawn at the face's size
  });
  window.lgGlassButtons = { init, M };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => init(document)); else init(document);
})();

'use strict';
// Particles and visual effects. All drawing happens at the 480x270 render resolution.

const PALETTES = {
  red: [[255, 246, 246], [255, 92, 110], [226, 24, 50], [120, 8, 30]],
  gold: [[255, 255, 238], [255, 214, 120], [255, 70, 70], [150, 10, 36]],
  violet: [[250, 240, 255], [255, 120, 200], [200, 30, 110], [90, 10, 60]],
  enemy: [[255, 250, 220], [255, 200, 90], [230, 110, 40], [120, 40, 20]],
  cyan: [[240, 255, 255], [120, 240, 255], [30, 170, 210], [10, 60, 90]],
};

const FX = {
  parts: [], swooshes: [], lines: [], rings: [], texts: [], decals: [], ghosts: [], gibs: [], bolts: [],
  lights: [], frameLights: [],
  flashA: 0, flashColor: '#ffffff',
  scratch: null,
  ghostPool: [],
  MAX_PARTS: 1600,

  init() { this.scratch = makeCanvas(360, 360); },
  clear() {
    this.parts.length = 0; this.swooshes.length = 0; this.lines.length = 0; this.rings.length = 0;
    this.texts.length = 0; this.decals.length = 0; this.gibs.length = 0; this.bolts.length = 0; this.lights.length = 0;
    for (const g of this.ghosts) this.ghostPool.push(g.c);
    this.ghosts.length = 0;
    this.flashA = 0;
  },
  n(count) {
    const v = count * S.visuals.particles;
    return Math.floor(v) + (Math.random() < v % 1 ? 1 : 0);
  },
  add(p) {
    if (this.parts.length >= this.MAX_PARTS) this.parts.splice(0, 50);
    this.parts.push(p);
    return p;
  },

  // ---------- spawners ----------
  sparks(x, y, count, ang, spread, smin, smax, opt = {}) {
    for (let i = this.n(count); i > 0; i--) {
      const a = ang + (Math.random() - 0.5) * spread, s = rand(smin, smax);
      this.add({
        k: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        t: 0, dur: rand(0.12, 0.32) * (opt.life || 1), g: opt.g === undefined ? 300 : opt.g, drag: opt.drag || 3,
        c0: opt.c0 || '#fff2f4', c1: opt.c1 || '#ff3a52', c2: opt.c2 || '#8a0c22',
      });
    }
  },
  debris(x, y, count, colors, speed = 140, up = 1) {
    for (let i = this.n(count); i > 0; i--) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4 * up;
      const s = rand(speed * 0.3, speed);
      this.add({
        k: 'px', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, dur: rand(0.8, 1.8),
        g: 620, drag: 0.6, c: pick(colors), sz: Math.random() < 0.3 ? 2 : 1, bounce: 0.35,
      });
    }
  },
  dust(x, y, count, opt = {}) {
    for (let i = this.n(count); i > 0; i--) {
      const a = opt.ang === undefined ? rand(0, TAU) : opt.ang + (Math.random() - 0.5) * (opt.spread || 1);
      const s = rand(opt.smin || 10, opt.smax || 60);
      this.add({
        k: 'dust', x: x + rand(-2, 2), y: y + rand(-2, 1), vx: Math.cos(a) * s, vy: Math.sin(a) * s - (opt.rise || 8),
        t: 0, dur: rand(0.3, 0.7) * (opt.life || 1), g: -10, drag: 4, r0: opt.r0 || 1.5, r1: opt.r1 || 4,
        c: opt.c || '#8a7c8c', a: opt.a || 0.55,
      });
    }
  },
  embers(x, y, count, opt = {}) {
    for (let i = this.n(count); i > 0; i--) {
      this.add({
        k: 'ember', x: x + rand(-3, 3), y, vx: rand(-15, 15), vy: rand(-60, -20), t: 0, dur: rand(0.5, 1.3),
        g: -20, drag: 1.5, c: opt.c || pick(['#ffcc55', '#ff8833', '#ff5522']),
      });
    }
  },
  oil(x, y, count, ang, speed = 120) {
    for (let i = this.n(count); i > 0; i--) {
      const a = ang + (Math.random() - 0.5) * 1.6, s = rand(speed * 0.3, speed);
      this.add({
        k: 'oil', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, t: 0, dur: 1.4,
        g: 700, drag: 0.8, c: pick(['#1a1418', '#2a1e22', '#3a2a24']), sz: Math.random() < 0.4 ? 2 : 1,
      });
    }
  },
  elec(x, y, r, count, opt = {}) {
    for (let i = this.n(count); i > 0; i--) {
      const a = rand(0, TAU), l = rand(r * 0.4, r);
      this.bolts.push({
        x0: x, y0: y, x1: x + Math.cos(a) * l, y1: y + Math.sin(a) * l, t: 0, dur: rand(0.04, 0.1),
        outer: opt.outer || '#ff2a48', core: opt.core || '#ffe6ee', jag: opt.jag || 2.5, w: 1,
      });
    }
  },
  bolt(x0, y0, x1, y1, dur = 0.1, opt = {}) {
    this.bolts.push({ x0, y0, x1, y1, t: 0, dur, outer: opt.outer || '#ff2a48', core: opt.core || '#fff0f4', jag: opt.jag || 4, w: opt.w || 1 });
  },
  swoosh(o) {
    const s = Object.assign({ t: 0, dur: 0.24, sweep: 0.09, trail: 0.85, thick: 9, dir: 1, pal: PALETTES.red, ox: 0, oy: 0, bolts: true }, o);
    s.r = Math.min(s.r, 170);
    this.swooshes.push(s);
    return s;
  },
  slashLine(x0, y0, x1, y1, o = {}) {
    this.lines.push(Object.assign({ x0, y0, x1, y1, t: 0, dur: 0.35, w: 4, pal: PALETTES.red, grow: 0.05 }, o));
  },
  ring(x, y, r0, r1, dur, o = {}) {
    this.rings.push(Object.assign({ x, y, r0, r1, t: 0, dur, sy: 1, w: 2, c: '#ff3a52', core: '#ffe8ec' }, o));
  },
  text(str, x, y, o = {}) {
    this.texts.push(Object.assign({ str: String(str), x, y, vy: -40, t: 0, dur: 0.7, c: '#ffffff', scale: 1 }, o));
  },
  decal(kind, x, y, o = {}) {
    if (this.decals.length > 60) this.decals.shift();
    const d = Object.assign({ kind, x, y, t: 0, dur: 6 }, o);
    if (kind === 'crack') {
      d.pts = [];
      const n = o.n || 6, len = o.len || 20;
      for (let i = 0; i < n; i++) {
        const a = Math.PI + (i / (n - 1)) * Math.PI + rand(-0.15, 0.15);
        let px = 0, py = 0;
        const seg = [0, 0];
        const steps = randi(3, 5);
        for (let j = 0; j < steps; j++) {
          px += Math.cos(a) * (len / steps) * rand(0.6, 1.3) * (a > Math.PI * 1.5 ? 1 : 1);
          py += Math.abs(Math.sin(a)) * rand(0.5, 1.5) * 0.6 + rand(-0.8, 0.8);
          seg.push(px, py);
        }
        d.pts.push(seg);
      }
    }
    this.decals.push(d);
  },
  ghost(src, x, y, color = '#ff2a48', dur = 0.25, alpha = 0.6) {
    const c = this.ghostPool.pop() || makeCanvas(src.width, src.height);
    if (c.width !== src.width || c.height !== src.height) { c.width = src.width; c.height = src.height; c.ctx.imageSmoothingEnabled = false; }
    const g = c.ctx;
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, c.width, c.height);
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'source-over';
    this.ghosts.push({ c, x, y, t: 0, dur, a: alpha });
    if (this.ghosts.length > 24) this.ghostPool.push(this.ghosts.shift().c);
  },
  gib(img, x, y, ox, oy, ang, side, vx, vy, bottom = 4) {
    if (this.gibs.length > 30) this.gibs.shift();
    this.gibs.push({ img, x, y, ox, oy, nx: Math.cos(ang + Math.PI / 2), ny: Math.sin(ang + Math.PI / 2), side, vx, vy, rot: 0, vr: rand(-8, 8), t: 0, dur: rand(1.6, 2.4), ground: false, bottom });
  },
  light(x, y, r, color, a = 1, dur = 0.2) { this.lights.push({ x, y, r, color, a, t: 0, dur }); },
  frameLight(x, y, r, color, a = 1) { this.frameLights.push({ x, y, r, color, a }); },
  flash(color = '#ffffff', a = 0.5) {
    if (!S.visuals.flashes) return;
    this.flashColor = color;
    this.flashA = Math.max(this.flashA, a);
  },

  // ---------- update ----------
  update(dt) {
    const parts = this.parts;
    let w = 0;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      p.t += dt;
      if (p.t >= p.dur) continue;
      const px = p.x, py = p.y;
      p.vy += p.g * dt;
      const dr = Math.max(0, 1 - p.drag * dt);
      p.vx *= dr; p.vy *= dr;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if ((p.k === 'px' || p.k === 'oil') && Level.pointSolid(p.x, p.y, py)) {
        if (p.k === 'oil') {
          if (Math.random() < 0.5) this.decal('oil', Math.round(p.x), Math.round(py), { dur: 8, c: p.c, sz: p.sz + randi(0, 2) });
          continue;
        }
        p.x = px; p.y = py;
        p.vy = -p.vy * p.bounce; p.vx *= 0.6;
        if (Math.abs(p.vy) < 20) { p.vy = 0; p.g = 0; p.vx *= 0.5; }
      }
      parts[w++] = p;
    }
    parts.length = w;

    const step = (arr, extra) => {
      let j = 0;
      for (let i = 0; i < arr.length; i++) {
        const o = arr[i];
        o.t += dt;
        if (extra) extra(o, dt);
        if (o.t < o.dur) arr[j++] = o;
        else if (arr === this.ghosts) this.ghostPool.push(o.c);
      }
      arr.length = j;
    };
    step(this.swooshes, (s) => {
      if (s.follow) { s.x = s.follow.x + s.ox; s.y = s.follow.y + s.oy; }
      if (s.t < s.sweep && Math.random() < 0.9) {
        const u = easeOutCubic(clamp(s.t / s.sweep, 0, 1));
        const a = s.ang + (s.dir > 0 ? u * s.span - s.span / 2 : s.span / 2 - u * s.span);
        const tx = s.x + Math.cos(a) * s.r, ty = s.y + Math.sin(a) * s.r;
        this.sparks(tx, ty, 2, a + (Math.PI / 2) * s.dir, 1.4, 40, 160, { life: 0.8, c1: rgba(...s.pal[1], 1), c2: rgba(...s.pal[3], 1) });
      }
    });
    step(this.lines);
    step(this.rings);
    step(this.texts, (o, d) => { o.y += o.vy * d; o.vy *= Math.max(0, 1 - 4 * d); });
    step(this.decals);
    step(this.ghosts);
    step(this.bolts);
    step(this.lights);
    step(this.gibs, (g, d) => {
      g.vy += 700 * d;
      g.x += g.vx * d;
      const ny = g.y + g.vy * d;
      if (Level.pointSolid(g.x, ny + g.bottom, g.y + g.bottom)) {
        g.vy = -g.vy * 0.3; g.vx *= 0.55; g.vr *= 0.4;
        if (Math.abs(g.vy) < 30) { g.vy = 0; g.ground = true; }
      } else g.y = ny;
      g.rot += g.vr * d;
    });
  },

  // ---------- drawing ----------
  drawDecals(ctx, cx, cy) {
    for (const d of this.decals) {
      const fade = 1 - clamp((d.t - d.dur * 0.7) / (d.dur * 0.3), 0, 1);
      if (fade <= 0) continue;
      ctx.globalAlpha = fade;
      const x = Math.round(d.x - cx), y = Math.round(d.y - cy);
      if (d.kind === 'crack') {
        ctx.fillStyle = '#120c14';
        for (const seg of d.pts) for (let i = 0; i < seg.length - 2; i += 2) pline(ctx, x + seg[i], y + seg[i + 1], x + seg[i + 2], y + seg[i + 3], 1);
        if (d.t < 0.6) {
          ctx.fillStyle = d.t < 0.25 ? '#ffe0e4' : '#ff3048';
          for (const seg of d.pts) pline(ctx, x + seg[0], y + seg[1], x + seg[2], y + seg[3], 1);
        }
      } else if (d.kind === 'scorch') {
        ctx.fillStyle = '#0e0a10';
        const r = d.r || 14;
        for (let yy = -2; yy <= 1; yy++) for (let xx = -r; xx <= r; xx++) {
          if (Math.abs(xx) / r + Math.abs(yy) / 3 > 1) continue;
          if (bayer(xx + x, yy + y) < 0.6) ctx.fillRect(x + xx, y + yy, 1, 1);
        }
      } else if (d.kind === 'gouge') {
        ctx.fillStyle = '#100c14';
        pline(ctx, x, y, x + d.len, y, 1); pline(ctx, x + d.len * 0.1, y + 1, x + d.len * 0.85, y + 1, 1);
        ctx.fillStyle = '#7a7080'; pline(ctx, x + d.len * 0.2, y - 1, x + d.len * 0.7, y - 1, 1);
        if (d.t < 0.6) { ctx.fillStyle = d.t < 0.25 ? '#ffe0a0' : '#ff5a3a'; pline(ctx, x + d.len * 0.55, y, x + d.len, y, 1); }
      } else if (d.kind === 'oil') {
        ctx.fillStyle = d.c || '#1a1418';
        ctx.fillRect(x - ((d.sz / 2) | 0), y - 1, d.sz || 2, 1);
      }
    }
    ctx.globalAlpha = 1;
  },
  drawGhosts(ctx, cx, cy) {
    for (const g of this.ghosts) {
      ctx.globalAlpha = g.a * (1 - g.t / g.dur);
      ctx.drawImage(g.c, Math.round(g.x - cx), Math.round(g.y - cy));
    }
    ctx.globalAlpha = 1;
  },
  drawGibs(ctx, cx, cy) {
    for (const g of this.gibs) {
      const left = g.dur - g.t;
      if (left < 0.5 && ((g.t * 16) | 0) % 2) continue;
      ctx.save();
      ctx.translate(Math.round(g.x - cx), Math.round(g.y - cy));
      ctx.rotate(g.rot);
      ctx.beginPath();
      const tx = -g.ny, ty = g.nx, L = 60, s = g.side;
      ctx.moveTo(tx * L, ty * L);
      ctx.lineTo(tx * L + g.nx * L * s, ty * L + g.ny * L * s);
      ctx.lineTo(-tx * L + g.nx * L * s, -ty * L + g.ny * L * s);
      ctx.lineTo(-tx * L, -ty * L);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(g.img, -g.ox, -g.oy);
      ctx.restore();
    }
  },
  drawParticles(ctx, cx, cy) {
    for (const p of this.parts) {
      const k = p.t / p.dur;
      const x = p.x - cx, y = p.y - cy;
      if (p.k === 'spark') {
        ctx.fillStyle = k < 0.35 ? p.c0 : k < 0.7 ? p.c1 : p.c2;
        const sp = Math.hypot(p.vx, p.vy), l = Math.min(7, sp * 0.02) + 0.5;
        pline(ctx, x, y, x - (p.vx / (sp || 1)) * l, y - (p.vy / (sp || 1)) * l, 1);
      } else if (p.k === 'px' || p.k === 'oil') {
        ctx.fillStyle = p.c;
        ctx.fillRect(Math.round(x), Math.round(y), p.sz, p.sz);
      } else if (p.k === 'dust') {
        ctx.globalAlpha = p.a * (1 - k);
        ctx.fillStyle = p.c;
        pdisc(ctx, x, y, lerp(p.r0, p.r1, easeOutQuad(k)));
        ctx.globalAlpha = 1;
      } else if (p.k === 'ember') {
        if (Math.random() < 0.15) continue;
        ctx.fillStyle = k < 0.5 ? p.c : '#a03018';
        ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
      }
    }
  },
  drawSwoosh(ctx, s, cx, cy) {
    const prog = clamp(s.t / s.sweep, 0, 1), lead = easeOutCubic(prog);
    const fade = s.t <= s.sweep ? 1 : clamp(1 - (s.t - s.sweep) / (s.dur - s.sweep), 0, 1);
    let tail = Math.max(0, lead - s.trail);
    if (s.t > s.sweep) tail = lerp(Math.max(0, 1 - s.trail), 1, easeInQuad(1 - fade));
    if (lead - tail < 0.01) return;
    const R = Math.ceil(s.r + 2), size = R * 2 + 1;
    if (!s.img || s.img.width !== size) s.img = new ImageData(size, size);
    const d = s.img.data;
    d.fill(0);
    const scx = s.x - cx, scy = s.y - cy;
    const rcx = Math.round(scx), rcy = Math.round(scy);
    const ox = rcx - R, oy = rcy - R;
    const fx = rcx - scx, fy = rcy - scy;
    const rOut2 = (s.r + 0.5) * (s.r + 0.5), rIn = Math.max(0, s.r - s.thick - 1), rIn2 = rIn * rIn;
    const pal = s.pal, span = s.span, half = span / 2, span1 = 1 / span, dl = 1 / (lead - tail);
    const fadeMul = 0.55 + 0.45 * fade, dith = 0.78 * (1.2 - fade * 0.2);
    for (let py = 0; py < size; py++) {
      const dy = py - R + fy;
      for (let px = 0; px < size; px++) {
        const dx = px - R + fx;
        const d2 = dx * dx + dy * dy;
        if (d2 > rOut2 || d2 < rIn2) continue;
        const rel = angDiff(s.ang, Math.atan2(dy, dx));
        if (rel > half || rel < -half) continue;
        const u = s.dir > 0 ? (rel + half) * span1 : (half - rel) * span1;
        if (u < tail || u > lead) continue;
        const k = (u - tail) * dl;
        const th = s.thick * (0.2 + 0.8 * Math.sqrt(k));
        const dd = Math.sqrt(d2), inner = s.r - th;
        if (dd < inner) continue;
        const w = (dd - inner) / th;
        const I = k * (0.35 + 0.65 * w) * fadeMul;
        if (I < bayer(px + ox, py + oy) * dith) continue;
        const c = I > 0.8 ? pal[0] : I > 0.58 ? pal[1] : I > 0.34 ? pal[2] : pal[3];
        const i4 = (py * size + px) << 2;
        d[i4] = c[0]; d[i4 + 1] = c[1]; d[i4 + 2] = c[2]; d[i4 + 3] = 255;
      }
    }
    const sc = this.scratch;
    sc.ctx.putImageData(s.img, 0, 0);
    ctx.drawImage(sc, 0, 0, size, size, ox, oy, size, size);
    if (s.bolts && s.t < s.sweep + 0.06) {
      const toA = (u) => s.ang + (s.dir > 0 ? u * span - half : half - u * span);
      for (let b = 0; b < 2; b++) {
        let pu = tail + (lead - tail) * Math.random() * 0.3, pr = s.r * rand(0.8, 1.02);
        ctx.fillStyle = b ? rgba(...pal[0], 1) : rgba(...pal[1], 1);
        for (let i = 0; i < 4; i++) {
          const nu = Math.min(lead, pu + (lead - tail) * rand(0.15, 0.3)), nr = s.r * rand(0.78, 1.06);
          const a0 = toA(pu), a1 = toA(nu);
          pline(ctx, scx + Math.cos(a0) * pr, scy + Math.sin(a0) * pr, scx + Math.cos(a1) * nr, scy + Math.sin(a1) * nr, 1);
          pu = nu; pr = nr;
        }
      }
    }
  },
  drawEmissive(ctx, cx, cy) {
    for (const s of this.swooshes) this.drawSwoosh(ctx, s, cx, cy);
    for (const L of this.lines) {
      const k = L.t / L.dur, grow = clamp(L.t / L.grow, 0, 1);
      const x0 = L.x0 - cx, y0 = L.y0 - cy;
      const x1 = lerp(x0, L.x1 - cx, easeOutCubic(grow)), y1 = lerp(y0, L.y1 - cy, easeOutCubic(grow));
      const w = Math.max(1, Math.round(L.w * (1 - k) ** 0.7));
      ctx.fillStyle = rgba(...L.pal[2], 1);
      pline(ctx, x0, y0, x1, y1, w + 2);
      ctx.fillStyle = rgba(...(k < 0.5 ? L.pal[0] : L.pal[1]), 1);
      pline(ctx, x0, y0, x1, y1, w);
    }
    for (const r of this.rings) {
      const k = r.t / r.dur, rr = lerp(r.r0, r.r1, easeOutCubic(k));
      ctx.globalAlpha = 1 - k * k;
      ctx.fillStyle = r.c;
      pring(ctx, r.x - cx, r.y - cy, rr, r.sy, r.w + 1);
      ctx.fillStyle = r.core;
      pring(ctx, r.x - cx, r.y - cy, rr - 1, r.sy, r.w);
    }
    ctx.globalAlpha = 1;
    for (const b of this.bolts) {
      drawBolt(ctx, b.x0 - cx, b.y0 - cy, b.x1 - cx, b.y1 - cy, b.outer, b.core, b.jag, b.w);
    }
    this.drawParticles(ctx, cx, cy);
  },
  drawTexts(ctx, cx, cy) {
    for (const t of this.texts) {
      if (!t.always && !S.visuals.damageNumbers) continue;
      const k = t.t / t.dur;
      if (k > 0.7 && ((t.t * 20) | 0) % 2) continue;
      const pop = t.t < 0.08 ? 1 + (1 - t.t / 0.08) : 1;
      drawText(ctx, t.str, t.x - cx, t.y - cy, { color: t.c, scale: Math.round(t.scale * pop), align: 'center' });
    }
  },
};

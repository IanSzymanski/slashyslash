'use strict';
// The abandoned city arena: collision geometry, body physics, and prerendered parallax layers.

const Level = {
  W: 2400, H: 440, GROUND: 400, CAM_Y_MIN: -60,
  solids: [], platforms: [], buildings: [],
  spawnGround: [], spawnHigh: [], barrelSpots: [],
  lamps: [], neons: [], fires: [], beacons: [],
  layers: {},
  built: false,

  build() {
    if (this.built) return;
    this.built = true;
    const G = this.GROUND;
    const S_ = (x, y, w, h, kind, style) => this.solids.push({ x, y, w, h, kind, style });
    const P_ = (x, y, w, kind) => this.platforms.push({ x, y, w, h: 4, kind, oneWay: true });
    // Buildings are scenery you can run through; only their roofs and balconies are walkable.
    const B_ = (x, top, w, style) => { this.buildings.push({ x, y: top, w, h: G - top, kind: 'building', style }); P_(x, top, w, 'roof'); };
    S_(-200, G, 2800, 120, 'ground');
    S_(-200, -400, 240, G + 400, 'wall', 'concrete');
    S_(2360, -400, 240, G + 400, 'wall', 'brick');
    S_(-200, -260, 2800, 200, 'ceiling');
    B_(110, 335, 140, 'shop');
    B_(380, 205, 160, 'brick');
    B_(860, 335, 120, 'shop2');
    B_(1130, 175, 180, 'panel');
    B_(1580, 255, 140, 'brick2');
    B_(1960, 205, 160, 'concrete');
    for (const cx of [300, 1400, 1870]) {
      S_(cx, G - 10, 38, 10, 'car');
      S_(cx + 8, G - 17, 22, 7, 'carTop');
    }
    S_(770, G - 10, 22, 10, 'barrier');
    S_(2250, G - 10, 22, 10, 'barrier');

    // tiers sit about 65px apart so a jump plus double jump reaches the next one
    P_(40, 335, 60, 'fire'); P_(40, 270, 56, 'fire'); P_(40, 205, 52, 'fire');
    P_(2300, 335, 60, 'fire'); P_(2304, 270, 56, 'fire'); P_(2308, 205, 52, 'fire');
    P_(340, 335, 40, 'balcony'); P_(540, 270, 46, 'balcony'); P_(540, 335, 40, 'balcony');
    P_(255, 270, 60, 'girder');
    P_(620, 320, 220, 'overpass');
    P_(690, 250, 90, 'girder');
    P_(990, 335, 70, 'scaffold'); P_(1040, 270, 60, 'scaffold');
    P_(1090, 215, 40, 'balcony'); P_(1310, 240, 46, 'balcony'); P_(1310, 310, 40, 'balcony');
    P_(1400, 300, 140, 'sign');
    P_(1450, 225, 80, 'girder');
    P_(1540, 325, 40, 'balcony');
    P_(1780, 335, 100, 'scaffold');
    P_(1790, 270, 90, 'girder');
    P_(1920, 335, 40, 'balcony'); P_(2120, 270, 46, 'balcony');
    P_(2190, 300, 70, 'girder');

    this.all = this.solids.concat(this.platforms);
    this.spawnGround = [70, 270, 470, 700, 900, 1060, 1250, 1450, 1650, 1850, 2050, 2280].map((x) => ({ x, y: G }));
    this.spawnHigh = [
      { x: 180, y: 335 }, { x: 460, y: 205 }, { x: 730, y: 320 }, { x: 920, y: 335 }, { x: 1220, y: 175 },
      { x: 1470, y: 300 }, { x: 1650, y: 255 }, { x: 2040, y: 205 }, { x: 735, y: 250 }, { x: 1490, y: 225 }, { x: 1830, y: 270 },
    ];
    this.barrelSpots = [{ x: 240, y: G }, { x: 700, y: 320 }, { x: 1020, y: G }, { x: 1480, y: G }, { x: 1990, y: G }, { x: 1250, y: 175 }, { x: 2230, y: G }];
    this.lamps = [{ x: 330, flick: false }, { x: 760, flick: true }, { x: 1240, flick: false }, { x: 1600, flick: false }, { x: 2010, flick: true }, { x: 2290, flick: false }];
    this.fires = [{ x: 140, y: G }, { x: 940, y: G }, { x: 1700, y: G }, { x: 1200, y: 175 }, { x: 2160, y: G }];
    this.neons = [
      { x: 527, y: 222, text: 'HOTEL', color: '#ff3ad0', vertical: true, broken: 3 },
      { x: 1150, y: 188, text: 'RAMEN', color: '#3af0ff', broken: -1 },
      { x: 122, y: 344, text: '24H', color: '#ffd03a', broken: 1 },
      { x: 1600, y: 266, text: 'BAR', color: '#7dff5a', broken: -1 },
      { x: 872, y: 344, text: 'OPEN', color: '#ff5a5a', broken: 2 },
    ];
    this.prerender();
  },

  // ---------- physics ----------
  pointSolid(x, y, prevY, skipCeiling) {
    for (const s of this.solids) {
      if (skipCeiling && s.kind === 'ceiling') continue;
      if (x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h) return true;
    }
    if (prevY !== undefined) {
      for (const p of this.platforms) if (x >= p.x && x < p.x + p.w && prevY <= p.y && y >= p.y) return true;
    }
    return false;
  },
  rectFree(x, y, w, h) {
    for (const s of this.solids) if (aabb(x, y, w, h, s.x, s.y, s.w, s.h)) return false;
    return true;
  },
  groundBelow(x, y) {
    let best = this.GROUND + 100;
    for (const s of this.all) if (x >= s.x && x < s.x + s.w && s.y >= y - 0.5 && s.y < best) best = s.y;
    return best;
  },
  moveBody(b, dt, opt = {}) {
    const c = b.col || (b.col = {});
    c.ground = false; c.ceil = false; c.wallL = false; c.wallR = false; c.oneWay = false; c.landed = null;
    const solids = this.solids;
    // X axis
    const dx = b.vx * dt;
    if (dx !== 0) {
      const steps = Math.max(1, Math.ceil(Math.abs(dx) / 3)), sx = dx / steps;
      outer: for (let i = 0; i < steps; i++) {
        b.x += sx;
        const l = b.x - b.w / 2, r = b.x + b.w / 2, t = b.y - b.h, bt = b.y;
        for (const s of solids) {
          if (r > s.x && l < s.x + s.w && bt > s.y && t < s.y + s.h) {
            // step up small lips (car hoods, kerbs)
            if (opt.step && b.onGround && s.y > bt - opt.step && this.rectFree(b.x - b.w / 2, s.y - b.h - 0.01, b.w, b.h)) {
              b.y = s.y; continue;
            }
            if (sx > 0) { b.x = s.x - b.w / 2; c.wallR = true; } else { b.x = s.x + s.w + b.w / 2; c.wallL = true; }
            b.vx = 0;
            break outer;
          }
        }
      }
    }
    // Y axis
    const dy = b.vy * dt;
    if (dy !== 0) {
      const steps = Math.max(1, Math.ceil(Math.abs(dy) / 3)), sy = dy / steps;
      outer: for (let i = 0; i < steps; i++) {
        const prevBottom = b.y;
        b.y += sy;
        const l = b.x - b.w / 2, r = b.x + b.w / 2, t = b.y - b.h, bt = b.y;
        for (const s of solids) {
          if (r > s.x && l < s.x + s.w && bt > s.y && t < s.y + s.h) {
            if (sy > 0) { b.y = s.y; c.ground = true; c.landed = s; } else { b.y = s.y + s.h + b.h; c.ceil = true; }
            b.vy = 0;
            break outer;
          }
        }
        if (sy > 0 && opt.oneWay !== false && !b.dropThrough) {
          for (const p of this.platforms) {
            if (r > p.x && l < p.x + p.w && prevBottom <= p.y + 0.01 && bt >= p.y) {
              b.y = p.y; c.ground = true; c.oneWay = true; c.landed = p; b.vy = 0;
              break outer;
            }
          }
        }
      }
    }
    // resting contact probes
    if (!c.ground && b.vy >= 0) c.ground = this.standing(b, opt);
    b.onGround = c.ground;
    return c;
  },
  standing(b, opt = {}) {
    const l = b.x - b.w / 2, r = b.x + b.w / 2, y = b.y;
    for (const s of this.solids) if (r > s.x && l < s.x + s.w && Math.abs(s.y - y) < 0.05) return true;
    if (opt.oneWay !== false && !b.dropThrough) for (const p of this.platforms) if (r > p.x && l < p.x + p.w && Math.abs(p.y - y) < 0.05) return true;
    return false;
  },
  onOneWay(b) {
    const l = b.x - b.w / 2, r = b.x + b.w / 2;
    for (const s of this.solids) if (r > s.x && l < s.x + s.w && Math.abs(s.y - b.y) < 0.05) return false;
    for (const p of this.platforms) if (r > p.x && l < p.x + p.w && Math.abs(p.y - b.y) < 0.05) return true;
    return false;
  },
  touchingWall(b, dir) {
    const x = dir > 0 ? b.x + b.w / 2 + 1 : b.x - b.w / 2 - 1;
    for (const s of this.solids) {
      if (s.kind === 'car' || s.kind === 'carTop' || s.kind === 'barrier' || s.kind === 'ceiling') continue;
      if (x > s.x && x < s.x + s.w && b.y - 2 > s.y && b.y - b.h + 2 < s.y + s.h) return true;
    }
    return false;
  },
  raycast(x0, y0, x1, y1) { return rayRects(x0, y0, x1, y1, this.solids); },

  // ---------- prerender ----------
  layerSize(f) {
    return [Math.ceil(VIEW_W + (this.W - VIEW_W) * f) + 4, Math.ceil(VIEW_H + (this.H - VIEW_H - this.CAM_Y_MIN) * f) + 4];
  },
  // Layer-space y where the street sits when the camera rests at ground level.
  groundBase(f) {
    const camGround = this.H - VIEW_H;
    return this.GROUND - camGround + (camGround - this.CAM_Y_MIN) * f;
  },
  prerender() {
    const R = mulberry32(1337);
    this.layers.sky = this.paintSky(R);
    this.layers.far = this.paintSkyline(R, 0.15, { base: Math.round(this.groundBase(0.15)) - 4, hMin: 50, hMax: 130, wMin: 18, wMax: 46, col: '#2b1631', win: ['#5a2440', '#6e2c3c'], winP: 0.05, haze: '#4a1c34', tall: true });
    this.layers.mid = this.paintSkyline(R, 0.45, { base: Math.round(this.groundBase(0.45)) - 10, hMin: 70, hMax: 190, wMin: 34, wMax: 80, col: '#1f1226', win: ['#9a3a40', '#c45a3a', '#5a2a48'], winP: 0.07, haze: '#3a1430', details: true });
    this.layers.back = this.paintBack(R);
    this.layers.play = this.paintPlay(R);
  },
  paintSky(R) {
    const c = makeCanvas(VIEW_W, VIEW_H), g = c.ctx;
    const img = g.createImageData(VIEW_W, VIEW_H), d = img.data;
    const stops = [[0, [16, 9, 30]], [0.35, [42, 16, 50]], [0.62, [94, 28, 54]], [0.82, [170, 58, 48]], [1, [214, 98, 58]]];
    for (let y = 0; y < VIEW_H; y++) {
      const t = y / VIEW_H;
      let i = 0;
      while (i < stops.length - 2 && t > stops[i + 1][0]) i++;
      const [t0, c0] = stops[i], [t1, c1] = stops[i + 1];
      const k = clamp((t - t0) / (t1 - t0), 0, 1);
      for (let x = 0; x < VIEW_W; x++) {
        // ordered dithering between quantised bands keeps the gradient pixel-y
        const q = Math.round(clamp(k + (bayer(x, y) - 0.5) * 0.18, 0, 1) * 6) / 6;
        const o = (y * VIEW_W + x) * 4;
        d[o] = lerp(c0[0], c1[0], q); d[o + 1] = lerp(c0[1], c1[1], q); d[o + 2] = lerp(c0[2], c1[2], q); d[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    for (let i = 0; i < 90; i++) {
      g.fillStyle = R() < 0.2 ? '#d8c8e8' : '#7a6290';
      g.fillRect((R() * VIEW_W) | 0, (R() * 110) | 0, 1, 1);
    }
    // dying red sun behind smog, with a dithered halo
    const sx = 330, sy = 168;
    for (let y = -64; y <= 64; y++) for (let x = -64; x <= 64; x++) {
      const dd = Math.hypot(x, y);
      if (dd < 27 || dd > 64) continue;
      const k = 1 - (dd - 27) / 37;
      if (bayer(sx + x, sy + y) < k * k * 0.6) { g.fillStyle = k > 0.6 ? '#d85a40' : '#a8403e'; g.fillRect(sx + x, sy + y, 1, 1); }
    }
    g.fillStyle = '#f2704e'; pdisc(g, sx, sy, 27);
    g.fillStyle = '#ff9466'; pdisc(g, sx - 3, sy - 3, 20);
    g.fillStyle = '#ffb27a'; pdisc(g, sx - 6, sy - 6, 9);
    // smog bands across the sun
    for (let i = 0; i < 26; i++) {
      const y = (R() * 200 + 40) | 0, x = (R() * VIEW_W) | 0, w = (R() * 160 + 40) | 0;
      g.fillStyle = y > 150 ? 'rgba(120,36,52,0.55)' : 'rgba(54,20,52,0.5)';
      for (let xx = 0; xx < w; xx++) {
        const hh = (1 + (Math.sin(xx * 0.08 + i) + 1) * 1.2) | 0;
        if (bayer(x + xx, y) < 0.8) g.fillRect(x + xx, y, 1, hh);
      }
    }
    return c;
  },
  paintSkyline(R, f, o) {
    const [w, h] = this.layerSize(f);
    const c = makeCanvas(w, h), g = c.ctx;
    let x = -10;
    while (x < w) {
      const bw = (o.wMin + R() * (o.wMax - o.wMin)) | 0;
      let bh = (o.hMin + R() * (o.hMax - o.hMin)) | 0;
      if (o.tall && R() < 0.12) bh += 60;
      const top = o.base - bh;
      g.fillStyle = o.col;
      g.fillRect(x, top, bw, h - top);
      // broken tops
      if (R() < 0.45) {
        for (let i = 0; i < bw; i++) {
          const cut = Math.max(0, Math.sin(i * 0.5 + x) * 3 + R() * 6 - 2) | 0;
          g.clearRect(x + i, top, 1, cut);
        }
      }
      if (o.details && R() < 0.35) {
        g.fillRect(x + ((bw * 0.3) | 0), top - 10, 2, 10);
        if (R() < 0.5) { g.fillRect(x + bw - 14, top - 12, 10, 8); g.fillRect(x + bw - 13, top - 4, 1, 4); g.fillRect(x + bw - 6, top - 4, 1, 4); }
      }
      if (R() < 0.3) this.beacons.push({ f, x: x + bw / 2, y: top - 2, phase: R() * 6 });
      // windows
      for (let wy = top + 4; wy < o.base - 4; wy += 5) {
        for (let wx = x + 3; wx < x + bw - 3; wx += 4) {
          if (R() < o.winP) { g.fillStyle = pick(o.win); g.fillRect(wx, wy, 2, 2); }
        }
      }
      x += bw + ((R() * 6) | 0) - 1;
    }
    // haze toward the base
    for (let y = o.base - 70; y < h; y++) {
      const k = clamp((y - (o.base - 70)) / 80, 0, 1);
      g.fillStyle = o.haze;
      for (let xx = 0; xx < w; xx++) if (bayer(xx, y) < k * 0.85) g.fillRect(xx, y, 1, 1);
    }
    return c;
  },
  paintBack(R) {
    const f = 0.8, [w, h] = this.layerSize(f);
    const c = makeCanvas(w, h), g = c.ctx;
    const base = Math.round(this.groundBase(f)) + 6;
    let x = -6;
    const cols = ['#2c2232', '#30243a', '#281e2e', '#33263a'];
    while (x < w) {
      const bw = (60 + R() * 90) | 0, bh = (90 + R() * 170) | 0, top = base - bh;
      const col = pick(cols);
      g.fillStyle = col;
      g.fillRect(x, top, bw, h - top);
      g.fillStyle = '#3e3046';
      g.fillRect(x, top, bw, 2);
      g.fillStyle = '#211826';
      g.fillRect(x + bw - 2, top, 2, h - top);
      if (R() < 0.5) {
        g.fillStyle = col;
        for (let i = 0; i < bw; i += 2) {
          const up = Math.max(0, (Math.sin(i * 0.3 + R() * 3) * 4 + R() * 5) | 0);
          g.fillRect(x + i, top - up, 2, up);
        }
      }
      const ww = 4, wh = 6, sx = 9, sy = 12;
      for (let wy = top + 8; wy < base - 20; wy += sy) {
        for (let wx = x + 6; wx < x + bw - 8; wx += sx) {
          const r = R();
          g.fillStyle = r < 0.06 ? '#c07a48' : r < 0.1 ? '#7a4a58' : r < 0.55 ? '#18121c' : '#1e1622';
          g.fillRect(wx, wy, ww, wh);
          if (r > 0.9) { g.fillStyle = '#3a3048'; g.fillRect(wx, wy + 2, ww, 1); }
        }
      }
      // zigzag fire escapes
      if (R() < 0.5) {
        const fx = x + ((bw * 0.25) | 0);
        g.fillStyle = '#1a141e';
        for (let fy = top + 20; fy < base - 30; fy += 24) {
          g.fillRect(fx, fy, 22, 2);
          pline(g, fx + 2, fy + 2, fx + 20, fy + 22, 1);
          for (let i = 0; i < 22; i += 3) g.fillRect(fx + i, fy - 5, 1, 5);
          g.fillRect(fx, fy - 5, 22, 1);
        }
      }
      if (R() < 0.35) {
        g.fillStyle = '#1e1622';
        g.fillRect(x + bw - 24, top - 16, 14, 11);
        g.fillRect(x + bw - 23, top - 5, 1, 5); g.fillRect(x + bw - 12, top - 5, 1, 5);
        g.fillStyle = '#2a2030'; g.fillRect(x + bw - 24, top - 18, 14, 2);
      }
      if (R() < 0.4) { g.fillStyle = '#1e1622'; g.fillRect(x + 10, top - 22, 1, 22); g.fillRect(x + 7, top - 18, 7, 1); }
      x += bw + ((R() * 20) | 0);
    }
    // power poles and sagging cables
    const poles = [];
    for (let px = 40; px < w; px += 150 + ((R() * 60) | 0)) {
      poles.push(px);
      g.fillStyle = '#17111a';
      g.fillRect(px, base - 120, 3, 120);
      g.fillRect(px - 8, base - 116, 19, 2);
      g.fillRect(px - 6, base - 106, 15, 2);
    }
    g.fillStyle = '#120d15';
    for (let i = 0; i < poles.length - 1; i++) {
      for (const yy of [-115, -105]) {
        const ax = poles[i] + 1, bx = poles[i + 1] + 1;
        for (let xx = ax; xx < bx; xx++) {
          const t = (xx - ax) / (bx - ax);
          g.fillRect(xx, base + yy + Math.sin(t * Math.PI) * 14, 1, 1);
        }
      }
    }
    return c;
  },
  paintPlay(R) {
    const c = makeCanvas(this.W, this.H + 20), g = c.ctx;
    const G = this.GROUND;
    // overpass pillars and scaffold legs go behind everything else
    for (const p of this.platforms) {
      if (p.kind === 'overpass') {
        for (const px of [p.x + 40, p.x + p.w - 54]) {
          g.fillStyle = '#3a3240'; g.fillRect(px, p.y + 8, 16, G - p.y - 8);
          g.fillStyle = '#4a4050'; g.fillRect(px, p.y + 8, 3, G - p.y - 8);
          g.fillStyle = '#2a2430'; g.fillRect(px + 13, p.y + 8, 3, G - p.y - 8);
          g.fillStyle = '#5a2838';
          for (let i = 0; i < 6; i++) g.fillRect(px + 4 + ((R() * 8) | 0), G - 30 + ((R() * 20) | 0), 2, 1);
          g.fillStyle = '#7a3a8a'; g.fillRect(px + 4, G - 34, 7, 1); g.fillRect(px + 5, G - 31, 5, 1);
        }
      }
      if (p.kind === 'scaffold') {
        g.fillStyle = '#5c5c6a';
        g.fillRect(p.x + 2, p.y, 2, G - p.y); g.fillRect(p.x + p.w - 4, p.y, 2, G - p.y);
        g.fillStyle = '#4a4a56';
        for (let yy = p.y + 14; yy < G - 6; yy += 22) pline(g, p.x + 3, yy, p.x + p.w - 3, yy + 18, 1);
      }
    }
    for (const s of this.buildings) this.paintBuilding(g, s, R);
    for (const s of this.solids) if (s.kind === 'wall') this.paintBuilding(g, s, R);
    this.paintGround(g, R);
    for (const p of this.platforms) this.paintPlatform(g, p, R);
    for (const s of this.solids) {
      if (s.kind === 'car') this.paintCar(g, s, R);
      if (s.kind === 'barrier') this.paintBarrier(g, s);
    }
    // street lamps
    for (const l of this.lamps) {
      g.fillStyle = '#26222c'; g.fillRect(l.x, G - 62, 2, 62);
      g.fillStyle = '#34303a'; g.fillRect(l.x - 1, G - 4, 4, 4);
      g.fillRect(l.x, G - 62, 12, 2);
      g.fillStyle = '#4a4450'; g.fillRect(l.x + 8, G - 61, 7, 3);
      l.hx = l.x + 11; l.hy = G - 57;
    }
    // burn barrels
    for (const fb of this.fires) {
      g.fillStyle = '#3a2a26'; g.fillRect(fb.x - 5, fb.y - 12, 10, 12);
      g.fillStyle = '#5a3a2a'; g.fillRect(fb.x - 5, fb.y - 12, 10, 1); g.fillRect(fb.x - 5, fb.y - 7, 10, 1);
      g.fillStyle = '#2a1c1a'; g.fillRect(fb.x + 3, fb.y - 11, 2, 11);
      g.fillStyle = '#ff7a2a'; g.fillRect(fb.x - 4, fb.y - 13, 8, 1);
    }
    // trash, tyres, weeds along the street
    for (let i = 0; i < 80; i++) {
      const x = 50 + R() * (this.W - 100), k = R();
      if (k < 0.3) { g.fillStyle = '#1e1a22'; g.fillRect(x, G - 4, 6, 4); g.fillStyle = '#2c2630'; g.fillRect(x + 1, G - 5, 4, 1); }
      else if (k < 0.5) { g.fillStyle = '#16131a'; pdisc(g, x, G - 3, 3); g.fillStyle = '#2a2530'; pdisc(g, x, G - 3, 1); }
      else { g.fillStyle = pick(['#2f5236', '#3f6e3e', '#4a7a3a']); for (let j = 0; j < 4; j++) g.fillRect(x + j * 2, G - 2 - ((R() * 5) | 0), 1, 6); }
    }
    return c;
  },
  paintBuilding(g, s, R) {
    const G = this.GROUND, x = s.x, y = Math.max(s.y, -60), w = s.w, h = G - y;
    const styles = {
      brick: ['#4e2c32', '#3e2228', '#62383c'], brick2: ['#56343a', '#432630', '#6c4044'],
      concrete: ['#463c4c', '#382f3e', '#584c5e'], panel: ['#3a3e4e', '#2e3140', '#4c5062'],
      shop: ['#3e3a48', '#302c38', '#524c5c'], shop2: ['#43384a', '#342b3a', '#574a5e'],
    };
    const [base, dark, light] = styles[s.style] || styles.concrete;
    // broken parapet behind the roof line (not walkable, drawn darker)
    if (s.kind === 'building') {
      g.fillStyle = '#2a2030';
      let cx = x + 2;
      while (cx < x + w - 4) {
        const seg = 4 + ((R() * 10) | 0), up = R() < 0.5 ? 0 : 3 + ((R() * 12) | 0);
        if (up) { g.fillRect(cx, y - up, seg, up); if (R() < 0.5) { g.fillStyle = '#6a5a5a'; g.fillRect(cx + 1, y - up - 3, 1, 3); g.fillStyle = '#2a2030'; } }
        cx += seg;
      }
    }
    g.fillStyle = base; g.fillRect(x, y, w, h);
    if (s.style && s.style.startsWith('brick')) {
      g.fillStyle = dark;
      for (let yy = y + 4; yy < G; yy += 3) {
        g.fillRect(x, yy, w, 1);
        const off = ((yy - y) / 3) % 2 ? 3 : 0;
        for (let xx = x + off; xx < x + w; xx += 6) g.fillRect(xx, yy - 2, 1, 2);
      }
    } else {
      for (let i = 0; i < w * h * 0.04; i++) {
        g.fillStyle = R() < 0.5 ? dark : light;
        g.fillRect(x + ((R() * w) | 0), y + ((R() * h) | 0), 1, 1);
      }
      g.fillStyle = dark;
      for (let yy = y + 18; yy < G; yy += 18) g.fillRect(x, yy, w, 1);
      if (s.style === 'panel') for (let xx = x + 24; xx < x + w; xx += 24) g.fillRect(xx, y, 1, h);
    }
    // windows
    const isShop = s.style === 'shop' || s.style === 'shop2';
    const winTop = y + 10, winBottom = isShop ? G - 34 : G - 16;
    for (let wy = winTop; wy < winBottom - 8; wy += 18) {
      for (let wx = x + 7; wx < x + w - 12; wx += 16) {
        const r = R();
        g.fillStyle = '#1a1420'; g.fillRect(wx - 1, wy - 1, 10, 12);
        g.fillStyle = r < 0.12 ? '#6a4a38' : '#0e0b12';
        g.fillRect(wx, wy, 8, 10);
        if (r < 0.12) { g.fillStyle = '#c08048'; g.fillRect(wx + 1, wy + 1, 6, 8); g.fillStyle = '#e0a060'; g.fillRect(wx + 1, wy + 7, 6, 2); }
        else if (r < 0.4) { // shattered glass
          g.fillStyle = '#4a5a78';
          pline(g, wx, wy, wx + 3, wy + 4, 1); pline(g, wx + 8, wy, wx + 5, wy + 3, 1); g.fillRect(wx, wy + 9, 8, 1);
        } else if (r < 0.55) { // boarded
          g.fillStyle = '#5a4030'; g.fillRect(wx, wy + 2, 8, 2); g.fillRect(wx, wy + 6, 8, 2);
          g.fillStyle = '#3a2a20'; g.fillRect(wx, wy + 3, 8, 1);
        } else { g.fillStyle = '#2a2436'; g.fillRect(wx + 1, wy + 1, 2, 3); }
        g.fillStyle = light; g.fillRect(wx - 1, wy + 11, 10, 1);
      }
    }
    if (isShop) { // storefront with shutter and awning
      const sx = x + 8, sw = w - 16, sy = G - 28;
      g.fillStyle = '#28232e'; g.fillRect(sx, sy, sw, 28);
      g.fillStyle = '#3c3644';
      for (let yy = sy + 2; yy < G; yy += 3) g.fillRect(sx + 1, yy, sw - 2, 1);
      g.fillStyle = '#1a1620'; g.fillRect(sx + sw - 20, sy + 6, 14, 22);
      g.fillStyle = '#7a2a3a'; g.fillRect(sx - 3, sy - 5, sw + 6, 4);
      g.fillStyle = '#5a1e2c'; for (let xx = sx - 3; xx < sx + sw + 3; xx += 4) g.fillRect(xx, sy - 1, 2, 2);
      g.fillStyle = '#9a3a4a'; g.fillRect(sx - 3, sy - 5, sw + 6, 1);
      g.fillStyle = '#c84aa0';
      for (let i = 0; i < 3; i++) g.fillRect(sx + 4 + ((R() * (sw - 20)) | 0), sy + 8 + ((R() * 14) | 0), 6 + ((R() * 8) | 0), 1);
    }
    if (s.kind === 'building') { g.fillStyle = 'rgba(12,8,18,0.24)'; g.fillRect(x, y + 4, w, h - 4); }
    // cornice and rim light
    g.fillStyle = light; g.fillRect(x, y, w, 3);
    g.fillStyle = '#9a6a6a'; g.fillRect(x, y, w, 1);
    g.fillStyle = dark; g.fillRect(x, y + 3, w, 1);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x + w - 3, y, 3, h);
    g.fillStyle = 'rgba(255,170,140,0.08)'; g.fillRect(x, y, 2, h);
    // cracks
    g.fillStyle = '#1a1220';
    for (let i = 0; i < (w * h) / 2600; i++) {
      let cx = x + R() * w, cy = y + 6 + R() * (h - 10);
      for (let j = 0; j < 5; j++) {
        const nx = cx + (R() - 0.5) * 8, ny = cy + R() * 6;
        pline(g, cx, cy, clamp(nx, x, x + w - 1), ny, 1);
        cx = clamp(nx, x, x + w - 1); cy = ny;
      }
    }
    // moss and hanging vines from the roof
    if (s.kind === 'building') {
      for (let xx = x; xx < x + w; xx++) {
        if (R() < 0.45) { g.fillStyle = R() < 0.5 ? '#3f6e3e' : '#2f5236'; g.fillRect(xx, y - 1, 1, 1 + ((R() * 2) | 0)); }
        if (R() < 0.06) {
          const len = 4 + ((R() * 22) | 0);
          for (let k = 0; k < len; k++) { g.fillStyle = k % 3 ? '#2a4a30' : '#3a6a3a'; g.fillRect(xx + ((Math.sin(k * 0.7) * 1.2) | 0), y + 2 + k, 1, 1); }
        }
      }
    }
    // rubble at the foot
    for (let i = 0; i < w / 5; i++) {
      g.fillStyle = pick([dark, light, '#2a2430']);
      const rw = 1 + ((R() * 4) | 0);
      g.fillRect(x + ((R() * w) | 0), G - 1 - ((R() * 3) | 0), rw, 2);
    }
    // graffiti
    if (R() < 0.8 && h > 40) {
      const gx = x + 6 + R() * Math.max(1, w - 40), gy = G - 18 - R() * 10;
      g.fillStyle = pick(['#c43a8a', '#3ac4b0', '#d0c040', '#8a5ae0']);
      let px = gx, py = gy;
      for (let i = 0; i < 18; i++) {
        const nx = px + R() * 3, ny = gy + Math.sin(i * 1.3) * 3 + (R() - 0.5) * 2;
        pline(g, px, py, nx, ny, 1); px = nx; py = ny;
      }
    }
  },
  paintGround(g, R) {
    const G = this.GROUND, W = this.W;
    g.fillStyle = '#4a4252'; g.fillRect(0, G, W, 6);
    g.fillStyle = '#5c5464'; g.fillRect(0, G, W, 1);
    g.fillStyle = '#3a3442';
    for (let x = 0; x < W; x += 16) g.fillRect(x, G + 1, 1, 5);
    g.fillStyle = '#6e6678'; g.fillRect(0, G + 6, W, 1);
    g.fillStyle = '#26212c'; g.fillRect(0, G + 7, W, this.H + 20 - G - 7);
    for (let i = 0; i < W * 4; i++) {
      g.fillStyle = R() < 0.5 ? '#2e2934' : '#1f1b24';
      g.fillRect((R() * W) | 0, G + 8 + ((R() * 34) | 0), 1, 1);
    }
    g.fillStyle = '#7a6a3a';
    for (let x = 10; x < W; x += 44) if (R() < 0.8) g.fillRect(x, G + 22, 16, 1);
    // puddles reflecting the sky
    for (let i = 0; i < 18; i++) {
      const px = R() * W, pw = 10 + R() * 30, py = G + 10 + R() * 24;
      g.fillStyle = '#3a2440'; g.fillRect(px, py, pw, 2);
      g.fillStyle = '#6a3048'; g.fillRect(px + 3, py, pw * 0.4, 1);
    }
    g.fillStyle = '#141018';
    for (let i = 0; i < 24; i++) {
      let cx = R() * W, cy = G + 8 + R() * 10;
      for (let j = 0; j < 6; j++) { const nx = cx + (R() - 0.3) * 10, ny = cy + (R() - 0.3) * 6; pline(g, cx, cy, nx, ny, 1); cx = nx; cy = ny; }
    }
    for (let x = 120; x < W; x += 340 + R() * 200) {
      g.fillStyle = '#1a161e'; g.fillRect(x, G + 14, 18, 3);
      g.fillStyle = '#34303a'; g.fillRect(x + 1, G + 14, 16, 1);
    }
    g.fillStyle = '#18141c'; g.fillRect(0, G + 42, W, this.H);
  },
  paintPlatform(g, p, R) {
    const { x, y, w } = p;
    if (p.kind === 'roof') return;
    if (p.kind === 'girder') {
      g.fillStyle = '#17131b';
      pline(g, x + 6, y, x + 6, Math.max(0, y - 140), 1); pline(g, x + w - 6, y, x + w - 6, Math.max(0, y - 140), 1);
      g.fillStyle = '#3a3640'; g.fillRect(x, y, w, 2);
      g.fillStyle = '#6a6470'; g.fillRect(x, y, w, 1);
      g.fillStyle = '#2a2630'; g.fillRect(x + 1, y + 2, w - 2, 3);
      g.fillStyle = '#18141c'; for (let i = 4; i < w - 3; i += 8) g.fillRect(x + i, y + 3, 3, 1);
      g.fillStyle = '#3a3640'; g.fillRect(x, y + 5, w, 1);
      g.fillStyle = '#7a3e28'; for (let i = 0; i < 3; i++) g.fillRect(x + ((R() * (w - 4)) | 0), y + 1 + ((R() * 4) | 0), 2, 1);
      return;
    }
    if (p.kind === 'fire' || p.kind === 'balcony') {
      g.fillStyle = '#211d26';
      for (let i = 2; i < w; i += 4) g.fillRect(x + i, y - 9, 1, 9);
      g.fillRect(x, y - 10, w, 1);
      g.fillStyle = '#3a3440'; g.fillRect(x, y, w, 3);
      g.fillStyle = '#56505e'; g.fillRect(x, y, w, 1);
      g.fillStyle = '#1a161e'; for (let i = 1; i < w; i += 2) g.fillRect(x + i, y + 1, 1, 1);
      g.fillStyle = '#2a2530';
      const walls = this.buildings.concat(this.solids.filter((q) => q.kind === 'wall'));
      const wallSide = walls.some((q) => Math.abs(q.x - (x + w)) < 3) ? 1 : -1;
      const ax = wallSide > 0 ? x + w - 2 : x + 2;
      pline(g, ax, y + 3, ax - wallSide * 14, y + 3, 1);
      pline(g, ax, y + 14, ax - wallSide * 14, y + 3, 1);
      g.fillStyle = '#7a3e28'; g.fillRect(x + ((R() * w) | 0), y + 2, 3, 1);
    } else if (p.kind === 'overpass') {
      g.fillStyle = '#25202a'; for (let i = 0; i < w; i += 6) g.fillRect(x + i, y - 6, 2, 6);
      g.fillStyle = '#3a3442'; g.fillRect(x, y - 7, w, 2);
      g.fillStyle = '#4a4252'; g.fillRect(x, y, w, 9);
      g.fillStyle = '#625a6c'; g.fillRect(x, y, w, 1);
      g.fillStyle = '#3a3442'; for (let i = 30; i < w; i += 40) g.fillRect(x + i, y + 1, 1, 8);
      g.fillStyle = '#2c2732'; g.fillRect(x, y + 9, w, 3);
      g.fillStyle = '#1e1a24'; g.fillRect(x + 4, y + 12, w - 8, 2);
      // broken end with rebar
      g.clearRect(x + w - 6, y + 4, 6, 10);
      g.fillStyle = '#7a4a3a'; pline(g, x + w - 4, y + 3, x + w + 3, y - 1, 1); pline(g, x + w - 6, y + 6, x + w + 1, y + 9, 1);
      g.fillStyle = '#3f6e3e'; for (let i = 0; i < w; i++) if (R() < 0.15) g.fillRect(x + i, y - 1, 1, 1);
    } else if (p.kind === 'scaffold') {
      g.fillStyle = '#4c3626'; g.fillRect(x, y, w, 3);
      g.fillStyle = '#6a4c34'; g.fillRect(x, y, w, 1);
      g.fillStyle = '#3a281c'; for (let i = 10; i < w; i += 12) g.fillRect(x + i, y, 1, 3);
      g.fillStyle = '#5c5c6a'; g.fillRect(x, y + 3, w, 1);
    } else if (p.kind === 'sign') {
      // billboard catwalk + billboard
      g.fillStyle = '#211d26'; g.fillRect(x + 20, y - 62, 2, 62); g.fillRect(x + w - 22, y - 62, 2, 62);
      const bx = x + 6, by = y - 70, bw = w - 12, bh = 52;
      g.fillStyle = '#1a1620'; g.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
      for (let yy = 0; yy < bh; yy++) {
        const k = yy / bh;
        g.fillStyle = mixHex('#3a1c4e', '#a03a5a', k);
        g.fillRect(bx, by + yy, bw, 1);
      }
      g.fillStyle = '#e8a060'; pdisc(g, bx + 30, by + 26, 12);
      g.fillStyle = '#c86048'; pdisc(g, bx + 30, by + 26, 8);
      drawText(g, 'NEO-KAI', bx + 50, by + 12, { color: '#f0e0d0', scale: 2, outline: '#2a1430' });
      drawText(g, 'LIVE FOREVER', bx + 52, by + 30, { color: '#ffb0c8', outline: null });
      for (let i = 0; i < 9; i++) { // torn poster strips
        const tx = bx + ((R() * bw) | 0), ty = by + ((R() * bh) | 0);
        g.fillStyle = '#5a4a50'; g.fillRect(tx, ty, 3 + ((R() * 6) | 0), 2 + ((R() * 5) | 0));
      }
      g.clearRect(bx + bw - 18, by + bh - 14, 18, 14);
      g.fillStyle = '#1a1620'; g.fillRect(bx + bw - 18, by + bh - 14, 1, 14);
      g.fillStyle = '#3a3440'; g.fillRect(x, y, w, 3);
      g.fillStyle = '#56505e'; g.fillRect(x, y, w, 1);
      g.fillStyle = '#211d26'; for (let i = 2; i < w; i += 4) g.fillRect(x + i, y - 6, 1, 6); g.fillRect(x, y - 7, w, 1);
    }
  },
  paintCar(g, s, R) {
    const x = s.x, y = s.y, w = s.w, G = this.GROUND;
    const body = pick(['#5a2a2e', '#2e3e4e', '#4a4a3a']);
    g.fillStyle = body; g.fillRect(x, y, w, 8);
    g.fillStyle = '#7a3e28'; for (let i = 0; i < 8; i++) g.fillRect(x + ((R() * w) | 0), y + ((R() * 7) | 0), 2, 1);
    g.fillStyle = mixHex(body, '#ffffff', 0.15); g.fillRect(x, y, w, 1);
    g.fillStyle = body; g.fillRect(x + 7, y - 7, 24, 7);
    g.fillStyle = '#141018'; g.fillRect(x + 9, y - 6, 9, 5); g.fillRect(x + 20, y - 6, 9, 5);
    g.fillStyle = '#4a5a78'; g.fillRect(x + 10, y - 6, 2, 1); g.fillRect(x + 21, y - 5, 1, 2);
    g.fillStyle = mixHex(body, '#ffffff', 0.12); g.fillRect(x + 7, y - 7, 24, 1);
    g.fillStyle = '#100c12'; g.fillRect(x + 3, G - 3, 8, 3); g.fillRect(x + w - 11, G - 3, 8, 3);
    g.fillStyle = '#2a2630'; g.fillRect(x + 5, G - 2, 4, 1); g.fillRect(x + w - 9, G - 2, 4, 1);
    g.fillStyle = '#c8b070'; g.fillRect(x + w - 2, y + 2, 2, 2);
    g.fillStyle = '#601818'; g.fillRect(x, y + 2, 2, 2);
  },
  paintBarrier(g, s) {
    g.fillStyle = '#6a6270'; g.fillRect(s.x + 2, s.y, s.w - 4, s.h);
    g.fillRect(s.x, s.y + 4, s.w, s.h - 4);
    g.fillStyle = '#c8a040';
    for (let i = 2; i < s.w - 2; i += 6) pline(g, s.x + i, s.y + 6, s.x + i + 3, s.y + 2, 1);
    g.fillStyle = '#4a4252'; g.fillRect(s.x, s.y + s.h - 2, s.w, 2);
  },

  // ---------- per-frame drawing ----------
  drawBackground(ctx, cx, cy, t) {
    ctx.drawImage(this.layers.sky, 0, 0);
    // sweeping searchlights
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 2; i++) {
      const a = -Math.PI / 2 + Math.sin(t * 0.25 + i * 2.1) * 0.55;
      const bx = 120 + i * 260 - cx * 0.1, by = 240;
      ctx.fillStyle = 'rgba(120,60,90,0.07)';
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + Math.cos(a - 0.05) * 400, by + Math.sin(a - 0.05) * 400);
      ctx.lineTo(bx + Math.cos(a + 0.05) * 400, by + Math.sin(a + 0.05) * 400);
      ctx.fill();
    }
    ctx.restore();
    const ly = cy - this.CAM_Y_MIN;
    const far = this.layers.far, mid = this.layers.mid, back = this.layers.back;
    ctx.drawImage(far, -Math.round(cx * 0.15), -Math.round(ly * 0.15));
    for (const b of this.beacons) {
      if (b.f !== 0.15) continue;
      if (Math.sin(t * 2 + b.phase) > 0.7) { ctx.fillStyle = '#ff3040'; ctx.fillRect(Math.round(b.x - cx * 0.15), Math.round(b.y - ly * 0.15), 1, 1); }
    }
    ctx.drawImage(mid, -Math.round(cx * 0.45), -Math.round(ly * 0.45));
    for (const b of this.beacons) {
      if (b.f !== 0.45) continue;
      if (Math.sin(t * 2.5 + b.phase) > 0.75) { ctx.fillStyle = '#ff4050'; ctx.fillRect(Math.round(b.x - cx * 0.45), Math.round(b.y - ly * 0.45), 2, 1); }
    }
    ctx.fillStyle = 'rgba(70,24,48,0.25)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.drawImage(back, -Math.round(cx * 0.8), -Math.round(ly * 0.8));
    ctx.fillStyle = 'rgba(40,16,36,0.22)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  },
  drawPlay(ctx, cx, cy, t) {
    const sx = Math.round(cx), sy = Math.round(cy);
    ctx.drawImage(this.layers.play, sx, sy, VIEW_W, VIEW_H, 0, 0, VIEW_W, VIEW_H);
    // neon signs (flickering)
    for (const n of this.neons) {
      const x = n.x - sx, y = n.y - sy;
      if (x < -60 || x > VIEW_W + 20 || y < -80 || y > VIEW_H + 10) continue;
      const on = (Math.sin(t * 9 + n.x) > -0.85) || Math.random() < 0.3;
      for (let i = 0; i < n.text.length; i++) {
        const lit = on && !(i === n.broken && Math.sin(t * 23 + i) > -0.2);
        const col = lit ? n.color : '#2a2230';
        if (n.vertical) drawText(ctx, n.text[i], x, y + i * 8, { color: col, outline: '#140e18' });
        else drawText(ctx, n.text[i], x + i * 5, y, { color: col, outline: '#140e18' });
      }
      n.lit = on;
    }
    // burn barrel flames
    for (const f of this.fires) {
      const x = f.x - sx, y = f.y - sy;
      if (x < -20 || x > VIEW_W + 20) continue;
      for (let i = 0; i < 7; i++) {
        const fx = x - 4 + i + Math.sin(t * 12 + i * 2) * 0.6;
        const fh = 3 + Math.abs(Math.sin(t * 8 + i * 1.7)) * 5 + (i === 3 ? 3 : 0);
        ctx.fillStyle = '#ff5a1a'; ctx.fillRect(Math.round(fx), Math.round(y - 13 - fh), 1, Math.round(fh));
        ctx.fillStyle = '#ffc04a'; ctx.fillRect(Math.round(fx), Math.round(y - 13 - fh * 0.5), 1, Math.round(fh * 0.5));
      }
      if (Math.random() < 0.3) FX.embers(f.x, f.y - 16, 1);
    }
  },
  addLights(cx, cy, t) {
    for (const l of this.lamps) {
      const on = !l.flick || Math.sin(t * 13 + l.x) > -0.6 || Math.random() < 0.5;
      if (!on) continue;
      FX.frameLight(l.hx, l.hy + 2, 70, '#ffb070', 0.75);
      FX.frameLight(l.hx, l.hy + 40, 40, '#ffb070', 0.35);
    }
    for (const n of this.neons) if (n.lit) FX.frameLight(n.x + (n.vertical ? 2 : n.text.length * 2.5), n.y + (n.vertical ? n.text.length * 4 : 2), 46, n.color, 0.6);
    for (const f of this.fires) FX.frameLight(f.x, f.y - 16, 54 + Math.sin(t * 17) * 4, '#ff8a3a', 0.8 + Math.sin(t * 23) * 0.1);
  },
};

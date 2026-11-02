'use strict';
// The Foundry, the second region (KRAG's), and the portal between the regions.
// A forge hall: the blast furnace at the west end taps a river of molten iron that runs in a trench along the
// floor to a drain, crossed by three grated bridges. Whatever falls in is burned and thrown back out onto the
// nearer bank: you take a little, an enemy you knock in takes a lot, a crucible bursts, KRAG just climbs out.
// Enemies leap the molten gaps. Further along: two gantry cranes with a ladle of molten metal hanging from
// each (hit one, or yank it on the tether, and it tips and pours, burning what's under it and leaving a pool
// of slag), an ore hopper, ingots, two conveyors running opposite ways that carry whatever stands on them, a
// scrap heap, casting molds with metal cooling in them, a hydraulic press, a storage rack stepping up to a
// catwalk, and a rolling mill's flywheel and gears turning on the back wall. Crucibles of slag stand where the
// city has red barrels; embers rise where the city has rain; sodium work lamps hang where it has street lamps.
// Endless travels between the regions: when a region's boss falls a portal opens to the other one (waves.js).

// the river: damage to you and to an enemy, how hard it throws a body up and out
const LAVA = { DMG: 14, EDMG: 42, UP: 380, OUT: 210 };
// a ladle's pour: how long it pours, its half-width, damage to an enemy and to you, the pool it leaves
const POUR = { DUR: 2.4, HALF: 9, EDMG: 48, DMG: 18, POOL: 40, LIFE: 6 };
// a slag pool's burn: to an enemy and to you, and how often
const SLAG = { EDMG: 9, DMG: 6, EVERY: 0.5, PEVERY: 0.8 };
const FOUNDRY_NAMES = ['SLAG HEAP', 'FURNACE FLOOR', 'MOLTEN RUN', 'IRON TIDE', 'CRUCIBLE', 'HOT METAL', 'ASH FALL', 'FORGE LINE'];
const MOLTEN = { c0: '#fff0c0', c1: '#ff7a1a', c2: '#6a1404' };
const SLAG_COLS = ['#3a3034', '#5a3a2a', '#ff7a1a', '#2a2226'];
// molten metal from crust to white hot
const MELT = ['#3a1408', '#5a1a08', '#8a2a0a', '#c8400e', '#ff6a1a', '#ff9a2a', '#ffc860', '#fff0c0'];

const Foundry = {
  // ---------- layout ----------
  build(L) {
    const G = L.GROUND;
    const S_ = (x, y, w, h, kind, style) => { const s = { x, y, w, h, kind, style }; L.solids.push(s); return s; };
    const P_ = (x, y, w, kind) => { const p = { x, y, w, h: 4, kind, oneWay: true }; L.platforms.push(p); return p; };
    const F = (L.F = {
      river: { x0: 250, x1: 890, y: G + 12 }, furnace: { x: 40, y: 180, w: 210 }, tap: { x: 250, y: 368 },
      bridges: [], gantries: [], workLamps: [170, 520, 1010, 1290, 1600, 1950, 2250].map((x) => ({ x, y: 168 })),
      // the rolling mill's flywheel and the gears turning on the back wall (back layer coordinates, set in paintBack)
      gears: [],
    });
    S_(890, G, 1710, 120, 'ground');
    S_(250, G + 18, 640, 100, 'bed');
    S_(-200, -400, 240, G + 520, 'wall', 'iron');
    S_(2360, -400, 240, G + 520, 'wall', 'iron');
    S_(-200, -260, 2800, 200, 'ceiling');
    // the blast furnace, its catwalks up its face, and the river under its tap
    S_(40, 180, 210, G - 180 + 120, 'furnace');
    for (const y of [340, 285, 230]) P_(250, y, 46, 'fcat');
    // three grated bridges; between them the molten metal shows
    for (const [x, w] of [[320, 120], [520, 120], [720, 120]]) F.bridges.push(S_(x, G, w, 6, 'bridge'));
    let x0 = F.river.x0;
    for (const b of F.bridges) { L.lava.push({ x0, x1: b.x, y: F.river.y, head: x0 === F.river.x0 }); x0 = b.x + b.w; }
    L.lava.push({ x0, x1: F.river.x1, y: F.river.y });
    // a walkway over the river
    P_(420, 322, 320, 'walk');
    // the hopper by the drain, then the open floor under the first gantry and its ladle, with catwalks either side
    S_(900, 340, 60, 60, 'hopper');
    for (const [x, w, lx] of [[1040, 340, 1210], [1700, 340, 1870]]) {
      F.gantries.push(P_(x, 246, w, 'gantry'));
      L.ladleSpots.push({ x: lx, y: 334, hook: 254 });
    }
    P_(1060, 323, 100, 'catwalk');
    P_(1400, 323, 120, 'catwalk');
    // ingots, the scrap heap, the conveyors running opposite ways under the second gantry
    S_(1500, 390, 40, 10, 'ingots');
    S_(1560, 392, 100, 8, 'scrap'); S_(1578, 384, 64, 8, 'scrap'); S_(1598, 376, 24, 8, 'scrap');
    for (const [x, dir] of [[1680, 1], [1880, -1]]) {
      S_(x, 391, 180, 9, 'conveyor');
      L.conveyors.push({ x, w: 180, y: 391, dir, speed: 70 });
    }
    // the casting molds, the press, the rack stepping up to the catwalk
    S_(2080, 394, 80, 6, 'molds');
    S_(2180, 380, 66, 20, 'press');
    P_(2176, 318, 74, 'crosshead');
    P_(2266, 366, 94, 'rack'); P_(2296, 334, 64, 'rack');
    P_(2110, 302, 250, 'catwalk');

    L.all = L.solids.concat(L.platforms);
    L.perches = L.platforms.filter((q) => q.y >= 220 && q.y <= 300 && q.w >= 40).map((q) => ({ x: q.x + q.w / 2, y: q.y }));
    L.spawnGround = [380, 580, 780, 1000, 1120, 1300, 1460, 1720, 1960, 2120, 2310].map((x) => ({ x, y: G }));
    L.spawnHigh = [
      { x: 1110, y: 323 }, { x: 1460, y: 323 }, { x: 1150, y: 246 }, { x: 1860, y: 246 }, { x: 273, y: 285 },
      { x: 2210, y: 318 }, { x: 2240, y: 302 }, { x: 930, y: 340 }, { x: 580, y: 322 },
    ];
    L.barrelSpots = [{ x: 1090, y: G }, { x: 1440, y: G }, { x: 1230, y: G }, { x: 1610, y: 376 }, { x: 2170, y: G }, { x: 2320, y: G }, { x: 580, y: G }, { x: 930, y: 340 }];
    L.portalAt = 1300; L.start = 1120;
    this.prerender(L);
  },

  // ---------- prerender ----------
  prerender(L) {
    const R = mulberry32(4242);
    L.layers.sky = this.paintSky(R);
    L.layers.far = this.paintFar(L, R);
    L.layers.mid = this.paintMid(L, R);
    L.layers.back = this.paintBack(L, R);
    L.layers.play = this.paintPlay(L, R);
    L.layers.melt = this.paintMelt(R);
    L.layers.potFull = this.paintPot(true);
    L.layers.potEmpty = this.paintPot(false);
  },
  // smoke and the furnace's glow through the open roof
  paintSky(R) {
    const c = makeCanvas(VIEW_W, VIEW_H), g = c.ctx;
    const stops = [[0, [12, 8, 12]], [0.4, [30, 14, 14]], [0.75, [70, 26, 16]], [1, [120, 46, 20]]];
    for (let y = 0; y < VIEW_H; y++) {
      const t = y / VIEW_H;
      let i = 0;
      while (i < stops.length - 2 && t > stops[i + 1][0]) i++;
      const [t0, c0] = stops[i], [t1, c1] = stops[i + 1];
      const k = clamp((t - t0) / (t1 - t0), 0, 1);
      for (let x = 0; x < VIEW_W; x++) {
        const q = Math.round(clamp(k + (bayer(x, y) - 0.5) * 0.2, 0, 1) * 5) / 5;
        g.fillStyle = `rgb(${lerp(c0[0], c1[0], q) | 0},${lerp(c0[1], c1[1], q) | 0},${lerp(c0[2], c1[2], q) | 0})`;
        g.fillRect(x, y, 1, 1);
      }
    }
    for (let i = 0; i < 30; i++) {
      const y = (R() * 220) | 0, x = (R() * VIEW_W) | 0, w = (R() * 180 + 40) | 0;
      g.fillStyle = y > 140 ? 'rgba(110,40,24,0.5)' : 'rgba(40,20,22,0.55)';
      for (let xx = 0; xx < w; xx++) if (bayer(x + xx, y) < 0.75) g.fillRect(x + xx, y, 1, 1 + ((Math.sin(xx * 0.07 + i) + 1) * 1.3) | 0);
    }
    return c;
  },
  // the hall's far wall: iron plates, tall windows glowing dull orange, the roof trusses over it
  paintFar(L, R) {
    const f = 0.15, [w, h] = L.layerSize(f), c = makeCanvas(w, h), g = c.ctx;
    const base = Math.round(L.groundBase(f)), top = base - 150;
    g.fillStyle = '#26181a'; g.fillRect(0, top, w, h - top);
    g.fillStyle = '#1c1214';
    for (let x = 0; x < w; x += 22) g.fillRect(x, top, 1, h - top);
    for (let y = top + 18; y < h; y += 26) g.fillRect(0, y, w, 1);
    for (let x = 6; x < w; x += 34) {
      for (const y of [top + 22, top + 66]) {
        const lit = R() < 0.4;
        g.fillStyle = '#140c0e'; g.fillRect(x - 1, y - 1, 9, 30);
        g.fillStyle = lit ? '#6a2c16' : '#2e1a16'; g.fillRect(x, y, 7, 28);
        if (lit) { g.fillStyle = '#9a4a1e'; g.fillRect(x + 1, y + 20, 5, 7); }
        g.fillStyle = '#140c0e'; g.fillRect(x + 3, y, 1, 28); g.fillRect(x, y + 13, 7, 1);
      }
    }
    // the trusses
    g.fillStyle = '#120a0c';
    const ty = top - 26;
    g.fillRect(0, ty, w, 2); g.fillRect(0, top - 2, w, 2);
    for (let x = 0; x < w; x += 18) { pline(g, x, ty, x + 9, top - 2, 1); pline(g, x + 9, top - 2, x + 18, ty, 1); }
    for (let x = 10; x < w; x += 60) { g.fillRect(x, ty - 80, 1, 80); if (R() < 0.5) g.fillRect(x - 2, ty - 80, 5, 2); }
    for (let y = top + 110; y < h; y++) {
      const k = clamp((y - top - 110) / 60, 0, 1);
      g.fillStyle = '#3a1a14';
      for (let xx = 0; xx < w; xx++) if (bayer(xx, y) < k * 0.8) g.fillRect(xx, y, 1, 1);
    }
    return c;
  },
  // machinery in the haze: stacks, a second furnace, gantries, pipes, chains
  paintMid(L, R) {
    const f = 0.45, [w, h] = L.layerSize(f), c = makeCanvas(w, h), g = c.ctx;
    const base = Math.round(L.groundBase(f)) - 6;
    let x = -20;
    while (x < w) {
      const k = R();
      g.fillStyle = '#1c1214';
      if (k < 0.3) {
        // a stack
        const sw = 14 + ((R() * 10) | 0), sh = 140 + ((R() * 80) | 0);
        g.fillRect(x, base - sh, sw, h);
        g.fillStyle = '#2a1a18'; for (let y = base - sh + 10; y < base; y += 16) g.fillRect(x - 1, y, sw + 2, 2);
        g.fillStyle = '#4a2416'; g.fillRect(x, base - sh, sw, 1);
        x += sw + 20 + ((R() * 30) | 0);
      } else if (k < 0.55) {
        // a squat furnace with a glowing mouth
        const fw = 50 + ((R() * 30) | 0), fh = 70 + ((R() * 40) | 0);
        g.fillRect(x, base - fh, fw, h);
        for (let i = 0; i < fw; i++) g.fillRect(x + i, base - fh - Math.round(Math.sin((i / fw) * Math.PI) * 12), 1, 12);
        g.fillStyle = '#5a2414'; g.fillRect(x + fw / 2 - 6, base - 22, 12, 10);
        g.fillStyle = '#8a3a18'; g.fillRect(x + fw / 2 - 4, base - 20, 8, 6);
        x += fw + 16;
      } else if (k < 0.75) {
        // a gantry frame
        const gw = 70 + ((R() * 40) | 0), gh = 110;
        g.fillRect(x, base - gh, 4, h); g.fillRect(x + gw, base - gh, 4, h); g.fillRect(x, base - gh, gw + 4, 5);
        g.fillStyle = '#2a1a18'; for (let i = 0; i < gw; i += 10) pline(g, x + i, base - gh + 5, x + i + 5, base - gh, 1);
        g.fillStyle = '#140c0e'; const hx = x + ((R() * gw) | 0); g.fillRect(hx, base - gh + 5, 1, 30 + ((R() * 30) | 0));
        x += gw + 30;
      } else {
        // pipes
        const py = base - 40 - ((R() * 60) | 0), pw = 80 + ((R() * 60) | 0);
        g.fillRect(x, py, pw, 6); g.fillRect(x + pw - 6, py, 6, base - py);
        g.fillStyle = '#2e1c1a'; g.fillRect(x, py, pw, 1);
        x += pw + 10;
      }
    }
    for (let y = base - 60; y < h; y++) {
      const k = clamp((y - base + 60) / 70, 0, 1);
      g.fillStyle = '#3a1810';
      for (let xx = 0; xx < w; xx++) if (bayer(xx, y) < k * 0.8) g.fillRect(xx, y, 1, 1);
    }
    return c;
  },
  // the back wall: columns with bracing, pipes, gauges; the mill's flywheel and gears turn on it (drawn live)
  paintBack(L, R) {
    const f = 0.8, [w, h] = L.layerSize(f), c = makeCanvas(w, h), g = c.ctx;
    const base = Math.round(L.groundBase(f)) + 6, top = base - 230;
    g.fillStyle = '#2a2022'; g.fillRect(0, top, w, h - top);
    g.fillStyle = '#231a1c';
    for (let y = top; y < h; y += 14) g.fillRect(0, y, w, 1);
    for (let x = 0; x < w; x += 28) for (let y = top + 7; y < h; y += 14) g.fillRect(x + ((y / 14) % 2 ? 14 : 0), y, 1, 1);
    // columns and bracing
    for (let x = 30; x < w; x += 130) {
      g.fillStyle = '#1a1416'; g.fillRect(x, top, 10, h - top);
      g.fillStyle = '#3a2e30'; g.fillRect(x, top, 2, h - top);
      g.fillStyle = '#1a1416';
      for (let y = top + 20; y < base - 20; y += 60) { pline(g, x + 10, y, x + 64, y + 50, 1); pline(g, x + 120, y, x + 66, y + 50, 1); }
    }
    // pipes along the wall
    for (const py of [top + 40, top + 120]) {
      g.fillStyle = '#1e1618'; g.fillRect(0, py, w, 7);
      g.fillStyle = '#3e3234'; g.fillRect(0, py, w, 1);
      g.fillStyle = '#141012'; for (let x = 0; x < w; x += 46) g.fillRect(x, py - 1, 3, 9);
    }
    // gauges and warning boards
    for (let i = 0; i < w / 160; i++) {
      const gx = (R() * w) | 0, gy = base - 60 - ((R() * 60) | 0);
      g.fillStyle = '#141012'; pdisc(g, gx, gy, 4);
      g.fillStyle = '#8a8070'; pdisc(g, gx, gy, 3);
      g.fillStyle = '#c03018'; pline(g, gx, gy, gx + 2, gy - 2, 1);
    }
    for (let i = 0; i < w / 300; i++) {
      const bx = (R() * w) | 0, by = base - 90;
      g.fillStyle = '#c8a020'; g.fillRect(bx, by, 22, 10);
      g.fillStyle = '#141012'; for (let j = 0; j < 22; j += 4) pline(g, bx + j, by + 10, bx + j + 4, by, 1);
    }
    // where the gears and the flywheel sit
    L.F.gears = [
      { x: 520, y: top + 70, r: 26, n: 12, s: 0.6 }, { x: 556, y: top + 104, r: 16, n: 8, s: -0.97 },
      { x: 1180, y: top + 60, r: 22, n: 10, s: -0.5 }, { x: 1440, y: base - 70, r: 58, n: 0, s: 0.9, fly: true },
      { x: 1700, y: top + 80, r: 30, n: 14, s: 0.4 }, { x: 1739, y: top + 117, r: 18, n: 8, s: -0.67 },
    ];
    // the flywheel's mill housing
    g.fillStyle = '#1a1416'; g.fillRect(1380, base - 40, 120, 40);
    g.fillStyle = '#3a2e30'; g.fillRect(1380, base - 40, 120, 2);
    return c;
  },
  // the hall itself: furnace, floor and trench, bridges, gantries, machines
  paintPlay(L, R) {
    const c = makeCanvas(L.W, L.H + 20), g = c.ctx, G = L.GROUND, F = L.F;
    // walls at the ends
    for (const x0 of [0, 2360]) {
      g.fillStyle = '#2e2426'; g.fillRect(x0, -60, 40, G + 120);
      g.fillStyle = '#1e1618'; for (let y = -60; y < G; y += 12) g.fillRect(x0, y, 40, 1);
      g.fillStyle = '#4a3c3e'; g.fillRect(x0 === 0 ? 38 : 2360, -60, 2, G + 60);
    }
    // gantry legs and the work lamps' cables go behind the rest
    for (const p of F.gantries) {
      for (const lx of [p.x + 2, p.x + p.w - 10]) {
        g.fillStyle = '#8a7018'; g.fillRect(lx, p.y + 8, 8, G - p.y - 8);
        g.fillStyle = '#c8a020'; g.fillRect(lx, p.y + 8, 2, G - p.y - 8);
        g.fillStyle = '#5a4810'; for (let y = p.y + 16; y < G - 6; y += 18) pline(g, lx, y, lx + 7, y + 9, 1);
      }
    }
    for (const l of F.workLamps) { g.fillStyle = '#141012'; g.fillRect(l.x, -60, 1, l.y + 60); }
    this.paintFurnace(g, L, R);
    // the floor: iron plates with a tread, the trench cut through it
    g.fillStyle = '#3e3436'; g.fillRect(960, G, L.W - 960, 6);
    g.fillStyle = '#5a4e50'; g.fillRect(960, G, L.W - 960, 1);
    g.fillStyle = '#2e2628'; for (let x = 960; x < L.W; x += 4) g.fillRect(x + ((x / 4) % 2 ? 2 : 0), G + 3, 1, 1);
    g.fillStyle = '#2a2224'; for (let x = 960; x < L.W; x += 24) g.fillRect(x, G + 1, 1, 5);
    g.fillStyle = '#6a5c5e'; g.fillRect(960, G + 6, L.W - 960, 1);
    g.fillStyle = '#1e1819'; g.fillRect(250, G + 7, L.W - 250, L.H + 20 - G - 7);
    for (let i = 0; i < L.W * 3; i++) { g.fillStyle = R() < 0.5 ? '#262022' : '#161214'; g.fillRect(250 + ((R() * (L.W - 250)) | 0), G + 8 + ((R() * 34) | 0), 1, 1); }
    // the trench: iron walls, the bed dark under the metal, hazard stripes along its banks
    g.fillStyle = '#141012'; g.fillRect(F.river.x0, G, F.river.x1 - F.river.x0, 30);
    g.fillStyle = '#3a2e2a'; g.fillRect(F.river.x0, G + 18, F.river.x1 - F.river.x0, 2);
    g.fillStyle = '#2e2426'; g.fillRect(F.river.x1, G, 3, 20);
    for (const x of [F.river.x1 - 1]) { g.fillStyle = '#c8a020'; for (let y = G; y < G + 6; y += 2) g.fillRect(x + 2, y, 4, 1); }
    // the drain under the east bank: a grate the metal pours into
    g.fillStyle = '#0a0808'; g.fillRect(F.river.x1, G + 8, 6, 12);
    g.fillStyle = '#4a3e3a'; for (let y = G + 9; y < G + 20; y += 3) g.fillRect(F.river.x1, y, 6, 1);
    // bridges: grates with yellow rails behind
    for (const b of F.bridges) {
      g.fillStyle = '#7a6018';
      for (let x = b.x + 2; x < b.x + b.w; x += 16) g.fillRect(x, G - 11, 1, 11);
      g.fillStyle = '#c8a020'; g.fillRect(b.x, G - 12, b.w, 2); g.fillRect(b.x, G - 6, b.w, 1);
      g.fillStyle = '#3a3234'; g.fillRect(b.x, G, b.w, 6);
      g.fillStyle = '#6a5c5e'; g.fillRect(b.x, G, b.w, 1);
      g.fillStyle = '#141012'; for (let x = b.x + 1; x < b.x + b.w - 1; x += 3) { g.fillRect(x, G + 1, 1, 4); }
      g.fillStyle = '#2a2224'; g.fillRect(b.x, G + 5, b.w, 1);
      g.fillStyle = '#c8a020'; g.fillRect(b.x, G, 2, 6); g.fillRect(b.x + b.w - 2, G, 2, 6);
    }
    for (const s of L.solids) this.paintSolid(g, s, L, R);
    for (const p of L.platforms) this.paintPlatform(g, p, L, R);
    // work lamps: sodium shades on their cables
    for (const l of F.workLamps) {
      g.fillStyle = '#2a2224'; g.fillRect(l.x - 6, l.y - 4, 13, 4); g.fillRect(l.x - 4, l.y - 6, 9, 2);
      g.fillStyle = '#4a3e40'; g.fillRect(l.x - 6, l.y - 4, 13, 1);
      g.fillStyle = '#ffd890'; g.fillRect(l.x - 4, l.y, 9, 1);
    }
    // grime, bolts and slag spatter on the floor
    for (let i = 0; i < 70; i++) {
      const x = 970 + R() * (L.W - 1010), k = R();
      if (k < 0.4) { g.fillStyle = '#1e1819'; g.fillRect(x, G - 2, 4, 2); g.fillStyle = '#3a2e2a'; g.fillRect(x + 1, G - 3, 2, 1); }
      else if (k < 0.7) { g.fillStyle = '#4a2418'; g.fillRect(x, G - 1, 2 + ((R() * 4) | 0), 1); }
      else { g.fillStyle = '#5a4e50'; g.fillRect(x, G - 1, 1, 1); }
    }
    return c;
  },
  paintFurnace(g, L, R) {
    const F = L.F.furnace, G = L.GROUND, x = F.x, y = F.y, w = F.w;
    // a stack up into the roof and the downcomer pipe
    g.fillStyle = '#2a2022'; g.fillRect(x + 60, -60, 50, y + 60);
    g.fillStyle = '#3a2e30'; for (let yy = -60; yy < y; yy += 20) g.fillRect(x + 58, yy, 54, 3);
    g.fillStyle = '#1e1618'; g.fillRect(x + 150, -60, 12, y + 60); g.fillRect(x + 150, y - 20, 60, 12);
    // the shell: fire brick with iron bands
    for (let yy = y; yy < G + 20; yy++) {
      for (let xx = x; xx < x + w; xx++) {
        const row = Math.floor((yy - y) / 4), off = row % 2 ? 4 : 0;
        const mortar = (yy - y) % 4 === 0 || (xx - x + off) % 8 === 0;
        g.fillStyle = mortar ? '#2a1612' : (R() < 0.15 ? '#6a3426' : '#5a2c22');
        g.fillRect(xx, yy, 1, 1);
      }
    }
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x, y, 30, G - y);
    for (const by of [y + 6, 220, 280, 340, 390]) {
      g.fillStyle = '#2e2628'; g.fillRect(x, by, w, 5);
      g.fillStyle = '#5a4e50'; g.fillRect(x, by, w, 1);
      g.fillStyle = '#141012'; for (let xx = x + 4; xx < x + w; xx += 12) g.fillRect(xx, by + 2, 1, 1);
    }
    // the cap
    g.fillStyle = '#3a3032'; g.fillRect(x, y, w, 4); g.fillStyle = '#6a5c5e'; g.fillRect(x, y, w, 1);
    // the slits and the tap hole are dark here; Foundry.drawEmissive lights them
    for (const s of this.slits()) { g.fillStyle = '#100808'; g.fillRect(s[0] - 1, s[1] - 1, s[2] + 2, s[3] + 2); }
    g.fillStyle = '#0a0606'; g.fillRect(L.F.tap.x - 12, L.F.tap.y - 7, 12, 12);
    g.fillStyle = '#3a3032'; g.fillRect(L.F.tap.x - 14, L.F.tap.y - 9, 16, 2); g.fillRect(L.F.tap.x - 2, L.F.tap.y - 9, 4, 18);
    // tuyeres round the hearth
    for (const ty of [370, 384]) { g.fillStyle = '#3a3032'; g.fillRect(x + 130, ty, 30, 4); g.fillStyle = '#5a4e50'; g.fillRect(x + 130, ty, 30, 1); }
  },
  // the furnace face's glowing slits: [x, y, w, h]
  slits() { return [[110, 240, 18, 3], [170, 240, 18, 3], [140, 300, 18, 3], [70, 300, 14, 3], [190, 350, 14, 3], [90, 360, 18, 3], [140, 200, 24, 3]]; },
  paintSolid(g, s, L, R) {
    const G = L.GROUND;
    if (s.kind === 'hopper') {
      // a funnel of ore on legs
      g.fillStyle = '#2a2224'; g.fillRect(s.x + 6, s.y + 26, 4, G - s.y - 26); g.fillRect(s.x + s.w - 10, s.y + 26, 4, G - s.y - 26);
      for (let yy = 0; yy < 30; yy++) {
        const inset = Math.round(yy * 0.6);
        g.fillStyle = yy < 2 ? '#6a5c5e' : yy % 6 === 0 ? '#2e2628' : '#4a3e40';
        g.fillRect(s.x + inset, s.y + yy, s.w - inset * 2, 1);
      }
      g.fillStyle = '#3a2e2a'; g.fillRect(s.x + 22, s.y + 30, 16, 10);
      g.fillStyle = '#6a4a3a'; for (let i = 0; i < 18; i++) g.fillRect(s.x + 4 + ((R() * (s.w - 8)) | 0), s.y - 2 + ((R() * 3) | 0), 2, 2);
      g.fillStyle = '#c8a020'; g.fillRect(s.x, s.y, s.w, 1);
    } else if (s.kind === 'ingots') {
      for (let row = 0; row < 3; row++) for (let i = 0; i < 4 - (row % 2); i++) {
        const bx = s.x + i * 10 + (row % 2 ? 5 : 0), by = s.y + 7 - row * 3;
        g.fillStyle = '#5a5458'; g.fillRect(bx, by, 9, 3);
        g.fillStyle = '#8a8288'; g.fillRect(bx, by, 9, 1);
      }
    } else if (s.kind === 'conveyor') {
      g.fillStyle = '#2a2224'; g.fillRect(s.x, s.y, s.w, s.h);
      g.fillStyle = '#1a1416'; for (let x = s.x + 6; x < s.x + s.w; x += 14) pdisc(g, x, s.y + 5, 2.5);
      g.fillStyle = '#4a3e40'; for (let x = s.x + 6; x < s.x + s.w; x += 14) g.fillRect(x, s.y + 5, 1, 1);
      g.fillStyle = '#c8a020'; g.fillRect(s.x, s.y + 3, 3, 4); g.fillRect(s.x + s.w - 3, s.y + 3, 3, 4);
    } else if (s.kind === 'scrap') {
      for (let i = 0; i < s.w / 3; i++) {
        g.fillStyle = pick(['#4a3e40', '#3a2e30', '#6a4a3a', '#5a5458', '#7a3a24']);
        g.fillRect(s.x + ((R() * s.w) | 0), s.y + ((R() * s.h) | 0), 2 + ((R() * 4) | 0), 2);
      }
      g.fillStyle = '#5a4e50'; pline(g, s.x + 4, s.y + 2, s.x + s.w - 4, s.y + 1, 1);
    } else if (s.kind === 'molds') {
      g.fillStyle = '#2a2224'; g.fillRect(s.x, s.y, s.w, s.h);
      g.fillStyle = '#4a3e40'; g.fillRect(s.x, s.y, s.w, 1);
      g.fillStyle = '#141012'; for (let x = s.x + 2; x < s.x + s.w - 6; x += 11) g.fillRect(x, s.y + 1, 8, 2);
    } else if (s.kind === 'press') {
      // columns from the base up past the crosshead to the press head
      for (const cx of [s.x + 2, s.x + s.w - 8]) {
        g.fillStyle = '#4a4248'; g.fillRect(cx, 270, 6, s.y - 270);
        g.fillStyle = '#7a7078'; g.fillRect(cx, 270, 1, s.y - 270);
      }
      g.fillStyle = '#2e282c'; g.fillRect(s.x - 4, 262, s.w + 8, 12);
      g.fillStyle = '#c8a020'; g.fillRect(s.x - 4, 262, s.w + 8, 2);
      g.fillStyle = '#5a5458'; g.fillRect(s.x + s.w / 2 - 4, 274, 8, 44);
      g.fillStyle = '#3a3438'; g.fillRect(s.x, s.y, s.w, s.h);
      g.fillStyle = '#6a6268'; g.fillRect(s.x, s.y, s.w, 1);
      g.fillStyle = '#141012'; for (let x = s.x + 4; x < s.x + s.w; x += 8) pline(g, x, s.y + s.h, x + 4, s.y + 4, 1);
    }
  },
  paintPlatform(g, p, L, R) {
    const { x, y, w } = p;
    if (p.kind === 'gantry') {
      g.fillStyle = '#c8a020'; g.fillRect(x, y, w, 8);
      g.fillStyle = '#ffe070'; g.fillRect(x, y, w, 1);
      g.fillStyle = '#141012'; for (let i = 0; i < w; i += 8) pline(g, x + i, y + 7, x + i + 5, y + 2, 1);
      g.fillStyle = '#5a4810'; g.fillRect(x, y + 7, w, 1);
      return;
    }
    // grated walkways and catwalks with railings
    g.fillStyle = '#2a2224';
    for (let i = 2; i < w; i += 8) g.fillRect(x + i, y - 9, 1, 9);
    g.fillRect(x, y - 10, w, 1);
    g.fillStyle = p.kind === 'rack' ? '#4a3a2a' : '#3a3234'; g.fillRect(x, y, w, 3);
    g.fillStyle = '#6a5c5e'; g.fillRect(x, y, w, 1);
    g.fillStyle = '#141012'; for (let i = 1; i < w; i += 2) g.fillRect(x + i, y + 1, 1, 1);
    if (p.kind === 'rack') {
      // crates on the rack's steps
      for (let i = 4; i < w - 12; i += 22 + ((R() * 10) | 0)) {
        g.fillStyle = '#5a4430'; g.fillRect(x + i, y - 9, 12, 9);
        g.fillStyle = '#3a2a1a'; g.fillRect(x + i, y - 5, 12, 1); g.fillRect(x + i + 5, y - 9, 1, 9);
      }
      g.fillStyle = '#2a2224'; g.fillRect(x + w - 3, y, 2, L.GROUND - y);
    } else if (p.kind === 'walk' || p.kind === 'catwalk' || p.kind === 'crosshead') {
      g.fillStyle = '#1e1618';
      if (p.kind !== 'crosshead') for (const hx of [x + 6, x + w - 6]) g.fillRect(hx, -60, 1, y + 60);
    } else if (p.kind === 'fcat') {
      g.fillStyle = '#2a2224'; pline(g, x + 2, y + 3, x + 2, y + 14, 1); pline(g, x + 2, y + 14, x + 20, y + 3, 1);
    }
  },
  // a tile of molten metal: plates of crust drifting on the bright metal
  paintMelt(R) {
    const N = 96, c = makeCanvas(N, 12), g = c.ctx, pts = [];
    for (let i = 0; i < 9; i++) pts.push([R() * N, R() * 12]);
    for (let y = 0; y < 12; y++) {
      for (let x = 0; x < N; x++) {
        let d1 = 1e9, d2 = 1e9;
        for (const [px, py] of pts) {
          let dx = Math.abs(x - px); dx = Math.min(dx, N - dx);
          const dy = (y - py) * 2.2, d = dx * dx + dy * dy;
          if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
        }
        const e = Math.sqrt(d2) - Math.sqrt(d1), n = R();
        g.fillStyle = e < 1.6 ? (n < 0.4 ? MELT[7] : MELT[6]) : e < 3.5 ? MELT[5] : e < 6 ? MELT[4] : n < 0.5 ? MELT[3] : MELT[2];
        g.fillRect(x, y, 1, 1);
      }
    }
    return c;
  },
  // a ladle's pot, unrotated, its trunnion at (16, 10); the spout faces +x
  paintPot(full) {
    const c = makeCanvas(32, 28), g = c.ctx;
    for (let y = 2; y < 24; y++) {
      const half = Math.round(lerp(13, 10, (y - 2) / 22));
      g.fillStyle = y === 2 ? '#6a6064' : y % 7 === 0 ? '#26222a' : '#3a3438';
      g.fillRect(16 - half, y, half * 2, 1);
      g.fillStyle = '#4a4248'; g.fillRect(16 - half, y, 1, 1);
    }
    g.fillStyle = '#4a4248'; g.fillRect(1, 1, 30, 2);
    g.fillStyle = '#4a4248'; g.fillRect(28, 0, 4, 3);
    g.fillStyle = '#22201e'; g.fillRect(1, 8, 3, 4); g.fillRect(28, 8, 3, 4);
    g.fillStyle = '#e8a030'; g.fillRect(12, 14, 8, 2);
    g.fillStyle = full ? '#ff9a2a' : '#2a1a14'; g.fillRect(4, 0, 22, 1);
    if (full) { g.fillStyle = '#ffe080'; g.fillRect(8, 0, 6, 1); }
    return c;
  },

  // ---------- per-frame drawing ----------
  drawBackground(ctx, cx, cy, t) {
    const L = Level;
    ctx.drawImage(L.layers.sky, 0, 0);
    const ly = cy - L.CAM_Y_MIN;
    ctx.drawImage(L.layers.far, -Math.round(cx * 0.15), -Math.round(ly * 0.15));
    ctx.drawImage(L.layers.mid, -Math.round(cx * 0.45), -Math.round(ly * 0.45));
    ctx.fillStyle = 'rgba(60,20,12,0.22)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const bx = -Math.round(cx * 0.8), by = -Math.round(ly * 0.8);
    ctx.drawImage(L.layers.back, bx, by);
    // the gears and the mill's flywheel turning
    for (const gr of L.F.gears) {
      const x = gr.x + bx, y = gr.y + by;
      if (x < -gr.r - 4 || x > VIEW_W + gr.r + 4) continue;
      drawGear(ctx, x, y, gr.r, gr.n, t * gr.s, gr.fly);
    }
    ctx.fillStyle = 'rgba(40,14,10,0.2)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  },
  drawPlay(ctx, cx, cy, t) {
    const L = Level, sx = Math.round(cx), sy = Math.round(cy);
    ctx.drawImage(L.layers.play, sx, sy, VIEW_W, VIEW_H, 0, 0, VIEW_W, VIEW_H);
    // the belts running
    const st = Game.state === 'playing' ? Game.time : t;
    for (const C of L.conveyors) {
      const x0 = C.x - sx, y = C.y - sy;
      if (x0 > VIEW_W || x0 + C.w < 0) continue;
      ctx.fillStyle = '#4a4044'; ctx.fillRect(x0, y, C.w, 2);
      ctx.fillStyle = '#1a1416';
      const off = (((st * C.speed * C.dir) % 8) + 8) % 8;
      for (let x = off; x < C.w; x += 8) ctx.fillRect(Math.round(x0 + x), y, 2, 2);
      ctx.fillStyle = '#6a5e62'; ctx.fillRect(x0, y, C.w, 1);
    }
  },
  // Molten metal glows through the lighting: the river, the tap's pour, the furnace's slits, the drain, the molds.
  drawEmissive(ctx, cx, cy, t) {
    const L = Level, F = L.F, G = L.GROUND, R = F.river, M = L.layers.melt;
    const st = Game.state === 'playing' || Game.state === 'paused' ? Game.time : t;
    // the river, its crust drifting toward the drain; under the bridges it shows only below their grates
    const x0 = Math.max(R.x0, cx), x1 = Math.min(R.x1, cx + VIEW_W);
    if (x1 > x0) {
      const off = (st * 22) % M.width, yy = Math.round(R.y - cy);
      for (let x = Math.floor((x0 - R.x0 + off) / M.width) * M.width - off + R.x0; x < x1; x += M.width) {
        const a = Math.max(x, x0), b = Math.min(x + M.width, x1);
        if (b > a) ctx.drawImage(M, Math.round(a - x), 0, Math.round(b - a), 6, Math.round(a - cx), yy, Math.round(b - a), 6);
      }
      // the open stretches: a heat shimmer over them and the metal's bright top line
      for (const g of L.lava) {
        const a = Math.max(g.x0, cx), b = Math.min(g.x1, cx + VIEW_W);
        if (b <= a) continue;
        ctx.globalAlpha = 0.18 + Math.sin(st * 3 + g.x0) * 0.05; ctx.fillStyle = '#ff6a1a';
        for (let y = 0; y < 14; y++) for (let x = Math.round(a); x < b; x += 2) if (bayer(x + y, y) < (1 - y / 14) * 0.7) ctx.fillRect(Math.round(x - cx), yy - y - 1, 1, 1);
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#ffd070'; ctx.fillRect(Math.round(a - cx), yy, Math.round(b - a), 1);
        // bubbles
        for (let i = 0; i < 3; i++) {
          const ph = st * 1.3 + i * 2.1 + g.x0, k = ph % 1, bx = g.x0 + ((Math.floor(ph) * 37 + i * 53) % Math.max(1, g.x1 - g.x0));
          if (bx < a || bx > b) continue;
          ctx.fillStyle = k < 0.7 ? '#fff0c0' : '#ff9a2a';
          pdisc(ctx, bx - cx, yy - k * 2, 1 + k * 1.5);
        }
      }
    }
    // the tap pouring into the river's head
    const tx = F.tap.x - cx, ty = F.tap.y - cy;
    if (tx > -30 && tx < VIEW_W + 10) {
      const bot = R.y - cy;
      for (let y = ty - 2; y < bot; y++) {
        const k = (y - ty) / (bot - ty), xx = tx + 2 + k * k * 9;
        const band = (((y - st * 160) % 9) + 9) % 9 < 3;
        ctx.fillStyle = band ? '#fff0c0' : '#ffb040'; ctx.fillRect(Math.round(xx) - 1, Math.round(y), 3, 1);
        ctx.fillStyle = '#ff6a1a'; ctx.fillRect(Math.round(xx) + 2, Math.round(y), 1, 1);
      }
      ctx.fillStyle = '#ffd070'; ctx.fillRect(Math.round(tx - 10), Math.round(ty - 4), 10, 7);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(tx - 6), Math.round(ty - 2), 5, 3);
      ctx.fillStyle = '#ffe080'; pring(ctx, tx + 11, bot, 4 + Math.sin(st * 20), 0.3, 1);
    }
    // the furnace's slits flickering
    for (const [x, y, w, h] of this.slits()) {
      const fl = Math.sin(st * 7 + x * 0.3) > -0.3;
      ctx.fillStyle = fl ? '#ff9a2a' : '#ff6a1a'; ctx.fillRect(Math.round(x - cx), Math.round(y - cy), w, h);
      ctx.fillStyle = '#ffe080'; ctx.fillRect(Math.round(x - cx + 2), Math.round(y - cy + 1), w - 4, 1);
    }
    // the drain
    const dx = R.x1 - cx;
    if (dx > -10 && dx < VIEW_W + 10) {
      ctx.fillStyle = '#ff7a1a'; ctx.fillRect(Math.round(dx - 3), Math.round(R.y - cy), 3, 6);
      for (let y = 0; y < 6; y += 2) { ctx.fillStyle = ((st * 12 + y) | 0) % 2 ? '#ffd070' : '#ff9a2a'; ctx.fillRect(Math.round(dx), Math.round(R.y - cy + y), 5, 1); }
    }
    // metal cooling in the molds
    const mx = 2082 - cx, my = 395 - cy;
    if (mx > -120 && mx < VIEW_W) {
      for (let i = 0; i < 7; i++) {
        const k = 0.5 + 0.5 * Math.sin(st * 0.4 + i * 1.7), col = MELT[Math.round(3 + k * 3)];
        ctx.fillStyle = col; ctx.fillRect(Math.round(mx + i * 11), Math.round(my), 8, 2);
        if (k > 0.8) { ctx.fillStyle = '#fff0c0'; ctx.fillRect(Math.round(mx + i * 11 + 2), Math.round(my), 3, 1); }
      }
    }
  },
  addLights(cx, cy, t) {
    const L = Level, F = L.F, G = L.GROUND;
    if (!Game.mod('blackout')) for (const l of F.workLamps) { FX.frameLight(l.x, l.y + 2, 90, '#ffb050', 0.75); FX.frameLight(l.x, l.y + 110, 70, '#ffb050', 0.35); }
    for (let x = F.river.x0 + 20; x < F.river.x1; x += 55) FX.frameLight(x, G + 6, 62 + Math.sin(t * 3 + x) * 6, '#ff6a1a', 0.9);
    FX.frameLight(F.tap.x + 6, F.tap.y + 10, 80 + Math.sin(t * 17) * 5, '#ff9a3a', 1);
    for (const [x, y, w] of this.slits()) FX.frameLight(x + w / 2, y + 1, 26, '#ff7a2a', 0.7);
    FX.frameLight(2120, 392, 60, '#ff7a2a', 0.8);
    FX.frameLight(F.river.x1, G + 10, 40, '#ff8a2a', 0.8);
  },
  ambient() { return Game.mod('blackout') ? '#2c2226' : '#9c8278'; },

  // ---------- the hall working ----------
  // whether x is over the molten river (open or under a bridge), and a body down in it
  inRiver(o) {
    const R = Level.F.river;
    return o.x > R.x0 && o.x < R.x1 && o.y > Level.GROUND + 5;
  },
  update(dt) {
    if (!Level.foundry()) return;
    const P = Game.player, L = Level;
    if (!P.dead && this.inRiver(P)) this.burn(P);
    for (const e of Game.enemies) if (!e.dead && !e.spawning && !e.flying && !e.dying && this.inRiver(e)) this.burn(e);
    for (const pr of Game.props) if (!pr.dead && pr.explode && !pr.towed && this.inRiver(pr)) pr.explode();
    for (const pk of Game.pickups) if (!pk.dead && this.inRiver(pk)) { pk.dead = true; FX.sparks(pk.x, pk.y, 6, -Math.PI / 2, 1, 40, 120, MOLTEN); }
    // conveyors carry what stands on them
    for (const C of L.conveyors) {
      const step = C.dir * C.speed * dt;
      const carry = (o) => {
        if (!o.onGround || Math.abs(o.y - C.y) > 0.6 || o.x < C.x || o.x > C.x + C.w) return;
        if (L.rectFree(o.x + step - o.w / 2, o.y - o.h, o.w, o.h - 0.5)) o.x += step;
      };
      if (!P.dead && !P.ult) carry(P);
      for (const e of Game.enemies) if (!e.dead && !e.flying && !e.spawning) carry(e);
      for (const pr of Game.props) if (!pr.dead && pr instanceof Barrel && !pr.towed) carry(pr);
    }
    // embers and spatter off the river, spray where the tap pours
    const R = L.F.river;
    if (Math.random() < 0.6) {
      const x = clamp(P.x + rand(-260, 260), R.x0 + 2, R.x1 - 2);
      if (L.lavaAt(x) && Math.random() < 0.7) FX.embers(x, R.y - 1, 1);
    }
    if (Math.random() < 0.5 && Math.abs(P.x - R.x0) < 400) FX.sparks(L.F.tap.x + 12, R.y - 1, 2, -Math.PI / 2, 1.4, 30, 110, Object.assign({ life: 0.8 }, MOLTEN));
  },
  // in the river: burned (not KRAG, who's made of the stuff) and thrown up onto the nearer bank
  burn(o) {
    if (o._lavaT > Game.time) return;
    o._lavaT = Game.time + 0.5;
    const g = Level.lavaAt(o.x), R = Level.F.river;
    let side;
    if (g) side = g.head ? 1 : o.x - g.x0 < g.x1 - o.x ? -1 : 1;
    else side = o.x - R.x0 < 80 ? 1 : chance(0.5) ? -1 : 1;
    const P = Game.player;
    if (o === P) {
      P.takeHit({ dmg: LAVA.DMG, x: o.x - side * 10, y: o.y + 6, kind: 'hazard', knock: 0, unparryable: true, through: true });
      if (!P.dead) { P.vy = -LAVA.UP; P.vx = side * LAVA.OUT; P.onGround = false; }
    } else if (o.type === 'krag') {
      o.vy = -LAVA.UP * 1.1; o.vx = side * LAVA.OUT; o.onGround = false;
    } else {
      hurtEnemy(o, LAVA.EDMG, { kx: side * 120, ky: -200, heavy: true, cause: 'lava', angle: -Math.PI / 2, stagger: 0.6, crit: true });
      if (!o.dead) { o.vy = -LAVA.UP; o.vx = side * LAVA.OUT * 0.8; o.onGround = false; }
    }
    FX.sparks(o.x, R.y - 2, 22, -Math.PI / 2, 1.4, 60, 260, Object.assign({ life: 1 }, MOLTEN));
    FX.embers(o.x, R.y - 2, 10);
    FX.dust(o.x, R.y - 4, 4, { c: '#3a3036', smax: 30, rise: 40, life: 1.2 });
    FX.light(o.x, R.y - 6, 60, '#ff8a2a', 1, 0.3);
    Sound.play('lavaBurn');
  },
  // the hall's own props each wave: ladles full again on their hooks
  resetProps() {
    for (const S of Level.ladleSpots) {
      let la = Game.props.find((p) => p instanceof Ladle && p.spot === S);
      if (!la) { la = new Ladle(S); Game.props.push(la); }
      la.refill();
    }
  },

  // ---------- travelling between the regions ----------
  // A portal opens at the region's portal spot, leading to `to`.
  openPortal(to) {
    const x = Level.portalAt, pt = new Portal(x, Level.groundBelow(x, Level.GROUND - 40), to);
    Game.hazards.push(pt);
    return pt;
  },
  // Through the portal: the run goes on in the other region (score, wave, upgrades, health, shield and the
  // ultimate's charge carry over); everything else is left behind.
  travel(to) {
    const P = Game.player;
    if (P.tether) P.releaseTether();
    P.stopAllLoops();
    for (const e of Game.enemies) if (e.stopLoops) e.stopLoops();
    FX.clear();
    Game.enemies = []; Game.projectiles = []; Game.hazards = []; Game.pickups = []; Game.cuts = []; Game.props = [];
    Game.endBulletTime();
    Level.load(to);
    const np = new Player(Level.start, Level.GROUND);
    np.hp = P.hp; np.shield = P.shield; np.ultCharge = P.ultCharge; np.charId = P.charId; np.facing = 1;
    Game.player = np;
    Game.snapCamera();
    Game.resetProps(true);
    // the way you came in, closing behind you
    const back = new Portal(Level.start - 18, Level.GROUND, null);
    back.exit = true;
    Game.hazards.push(back);
    FX.flash('#ffd0a0', 0.9);
    Game.shake(0.4);
    Game.announcements = [];
    Sound.play('portalEnter');
    Game.announce(to === 'foundry' ? 'THE FOUNDRY' : 'SECTOR 9', to === 'foundry' ? 'KRAG WAITS IN THE FORGE' : 'BACK TO THE STREETS', to === 'foundry' ? '#ff9a5a' : '#4af0ff', 2.6);
  },
};

// A gear (or, with no teeth, a spoked flywheel) turned to angle a.
function drawGear(ctx, x, y, r, n, a, fly) {
  ctx.fillStyle = '#141012'; pdisc(ctx, x, y, r + 1);
  ctx.fillStyle = fly ? '#2e2628' : '#3a3032'; pdisc(ctx, x, y, r);
  ctx.fillStyle = '#1e1819'; pdisc(ctx, x, y, r * (fly ? 0.82 : 0.62));
  ctx.fillStyle = fly ? '#2e2628' : '#3a3032';
  const spokes = fly ? 6 : 4;
  for (let i = 0; i < spokes; i++) { const q = a + (i / spokes) * TAU; pline(ctx, x, y, x + Math.cos(q) * r * 0.85, y + Math.sin(q) * r * 0.85, fly ? 3 : 2); }
  if (n) {
    ctx.fillStyle = '#3a3032';
    for (let i = 0; i < n; i++) { const q = a + (i / n) * TAU; pdisc(ctx, x + Math.cos(q) * (r + 1.5), y + Math.sin(q) * (r + 1.5), 1.6); }
  } else {
    ctx.fillStyle = '#5a4e50'; for (let i = 0; i < 24; i++) { const q = a + (i / 24) * TAU; ctx.fillRect(Math.round(x + Math.cos(q) * r), Math.round(y + Math.sin(q) * r), 1, 1); }
  }
  ctx.fillStyle = '#5a4e50'; pdisc(ctx, x, y, fly ? 6 : 3);
  ctx.fillStyle = '#7a6e70'; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 1);
}

// A crucible of slag: the red barrel's place in the Foundry. It lights, throws and bursts the same way, but
// bursts into a pool of molten slag that burns what stands in it.
class Crucible extends Barrel {
  constructor(x, y) { super(x, y); this.w = 12; this.h = 12; this.grabR = 10; }
  get cy() { return this.y - 6; }
  explode() {
    if (this.dead) return;
    this.dead = true;
    const cx = this.x, cy = this.y - 6, R = 52;
    for (const e of Game.enemies) {
      if (e.dead || e.spawning) continue;
      const d = dist(cx, cy, e.x, e.cy);
      if (d < R + e.w / 2) hurtEnemy(e, 55 * (1 - (d / (R + e.w)) * 0.5), { kx: ((e.x - cx) / (d || 1)) * 300, ky: -300, heavy: true, cause: 'barrel', stagger: 1, angle: Math.atan2(e.cy - cy, e.x - cx) });
    }
    for (const pr of Game.props) if (pr !== this && !pr.dead && dist(cx, cy, pr.x, pr.y) < R) pr.hit(10, { heavy: true, kx: (pr.x - cx) * 4, ky: -200 });
    const p = Game.player, pd = dist(cx, cy, p.x, p.cy);
    if (pd < R * 0.8 && !p.dead && !p.ult) { p.vx += ((p.x - cx) / (pd || 1)) * 200; p.vy = Math.min(p.vy, -160); }
    // the slag spreads where it stood
    if (!(Level.foundry() && Foundry.inRiver(this))) {
      const gy = Level.groundBelow(this.x, this.y - 2);
      if (gy < Level.H) Game.hazards.push(new SlagPool(this.x, gy, 34, 4.5));
    }
    FX.ring(cx, cy, 4, R, 0.35, { c: '#ff7a2a', core: '#ffe080', w: 2 });
    FX.sparks(cx, cy, 34, -Math.PI / 2, 2.6, 80, 300, MOLTEN);
    FX.dust(cx, cy, 12, { c: '#2a2026', smax: 80, r1: 7, life: 1.4, rise: 25 });
    FX.embers(cx, cy, 18);
    FX.debris(cx, cy, 14, SLAG_COLS, 220);
    FX.light(cx, cy, 130, '#ff8a3a', 1, 0.4);
    FX.flash('#ff8a3a', 0.2);
    Sound.play('crucibleBurst');
    Game.shake(0.45);
    Game.hitstop(0.04);
  }
  draw(ctx, camX, camY) {
    if (this.dead) return;
    const x = Math.round(this.x - camX), y = Math.round(this.y - camY), blink = this.fuse >= 0 && ((this.fuse * 16) | 0) % 2;
    ctx.fillStyle = '#0b0910'; ctx.fillRect(x - 7, y - 12, 14, 12); ctx.fillRect(x - 6, y - 13, 12, 14);
    for (let yy = 0; yy < 11; yy++) {
      const half = Math.round(lerp(6, 5, yy / 10));
      ctx.fillStyle = blink ? '#ffffff' : yy === 0 ? '#5a5054' : yy === 4 ? '#221e20' : '#3a3234';
      ctx.fillRect(x - half, y - 12 + yy, half * 2, 1);
    }
    ctx.fillStyle = '#2a2426'; ctx.fillRect(x - 7, y - 9, 1, 3); ctx.fillRect(x + 6, y - 9, 1, 3);
    ctx.fillStyle = '#e8a030'; ctx.fillRect(x - 2, y - 6, 4, 1);
    ctx.fillStyle = ((Game.time * 6) | 0) % 2 ? '#ff9a3a' : '#ff7a1a'; ctx.fillRect(x - 4, y - 12, 8, 1);
  }
  addLights() { FX.frameLight(this.x, this.y - 12, this.fuse >= 0 ? 30 : 16, '#ff8a2a', 0.7); }
}

// A ladle of molten metal hanging from a gantry crane by its bail. Hit it, or yank it on the tether, and it
// tips toward the side the blow came from and pours; then it hangs empty until refilled.
class Ladle {
  constructor(S) {
    this.spot = S; this.x = S.x; this.y = S.y; this.hook = S.hook; this.w = 26; this.h = 24; this.grabR = 14;
    this.dead = false; this.tethered = false; this.state = 'full'; this.t = 0; this.tilt = 0; this.dir = 1; this.yank = null; this.pour = null; this.swing = 0;
  }
  get cx() { return this.x; }
  get cy() { return this.y - 12; }
  refill() { this.state = 'full'; this.t = 0; this.tilt = 0; this.pour = null; }
  // the blow's direction, or from you to it
  hit(dmg, o = {}) { this.tip(o.kx ? sign(o.kx) : sign(this.x - Game.player.x) || 1); }
  grab(p) { this.tip(sign(p.x - this.x) || 1); this.yank = p; }
  towTo() {}
  throwAt() {}
  tip(d) {
    FX.sparks(this.x, this.cy, 6, rand(0, TAU), TAU, 40, 120);
    this.swing = 0.25;
    if (this.state !== 'full') { Sound.play('kragBlock', { wear: 0.2 }); return; }
    this.dir = d; this.state = 'tip'; this.t = 0;
    Sound.play('ladleTip');
  }
  // the spout's lip, on the side it tips to
  lip() { return rotPt(this.x + this.dir * 15, this.y - 24, this.x, this.y - 14, this.tilt * this.dir); }
  update(dt) {
    this.t += dt;
    if (this.swing > 0) this.swing = Math.max(0, this.swing - dt);
    if (this.yank) { if (this.yank.tether && this.yank.tether.target === this) this.yank.releaseTether(); this.yank = null; }
    if (this.state === 'tip') {
      this.tilt = Math.min(1.9, this.tilt + dt * 3.4);
      if (!this.pour && this.tilt > 1.1) {
        const [lx, ly] = this.lip();
        this.pour = new SlagPour(lx, ly, Level.groundBelow(lx, ly + 2), this);
        Game.hazards.push(this.pour);
      }
      if (this.t > POUR.DUR + 0.6) { this.state = 'empty'; this.t = 0; }
    } else if (this.state === 'empty') this.tilt = Math.max(0.35, this.tilt - dt * 0.8);
    else if (Math.random() < 0.05) FX.embers(this.x + rand(-8, 8), this.y - 24, 1);
  }
  draw(ctx, camX, camY) {
    const x = Math.round(this.x - camX), y = Math.round(this.y - camY), top = Math.round(this.hook - camY), wob = Math.sin(Game.time * 30) * this.swing * 4;
    // trolley, cable, bail
    ctx.fillStyle = '#2a2224'; ctx.fillRect(x - 6, top, 13, 5);
    ctx.fillStyle = '#c8a020'; ctx.fillRect(x - 6, top, 13, 1);
    ctx.fillStyle = '#141012'; ctx.fillRect(x, top + 5, 1, y - 38 - top);
    ctx.fillStyle = '#c8a020'; ctx.fillRect(x - 2, y - 40, 5, 4);
    ctx.fillStyle = '#2e2a2c'; pline(ctx, x - 1, y - 36, x - 15, y - 14, 2); pline(ctx, x + 1, y - 36, x + 15, y - 14, 2);
    // the pot, rotated about its trunnions
    const pot = this.state === 'full' ? Level.layers.potFull : Level.layers.potEmpty;
    ctx.save();
    ctx.translate(x + wob, y - 14);
    ctx.rotate(this.tilt * this.dir);
    if (this.dir < 0) ctx.scale(-1, 1);
    ctx.drawImage(pot, -16, -10);
    ctx.restore();
  }
  addLights() { if (this.state === 'full') FX.frameLight(this.x, this.y - 24, 30, '#ff8a2a', 0.8); }
}

// The stream of molten metal out of a tipped ladle: it burns whatever is under it as it comes down, and
// spreads into a pool.
class SlagPour {
  constructor(x, top, ground, owner) {
    this.x = x; this.top = top; this.y = ground; this.owner = owner; this.t = 0; this.dead = false; this.hit = new Set();
    Game.hazards.push(new SlagPool(x, ground, POUR.POOL, POUR.LIFE, 0.8));
    Sound.play('slagPour');
  }
  update(dt) {
    this.t += dt;
    const P = Game.player, live = this.t < POUR.DUR;
    if (live) {
      if (Math.random() < 0.9) FX.sparks(this.x + rand(-4, 4), this.y - 1, 2, -Math.PI / 2, 1.6, 50, 180, Object.assign({ life: 0.9 }, MOLTEN));
      if (Math.random() < 0.3) FX.embers(this.x, rand(this.top, this.y), 1);
      for (const e of Game.enemies) {
        if (e.dead || e.spawning || this.hit.has(e) || Math.abs(e.x - this.x) > POUR.HALF + e.w / 2 || e.y < this.top || e.y - e.h > this.y) continue;
        this.hit.add(e);
        if (e.type === 'krag') continue;
        hurtEnemy(e, POUR.EDMG, { kx: sign(e.x - this.x || 1) * 160, ky: -200, heavy: true, cause: 'lava', angle: Math.PI / 2, stagger: 0.8, crit: true });
      }
      if (!P.dead && !this.hit.has(P) && Math.abs(P.x - this.x) < POUR.HALF + P.w / 2 && P.y > this.top && P.y - P.h < this.y) {
        this.hit.add(P);
        if (P.takeHit({ dmg: POUR.DMG, x: this.x, y: P.y - 30, kind: 'hazard', knock: 200 }) === 'hit') { P.vy = -220; P.onGround = false; }
      }
    }
    if (this.t > POUR.DUR + 0.3) this.dead = true;
  }
  drawEmissive(ctx, camX, camY) {
    const k = this.t < 0.15 ? this.t / 0.15 : this.t > POUR.DUR ? clamp(1 - (this.t - POUR.DUR) / 0.3, 0, 1) : 1;
    if (k <= 0) return;
    const x = Math.round(this.x - camX), y0 = Math.round(this.top - camY), y1 = Math.round(lerp(this.top, this.y, Math.min(1, this.t / 0.15)) - camY);
    const w = Math.max(1, Math.round(5 * k));
    for (let y = y0; y < y1; y++) {
      const band = (((y - this.t * 220) % 10) + 10) % 10 < 3;
      ctx.fillStyle = '#ff6a1a'; ctx.fillRect(x - (w >> 1) - 1, y, w + 2, 1);
      ctx.fillStyle = band ? '#fff0c0' : '#ffb040'; ctx.fillRect(x - (w >> 1), y, w, 1);
    }
    ctx.fillStyle = '#ffd070'; pring(ctx, x, y1, 4 + Math.sin(this.t * 30) * 1.5, 0.35, 1);
  }
  addLights() { if (this.t < POUR.DUR) { FX.frameLight(this.x, (this.top + this.y) / 2, 70, '#ff7a2a', 0.9); FX.frameLight(this.x, this.y - 4, 50, '#ffb040', 0.9); } }
}

// A pool of molten slag on the floor: it burns whatever stands in it, a little at a time, until it cools.
class SlagPool {
  constructor(x, y, R, life, grow = 0.25) {
    this.x = x; this.y = y; this.R = R; this.life = life; this.grow = grow; this.t = 0; this.dead = false; this.tick = new Map();
    this.seed = (Math.random() * 1000) | 0;
  }
  radius() { return this.R * Math.min(1, this.t / this.grow); }
  update(dt) {
    this.t += dt;
    if (this.t >= this.life) { this.dead = true; return; }
    const r = this.radius(), hot = this.t < this.life - 1, P = Game.player;
    if (Math.random() < 0.5) FX.sparks(this.x + rand(-r, r), this.y - 1, 1, -Math.PI / 2, 0.8, 20, 70, Object.assign({ life: 0.7 }, MOLTEN));
    if (!hot) return;
    const burns = (o) => Math.abs(o.x - this.x) < r && o.y > this.y - 3 && o.y < this.y + 4;
    for (const e of Game.enemies) {
      if (e.dead || e.spawning || e.flying || e.type === 'krag' || !burns(e) || (this.tick.get(e) || 0) > this.t) continue;
      this.tick.set(e, this.t + SLAG.EVERY);
      hurtEnemy(e, SLAG.EDMG, { cause: 'lava', stagger: 0.25, noKnock: true, angle: -Math.PI / 2 });
      FX.sparks(e.x, e.y - 2, 4, -Math.PI / 2, 1, 30, 90, MOLTEN);
    }
    if (!P.dead && burns(P) && (this.tick.get(P) || 0) <= this.t) {
      this.tick.set(P, this.t + SLAG.PEVERY);
      if (P.takeHit({ dmg: SLAG.DMG, x: P.x, y: this.y + 10, kind: 'hazard', knock: 0 }) === 'hit') { P.vy = -160; P.onGround = false; }
      Sound.play('slagHiss');
    }
  }
  drawEmissive(ctx, camX, camY) {
    const r = this.radius(), cool = clamp((this.life - this.t) / (this.life * 0.6), 0, 1), fade = clamp((this.life - this.t) / 1, 0, 1);
    const x = this.x - camX, y = Math.round(this.y - camY);
    ctx.globalAlpha = fade;
    for (let dx = -r; dx <= r; dx++) {
      const k = 1 - Math.abs(dx) / (r + 1), h = k > 0.6 ? 2 : 1;
      const n = Math.sin((dx + this.seed) * 0.7 + this.t * 2) * 0.5 + 0.5;
      ctx.fillStyle = MELT[clamp(Math.round(1 + cool * (3 + n * 3) * Math.min(1, k * 2)), 0, 7)];
      ctx.fillRect(Math.round(x + dx), y - h, 1, h);
    }
    ctx.globalAlpha = 1;
  }
  addLights() { const k = clamp((this.life - this.t) / (this.life * 0.6), 0, 1); if (k > 0.1) FX.frameLight(this.x, this.y - 4, this.radius() + 20, '#ff6a1a', 0.7 * k); }
}

// A portal between the regions: an oval of molten light on the street that opens over a second; step into it
// to go through. An exit portal (the one you came out of) only closes.
class Portal {
  constructor(x, y, to) {
    this.x = x; this.y = y; this.to = to; this.t = 0; this.open = 0; this.entered = false; this.dead = false; this.exit = false;
    this.indicator = !!to;
    if (to) { Sound.play('portalOpen'); FX.flash('#ffb070', 0.3); Game.shake(0.3); }
  }
  get cy() { return this.y - 18; }
  update(dt) {
    this.t += dt;
    this.open = this.exit ? clamp(1 - this.t / 1.6, 0, 1) : clamp(this.t / 1.2, 0, 1);
    if (this.exit && this.t > 1.6) { this.dead = true; return; }
    if (Math.random() < 0.8 * this.open) {
      const a = rand(0, TAU), qx = this.x + Math.cos(a) * 12, qy = this.cy + Math.sin(a) * 18;
      FX.sparks(qx, qy, 1, Math.atan2(this.cy - qy, this.x - qx), 0.4, 20, 50, { c0: '#ffffff', c1: '#ffb040', c2: '#a03a10', g: 0, life: 0.9 });
    }
    const P = Game.player;
    if (!this.exit && this.open >= 1 && !P.dead && Math.abs(P.x - this.x) < 9 && P.y > this.y - 34 && P.y < this.y + 4) this.entered = true;
  }
  drawEmissive(ctx, camX, camY) {
    const k = easeOutCubic(this.open), x = this.x - camX, cy = this.cy - camY, t = this.t;
    if (k <= 0.02) return;
    ctx.globalAlpha = 0.3 * k; ctx.fillStyle = '#ff7a2a'; pdisc(ctx, x, cy, 15 * k); ctx.globalAlpha = 1;
    // the heart: a spiral turning inward
    for (let i = 0; i < 70; i++) {
      const u = i / 70, a = u * 9 - t * 3, rr = u * k;
      ctx.fillStyle = u < 0.3 ? '#ffffff' : u < 0.65 ? '#ffd070' : '#ff7a1a';
      ctx.fillRect(Math.round(x + Math.cos(a) * 10 * rr), Math.round(cy + Math.sin(a) * 16 * rr), 1, 1);
    }
    // the rim
    const n = 60;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      ctx.fillStyle = (i + ((t * 20) | 0)) % 6 < 2 ? '#ffffff' : '#ffb040';
      ctx.fillRect(Math.round(x + Math.cos(a) * 12 * k), Math.round(cy + Math.sin(a) * 18 * k), 1, 1);
      ctx.fillStyle = '#ff5a1a';
      ctx.fillRect(Math.round(x + Math.cos(a + t * 0.6) * 13.5 * k), Math.round(cy + Math.sin(a + t * 0.6) * 19.5 * k), 1, 1);
    }
    ctx.fillStyle = '#ffd070'; pring(ctx, x, this.y - camY - 1, 12 * k, 0.25, 1);
  }
  addLights() { FX.frameLight(this.x, this.cy, 70 * this.open, '#ffa040', 0.95); }
}

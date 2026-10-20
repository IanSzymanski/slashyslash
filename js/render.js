'use strict';
// Frame composition, lighting, weather and HUD. Everything renders at 480x270, CSS upscales it.

const Render = {
  canvas: null, ctx: null, scene: null, light: null, mask: null, vignette: null,
  weather: [], fps: 60, hpTrail: 100, shTrail: 100,

  init(canvas) {
    this.canvas = canvas;
    canvas.width = VIEW_W; canvas.height = VIEW_H;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.scene = makeCanvas(VIEW_W, VIEW_H);
    this.light = makeCanvas(VIEW_W, VIEW_H);
    this.mask = makeCanvas(VIEW_W, VIEW_H);
    this.vignette = makeCanvas(VIEW_W, VIEW_H);
    this.zoomBuf = makeCanvas(VIEW_W, VIEW_H);
    const g = this.vignette.ctx;
    const grd = g.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.35, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.62);
    grd.addColorStop(0, 'rgba(8,4,12,0)');
    grd.addColorStop(1, 'rgba(8,4,12,0.55)');
    g.fillStyle = grd;
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    for (let i = 0; i < 140; i++) {
      const ash = i < 80;
      this.weather.push({ ash, x: rand(0, VIEW_W), y: rand(0, VIEW_H), d: rand(0.6, 1.2), s: ash ? rand(8, 22) : rand(220, 300), ph: rand(0, TAU) });
    }
    this.resize();
    window.addEventListener('resize', () => this.resize());
  },
  resize() {
    const ww = window.innerWidth, wh = window.innerHeight;
    let scale = Math.min(ww / VIEW_W, wh / VIEW_H);
    if (S.visuals.integerScale && scale >= 1) scale = Math.floor(scale);
    const w = Math.floor(VIEW_W * scale), h = Math.floor(VIEW_H * scale);
    const app = document.getElementById('app');
    app.style.width = w + 'px';
    app.style.height = h + 'px';
    app.style.setProperty('--ui-scale', (h / 720).toFixed(3));
    document.getElementById('scanlines').style.backgroundSize = '100% ' + Math.max(2, Math.round(scale)) + 'px';
  },

  draw(realDt) {
    const ctx = this.ctx, G = Game, cam = G.cam;
    this.fps = lerp(this.fps, 1 / Math.max(realDt, 0.001), 0.05);
    const cx = Math.round(cam.x + cam.ox), cy = Math.round(cam.y + cam.oy);
    cam.rx = cx; cam.ry = cy;
    const t = G.realTime;
    FX.frameLights.length = 0;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;

    Level.drawBackground(ctx, cx, cy, t);

    // lit foreground
    const sc = this.scene.ctx;
    sc.globalCompositeOperation = 'source-over';
    sc.clearRect(0, 0, VIEW_W, VIEW_H);
    Level.drawPlay(sc, cx, cy, t);
    FX.drawDecals(sc, cx, cy);
    for (const p of G.props) p.draw(sc, cx, cy);
    for (const b of G.projectiles) if (b.draw) b.draw(sc, cx, cy);
    for (const e of G.enemies) if (!e.dead) e.draw(sc, cx, cy);
    FX.drawGhosts(sc, cx, cy);
    if (G.player) G.player.draw(sc, cx, cy);
    FX.drawGibs(sc, cx, cy);
    if (S.visuals.lighting) this.applyLighting(cx, cy, t);
    ctx.drawImage(this.scene, 0, 0);
    // bullet time drains the colour from the world; emissive effects drawn after it stay bright
    const bt = G.bulletK();
    if (bt > 0) {
      ctx.globalCompositeOperation = 'saturation';
      ctx.globalAlpha = 0.85 * bt; ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = 0.55 * bt; ctx.fillStyle = '#7080b8'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    }

    // emissive layer
    Level.drawEmissive(ctx, cx, cy, t);
    for (const e of G.enemies) if (!e.dead) e.drawEmissive(ctx, cx, cy);
    for (const h of G.hazards) h.drawEmissive(ctx, cx, cy);
    for (const pk of G.pickups) pk.drawEmissive(ctx, cx, cy);
    for (const b of G.projectiles) if (b.drawEmissive) b.drawEmissive(ctx, cx, cy);
    FX.drawEmissive(ctx, cx, cy);
    if (G.player) G.player.drawEmissive(ctx, cx, cy);
    if (S.visuals.glow) this.drawGlow(ctx, cx, cy);
    if (bt > 0) this.drawBulletTime(ctx, cx, cy, bt, t);
    FX.drawTexts(ctx, cx, cy);
    if (S.visuals.weather) this.drawWeather(ctx, realDt, cx, cy);
    if (FX.flashA > 0) {
      ctx.globalAlpha = Math.min(0.7, FX.flashA);
      ctx.fillStyle = FX.flashColor;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.globalAlpha = 1;
      FX.flashA = Math.max(0, FX.flashA - realDt * 6);
    }
    const C = G.cine;
    if (C && C.zoom > 1 && C.focus) this.zoomTo(ctx, C.focus.x - cx, C.focus.y - 12 - cy, C.zoom);
    ctx.drawImage(this.vignette, 0, 0);
    const inGame = G.player && (G.state === 'playing' || G.state === 'paused' || G.state === 'over' || G.state === 'pick');
    if (inGame && !G.cineActive()) this.drawHUD(ctx, realDt);
    if (C) this.drawCine(ctx, C, t);
    if (S.visuals.showFps) drawText(ctx, Math.round(this.fps) + ' FPS', VIEW_W - 4, VIEW_H - 9, { align: 'right', color: '#7a849c' });
  },

  // Integer zoom (pixel-perfect) around a screen point, used for cutscene close-ups.
  zoomTo(ctx, fx, fy, z) {
    const w = VIEW_W / z, h = VIEW_H / z;
    const sx = clamp(Math.round(fx - w / 2), 0, VIEW_W - w), sy = clamp(Math.round(fy - h / 2), 0, VIEW_H - h);
    const zb = this.zoomBuf.ctx;
    zb.clearRect(0, 0, VIEW_W, VIEW_H);
    zb.drawImage(this.canvas, 0, 0);
    ctx.drawImage(this.zoomBuf, sx, sy, w, h, 0, 0, VIEW_W, VIEW_H);
  },
  drawCine(ctx, C, t) {
    const k = easeOutCubic(clamp(C.bars, 0, 1)), bh = Math.round(30 * k);
    if (bh <= 0) return;
    ctx.fillStyle = '#050308';
    ctx.fillRect(0, 0, VIEW_W, bh); ctx.fillRect(0, VIEW_H - bh, VIEW_W, bh);
    if (C.skippable && !C.closing && k > 0.9) {
      const hold = clamp(C.skipHold / 0.5, 0, 1);
      drawText(ctx, 'HOLD ' + hudKey('sheathe') + ' TO SKIP', VIEW_W - 8, VIEW_H - 12, { align: 'right', color: hold > 0 ? '#ffffff' : '#7a6a7a' });
      ctx.fillStyle = '#3a3040'; ctx.fillRect(VIEW_W - 58, VIEW_H - 5, 50, 1);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(VIEW_W - 58, VIEW_H - 5, Math.round(50 * hold), 1);
    }
    if (C.caption && k > 0.9) {
      const cap = C.caption;
      drawText(ctx, cap.text, VIEW_W / 2, VIEW_H - bh + 7, { align: 'center', color: cap.color || '#ffffff', scale: 2 });
      if (cap.sub) drawText(ctx, cap.sub, VIEW_W / 2, VIEW_H - bh + 20, { align: 'center', color: '#9a8aa8' });
    }
    if (C.big) {
      const bt = C.bigT, sc = bt < 0.08 ? 9 : bt < 0.16 ? 7 : 6;
      const shake = bt < 0.3 ? Math.round((Math.random() - 0.5) * 4 * (1 - bt / 0.3)) : 0;
      drawText(ctx, C.big.text, VIEW_W / 2 + shake, VIEW_H / 2 - sc * 3 + shake, { align: 'center', color: C.big.color || '#ffd070', scale: sc, outline: '#0b0910' });
      if (C.big.sub && bt > 0.5) drawText(ctx, C.big.sub, VIEW_W / 2, VIEW_H / 2 + sc * 3 + 6, { align: 'center', color: '#e8d8e0', outline: '#0b0910' });
    }
  },
  // Speed lines converging on the tethered grenade, a closing reticle, and where the slash will send it.
  drawBulletTime(ctx, cx, cy, k, t) {
    const p = Game.player, T = p && p.tether;
    if (!T || T.mode !== 'rebound' || !T.target) return;
    const g = T.target, gx = g.x - cx, gy = g.y - cy;
    ctx.globalAlpha = 0.35 * k;
    ctx.fillStyle = '#e0f0ff';
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * TAU + Math.sin(i * 7.3) * 0.2, r0 = 70 + ((i * 37 + ((t * 240) | 0)) % 90), r1 = r0 + 26 + (i % 3) * 10;
      pline(ctx, gx + Math.cos(a) * r0, gy + Math.sin(a) * r0, gx + Math.cos(a) * r1, gy + Math.sin(a) * r1, 1);
    }
    ctx.globalAlpha = 1;
    const rr = 6 + 14 * clamp(Game.btT / Game.btDur, 0, 1);
    ctx.fillStyle = '#ffd070';
    for (let i = 0; i < 4; i++) {
      const a = i * (Math.PI / 2) + t * 3;
      pline(ctx, gx + Math.cos(a) * rr, gy + Math.sin(a) * rr, gx + Math.cos(a) * (rr + 4), gy + Math.sin(a) * (rr + 4), 1);
    }
    const ang = p.aimAngle;
    for (let d = 14; d < 130; d += 5) {
      ctx.fillStyle = d < 60 ? '#ffffff' : '#ffd070';
      ctx.fillRect(Math.round(gx + Math.cos(ang) * d), Math.round(gy + Math.sin(ang) * d), 1, 1);
    }
    drawText(ctx, 'AIM THE SLASH', gx, gy + 14, { align: 'center', color: '#ffd070', outline: '#0b0910' });
  },
  gatherLights(cx, cy, t) {
    const G = Game;
    Level.addLights(cx, cy, t);
    if (G.player) G.player.addLights();
    for (const e of G.enemies) if (!e.dead) e.addLights();
    for (const b of G.projectiles) if (b.addLights) b.addLights();
    for (const h of G.hazards) h.addLights();
    for (const p of G.props) if (!p.dead) p.addLights();
    for (const pk of G.pickups) pk.addLights();
  },
  applyLighting(cx, cy, t) {
    this.gatherLights(cx, cy, t);
    const L = this.light.ctx;
    L.globalCompositeOperation = 'source-over';
    L.globalAlpha = 1;
    L.fillStyle = Game.mod('blackout') ? '#2e2638' : '#9a84ac';
    L.fillRect(0, 0, VIEW_W, VIEW_H);
    L.globalCompositeOperation = 'lighter';
    const put = (x, y, r, color, a) => {
      if (x + r < 0 || x - r > VIEW_W || y + r < 0 || y - r > VIEW_H || a <= 0.01) return;
      L.globalAlpha = Math.min(1, a);
      L.drawImage(glowSprite(color), Math.round(x - r), Math.round(y - r), Math.round(r * 2), Math.round(r * 2));
    };
    for (const l of FX.frameLights) put(l.x - cx, l.y - cy, l.r, l.color, l.a);
    for (const l of FX.lights) put(l.x - cx, l.y - cy, l.r, l.color, l.a * (1 - l.t / l.dur));
    if (FX.flashA > 0) { L.globalAlpha = FX.flashA * 0.6; L.fillStyle = '#ffffff'; L.fillRect(0, 0, VIEW_W, VIEW_H); }
    L.globalAlpha = 1;
    // restrict the light map to the foreground's alpha, then multiply
    const M = this.mask.ctx;
    M.globalCompositeOperation = 'source-over';
    M.clearRect(0, 0, VIEW_W, VIEW_H);
    M.drawImage(this.light, 0, 0);
    M.globalCompositeOperation = 'destination-in';
    M.drawImage(this.scene, 0, 0);
    M.globalCompositeOperation = 'source-over';
    const sc = this.scene.ctx;
    sc.globalCompositeOperation = 'multiply';
    sc.drawImage(this.mask, 0, 0);
    sc.globalCompositeOperation = 'source-over';
  },
  drawGlow(ctx, cx, cy) {
    if (!S.visuals.lighting) this.gatherLights(cx, cy, Game.realTime);
    ctx.globalCompositeOperation = 'lighter';
    const put = (x, y, r, color, a) => {
      if (x + r < 0 || x - r > VIEW_W || y + r < 0 || y - r > VIEW_H || a <= 0.01) return;
      ctx.globalAlpha = Math.min(1, a);
      ctx.drawImage(glowSprite(color), Math.round(x - r), Math.round(y - r), Math.round(r * 2), Math.round(r * 2));
    };
    for (const l of FX.frameLights) put(l.x - cx, l.y - cy, l.r * 0.6, l.color, l.a * 0.22);
    for (const l of FX.lights) put(l.x - cx, l.y - cy, l.r * 0.7, l.color, l.a * 0.4 * (1 - l.t / l.dur));
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  },
  drawWeather(ctx, dt, cx, cy) {
    const sdt = Game.state === 'playing' || Game.state === 'menu' ? dt * Game.slowScale : 0;
    for (const w of this.weather) {
      w.ph += sdt;
      if (w.ash) { w.y += w.s * sdt; w.x += Math.sin(w.ph * 1.3) * 6 * sdt - 4 * sdt; }
      else { w.y += w.s * sdt; w.x -= w.s * 0.25 * sdt; }
      const x = (((w.x - cx * w.d * 0.5) % VIEW_W) + VIEW_W) % VIEW_W;
      const y = (((w.y - cy * w.d * 0.5) % VIEW_H) + VIEW_H) % VIEW_H;
      if (w.ash) {
        ctx.fillStyle = w.d > 1 ? '#b8a0b0' : '#6a5a6a';
        ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
      } else {
        ctx.fillStyle = 'rgba(150,140,190,0.35)';
        pline(ctx, x, y, x - 1, y + 4, 1);
      }
    }
  },

  // ---------- HUD ----------
  drawHUD(ctx, dt) {
    const G = Game, p = G.player, t = G.realTime;
    this.hpTrail = this.hpTrail > p.hp ? Math.max(p.hp, this.hpTrail - dt * 40) : p.hp;
    this.shTrail = this.shTrail > p.shield ? Math.max(p.shield, this.shTrail - dt * 60) : p.shield;
    const x = 8, y = 8, w = 96;
    // shield
    ctx.fillStyle = '#0b0910'; ctx.fillRect(x - 1, y - 1, w + 2, 6);
    ctx.fillStyle = '#0e2230'; ctx.fillRect(x, y, w, 4);
    ctx.fillStyle = '#d8f4ff'; ctx.fillRect(x, y, Math.round((w * this.shTrail) / PC.MAX_SHIELD), 4);
    const flash = p.shieldFlash > 0 && ((t * 20) | 0) % 2;
    ctx.fillStyle = flash ? '#ff3048' : p.shield < PC.TETHER_COST ? '#2a7aa0' : '#3ad0ff';
    ctx.fillRect(x, y, Math.round((w * p.shield) / PC.MAX_SHIELD), 4);
    ctx.fillStyle = '#a8ecff'; ctx.fillRect(x, y, Math.round((w * p.shield) / PC.MAX_SHIELD), 1);
    ctx.fillStyle = '#0b0910';
    for (let i = 1; i * PC.TETHER_COST < PC.MAX_SHIELD; i++) ctx.fillRect(x + Math.round((w * i * PC.TETHER_COST) / PC.MAX_SHIELD), y + 3, 1, 1);
    if (p.shieldDelay <= 0 && p.shield < PC.MAX_SHIELD && ((t * 6) | 0) % 2) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x + Math.round((w * p.shield) / PC.MAX_SHIELD), y, 1, 4); }
    if (p.shieldFullFlash > 0) { ctx.globalAlpha = p.shieldFullFlash / 0.45; ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 1, y - 1, w + 2, 6); ctx.globalAlpha = 1; }
    // hp
    const y2 = y + 7;
    ctx.fillStyle = '#0b0910'; ctx.fillRect(x - 1, y2 - 1, w + 2, 6);
    ctx.fillStyle = '#300a12'; ctx.fillRect(x, y2, w, 4);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y2, Math.round((w * this.hpTrail) / PC.MAX_HP), 4);
    const low = p.hp < 30 && ((t * 5) | 0) % 2;
    ctx.fillStyle = low ? '#ff8a9a' : '#ff3048'; ctx.fillRect(x, y2, Math.round((w * p.hp) / PC.MAX_HP), 4);
    ctx.fillStyle = '#ff9aa8'; ctx.fillRect(x, y2, Math.round((w * p.hp) / PC.MAX_HP), 1);
    if (p.shieldOffT > 0) {
      ctx.fillStyle = ((t * 6) | 0) % 2 ? '#2a3a46' : '#1a2630'; ctx.fillRect(x, y, w, 4);
      drawText(ctx, 'OFF ' + Math.ceil(p.shieldOffT), x + w + 4, y - 1, { color: '#5a7a8a' });
    } else drawText(ctx, String(Math.ceil(p.shield)), x + w + 4, y - 1, { color: '#3ad0ff' });
    drawText(ctx, String(Math.ceil(p.hp)), x + w + 4, y2 - 1, { color: '#ff5a6a' });
    // dash charges
    for (let i = 0; i < PC.DASH_CHARGES; i++) {
      const dx = x + 3 + i * 9, dy = y2 + 10;
      const full = i < p.dashCharges;
      const part = i === p.dashCharges ? p.dashRecharge / PC.DASH_RECHARGE : 0;
      ctx.fillStyle = '#0b0910'; this.diamond(ctx, dx, dy, 4);
      ctx.fillStyle = full ? '#ffffff' : '#3a1a24'; this.diamond(ctx, dx, dy, 3);
      if (!full && part > 0) {
        ctx.fillStyle = '#ff3a52';
        const hh = Math.round(part * 7);
        for (let yy = 0; yy < hh; yy++) { const ry = dy + 3 - yy, half = 3 - Math.abs(ry - dy); if (half >= 0) ctx.fillRect(dx - half, ry, half * 2 + 1, 1); }
      }
    }
    drawText(ctx, 'DASH', x + 22, y2 + 8, { color: '#7a849c' });
    // upgrades picked this run
    let ux = x;
    for (const id of G.upgrades) {
      ctx.fillStyle = '#0b0910'; ctx.fillRect(ux - 1, y2 + 17, 13, 9);
      ctx.fillStyle = '#3a2a1a'; ctx.fillRect(ux, y2 + 18, 11, 7);
      drawText(ctx, UPGRADES[id].tag, ux + 6, y2 + 19, { align: 'center', color: '#ffd070', outline: null });
      ux += 14;
    }
    // parry stance: cooldown and shield cost
    {
      const px = x + 48, py = y2 + 10;
      const cdK = p.parryCD > 0 ? 1 - p.parryCD / PC.PARRY_CD : 1;
      const afford = p.shield >= PC.PARRY_COST || S.gameplay.invincible;
      const flash = p.parryFlash > 0 && ((t * 20) | 0) % 2;
      ctx.fillStyle = '#0b0910'; this.diamond(ctx, px, py, 4);
      ctx.fillStyle = flash ? '#ff3048' : p.sheathe ? '#ffe8a0' : cdK >= 1 && afford ? '#ffd070' : '#3a2a1a'; this.diamond(ctx, px, py, 3);
      if (cdK < 1) {
        ctx.fillStyle = '#ffd070';
        const hh = Math.round(cdK * 7);
        for (let yy = 0; yy < hh; yy++) { const ry = py + 3 - yy, half = 3 - Math.abs(ry - py); if (half >= 0) ctx.fillRect(px - half, ry, half * 2 + 1, 1); }
      }
      drawText(ctx, 'PARRY', px + 7, y2 + 8, { color: afford ? '#7a849c' : '#5a4a4a' });
    }
    // ultimate
    this.drawUltMeter(ctx, 22, VIEW_H - 22, p, t);
    // wave info
    const D = Director;
    const boss = G.enemies.find((e) => e.isBoss && !e.dead && !e.spawning);
    if (boss) this.drawBossBar(ctx, boss, t);
    else if (G.mode === 'training') {
      drawText(ctx, 'TRAINING', VIEW_W / 2, 6, { align: 'center', color: '#ffd070' });
      drawText(ctx, hudKey('pause') + ' OPENS THE SPAWN PANEL' + (D.modifier ? ' - ' + WAVE_MODIFIERS[D.modifier].name : ''), VIEW_W / 2, 14, { align: 'center', color: '#9a8aa8' });
      const dummy = G.enemies.find((e) => e.type === 'dummy');
      if (dummy && dummy.dps !== undefined) drawText(ctx, 'DPS ' + dummy.dps, dummy.x - G.cam.rx, dummy.y - 34 - G.cam.ry, { align: 'center', color: '#ffd070' });
    } else if (D.wave > 0) {
      const label = G.mode === 'duel' ? 'MELEE DUEL' : G.mode === 'boss' ? 'RIVAL FIGHT' : (G.mode === 'demo' ? 'DEMO ' : 'ENDLESS ') + 'WAVE ' + D.wave;
      drawText(ctx, label, VIEW_W / 2, 6, { align: 'center', color: '#ffd0d8' });
      let sub;
      if (D.state === 'fight') sub = D.remaining() + ' HOSTILES' + (D.modifier ? ' - ' + WAVE_MODIFIERS[D.modifier].name : '');
      else if (D.state === 'break') sub = D.wave >= D.lastWave() ? '' : 'NEXT WAVE ' + Math.ceil(D.breakT);
      if (sub) drawText(ctx, sub, VIEW_W / 2, 14, { align: 'center', color: '#9a8aa8' });
    }
    // score + combo
    drawText(ctx, String(G.stats.score).padStart(7, '0'), VIEW_W - 8, 6, { align: 'right', color: '#ffffff' });
    if (G.combo >= 2) {
      const pop = G.comboPop > 0 ? 1 : 0;
      drawText(ctx, G.combo + ' HIT', VIEW_W - 8, 16 - pop, { align: 'right', color: '#ff8a9a', scale: 2 });
    }
    // style rank: grows with varied moves, multiplies score and ultimate charge
    const rank = G.rank();
    if (rank || G.style > 1) {
      const i = rank ? STYLE_RANKS.indexOf(rank) : STYLE_RANKS.length;
      const next = STYLE_RANKS[i - 1], lo = rank ? rank.th : 0;
      const k = next ? clamp((G.style - lo) / (next.th - lo), 0, 1) : 1;
      if (rank) {
        const big = G.rankPop > 0 ? 4 : 3;
        drawText(ctx, rank.r, VIEW_W - 8, 30 - (big - 3) * 2, { align: 'right', color: rank.c, scale: big });
        drawText(ctx, 'x' + rank.mul.toFixed(2), VIEW_W - 8, 47, { align: 'right', color: '#9a8aa8' });
      }
      const bw = 40;
      ctx.fillStyle = '#300a12'; ctx.fillRect(VIEW_W - 8 - bw, 54, bw, 2);
      ctx.fillStyle = rank ? rank.c : '#9ab0d0'; ctx.fillRect(VIEW_W - 8 - bw, 54, Math.round(bw * k), 2);
    }
    // announcements: big between fights, smaller and higher up while enemies are active
    const combat = D.state === 'fight' && G.enemies.some((e) => !e.dead && !e.spawning);
    let ay = combat ? 34 : 64;
    for (const a of G.announcements) {
      const k = a.t / a.dur;
      const sc = combat ? (a.small ? 1 : 2) : a.small ? 1 : a.t < 0.1 ? 4 : 3;
      const step = combat ? (a.small ? 15 : 22) : a.small ? 16 : 32;
      if (k > 0.8 && ((a.t * 20) | 0) % 2) { ay += step; continue; }
      const slide = a.t < 0.12 ? Math.round((1 - a.t / 0.12) * 30) : 0;
      drawText(ctx, a.text, VIEW_W / 2 + slide, ay, { align: 'center', color: a.color, scale: sc, outline: '#0b0910' });
      if (a.sub) drawText(ctx, a.sub, VIEW_W / 2 - slide, ay + sc * 5 + 3, { align: 'center', color: '#e8d8e0', outline: combat ? '#0b0910' : undefined });
      ay += step;
    }
    if (S.visuals.indicators) this.drawIndicators(ctx);
    if (G.mode === 'demo' && G.stats.time < 16 && !p.dead) {
      const k = G.stats.time > 13 ? 1 - (G.stats.time - 13) / 3 : 1;
      if (k > 0 && (k > 0.3 || ((t * 10) | 0) % 2)) {
        const l1 = `${hudKey('left')}/${hudKey('right')} MOVE   ${hudKey('jump')} JUMP x2   ${hudKey('crouch')} SLIDE, x2 DROP   ${hudKey('dash')} DASH`;
        const l2 = `${hudKey('attack')} SLASH   ${hudKey('dash')}+${hudKey('attack')} DASH SLASH   ${hudKey('crouch')}+${hudKey('attack')} PLUNGE   ${hudKey('sheathe')} PARRY`;
        const l3 = `${hudKey('tether')} TAP FLING / HOLD ZIP / GRAB   HOLD ${hudKey('ultimate')} ULTIMATE`;
        ctx.globalAlpha = Math.min(1, k);
        ctx.fillStyle = 'rgba(8,5,12,0.6)';
        ctx.fillRect(VIEW_W / 2 - 150, VIEW_H - 40, 300, 30);
        drawText(ctx, l1, VIEW_W / 2, VIEW_H - 36, { align: 'center', color: '#e8d8e0' });
        drawText(ctx, l2, VIEW_W / 2, VIEW_H - 27, { align: 'center', color: '#e8d8e0' });
        drawText(ctx, l3, VIEW_W / 2, VIEW_H - 18, { align: 'center', color: '#ff8a9a' });
        ctx.globalAlpha = 1;
      }
    }
    if (p.hp < 30 && !p.dead) {
      ctx.globalAlpha = 0.18 + Math.sin(t * 6) * 0.08;
      ctx.fillStyle = '#ff0020';
      ctx.fillRect(0, 0, VIEW_W, 3); ctx.fillRect(0, VIEW_H - 3, VIEW_W, 3); ctx.fillRect(0, 0, 3, VIEW_H); ctx.fillRect(VIEW_W - 3, 0, 3, VIEW_H);
      ctx.globalAlpha = 1;
    }
    if (G.state === 'playing') this.drawCrosshair(ctx, p);
  },
  diamond(ctx, cx, cy, r) {
    for (let yy = -r; yy <= r; yy++) { const h = r - Math.abs(yy); ctx.fillRect(cx - h, cy + yy, h * 2 + 1, 1); }
  },
  drawUltMeter(ctx, cx, cy, p, t) {
    const ready = p.ultCharge >= 1, active = !!p.ult;
    const spin = active ? p.ult.spin : ready ? t * 4 : 0;
    const n = 12;
    for (let i = 0; i < n; i++) {
      const a = spin + (i / n) * TAU - Math.PI / 2;
      const lit = active || i / n < p.ultCharge;
      ctx.fillStyle = '#0b0910';
      pline(ctx, cx + Math.cos(a) * 7, cy + Math.sin(a) * 7, cx + Math.cos(a + 0.3) * 12, cy + Math.sin(a + 0.3) * 12, 3);
      ctx.fillStyle = lit ? (ready && ((t * 8) | 0) % 2 ? '#ffffff' : '#ff3048') : '#3a1a24';
      pline(ctx, cx + Math.cos(a) * 7, cy + Math.sin(a) * 7, cx + Math.cos(a + 0.3) * 11, cy + Math.sin(a + 0.3) * 11, 1);
    }
    ctx.fillStyle = '#0b0910'; pdisc(ctx, cx, cy, 7);
    ctx.fillStyle = active || ready ? '#b8142a' : '#3a1a24'; pdisc(ctx, cx, cy, 6);
    const pct = Math.floor(p.ultCharge * 100);
    if (active) drawText(ctx, 'SAW', cx, cy - 2, { align: 'center', color: '#ffffff' });
    else if (ready) {
      drawText(ctx, hudKey('ultimate').slice(0, 3), cx, cy - 2, { align: 'center', color: '#ffffff' });
      drawText(ctx, 'HOLD ' + hudKey('ultimate') + ' - SAWBLADE', cx + 16, cy - 2, { color: ((t * 3) | 0) % 2 ? '#ff8a9a' : '#ffffff' });
    } else {
      drawText(ctx, pct + '', cx, cy - 2, { align: 'center', color: '#9a8aa8' });
      drawText(ctx, 'SAWBLADE', cx + 16, cy - 2, { color: '#5a4a5a' });
    }
  },
  drawBossBar(ctx, b, t) {
    const w = 200, x = Math.round(VIEW_W / 2 - w / 2), y = 14;
    drawText(ctx, b.name, VIEW_W / 2, 5, { align: 'center', color: '#bff8ff' });
    ctx.fillStyle = '#0b0910'; ctx.fillRect(x - 1, y - 1, w + 2, 6);
    ctx.fillStyle = '#300a12'; ctx.fillRect(x, y, w, 4);
    const k = Math.max(0, b.hp) / b.maxHp;
    ctx.fillStyle = b.stunT > 0 && ((t * 10) | 0) % 2 ? '#ffffff' : '#ff3048'; ctx.fillRect(x, y, Math.round(w * k), 4);
    ctx.fillStyle = '#ff9aa8'; ctx.fillRect(x, y, Math.round(w * k), 1);
    if (!b.duel) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x + w / 2, y - 2, 1, 8); }
    if (b.shield) {
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = '#4af0ff';
      for (let i = 0; i < w; i += 2) if (((i + ((t * 20) | 0)) >> 1) % 3) ctx.fillRect(x + i, y, 1, 4);
      ctx.globalAlpha = 1;
      drawText(ctx, b.cracks ? `SHIELD CRACKED ${b.cracks}/3 - RETURN BOLTS OR REBOUND THE GRENADE` : 'SHIELDED - REBOUND ITS GRENADE OR RETURN 3 BOLTS', VIEW_W / 2, y + 7, { align: 'center', color: '#4af0ff' });
    } else if (b.stunT > 0) drawText(ctx, 'STUNNED', VIEW_W / 2, y + 7, { align: 'center', color: '#ffffff' });
    else if (b.phase === 2) drawText(ctx, b.guardT > 0 ? 'GUARDING - BAIT THE RIPOSTE AND PARRY IT' : 'LIMITERS OFF - PARRY, THEN PARRY ITS RIPOSTE', VIEW_W / 2, y + 7, { align: 'center', color: '#ff8a9a' });
    else drawText(ctx, 'SHIELD BACK IN ' + Math.ceil(b.shieldDownT), VIEW_W / 2, y + 7, { align: 'center', color: '#7a9aa6' });
  },
  drawIndicators(ctx) {
    const cam = Game.cam;
    const things = Game.enemies.concat(Game.projectiles.filter((b) => b.indicator && b.hostile && !b.dead));
    for (const e of things) {
      if (e.dead) continue;
      const sx = e.x - cam.rx, sy = e.cy - cam.ry;
      if (sx > -4 && sx < VIEW_W + 4 && sy > -4 && sy < VIEW_H + 4) continue;
      const ex = clamp(sx, 8, VIEW_W - 8), ey = clamp(sy, 22, VIEW_H - 8);
      const a = Math.atan2(sy - ey, sx - ex);
      ctx.fillStyle = e.indicator ? (((Game.realTime * 10) | 0) % 2 ? '#ffffff' : '#ff3030') : e.isBoss ? '#4af0ff' : e.windingUp() ? '#ffffff' : e.spawning ? '#ff9a3a' : '#ff5a3a';
      for (let i = 0; i < 4; i++) {
        const px = ex + Math.cos(a) * (3 - i), py = ey + Math.sin(a) * (3 - i);
        const h = i;
        ctx.fillRect(Math.round(px - Math.sin(a) * h), Math.round(py + Math.cos(a) * h), 1, 1);
        ctx.fillRect(Math.round(px + Math.sin(a) * h), Math.round(py - Math.cos(a) * h), 1, 1);
        ctx.fillRect(Math.round(px), Math.round(py), 1, 1);
      }
    }
  },
  drawCrosshair(ctx, p) {
    const x = Math.round(Input.mx), y = Math.round(Input.my);
    const [pcx, pcy] = p.chest();
    const inRange = p.ult || dist(p.aimX, p.aimY, pcx, pcy) <= PC.TETHER_RANGE;
    const canTether = p.ult || p.shield >= PC.TETHER_COST || S.gameplay.invincible;
    const col = inRange && canTether ? '#ff3a52' : '#7a6a7a';
    ctx.fillStyle = '#0b0910';
    ctx.fillRect(x - 5, y - 1, 3, 3); ctx.fillRect(x + 3, y - 1, 3, 3); ctx.fillRect(x - 1, y - 5, 3, 3); ctx.fillRect(x - 1, y + 3, 3, 3);
    ctx.fillStyle = col;
    ctx.fillRect(x - 4, y, 2, 1); ctx.fillRect(x + 3, y, 2, 1); ctx.fillRect(x, y - 4, 1, 2); ctx.fillRect(x, y + 3, 1, 2);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, 1, 1);
  },
};



'use strict';
// Game state, fixed-step simulation, camera and the main loop.

const Game = {
  state: 'menu', mode: 'demo', time: 0, realTime: 0, acc: 0,
  player: null, enemies: [], projectiles: [], props: [], hazards: [], pickups: [], cuts: [],
  cam: { x: 520, y: 100, ox: 0, oy: 0, trauma: 0, rx: 0, ry: 0 },
  slowScale: 1, slowT: 0, freezeT: 0,
  stats: { kills: 0, score: 0, maxCombo: 0, parries: 0, wave: 0, time: 0, damageTaken: 0, ults: 0 },
  combo: 0, comboT: 0, comboPop: 0, announcements: [], overT: 0, overVictory: false,

  mouseWorld() { return { x: Input.mx + this.cam.x, y: Input.my + this.cam.y }; },

  toMenu() {
    this.state = 'menu';
    if (this.player) this.player.stopAllLoops();
    FX.clear();
    this.enemies = []; this.projectiles = []; this.hazards = []; this.pickups = []; this.cuts = []; this.props = [];
    this.player = new Player(476, 220);
    this.player.facing = 1;
    this.slowScale = 1; this.slowT = 0; this.freezeT = 0;
    Sound.setSlow(false);
    Sound.setIntensity(0);
    this.announcements = [];
    UI.refreshBest();
    UI.show('menu');
  },
  newRun(mode) {
    Sound.init();
    Sound.startMusic();
    if (this.player) this.player.stopAllLoops();
    this.mode = mode;
    this.state = 'playing';
    FX.clear();
    this.enemies = []; this.projectiles = []; this.hazards = []; this.pickups = []; this.cuts = []; this.props = [];
    this.player = new Player(720, Level.GROUND);
    this.time = 0; this.acc = 0; this.slowScale = 1; this.slowT = 0; this.freezeT = 0; this.overT = 0;
    this.stats = { kills: 0, score: 0, maxCombo: 0, parries: 0, wave: 0, time: 0, damageTaken: 0, ults: 0 };
    this.combo = 0; this.comboT = 0; this.announcements = [];
    Render.hpTrail = PC.MAX_HP; Render.shTrail = PC.MAX_SHIELD;
    this.cam.x = clamp(this.player.x - VIEW_W / 2, 0, Level.W - VIEW_W);
    this.cam.y = clamp(this.player.y - VIEW_H * 0.62, Level.CAM_Y_MIN, Level.H - VIEW_H);
    this.cam.trauma = 0;
    this.resetProps(true);
    Director.start(mode);
    Sound.setSlow(false);
    Sound.setIntensity(0.4);
    Input.clear(); Input.consume();
    UI.hideAll();
  },
  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    if (this.player) { this.player.stopLoop('charge'); this.player.stopLoop('reel'); this.player.stopLoop('ult'); }
    Sound.setSlow(true);
    UI.show('pause');
  },
  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    Sound.setSlow(this.slowT > 0);
    if (this.player && this.player.sheathe) this.player.loops.charge = Sound.loop('charge');
    if (this.player && this.player.zipping()) this.player.loops.reel = Sound.loop('reel');
    Input.clear(); Input.consume();
    UI.hideAll();
  },
  resetProps(all) {
    if (all) this.props = [];
    this.props = this.props.filter((p) => !p.dead);
    for (const s of Level.barrelSpots) {
      if (!this.props.some((p) => dist(p.x, p.y, s.x, s.y) < 30)) this.props.push(new Barrel(s.x, s.y));
    }
  },

  // ---------- feedback hooks ----------
  hitstop(d) {
    if (S.visuals.hitstop <= 0) return;
    this.freezeT = Math.max(this.freezeT, Math.min(0.12, d * S.visuals.hitstop));
  },
  slowmo(scale, dur) {
    if (!S.visuals.slowmo) return;
    this.slowScale = Math.min(this.slowScale, scale);
    this.slowT = Math.max(this.slowT, dur);
    Sound.setSlow(true);
  },
  shake(t) { this.cam.trauma = Math.min(1, this.cam.trauma + t); },
  queueCut(delay, fn) { this.cuts.push({ t: delay, fn }); },
  announce(text, sub, color = '#ff3a52', dur = 1.6, small = false) {
    this.announcements = this.announcements.filter((a) => a.text !== text);
    this.announcements.push({ text, sub, color, dur, t: 0, small });
    if (this.announcements.length > 3) this.announcements.shift();
  },
  addScore(n) { this.stats.score += Math.round(n); },
  registerHit() {
    this.combo++;
    this.comboT = 2.5;
    this.comboPop = 0.06;
    if (this.combo > this.stats.maxCombo) this.stats.maxCombo = this.combo;
  },
  onKill(e, o) {
    if (e.counted) return;
    e.counted = true;
    this.stats.kills++;
    this.addScore(e.def.score * (1 + Math.min(this.combo, 100) * 0.05));
    const p = this.player;
    if (!p.ult) p.ultCharge = Math.min(1, p.ultCharge + (e.heavy ? 3 : 1) / S.gameplay.ultKills);
    if (o.cause !== 'fall' && chance(e.heavy ? 1 : 0.12)) this.pickups.push(new Pickup(e.x, e.cy, 'hp'));
  },
  onPlayerDeath() {
    this.combo = 0;
    this.overT = 2.2;
    this.overVictory = false;
    Sound.play('gameOver');
    Sound.setIntensity(0);
    this.saveBest();
  },
  victory() {
    SaveData.demoCleared = true;
    saveProgress();
    this.overT = 1.2;
    this.overVictory = true;
    Sound.setIntensity(0.2);
  },
  saveBest() {
    if (this.mode === 'endless') {
      if (this.stats.score > SaveData.bestScore) SaveData.bestScore = this.stats.score;
      if (Director.wave - 1 > SaveData.bestWave) SaveData.bestWave = Director.wave - 1;
      saveProgress();
    }
  },

  // ---------- simulation ----------
  step(realDt) {
    if (this.slowT > 0) {
      this.slowT -= realDt;
      if (this.slowT <= 0) { this.slowScale = 1; Sound.setSlow(false); }
    }
    for (let i = this.cuts.length - 1; i >= 0; i--) {
      const c = this.cuts[i];
      c.t -= realDt;
      if (c.t <= 0) { this.cuts.splice(i, 1); c.fn(); }
    }
    for (const a of this.announcements) a.t += realDt;
    this.announcements = this.announcements.filter((a) => a.t < a.dur);
    this.comboPop = Math.max(0, this.comboPop - realDt);
    if (this.freezeT > 0) this.freezeT -= realDt;
    else {
      this.acc += realDt * this.slowScale;
      const STEP = 1 / 120;
      let n = 0;
      while (this.acc >= STEP && n < 10) { this.tick(STEP); this.acc -= STEP; n++; Input.consume(); }
      if (n >= 10) this.acc = 0;
    }
    this.updateCamera(realDt);
    if (this.overT > 0) {
      this.overT -= realDt;
      if (this.overT <= 0) { this.state = 'over'; this.player.stopAllLoops(); this.saveBest(); UI.showOver(this.overVictory); }
    }
  },
  tick(dt) {
    this.time += dt;
    if (!this.player.dead) this.stats.time += dt;
    this.player.update(dt);
    for (const e of this.enemies) if (!e.dead) e.update(dt);
    // keep grounded enemies from stacking
    const es = this.enemies;
    for (let i = 0; i < es.length; i++) {
      const a = es[i];
      if (a.dead || a.spawning || a.flying) continue;
      for (let j = i + 1; j < es.length; j++) {
        const b = es[j];
        if (b.dead || b.spawning || b.flying) continue;
        const dx = b.x - a.x, minD = (a.w + b.w) * 0.42;
        if (Math.abs(dx) < minD && Math.abs(a.y - b.y) < 12) {
          const push = (minD - Math.abs(dx)) * 4 * dt * (dx >= 0 ? 1 : -1);
          if (Level.rectFree(a.x - push - a.w / 2, a.y - a.h, a.w, a.h - 0.5)) a.x -= push;
          if (Level.rectFree(b.x + push - b.w / 2, b.y - b.h, b.w, b.h - 0.5)) b.x += push;
        }
      }
    }
    for (const b of this.projectiles) b.update(dt);
    for (const h of this.hazards) h.update(dt);
    for (const p of this.props) p.update(dt);
    for (const pk of this.pickups) pk.update(dt);
    if (!this.player.dead) Director.update(dt);
    FX.update(dt);
    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.combo = 0; }
    this.enemies = this.enemies.filter((e) => !e.dead);
    this.projectiles = this.projectiles.filter((b) => !b.dead);
    this.hazards = this.hazards.filter((h) => !h.dead);
    this.pickups = this.pickups.filter((p) => !p.dead);
    this.props = this.props.filter((p) => !p.dead);
  },
  updateCamera(realDt) {
    const p = this.player, cam = this.cam;
    const look = S.visuals.lookAhead;
    const lx = (Input.mx - VIEW_W / 2) * look * 0.55, ly = (Input.my - VIEW_H / 2) * look * 0.45;
    const tx = p.x - VIEW_W / 2 + lx + clamp(p.vx, -400, 400) * 0.1;
    const ty = p.y - 12 - VIEW_H * 0.56 + ly + clamp(p.vy, -300, 400) * 0.05;
    cam.x = damp(cam.x, tx, 7, realDt);
    cam.y = damp(cam.y, ty, 5.5, realDt);
    cam.x = clamp(cam.x, 0, Level.W - VIEW_W);
    cam.y = clamp(cam.y, Level.CAM_Y_MIN, Level.H - VIEW_H);
    cam.trauma = Math.max(0, cam.trauma - realDt * 1.7);
    const s = cam.trauma * cam.trauma * 9 * S.visuals.shake;
    const tt = this.realTime * 60;
    cam.ox = s * (Math.sin(tt * 1.7) * 0.6 + Math.sin(tt * 3.1) * 0.4);
    cam.oy = s * (Math.cos(tt * 2.3) * 0.6 + Math.sin(tt * 2.9) * 0.4);
  },
  menuStep(realDt) {
    const p = this.player;
    p.animT += realDt;
    p.facing = Input.mx > VIEW_W * 0.5 + (p.x - this.cam.x - VIEW_W / 2) ? 1 : -1;
    const m = this.mouseWorld();
    p.aimAngle = Math.atan2(m.y - p.cy, m.x - p.x);
    p.updateScarf(realDt);
    FX.update(realDt);
    const cam = this.cam;
    const tx = p.x - VIEW_W * 0.5 + Math.sin(this.realTime * 0.12) * 60 + (Input.mx - VIEW_W / 2) * 0.08;
    const ty = p.y - VIEW_H * 0.55 + (Input.my - VIEW_H / 2) * 0.05;
    cam.x = clamp(damp(cam.x, tx, 2, realDt), 0, Level.W - VIEW_W);
    cam.y = clamp(damp(cam.y, ty, 2, realDt), Level.CAM_Y_MIN, Level.H - VIEW_H);
    cam.ox = cam.oy = 0;
  },
};

(function boot() {
  let last = performance.now();
  function frame(now) {
    const realDt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    Game.realTime += realDt;
    if (Input.wasPressed('pause')) {
      const open = UI.openPanel();
      if (Game.state === 'playing') Game.pause();
      else if (open === 'settings' || open === 'howto') UI.act('back');
      else if (Game.state === 'paused') Game.resume();
      Input.consume();
    }
    if (Game.state === 'playing') Game.step(realDt);
    else if (Game.state === 'menu') { Game.menuStep(realDt); Input.consume(); }
    else Input.consume();
    try { Render.draw(realDt); } catch (err) { console.error(err); }
    requestAnimationFrame(frame);
  }
  function start() {
    const canvas = document.getElementById('screen');
    FX.init();
    Sprite.init();
    Render.init(canvas);
    Level.build();
    Input.init(canvas);
    Input.gameKeysActive = () => Game.state === 'playing';
    UI.init();
    UI.applyVisualToggles();
    Game.toMenu();
    window.addEventListener('blur', () => { Sound.setFocus(false); Game.pause(); });
    window.addEventListener('focus', () => Sound.setFocus(true));
    document.addEventListener('visibilitychange', () => { if (document.hidden) Game.pause(); });
    window.addEventListener('keydown', (e) => {
      if (e.code !== 'Escape' || Input.codes('pause').includes('Escape')) return;
      const open = UI.openPanel();
      if (open === 'settings' || open === 'howto') UI.act('back');
    });
    const wake = () => { Sound.init(); Sound.startMusic(); };
    document.addEventListener('pointerdown', wake, { once: true });
    document.addEventListener('keydown', wake, { once: true });
    requestAnimationFrame(frame);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();

'use strict';
// AEGIS-07: a rival cyborg on the player's own rig and movement model (run, double jump, wall jump,
// dash with i-frames, platform drops, tether zip), armed with a shield, forearm gun, greatblade,
// visor death beam, a lock-on missile and reinforcement calls. Its character definition lives in
// CHARACTERS so it can be made playable once unlocked.

const AEGIS_PAL = {
  dark: '#1c2130', mid: '#3c4760', light: '#7a8aa6', hi: '#c8d6ea', boot: '#0e1118',
  visor: '#4af0ff', core: '#4af0ff', scarf: '#3ad8e8', scarfD: '#145e6a',
  blade: '#d4dbe6', edge: '#4af0ff', handle: '#10202a', tsuba: '#8aa0b8', sheath: '#16303a', sheathD: '#22505c',
};

const CHARACTERS = {
  ronin: { id: 'ronin', name: 'RONIN', pal: PCOL, weapon: 'katana', unlocked: () => true },
  aegis: { id: 'aegis', name: 'AEGIS-07', pal: AEGIS_PAL, weapon: 'greatblade', unlocked: () => !!SaveData.unlocks.aegis },
};

ENEMY_DEFS.aegis = { hp: 900, w: 8, h: 20, speed: 145, score: 5000, mass: 6, dmg: 5, debris: ['#3c4760', '#7a8aa6', '#1c2130', '#4af0ff'] };
ENEMY_BASE_STATE.aegis = 'fight';

const BOLT_CYAN = { outer: '#2ab8d8', core: '#e0ffff', light: '#4af0ff' };

class Rival extends Enemy {
  constructor(x, y, scale = {}) {
    super('aegis', x, y, scale);
    this.isBoss = true; this.name = CHARACTERS.aegis.name; this.pal = AEGIS_PAL;
    this.heavy = true; this.spawnT = 1.5;
    this.shield = true; this.shieldDownT = 0; this.stunT = 0; this.flinchT = 0; this.deflectT = 0;
    this.dmgMul = scale.dmg || 1;
    // fields the shared player rig reads
    this.dashT = 0; this.dashVX = 0; this.dashVY = 0; this.dashCharges = 2; this.dashRecharge = 0; this.dodgeT = 0;
    this.airJumps = 1; this.attack = null; this.iaido = null; this.postPose = 0; this.sheathe = null; this.plunge = null;
    this.hurtT = 0; this.sliding = false; this.crouching = false; this.wallSliding = false; this.ultHold = 0;
    this.spinT = 0; this.spinDur = 0.32; this.runPhase = 0; this.animT = 0; this.landSquash = 0; this.aimAngle = Math.PI;
    this.deadT = 0; this.tether = null; this.ghostT = 0; this.dropT = 0; this.dropThrough = false; this.jumpCD = 0;
    this.scarf = [];
    for (let i = 0; i < 6; i++) this.scarf.push({ x: x + i * 2, y: y - 16, px: x + i * 2, py: y - 16 });
    this.cds = { gun: 1.2, blade: 0, beam: 7, missile: 2.5, summon: 12, dash: 0, zip: 2 };
    this.act = null; this.hover = false; this.beam = null; this.missile = null;
    this.dodged = new WeakSet(); this.dying = false; this.dyingT = 0; this.boomT = 0;
    this.kite = chance(0.5) ? 1 : -1;
  }

  // ---------- shield and damage hooks used by hurtEnemy ----------
  shielded() { return this.shield && !this.dying; }
  dodging() { return this.dashT > 0 || this.dodgeT > 0; }
  damageTakenMul() { return this.stunT > 0 ? 1.3 : 1; }
  shieldHit(o) {
    const p = Game.player, a = o.angle !== undefined ? o.angle : Math.atan2(this.cy - p.cy, this.x - p.x);
    const hx = this.x - Math.cos(a) * 14, hy = this.cy - Math.sin(a) * 16;
    FX.sparks(hx, hy, 6, a + Math.PI, 1.4, 60, 200, { c0: '#ffffff', c1: '#4af0ff', c2: '#145e6a' });
    this.deflectT = 0.2;
    Sound.play('shieldDeflect');
    if (!this._immuneT || Game.time > this._immuneT) {
      this._immuneT = Game.time + 0.7;
      FX.text('SHIELDED', this.x, this.y - 34, { c: '#4af0ff', always: true, dur: 0.6, vy: -20 });
    }
  }
  breakShield() {
    this.shield = false; this.shieldDownT = 10; this.stunT = 3.2;
    this.act = null; this.attack = null; this.beam = null; this.hover = false; this.tether = null; this.dashT = 0;
    this.stopBeamLoop();
    this.vx = -this.facing * 120; this.vy = -180;
    FX.ring(this.x, this.cy, 4, 60, 0.45, { c: '#4af0ff', core: '#ffffff', w: 2 });
    FX.sparks(this.x, this.cy, 40, 0, TAU, 80, 320, { c0: '#ffffff', c1: '#7af0ff', c2: '#145e6a' });
    FX.elec(this.x, this.cy, 30, 10, { outer: '#2ab8d8', core: '#ffffff' });
    FX.light(this.x, this.cy, 160, '#4af0ff', 1, 0.5);
    FX.flash('#bff8ff', 0.35);
    Sound.play('bossShieldBreak');
    Game.slowmo(0.25, 0.55);
    Game.shake(0.6);
    Game.hitstop(0.1);
    Game.announce('SHIELD DOWN', 'STRIKE NOW', '#4af0ff', 1.6);
  }
  restoreShield() {
    this.shield = true;
    FX.ring(this.x, this.cy, 30, 6, 0.4, { c: '#4af0ff', core: '#ffffff', w: 1 });
    Sound.play('shieldUp');
    Game.announce('SHIELD RESTORED', 'FIND ITS MISSILE', '#4af0ff', 1.3, true);
  }
  missileHit(m) {
    if (this.dying) return;
    if (this.shield) this.breakShield();
    else hurtEnemy(this, 120, { cause: 'missile', heavy: true, kx: m.vx * 0.3, ky: -150, angle: Math.atan2(m.vy, m.vx), crit: true });
  }
  stagger(dur, kx = 0) {
    if (this.dying) return;
    // only a parry (or the shield breaking) interrupts it
    if (dur >= 1.2) {
      this.flinchT = 0.7; this.hurtT = 0.7;
      this.act = null; this.attack = null; this.hover = false; this.beam = null; this.stopBeamLoop();
      this.vx += kx / 3;
    }
  }
  windingUp() {
    const a = this.act;
    if (!a) return false;
    return (a.kind === 'gun' && a.t < this.tele(0.45)) || (a.kind === 'blade' && a.phase === 'wind') ||
      (a.kind === 'beam' && a.phase !== 'fire') || a.kind === 'missile' || a.kind === 'summon';
  }
  stopBeamLoop() { if (this.beamLoop) { this.beamLoop.stop(); this.beamLoop = null; } }

  // ---------- rig compatibility ----------
  chest() { return [this.x, this.y - 12]; }
  hand() { return [this.x - this.facing * 2, this.y - 13]; }
  zipping() { return !!this.tether; }
  gunPos() { const a = this.aimAngle; return [this.x + Math.cos(a) * 8, this.y - 13 + Math.sin(a) * 8]; }
  visorPos() { return this._visor || [this.x + this.facing * 2, this.y - 19]; }

  // ---------- update ----------
  update(dt) {
    this.t += dt; this.animT += dt; this.st += dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    if (this.spawning) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawning = false;
        FX.ring(this.x, this.y - 2, 3, 46, 0.4, { sy: 0.35, c: '#4af0ff', core: '#ffffff', w: 2 });
        FX.sparks(this.x, this.cy, 30, -Math.PI / 2, TAU, 60, 260, { c0: '#ffffff', c1: '#4af0ff', c2: '#145e6a' });
        FX.dust(this.x, this.y, 14, { smax: 90 });
        FX.decal('crack', this.x, this.y, { len: 22, n: 7 });
        Sound.play('shockwave', { power: 0.8 });
        Sound.play('bossRoar');
        Game.shake(0.45);
        Game.announce(this.name, 'TETHER ITS MISSILE AND THROW IT BACK', '#4af0ff', 2.6);
        this.act = { kind: 'intro', t: 0 };
      }
      return;
    }
    for (const k in this.cds) this.cds[k] -= dt * (k === 'dash' || k === 'zip' ? 1 : S.enemies.aggression);
    for (const k of ['flinchT', 'hurtT', 'spinT', 'postPose', 'dodgeT', 'jumpCD', 'deflectT']) if (this[k] > 0) this[k] = Math.max(0, this[k] - dt);
    if (this.dashCharges < 2) { this.dashRecharge += dt; if (this.dashRecharge >= 1.2) { this.dashCharges++; this.dashRecharge = 0; } }
    if (this.dropThrough) { this.dropT -= dt; if (this.dropT <= 0) this.dropThrough = false; }
    if (this.missile && this.missile.dead) { this.missile = null; this.cds.missile = rand(6, 9); }
    if (this.dying) { this.updateDying(dt); return; }
    if (!this.shield) {
      this.shieldDownT -= dt;
      if (this.shieldDownT <= 0 && this.stunT <= 0) this.restoreShield();
    }
    const p = Game.player;
    this.aimAngle = Math.atan2(p.cy - (this.y - 12), p.x - this.x);
    let intent = { mx: 0, jump: false, drop: false };
    if (this.stunT > 0) {
      this.stunT -= dt;
      if (Math.random() < 0.3) FX.elec(this.x, this.y - 10, 10, 1, { outer: '#2ab8d8', core: '#ffffff' });
    } else if (this.flinchT > 0) {
      // recoiling from a parry
    } else {
      if (!this.act) this.chooseAct(p);
      intent = this.act ? this.runAct(dt, p) : this.navigate(p, 'kite');
      this.react(p);
    }
    this.physics(dt, intent);
    this.updateScarf(dt);
    if (this.dashT > 0 || this.zipping()) {
      this.ghostT -= dt;
      if (this.ghostT <= 0) { this.ghostT = 0.025; this.makeGhost('#2ab8d8', 0.22, 0.5); }
    }
  }
  chooseAct(p) {
    const dx = p.x - this.x, adx = Math.abs(dx), dy = p.y - this.y;
    const adds = Game.enemies.filter((e) => !e.dead && !e.isBoss).length;
    if (p.dead) return;
    if (this.shield && !this.missile && this.cds.missile <= 0) { this.act = { kind: 'missile', t: 0, beep: 0 }; return; }
    if (adx < 64 && Math.abs(dy) < 40 && this.cds.blade <= 0) { this.act = { kind: 'blade', phase: 'wind', t: 0 }; this.facing = sign(dx) || this.facing; Sound.play('enemyWindup', { pm: 0.6 }); return; }
    if (this.cds.summon <= 0 && adds < 3) { this.act = { kind: 'summon', t: 0 }; Sound.play('enemyWindup', { pm: 0.5 }); return; }
    if (this.cds.beam <= 0 && adx > 70) { this.act = { kind: 'beam', phase: 'rise', t: 0 }; this.vy = -330; this.onGround = false; return; }
    if (this.cds.gun <= 0) { this.act = { kind: 'gun', t: 0, shots: 0, next: 0, aim: this.aimAngle }; Sound.play('enemyWindup', { pm: 0.9 }); }
  }
  runAct(dt, p) {
    const a = this.act;
    a.t += dt;
    switch (a.kind) {
      case 'intro':
        if (a.t > 1.1) this.act = null;
        return { mx: 0 };
      case 'gun': {
        this.facing = Math.cos(this.aimAngle) >= 0 ? 1 : -1;
        const tele = this.tele(0.45);
        if (a.t < tele) a.aim = this.aimAngle;
        else {
          const turn = 2.6 * dt, d = angDiff(a.aim, this.aimAngle);
          a.aim += clamp(d, -turn, turn);
          a.next -= dt;
          if (a.next <= 0 && a.shots < 10) {
            a.next = 0.08; a.shots++;
            const [gx, gy] = this.gunPos();
            const ang = a.aim + rand(-0.05, 0.05);
            Game.projectiles.push(new Bolt(gx, gy, ang, 300 * S.enemies.speed, this.def.dmg * this.dmgMul, BOLT_CYAN));
            Sound.play('bossGun');
            FX.sparks(gx, gy, 3, ang, 0.5, 60, 160, { c0: '#ffffff', c1: '#7af0ff', c2: '#145e6a' });
            FX.light(gx, gy, 24, '#4af0ff', 0.9, 0.06);
          }
          if (a.shots >= 10 && a.next <= -0.15) { this.act = null; this.cds.gun = rand(2.2, 3.2); }
        }
        return this.navigate(p, 'kite');
      }
      case 'blade': {
        if (a.phase === 'wind') {
          this.facing = sign(p.x - this.x) || this.facing;
          if (a.t >= this.tele(0.45)) {
            a.phase = 'swing'; a.t = 0;
            const ang = this.aimAngle;
            this.attack = { stage: 3, t: 0, sweep: 0.12, dur: 0.34, dir: this.facing, span: 3.6, ang, hit: false };
            FX.swoosh({ x: this.x, y: this.y - 12, follow: this, ox: 0, oy: -12, r: 50, span: 3.6, ang, dir: this.facing, sweep: 0.12, dur: 0.34, thick: 16, pal: PALETTES.cyan, trail: 0.95 });
            Sound.play('swing', { stage: 3 });
            this.vx = this.facing * 220;
          }
          return { mx: 0 };
        }
        this.attack.t = a.t;
        if (!this.attack.hit && a.t > 0.02 && a.t < 0.17) {
          const [cx, cy] = this.chest();
          if (!p.dead && sectorRect(cx, cy, 52, this.attack.ang, 3.6, p.x - p.w / 2, p.y - p.h, p.w, p.h)) {
            this.attack.hit = true;
            p.takeHit({ dmg: 24 * this.dmgMul, x: this.x, y: cy, kind: 'melee', source: this, knock: 260 });
          }
        }
        if (a.t >= 0.34) { this.attack = null; this.act = null; this.cds.blade = 1.6; this.postPose = 0.2; }
        return { mx: 0 };
      }
      case 'beam': return this.runBeam(dt, a, p);
      case 'missile': {
        this.facing = sign(p.x - this.x) || this.facing;
        const lock = this.tele(1.3), k = a.t / lock;
        a.beep -= dt;
        if (a.beep <= 0 && k < 1) { a.beep = lerp(0.28, 0.06, k); Sound.play('lockBeep', { pm: 1 + k }); }
        if (a.t >= lock) {
          const [hx, hy] = this.visorPos();
          this.missile = new Missile(hx - this.facing * 4, hy - 6, this);
          Game.projectiles.push(this.missile);
          Sound.play('missileLaunch');
          FX.dust(hx, hy - 4, 6, { smax: 40, c: '#5a5060' });
          this.act = null; this.cds.missile = 99;
        }
        return this.navigate(p, 'kite', 0.5);
      }
      case 'summon': {
        if (a.t >= 0.9) {
          const pool = ['scrapper', 'gunner', 'drone'].filter((t) => S.enemies[t]);
          const n = 2 + (Director.wave >= 8 ? 1 : 0);
          for (let i = 0; i < n; i++) Director.spawn(pool.length ? pick(pool) : 'scrapper');
          FX.ring(this.x, this.y - 30, 3, 26, 0.35, { c: '#4af0ff', core: '#ffffff', w: 1 });
          Sound.play('spawn');
          this.act = null; this.cds.summon = rand(15, 19);
        }
        return { mx: 0 };
      }
    }
    return { mx: 0 };
  }
  runBeam(dt, a, p) {
    const [ox, oy] = this.visorPos();
    const target = Math.atan2(p.cy - oy, p.x - ox);
    this.facing = Math.cos(target) >= 0 ? 1 : -1;
    if (a.phase === 'rise') {
      if (this.vy > -40 || a.t > 0.4) { a.phase = 'charge'; a.t = 0; this.hover = true; a.ang = target; Sound.play('beamCharge'); }
      return { mx: 0 };
    }
    if (a.phase === 'charge') {
      a.ang = target;
      if (Math.random() < 0.6) FX.elec(ox, oy, 8, 1, { outer: '#2ab8d8', core: '#ffffff' });
      if (a.t >= this.tele(0.85)) { a.phase = 'fire'; a.t = 0; a.tick = 0; this.beamLoop = Sound.loop('beam'); }
      this.beam = { ox, oy, ang: a.ang, len: 0, firing: false };
      return { mx: 0 };
    }
    // firing: the beam drags toward the player at a limited turn rate
    const turn = 1.1 * dt * S.enemies.speed;
    a.ang += clamp(angDiff(a.ang, target), -turn, turn);
    const L = 700, ex = ox + Math.cos(a.ang) * L, ey = oy + Math.sin(a.ang) * L;
    const len = L * Level.raycast(ox, oy, ex, ey);
    this.beam = { ox, oy, ang: a.ang, len, firing: true };
    const hx = ox + Math.cos(a.ang) * len, hy = oy + Math.sin(a.ang) * len;
    if (Math.random() < 0.8) FX.sparks(hx, hy, 2, a.ang + Math.PI, 1.6, 60, 220, { c0: '#ffffff', c1: '#7af0ff', c2: '#145e6a' });
    if (Math.random() < 0.15) FX.decal('scorch', hx, hy, { r: 4, dur: 3 });
    a.tick -= dt;
    if (a.tick <= 0 && !p.dead && segRect(ox, oy, hx, hy, 4, p.x - p.w / 2, p.y - p.h, p.w, p.h)) {
      a.tick = 0.18;
      p.takeHit({ dmg: 7 * this.dmgMul, x: ox, y: oy, kind: 'beam', knock: 140 });
    }
    Game.shake(0.02);
    if (a.t >= 2.4) { this.act = null; this.beam = null; this.hover = false; this.stopBeamLoop(); this.cds.beam = rand(8, 11); }
    return { mx: 0 };
  }
  // Where to stand: "press" closes in for the blade, "kite" holds mid range for the gun and beam.
  navigate(p, style, speedMul = 1) {
    const dx = p.x - this.x, adx = Math.abs(dx), dy = p.y - this.y;
    let mx = 0, jump = false, drop = false;
    const pressing = style === 'press' || (!this.shield && this.cds.blade <= 0.4);
    if (pressing) { if (adx > 22) mx = sign(dx); }
    else {
      if (adx < 100) mx = -sign(dx || this.kite);
      else if (adx > 190) mx = sign(dx);
      else if (Math.random() < 0.01) this.kite = -this.kite;
      if (this.x < 90) mx = 1; else if (this.x > Level.W - 90) mx = -1;
    }
    if (dy < -40 && adx < 150) {
      if (this.onGround && this.jumpCD <= 0) { jump = true; this.jumpCD = 0.35; }
      else if (!this.onGround && this.vy > -60 && this.airJumps > 0 && this.jumpCD <= 0) { jump = true; this.jumpCD = 0.3; }
    }
    if (dy < -110 && this.cds.zip <= 0 && !this.act) this.zipTo(p);
    if (dy > 40 && this.onGround && Level.onOneWay(this)) drop = true;
    if (adx > 280 && this.cds.dash <= 0 && this.dashCharges > 0) this.dash(sign(dx), 0);
    return { mx: mx * speedMul, jump, drop };
  }
  react(p) {
    // with the shield down it dodges incoming swings like a player would
    if (this.shield || this.dashCharges <= 0 || this.act && this.act.kind === 'beam') return;
    const threat = p.attack || p.iaido;
    if (threat && !this.dodged.has(threat) && dist(p.x, p.y, this.x, this.y) < 64) {
      this.dodged.add(threat);
      if (chance(0.4)) this.dash(-sign(p.x - this.x) || 1, -0.3);
    }
  }
  dash(dx, dy) {
    const l = Math.hypot(dx, dy) || 1;
    this.dashT = 0.14; this.dashVX = (dx / l) * 480; this.dashVY = (dy / l) * 400;
    this.dashCharges--; this.cds.dash = 0.6; this.dodgeT = 0.3;
    if (dx) this.facing = sign(dx);
    Sound.play('dash');
    FX.ring(this.x, this.y - 12, 2, 14, 0.18, { w: 1, c: '#2ab8d8', core: '#e0ffff' });
  }
  zipTo(p) {
    const gx = clamp(p.x + sign(this.x - p.x || 1) * 22, 50, Level.W - 50);
    const gy = Level.groundBelow(gx, p.y - 4);
    if (gy > Level.GROUND + 5 || dist(gx, gy, this.x, this.y) < 70) return;
    this.tether = { phase: 'attached', mode: 'zip', x: gx, y: gy - 2, spd: 200, t: 0 };
    this.cds.zip = 4;
    Sound.play('tetherFire');
  }
  physics(dt, intent) {
    const wasGround = this.onGround, preVy = this.vy;
    if (this.dashT > 0) {
      this.dashT -= dt;
      this.vx = this.dashVX; this.vy = this.dashVY;
      if (this.dashT <= 0) { this.vx *= 0.5; this.vy *= 0.3; }
    } else if (this.tether) {
      const T = this.tether;
      const dx = T.x - this.x, dy = T.y - (this.y - 10), d = Math.hypot(dx, dy) || 1;
      T.spd = Math.min(520, T.spd + 2600 * dt);
      T.t += dt;
      this.vx = (dx / d) * T.spd; this.vy = (dy / d) * T.spd;
      this.facing = dx >= 0 ? 1 : -1;
      if (d < 12 || this.stunT > 0 || T.t > 1.4) { this.tether = null; this.vy = -140; this.vx *= 0.3; this.airJumps = 1; }
    } else if (this.hover) {
      this.vx = approach(this.vx, 0, 400 * dt);
      this.vy = approach(this.vy, Math.sin(this.t * 4) * 8, 600 * dt);
      if (Math.random() < 0.6) FX.sparks(this.x, this.y, 1, Math.PI / 2, 0.5, 40, 90, { c0: '#ffffff', c1: '#4af0ff', c2: '#145e6a', g: 0 });
    } else {
      const stunned = this.stunT > 0 || this.flinchT > 0;
      const max = this.def.speed * S.enemies.speed;
      const acc = this.onGround ? 1500 : 1000;
      if (intent.mx && !stunned) this.vx = approach(this.vx, intent.mx * max, acc * dt);
      else this.vx = approach(this.vx, 0, (this.onGround ? 1500 : 240) * dt);
      if (intent.mx && !this.act && !stunned) this.facing = sign(intent.mx);
      this.vy = Math.min(this.vy + 960 * dt, 430);
      const wallDir = !this.onGround ? (Level.touchingWall(this, 1) ? 1 : Level.touchingWall(this, -1) ? -1 : 0) : 0;
      if (intent.jump && !stunned) {
        if (this.onGround) { this.vy = -300; Sound.play('jump'); FX.dust(this.x, this.y, 3, { smax: 30 }); }
        else if (wallDir) { this.vx = -wallDir * 180; this.vy = -290; this.facing = -wallDir; Sound.play('walljump'); }
        else if (this.airJumps > 0) {
          this.vy = -282; this.airJumps--; this.spinT = 0.32;
          Sound.play('djump');
          FX.ring(this.x, this.y, 2, 12, 0.22, { sy: 0.35, w: 1, c: '#2ab8d8', core: '#e0ffff' });
        }
      }
      if (intent.drop && this.onGround) { this.dropThrough = true; this.dropT = 0.22; this.vy = 40; this.onGround = false; }
    }
    Level.moveBody(this, dt, { step: 11 });
    if (this.onGround) {
      this.airJumps = 1;
      if (!wasGround && preVy > 220) { FX.dust(this.x, this.y, 4, { smax: 40 }); this.landSquash = 0.12; }
    }
    if (this.onGround && Math.abs(this.vx) > 15) this.runPhase += Math.abs(this.vx) * dt * 0.105;
    if (this.landSquash > 0) this.landSquash -= dt;
    if (this.x < 44) this.x = 44;
    if (this.x > Level.W - 44) this.x = Level.W - 44;
  }

  // ---------- death ----------
  onDeath() {
    if (this.dying) return;
    this.dying = true; this.dyingT = 2.4; this.hp = 0; this.boomT = 0;
    this.act = null; this.attack = null; this.beam = null; this.hover = false; this.tether = null;
    this.stopBeamLoop();
    if (this.missile && !this.missile.dead) this.missile.explode();
    Game.slowmo(0.35, 1.1);
    Game.shake(0.5);
    Sound.play('bossRoar');
    Game.announce(this.name + ' DOWN', null, '#4af0ff', 2);
  }
  updateDying(dt) {
    this.dyingT -= dt;
    this.boomT -= dt;
    this.vx = approach(this.vx, 0, 600 * dt);
    this.vy = Math.min(this.vy + 960 * dt, 430);
    Level.moveBody(this, dt);
    this.updateScarf(dt);
    if (this.boomT <= 0) {
      this.boomT = 0.18;
      const bx = this.x + rand(-10, 10), by = this.y - rand(4, 22);
      FX.ring(bx, by, 2, 14, 0.25, { c: '#4af0ff', core: '#ffffff', w: 1 });
      FX.sparks(bx, by, 10, 0, TAU, 60, 220, { c0: '#ffffff', c1: '#7af0ff', c2: '#145e6a' });
      Sound.play('hit', { heavy: true });
      Game.shake(0.15);
    }
    if (this.dyingT <= 0) this.finalBlast();
  }
  finalBlast() {
    this.dead = true;
    const cx = this.x, cy = this.cy;
    if (this.spriteCopy) {
      const img = makeCanvas(Sprite.SIZE, Sprite.SIZE);
      img.ctx.drawImage(this.spriteCopy, 0, 0);
      FX.gib(img, cx, cy, Sprite.OX, Sprite.OY - this.h / 2, 0.6, 1, 120, -260, this.h * 0.4);
      FX.gib(img, cx, cy, Sprite.OX, Sprite.OY - this.h / 2, 0.6, -1, -120, -300, this.h * 0.4);
    }
    FX.ring(cx, cy, 4, 110, 0.6, { c: '#4af0ff', core: '#ffffff', w: 2 });
    FX.ring(cx, cy, 2, 70, 0.45, { c: '#ff3a52', core: '#ffd0d8', w: 1 });
    FX.sparks(cx, cy, 60, 0, TAU, 80, 360, { c0: '#ffffff', c1: '#7af0ff', c2: '#145e6a' });
    FX.debris(cx, cy, 30, this.def.debris, 260);
    FX.oil(cx, cy, 20, -Math.PI / 2, 200);
    FX.elec(cx, cy, 40, 12, { outer: '#2ab8d8', core: '#ffffff' });
    FX.light(cx, cy, 200, '#4af0ff', 1, 0.6);
    FX.flash('#ffffff', 0.5);
    Sound.play('explode', { big: true });
    Sound.play('bossShieldBreak');
    Game.shake(0.8);
    Game.hitstop(0.12);
    SaveData.unlocks.aegis = true;
    SaveData.bossKills++;
    saveProgress();
    Game.onKill(this, { cause: 'boss' });
    Game.announce('AEGIS-07 UNLOCKED', 'DEFEATED RIVALS JOIN YOUR ROSTER', '#ffd070', 3);
  }

  // ---------- drawing ----------
  drawFlash() {
    if (this.hitFlash > 0) return '#ffffff';
    if (this.dying && ((this.t * 20) | 0) % 2) return '#bff8ff';
    if (this.cutMark && ((this.t * 30) | 0) % 2) return '#4af0ff';
    return null;
  }
  customPose(o, la) {
    const a = this.act;
    if (this.dying || this.stunT > 0) {
      o.lean = 0.7; o.hipY = -5; o.fF = [5, -1]; o.fB = [-4, -1]; o.hF = [7, -4]; o.hB = [2, -6]; o.swordAng = 1.25;
      return true;
    }
    if (!a) return false;
    if (a.kind === 'gun') {
      o.hB = [Math.cos(la) * 8, -13 + Math.sin(la) * 8]; o.hF = [3, -7]; o.swordAng = 2.5; o.lean = 0.1;
      if (!this.onGround) { o.fF = [3, -4]; o.fB = [-3, -2]; }
      return !this.onGround || Math.abs(this.vx) < 15 ? true : false;
    }
    if (a.kind === 'blade' && a.phase === 'wind') {
      o.lean = -0.15; o.fF = [5, -1]; o.fB = [-5, -1]; o.hF = [-3, -21]; o.hB = [-1, -19]; o.swordAng = -2.3;
      return true;
    }
    if (a.kind === 'beam' && a.phase !== 'rise') {
      o.fF = [2, -3]; o.fB = [-3, -2]; o.hF = [6, -9]; o.hB = [-6, -15]; o.swordAng = 2.4; o.lean = 0.05;
      return true;
    }
    if (a.kind === 'missile' || a.kind === 'summon' || a.kind === 'intro') {
      o.hB = [-1, -26]; o.hF = [4, -8]; o.swordAng = 2.5; o.fF = [4, -1]; o.fB = [-4, -1];
      return true;
    }
    return false;
  }
  drawKatana(g, hx, hy, ang, len, hot, C) {
    // the greatblade: longer, two pixels thick, cyan edge
    const L = 21, c = Math.cos(ang), s = Math.sin(ang);
    g.fillStyle = C.handle; pline(g, hx - c * 4, hy - s * 4, hx, hy, 2);
    g.fillStyle = C.tsuba; pline(g, hx + c - s * 2, hy + s + c * 2, hx + c + s * 2, hy + s - c * 2, 1);
    g.fillStyle = hot ? '#ffffff' : C.blade; pline(g, hx + c * 2, hy + s * 2, hx + c * L, hy + s * L, 2);
    g.fillStyle = C.edge; pline(g, hx + c * 3 - s * 1.5, hy + s * 3 + c * 1.5, hx + c * (L - 1) - s * 1.5, hy + s * (L - 1) + c * 1.5, 1);
    g.fillStyle = '#2a3446'; g.fillRect(Math.round(hx + c * (L * 0.5)), Math.round(hy + s * (L * 0.5)), 1, 1);
  }
  drawExtras(g, J, C) {
    // shoulder missile pod
    const [sx, sy] = J.Sh;
    g.fillStyle = C.dark; g.fillRect(Math.round(sx) - 6, Math.round(sy) - 5, 5, 4);
    g.fillStyle = C.light; g.fillRect(Math.round(sx) - 6, Math.round(sy) - 5, 5, 1);
    g.fillStyle = this.missile || (this.act && this.act.kind === 'missile') ? '#ff3a3a' : C.visor;
    g.fillRect(Math.round(sx) - 5, Math.round(sy) - 3, 1, 1); g.fillRect(Math.round(sx) - 3, Math.round(sy) - 3, 1, 1);
  }
  draw(ctx, camX, camY) {
    if (this.spawning) return;
    Player.prototype.draw.call(this, ctx, camX, camY);
  }
  drawEmissive(ctx, camX, camY) {
    const x = this.x - camX, y = this.y - camY;
    if (this.spawning) {
      const k = 1 - this.spawnT / 1.5, w = Math.max(1, Math.round((1 - k) * 5));
      if (((this.t * 30) | 0) % 3) {
        ctx.fillStyle = '#2ab8d8'; ctx.fillRect(Math.round(x) - w, -10, w * 2 + 1, Math.round(y + 10));
        ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(x), -10, 1, Math.round(y + 10));
      }
      ctx.fillStyle = '#4af0ff'; pring(ctx, x, y - 1, 4 + k * 20, 0.35, 1);
      return;
    }
    if (this.dead) return;
    const cy = y - 11;
    // zip line
    if (this.tether) drawBolt(ctx, x, y - 13, this.tether.x - camX, this.tether.y - camY, '#1a8aa8', '#e0ffff', 3, 1);
    // shield bubble
    if (this.shield && !this.dying) {
      const pulse = Math.sin(this.t * 6) * 0.5;
      const n = 46;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + this.t * 0.6;
        const rx = 15 + pulse, ry = 17 + pulse;
        if (bayer(i, (this.t * 10) | 0) < 0.25) continue;
        ctx.fillStyle = this.deflectT > 0 ? '#ffffff' : i % 3 ? '#4af0ff' : '#bff8ff';
        ctx.fillRect(Math.round(x + Math.cos(a) * rx), Math.round(cy + Math.sin(a) * ry), 1, 1);
      }
      ctx.globalAlpha = 0.12 + (this.deflectT > 0 ? 0.2 : 0);
      ctx.fillStyle = '#4af0ff';
      pdisc(ctx, x, cy, 13);
      ctx.globalAlpha = 1;
    } else if (!this.dying && this.shieldDownT > 0 && this.shieldDownT < 2 && ((this.t * 10) | 0) % 2) {
      ctx.fillStyle = '#4af0ff';
      pring(ctx, x, cy, 16, 1.1, 1);
    }
    const a = this.act;
    if (a && a.kind === 'gun' && a.t < this.tele(0.45)) {
      const [gx, gy] = this.gunPos();
      ctx.fillStyle = '#4af0ff';
      for (let i = 2; i < 40; i += 3) ctx.fillRect(Math.round(gx - camX + Math.cos(a.aim) * i), Math.round(gy - camY + Math.sin(a.aim) * i), 1, 1);
    }
    if (this.beam) {
      const B = this.beam, ox = B.ox - camX, oy = B.oy - camY;
      if (!B.firing) {
        ctx.fillStyle = ((this.t * 20) | 0) % 2 ? '#ffffff' : '#4af0ff';
        for (let i = 0; i < 300; i += 4) ctx.fillRect(Math.round(ox + Math.cos(B.ang) * i), Math.round(oy + Math.sin(B.ang) * i), 1, 1);
      } else {
        const ex = ox + Math.cos(B.ang) * B.len, ey = oy + Math.sin(B.ang) * B.len;
        const wob = ((this.t * 40) | 0) % 2;
        ctx.fillStyle = '#145e6a'; pline(ctx, ox, oy, ex, ey, 7 + wob);
        ctx.fillStyle = '#2ab8d8'; pline(ctx, ox, oy, ex, ey, 5);
        ctx.fillStyle = '#bff8ff'; pline(ctx, ox, oy, ex, ey, 3);
        ctx.fillStyle = '#ffffff'; pline(ctx, ox, oy, ex, ey, 1);
        ctx.fillStyle = '#ffffff'; pdisc(ctx, ex, ey, 4 + wob); pdisc(ctx, ox, oy, 3);
      }
    }
    if (a && a.kind === 'missile') {
      // lock-on reticle closing on the player
      const p = Game.player, k = clamp(a.t / this.tele(1.3), 0, 1);
      const px = p.x - camX, py = p.cy - camY, r = lerp(28, 8, easeOutQuad(k)), rot = k * 1.6;
      ctx.fillStyle = k > 0.85 ? '#ff3030' : ((this.t * 12) | 0) % 2 ? '#ffffff' : '#ff8a3a';
      for (let i = 0; i < 4; i++) {
        const ang = rot + i * Math.PI / 2 + Math.PI / 4;
        const bx = px + Math.cos(ang) * r, by = py + Math.sin(ang) * r;
        pline(ctx, bx, by, bx - Math.cos(ang - 0.6) * 5, by - Math.sin(ang - 0.6) * 5, 1);
        pline(ctx, bx, by, bx - Math.cos(ang + 0.6) * 5, by - Math.sin(ang + 0.6) * 5, 1);
      }
      ctx.fillRect(Math.round(px), Math.round(py), 1, 1);
      drawText(ctx, k > 0.85 ? 'LOCKED' : 'LOCK', px, py + r + 4, { align: 'center', color: k > 0.85 ? '#ff3030' : '#ffffff' });
    }
    if (this.windingUp() && a.kind !== 'missile' && ((this.t * 14) | 0) % 2 === 0) drawText(ctx, '!!', x, y - 32, { color: '#4af0ff', align: 'center' });
  }
  addLights() {
    if (this.spawning) { FX.frameLight(this.x, this.y - 30, 80, '#4af0ff', 0.9); return; }
    const [vx, vy] = this.visorPos();
    FX.frameLight(vx, vy, 16, '#4af0ff', 0.9);
    FX.frameLight(this.x, this.cy, this.shield ? 40 : 24, '#4af0ff', this.shield ? 0.55 : 0.3);
    if (this.beam && this.beam.firing) {
      const B = this.beam;
      for (let d = 0; d < B.len; d += 50) FX.frameLight(B.ox + Math.cos(B.ang) * d, B.oy + Math.sin(B.ang) * d, 36, '#4af0ff', 0.9);
    }
  }
}
for (const k of ['pose', 'updateScarf', 'makeGhost']) Rival.prototype[k] = Player.prototype[k];

// Heat-seeking missile. Dodge it, tether it, and throw it back to break the shield.
class Missile {
  constructor(x, y, owner) {
    this.x = x; this.y = y; this.owner = owner;
    this.ang = -Math.PI / 2; this.speed = 90; this.vx = 0; this.vy = -90;
    this.state = 'homing'; this.t = 0; this.life = 11;
    this.hostile = true; this.tetherable = true; this.grabR = 7; this.tethered = false; this.dead = false;
    this.smokeT = 0; this.indicator = true; this.passT = 0;
  }
  get cx() { return this.x; }
  get cy() { return this.y; }
  grab() { this.state = 'towed'; this.hostile = false; }
  towTo(hx, hy, dt, p) {
    const dx = this.x - hx, dy = this.y - hy, d = Math.hypot(dx, dy) || 1;
    const L = Math.min(d, 22), tx = hx + (dx / d) * L, ty = hy + (dy / d) * L;
    this.vx = (tx - this.x) * 14 + p.vx * 0.5; this.vy = (ty - this.y) * 14 + p.vy * 0.5;
    this.ang = Math.atan2(this.vy, this.vx) || this.ang;
  }
  throwAt(ang) {
    this.state = 'thrown'; this.hostile = false; this.ang = ang; this.speed = 430; this.life = 3; this.t = 0;
    Sound.play('missileLaunch');
    FX.ring(this.x, this.y, 2, 12, 0.18, { w: 1 });
  }
  reflect(ang) { this.throwAt(ang); }
  update(dt) {
    this.t += dt; this.life -= dt; this.passT -= dt;
    if (this.life <= 0) { this.explode(); return; }
    const owner = this.owner, p = Game.player;
    if (this.state === 'homing') {
      this.speed = Math.min(150 * S.enemies.speed, this.speed + 120 * dt);
      if (this.t > 0.35) {
        const want = Math.atan2(p.cy - this.y, p.x - this.x), turn = 2.3 * dt;
        this.ang += clamp(angDiff(this.ang, want), -turn, turn);
      }
    } else if (this.state === 'thrown' && owner && !owner.dead && !owner.dying) {
      const want = Math.atan2(owner.cy - this.y, owner.x - this.x), d = angDiff(this.ang, want);
      if (Math.abs(d) < 1.8) this.ang += clamp(d, -3.6 * dt, 3.6 * dt);
    }
    if (this.state !== 'towed') { this.vx = Math.cos(this.ang) * this.speed; this.vy = Math.sin(this.ang) * this.speed; }
    else if (!this.tethered) { this.state = 'homing'; this.hostile = true; this.speed = 60; }
    const steps = 3;
    for (let i = 0; i < steps; i++) {
      this.x += (this.vx * dt) / steps; this.y += (this.vy * dt) / steps;
      if (this.state !== 'towed' && Level.pointSolid(this.x, this.y)) { this.explode(); return; }
      if (this.state === 'homing' && !p.dead && this.passT <= 0 && dist(this.x, this.y, p.x, p.cy) < 8) {
        const r = p.takeHit({ dmg: 22 * (owner ? owner.dmgMul : 1), x: this.x, y: this.y, kind: 'explosion', proj: this, knock: 220 });
        if (r === 'parried') return;
        if (r === 'ignored') { this.passT = 0.4; continue; }
        this.explode();
        return;
      }
      if (this.state === 'thrown') {
        for (const e of Game.enemies) {
          if (e.dead || e.spawning) continue;
          if (this.x > e.x - e.w / 2 - 3 && this.x < e.x + e.w / 2 + 3 && this.y > e.y - e.h - 3 && this.y < e.y + 3) {
            if (e === owner) owner.missileHit(this);
            this.explode(true);
            return;
          }
        }
      }
    }
    this.smokeT -= dt;
    if (this.smokeT <= 0) {
      this.smokeT = 0.03;
      const bx = this.x - Math.cos(this.ang) * 5, by = this.y - Math.sin(this.ang) * 5;
      FX.dust(bx, by, 1, { smin: 2, smax: 10, r0: 1, r1: 3, c: '#5a5060', rise: 4, life: 1.2 });
      FX.sparks(bx, by, 1, this.ang + Math.PI, 0.5, 30, 80, { c0: '#ffffff', c1: '#ffb040', c2: '#a04010', g: 0 });
    }
  }
  explode(friendly) {
    if (this.dead) return;
    this.dead = true;
    if (friendly || !this.hostile) {
      for (const e of Game.enemies) {
        if (e.dead || e.spawning || e === this.owner) continue;
        const d = dist(this.x, this.y, e.x, e.cy);
        if (d < 44) hurtEnemy(e, 50, { kx: ((e.x - this.x) / (d || 1)) * 260, ky: -220, heavy: true, cause: 'barrel', angle: Math.atan2(e.cy - this.y, e.x - this.x) });
      }
    }
    FX.ring(this.x, this.y, 3, 34, 0.3, { c: '#ff7a2a', core: '#ffe080', w: 2 });
    FX.sparks(this.x, this.y, 24, 0, TAU, 80, 280, { c0: '#ffffff', c1: '#ffb040', c2: '#a03010' });
    FX.dust(this.x, this.y, 10, { c: '#2a2026', smax: 70, r1: 6, life: 1.4, rise: 20 });
    FX.embers(this.x, this.y, 8);
    FX.light(this.x, this.y, 100, '#ff8a3a', 1, 0.3);
    Sound.play('explode', { big: false });
    Game.shake(0.3);
  }
  drawEmissive(ctx, camX, camY) {
    const x = this.x - camX, y = this.y - camY, c = Math.cos(this.ang), s = Math.sin(this.ang);
    const flick = ((this.t * 30) | 0) % 2;
    ctx.fillStyle = flick ? '#ffffff' : '#ffb040';
    pline(ctx, x - c * 5, y - s * 5, x - c * (8 + flick * 2), y - s * (8 + flick * 2), 2);
    ctx.fillStyle = '#0b0910'; pline(ctx, x - c * 5, y - s * 5, x + c * 4, y + s * 4, 4);
    ctx.fillStyle = '#c8d0dc'; pline(ctx, x - c * 4, y - s * 4, x + c * 3, y + s * 3, 2);
    ctx.fillStyle = this.hostile ? '#ff3030' : '#ff2a48';
    ctx.fillRect(Math.round(x + c * 4), Math.round(y + s * 4), 1, 1);
    ctx.fillStyle = '#5a6070';
    pline(ctx, x - c * 4 - s * 2, y - s * 4 + c * 2, x - c * 4 + s * 2, y - s * 4 - c * 2, 1);
    if (this.hostile && ((this.t * 6) | 0) % 2) drawText(ctx, '!', x, y - 11, { color: '#ff5a3a', align: 'center' });
  }
  addLights() { FX.frameLight(this.x, this.y, 30, this.hostile ? '#ff7a2a' : '#ff3048', 0.9); }
}

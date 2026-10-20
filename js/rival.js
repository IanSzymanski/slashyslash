'use strict';
// AEGIS-07: a rival cyborg on the player's own rig and movement model (run, double jump, wall jump,
// dash with i-frames, platform drops, tether zip).
// Phase 1 (above half health): shielded, with a forearm gun, a tracking visor beam, the greatblade,
// and a pulse grenade that must be thrown back to break the shield.
// Phase 2: shield and ranged weapons go offline and it fights in melee combos. Parry one of its
// attacks and it guards against your counter, parries it and ripostes; parry the riposte to stun it.
// Its character definition lives in CHARACTERS so it can be made playable once unlocked.

const AEGIS_PAL = {
  dark: '#1c2130', mid: '#3c4760', light: '#7a8aa6', hi: '#c8d6ea', boot: '#0e1118',
  visor: '#4af0ff', core: '#4af0ff', scarf: '#3ad8e8', scarfD: '#145e6a',
  blade: '#d4dbe6', edge: '#4af0ff', handle: '#10202a', tsuba: '#8aa0b8', sheath: '#16303a', sheathD: '#22505c',
};
const AEGIS_PAL_P2 = Object.assign({}, AEGIS_PAL, { visor: '#ffffff', core: '#ffffff', edge: '#ff6a7a', scarf: '#bff8ff' });

const CHARACTERS = {
  ronin: { id: 'ronin', name: 'RONIN', pal: PCOL, weapon: 'katana', unlocked: () => true },
  aegis: { id: 'aegis', name: 'AEGIS-07', pal: AEGIS_PAL, weapon: 'greatblade', unlocked: () => !!SaveData.unlocks.aegis },
};

ENEMY_DEFS.aegis = { hp: 900, w: 8, h: 20, speed: 145, score: 5000, mass: 6, dmg: 5, debris: ['#3c4760', '#7a8aa6', '#1c2130', '#4af0ff'] };
ENEMY_BASE_STATE.aegis = 'fight';

const BOLT_CYAN = { outer: '#2ab8d8', core: '#e0ffff', light: '#4af0ff' };
const GRENADE_G = 600;

// Greatblade moves. wind = telegraph before the swing; swing = active time.
const RIVAL_MOVES = {
  slash: { wind: 0.3, swing: 0.2, r: 46, span: 3.0, dmg: 14, lunge: 170 },
  cleave: { wind: 0.45, swing: 0.24, r: 56, span: 3.2, dmg: 24, lunge: 110, quake: true },
  rise: { wind: 0.32, swing: 0.22, r: 48, span: 2.8, dmg: 16, lunge: 90, rising: true },
  thrust: { wind: 0.36, swing: 0.2, r: 0, span: 0.01, dmg: 18, thrust: true },
  spin: { wind: 0.42, swing: 0.3, r: 44, span: TAU - 0.02, dmg: 16, spin: true },
  riposte: { wind: 0.34, swing: 0.2, r: 54, span: 3.6, dmg: 28, lunge: 240 },
};
const RIVAL_COMBOS = [
  ['slash', 'slash', 'cleave'], ['thrust', 'slash', 'rise'], ['slash', 'spin'],
  ['rise', 'cleave'], ['thrust', 'cleave'], ['slash', 'slash', 'slash', 'spin'],
];

class Rival extends Enemy {
  constructor(x, y, scale = {}) {
    super('aegis', x, y, scale);
    this.isBoss = true; this.name = CHARACTERS.aegis.name; this.pal = AEGIS_PAL;
    this.heavy = true; this.spawnT = 1.5; this.phase = 1;
    this.shield = true; this.shieldDownT = 0; this.stunT = 0; this.flinchT = 0; this.deflectT = 0;
    this.guardT = 0; this.parryInvulnT = 0; this.transT = 0; this.lungeT = 0; this.lungeV = 0;
    this.dmgMul = scale.dmg || 1;
    // fields the shared player rig reads
    this.dashT = 0; this.dashVX = 0; this.dashVY = 0; this.dashCharges = 2; this.dashRecharge = 0; this.dodgeT = 0;
    this.airJumps = 1; this.attack = null; this.iaido = null; this.postPose = 0; this.sheathe = null; this.plunge = null;
    this.hurtT = 0; this.sliding = false; this.crouching = false; this.wallSliding = false; this.ultHold = 0;
    this.spinT = 0; this.spinDur = 0.32; this.runPhase = 0; this.animT = 0; this.landSquash = 0; this.aimAngle = Math.PI;
    this.deadT = 0; this.tether = null; this.ghostT = 0; this.dropT = 0; this.dropThrough = false; this.jumpCD = 0;
    this.scarf = [];
    for (let i = 0; i < 6; i++) this.scarf.push({ x: x + i * 2, y: y - 16, px: x + i * 2, py: y - 16 });
    this.cds = { gun: 1.2, blade: 0, beam: 8, grenade: 3, combo: 0.5, dash: 0, zip: 2 };
    this.act = null; this.hover = false; this.beam = null; this.grenade = null; this.beamLoop = null;
    this.dodged = new WeakSet(); this.dying = false; this.dyingT = 0; this.boomT = 0;
    this.kite = chance(0.5) ? 1 : -1;
  }

  // ---------- damage hooks used by hurtEnemy ----------
  shielded() { return this.shield && !this.dying; }
  dodging() { return this.dashT > 0 || this.dodgeT > 0; }
  damageTakenMul() { return this.stunT > 0 ? 1.3 : 1; }
  // phase 1 can't be skipped: damage stops at half health until the limiters come off
  gateDamage(d) { return this.phase === 1 ? Math.max(0, Math.min(d, this.hp - Math.floor(this.maxHp / 2))) : d; }
  // Hits it deflects without a shield: its own parries, and the phase change.
  intercept(o) {
    if (this.transT > 0) return true;
    if (this.parryInvulnT > 0) { FX.sparks(this.x, this.cy, 4, rand(0, TAU), TAU, 60, 160, { c0: '#ffffff', c1: '#7af0ff', c2: '#145e6a' }); return true; }
    if (this.phase === 2 && this.guardT > 0) { this.parryPlayer(o); return true; }
    return false;
  }
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
    this.shield = false; this.shieldDownT = 10;
    this.stunFor(3.2);
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
    Game.announce('SHIELD RESTORED', 'THROW ITS GRENADE BACK', '#4af0ff', 1.3, true);
  }
  pulseHit() {
    if (this.dying || this.transT > 0) return;
    if (this.shield) this.breakShield();
    else hurtEnemy(this, 60, { cause: 'barrel', heavy: true, kx: 0, ky: -150, angle: -Math.PI / 2, crit: true });
  }
  stunFor(dur) {
    this.stunT = dur; this.flinchT = 0; this.guardT = 0;
    this.act = null; this.attack = null; this.beam = null; this.hover = false; this.tether = null; this.dashT = 0; this.lungeT = 0;
    this.stopLoops();
  }
  // Called when the player parries one of its attacks.
  stagger(dur, kx = 0) {
    if (this.dying || dur < 1.2) return;
    if (this.phase === 2) {
      if (this.act && this.act.move === 'riposte') {
        this.stunFor(3.2);
        this.vx = kx / 2; this.vy = -120;
        FX.ring(this.x, this.cy, 4, 40, 0.35, { c: '#ffd070', core: '#ffffff', w: 2 });
        Sound.play('bossShieldBreak');
        Game.slowmo(0.25, 0.5);
        Game.announce('STAGGERED', 'PUNISH IT', '#ffd070', 1.4);
        return;
      }
      // it raises a guard, ready to parry your counter
      this.attack = null; this.lungeT = 0;
      this.act = { kind: 'guard', t: 0 };
      this.guardT = 1.4;
      this.vx += kx / 4;
      return;
    }
    this.flinchT = 0.7; this.hurtT = 0.7;
    this.act = null; this.attack = null; this.hover = false; this.beam = null; this.lungeT = 0;
    this.vx += kx / 3;
  }
  parryPlayer(o) {
    this.guardT = 0; this.parryInvulnT = 0.45;
    const p = Game.player;
    this.facing = sign(p.x - this.x) || this.facing;
    const [cx, cy] = this.chest();
    FX.ring(cx, cy, 4, 34, 0.28, { c: '#4af0ff', core: '#ffffff', w: 2 });
    FX.sparks(cx + this.facing * 8, cy, 18, Math.PI + (this.facing > 0 ? 0 : Math.PI), 1.6, 80, 280, { c0: '#ffffff', c1: '#7af0ff', c2: '#145e6a' });
    FX.text('PARRIED', this.x, this.y - 34, { c: '#4af0ff', always: true, dur: 0.8, vy: -24 });
    Sound.play('parry');
    Game.hitstop(0.06);
    Game.slowmo(0.4, 0.3);
    Game.shake(0.2);
    if (!p.dead) { p.vx = sign(p.x - this.x || 1) * 170; p.vy = Math.min(p.vy, -80); }
    this.startMove('riposte', null);
    Game.announce('COUNTERED', 'PARRY ITS RIPOSTE', '#4af0ff', 1.0, true);
  }
  windingUp() {
    const a = this.act;
    if (!a) return false;
    return (a.kind === 'gun' && a.t < this.tele(0.45)) || (a.kind === 'melee' && a.phase === 'wind') ||
      (a.kind === 'beam' && a.phase !== 'fire') || a.kind === 'grenade';
  }
  stopLoops() { if (this.beamLoop) { this.beamLoop.stop(); this.beamLoop = null; } }

  // ---------- rig compatibility ----------
  chest() { return [this.x, this.y - 12]; }
  hand() { return [this.x - this.facing * 2, this.y - 13]; }
  zipping() { return !!this.tether; }
  gunPos() { const a = this.aimAngle; return [this.x + Math.cos(a) * 8, this.y - 13 + Math.sin(a) * 8]; }
  visorPos() { return this._visor || [this.x + this.facing * 2, this.y - 19]; }
  orbPos() { return this._handB || [this.x - this.facing * 6, this.y - 22]; }

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
        Game.announce(this.name, 'TETHER ITS GRENADE AND THROW IT BACK', '#4af0ff', 2.6);
        this.act = { kind: 'intro', t: 0 };
      }
      return;
    }
    for (const k in this.cds) this.cds[k] -= dt * (k === 'dash' || k === 'zip' ? 1 : S.enemies.aggression);
    for (const k of ['flinchT', 'hurtT', 'spinT', 'postPose', 'dodgeT', 'jumpCD', 'deflectT', 'guardT', 'parryInvulnT', 'transT']) if (this[k] > 0) this[k] = Math.max(0, this[k] - dt);
    if (this.dashCharges < 2) { this.dashRecharge += dt; if (this.dashRecharge >= 1.2) { this.dashCharges++; this.dashRecharge = 0; } }
    if (this.dropThrough) { this.dropT -= dt; if (this.dropT <= 0) this.dropThrough = false; }
    if (this.grenade && this.grenade.dead) { this.grenade = null; this.cds.grenade = rand(6, 9); }
    // the beam hum follows the beam, so it can never outlive it
    const hum = !!(this.beam && this.beam.firing) && !this.dying;
    if (hum && !this.beamLoop) this.beamLoop = Sound.loop('beam');
    else if (!hum && this.beamLoop) this.stopLoops();
    if (this.dying) { this.updateDying(dt); return; }
    if (this.phase === 1 && this.hp <= this.maxHp / 2) this.enterPhase2();
    if (this.phase === 1 && !this.shield) {
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
      intent = this.act ? this.runAct(dt, p) : this.navigate(p, this.phase === 2 ? 'press' : 'kite');
      this.react(p);
    }
    if (this.phase === 2 && Math.random() < 0.25) FX.sparks(this.x + rand(-4, 4), this.y - rand(4, 18), 1, -Math.PI / 2, 1, 20, 60, { c0: '#ffffff', c1: '#ff6a7a', c2: '#145e6a', g: -40 });
    this.physics(dt, intent);
    this.updateScarf(dt);
    if (this.dashT > 0 || this.zipping() || this.lungeT > 0 || (this.phase === 2 && Math.abs(this.vx) > 120)) {
      this.ghostT -= dt;
      if (this.ghostT <= 0) { this.ghostT = 0.025; this.makeGhost(this.phase === 2 ? '#ff6a7a' : '#2ab8d8', 0.22, 0.5); }
    }
  }
  enterPhase2() {
    this.phase = 2; this.pal = AEGIS_PAL_P2;
    const hadShield = this.shield;
    this.shield = false; this.stunT = 0; this.flinchT = 0;
    this.act = { kind: 'limiter', t: 0 }; this.attack = null; this.beam = null; this.hover = false; this.tether = null;
    this.transT = 1.4; this.cds.combo = 0.2;
    this.stopLoops();
    FX.ring(this.x, this.cy, 4, 80, 0.5, { c: '#ff6a7a', core: '#ffffff', w: 2 });
    if (hadShield) FX.ring(this.x, this.cy, 20, 4, 0.3, { c: '#4af0ff', core: '#ffffff', w: 1 });
    FX.sparks(this.x, this.cy, 40, 0, TAU, 80, 300, { c0: '#ffffff', c1: '#ff6a7a', c2: '#145e6a' });
    FX.elec(this.x, this.cy, 34, 12, { outer: '#ff6a7a', core: '#ffffff' });
    FX.flash('#ffffff', 0.35);
    Sound.play('bossRoar');
    Sound.play('bossShieldBreak');
    Game.slowmo(0.3, 0.6);
    Game.shake(0.6);
    Game.announce('LIMITERS OFF', 'NO SHIELD, NO GUNS. PARRY, THEN PARRY ITS RIPOSTE', '#ff6a7a', 2.6);
  }
  chooseAct(p) {
    const dx = p.x - this.x, adx = Math.abs(dx), dy = p.y - this.y;
    if (p.dead) return;
    if (this.phase === 2) {
      if (this.cds.combo <= 0 && Math.abs(dy) < 40 && adx < 150) {
        const options = adx > 80 ? RIVAL_COMBOS.filter((c) => c[0] === 'thrust') : RIVAL_COMBOS;
        const combo = pick(options);
        this.startMove(combo[0], { list: combo, i: 0 });
      }
      return;
    }
    if (this.shield && !this.grenade && this.cds.grenade <= 0) { this.act = { kind: 'grenade', t: 0 }; Sound.play('beamCharge'); return; }
    if (adx < 64 && Math.abs(dy) < 40 && this.cds.blade <= 0) { this.startMove('slash', null); this.cds.blade = 1.6; return; }
    if (this.cds.beam <= 0 && adx > 70) { this.act = { kind: 'beam', phase: 'rise', t: 0 }; this.vy = -330; this.onGround = false; return; }
    if (this.cds.gun <= 0) { this.act = { kind: 'gun', t: 0, shots: 0, next: 0, aim: this.aimAngle }; Sound.play('enemyWindup', { pm: 0.9 }); }
  }
  startMove(name, combo) {
    this.attack = null;
    this.act = { kind: 'melee', move: name, m: RIVAL_MOVES[name], phase: 'wind', t: 0, combo };
    this.facing = sign(Game.player.x - this.x) || this.facing;
    Sound.play('enemyWindup', { pm: name === 'riposte' ? 1.4 : 0.6 });
  }
  runAct(dt, p) {
    const a = this.act;
    a.t += dt;
    switch (a.kind) {
      case 'intro':
        if (a.t > 1.1) this.act = null;
        return { mx: 0 };
      case 'limiter':
        if (Math.random() < 0.6) FX.elec(this.x, this.cy, 18, 1, { outer: '#ff6a7a', core: '#ffffff' });
        if (a.t > 1.4) this.act = null;
        return { mx: 0 };
      case 'guard':
        this.facing = sign(p.x - this.x) || this.facing;
        if (Math.random() < 0.4) FX.sparks(this.x + this.facing * 8, this.y - 13, 1, -Math.PI / 2, 1.5, 20, 60, { c0: '#ffffff', c1: '#4af0ff', c2: '#145e6a', g: 0 });
        if (this.guardT <= 0) { this.act = null; this.cds.combo = 0.2; }
        return { mx: 0 };
      case 'recover':
        if (a.t > a.dur) this.act = null;
        return { mx: 0 };
      case 'melee': return this.runMelee(dt, a, p);
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
      case 'beam': return this.runBeam(dt, a, p);
      case 'grenade': {
        // charge a pulse grenade in the off hand, then lob it on an arc at the player
        this.facing = sign(p.x - this.x) || this.facing;
        const [ox, oy] = this.orbPos();
        a.plan = this.planThrow(ox, oy, p.x, p.y - 6);
        if (Math.random() < 0.7) FX.elec(ox, oy, 6 + a.t * 8, 1, { outer: '#2ab8d8', core: '#ffffff' });
        if (a.t >= this.tele(1.15)) {
          this.grenade = new PulseGrenade(ox, oy, a.plan.vx, a.plan.vy, this);
          Game.projectiles.push(this.grenade);
          Sound.play('throw');
          this.act = { kind: 'recover', t: 0, dur: 0.3 };
          this.cds.grenade = 99;
        }
        return { mx: 0 };
      }
    }
    return { mx: 0 };
  }
  planThrow(x0, y0, tx, ty) {
    const T = clamp(dist(x0, y0, tx, ty) / 220, 0.65, 1.15);
    return { vx: (tx - x0) / T, vy: (ty - y0) / T - 0.5 * GRENADE_G * T, T, x0, y0 };
  }
  runMelee(dt, a, p) {
    const m = a.m;
    const [cx, cy] = this.chest();
    if (a.phase === 'wind') {
      this.facing = sign(p.x - this.x) || this.facing;
      if (a.t >= this.tele(m.wind)) {
        a.phase = 'swing'; a.t = 0; a.hit = false; a.quaked = false;
        let ang = this.aimAngle, dir = this.facing;
        if (m.spin) ang = -Math.PI / 2;
        if (m.rising) dir = -this.facing;
        if (m.thrust) { ang = this.facing > 0 ? 0 : Math.PI; this.lungeT = 0.16; this.lungeV = this.facing * 560; }
        else if (a.move === 'riposte') {
          // the riposte closes whatever gap your counter opened
          const gap = Math.max(0, Math.abs(p.x - this.x) - 18);
          this.lungeT = 0.14; this.lungeV = this.facing * Math.min(760, gap / 0.14);
        } else if (m.lunge) this.vx = this.facing * m.lunge;
        if (m.rising) this.vy = -240;
        this.attack = { stage: 3, t: 0, sweep: m.swing * 0.6, dur: m.swing, dir, span: m.span, ang };
        if (!m.thrust) {
          FX.swoosh({ x: cx, y: cy, follow: this, ox: 0, oy: -12, r: m.r, span: m.span, ang, dir, sweep: m.swing * 0.6, dur: m.swing + 0.12, thick: m.r > 50 ? 16 : 12, pal: a.move === 'riposte' ? PALETTES.gold : PALETTES.cyan, trail: 0.95 });
        } else FX.slashLine(cx, cy, cx + this.facing * 70, cy, { w: 3, dur: 0.25, pal: PALETTES.cyan });
        Sound.play('swing', { stage: m.r > 50 || m.spin ? 3 : 1 });
      }
      return { mx: m.thrust || adxNear(this, p) ? 0 : sign(p.x - this.x) * 0.5 };
    }
    this.attack.t = a.t;
    if (!a.hit && !p.dead) {
      let hit = false;
      if (m.thrust) hit = segRect(cx, cy, cx + this.facing * 26, cy, 6, p.x - p.w / 2, p.y - p.h, p.w, p.h);
      else if (a.t > 0.02 && a.t < m.swing * 0.8) hit = sectorRect(cx, cy, m.r + 2, this.attack.ang, m.span, p.x - p.w / 2, p.y - p.h, p.w, p.h);
      if (hit) {
        a.hit = true;
        p.takeHit({ dmg: m.dmg * this.dmgMul, x: this.x, y: cy, kind: 'melee', source: this, knock: m.quake ? 280 : m.rising ? 160 : 220 });
        if (m.rising && !p.dead && p.hurtT > 0) p.vy = -300;
        if (this.act !== a) return { mx: 0 };
      }
    }
    if (m.quake && !a.quaked && a.t > 0.12) {
      a.quaked = true;
      if (this.onGround) {
        for (const d of [-1, 1]) Game.hazards.push(new Shockwave(this.x + d * 14, this.y, d, 240, 10 * this.dmgMul, this));
        FX.dust(this.x, this.y, 10, { smax: 90 });
        FX.decal('crack', this.x + this.facing * 16, this.y, { len: 14, n: 5 });
        Game.shake(0.2);
        Sound.play('slam');
      }
    }
    if (a.t >= m.swing) {
      this.attack = null;
      const c = a.combo;
      if (c && c.i + 1 < c.list.length) { c.i++; this.startMove(c.list[c.i], c); }
      else {
        this.act = { kind: 'recover', t: 0, dur: this.phase === 2 ? rand(0.55, 0.85) : 0.4 };
        this.cds.combo = rand(0.3, 0.8);
        this.postPose = 0.2;
      }
    }
    return { mx: 0 };
  }
  runBeam(dt, a, p) {
    const [ox, oy] = this.visorPos();
    const target = Math.atan2(p.cy - oy, p.x - ox);
    this.facing = Math.cos(target) >= 0 ? 1 : -1;
    if (a.phase === 'rise') {
      if (this.vy > -40 || a.t > 0.4) { a.phase = 'charge'; a.t = 0; this.hover = true; a.ang = target; a.w = 0; Sound.play('beamCharge'); }
      return { mx: 0 };
    }
    if (a.phase === 'charge') {
      a.ang = target;
      if (Math.random() < 0.6) FX.elec(ox, oy, 8, 1, { outer: '#2ab8d8', core: '#ffffff' });
      if (a.t >= this.tele(0.85)) { a.phase = 'fire'; a.t = 0; a.tick = 0; }
      this.beam = { ox, oy, ang: a.ang, len: 0, firing: false };
      return { mx: 0 };
    }
    // firing: the beam has angular momentum, so it is slow to change direction
    const want = clamp(angDiff(a.ang, target) * 1.5, -0.55, 0.55) * S.enemies.speed;
    a.w = approach(a.w, want, 0.9 * dt);
    a.ang += a.w * dt;
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
    if (a.t >= 2.6) { this.act = null; this.beam = null; this.hover = false; this.cds.beam = rand(9, 12); }
    return { mx: 0 };
  }
  // Where to stand: "press" closes in for melee, "kite" holds mid range for the gun and beam.
  navigate(p, style, speedMul = 1) {
    const dx = p.x - this.x, adx = Math.abs(dx), dy = p.y - this.y;
    let mx = 0, jump = false, drop = false;
    if (style === 'press') { if (adx > 26) mx = sign(dx); }
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
    const closeIn = style === 'press' ? 150 : 280;
    if (adx > closeIn && this.cds.dash <= 0 && this.dashCharges > 0 && Math.abs(dy) < 60) this.dash(sign(dx), 0);
    return { mx: mx * speedMul, jump, drop };
  }
  react(p) {
    // with the shield down it dodges incoming swings like a player would
    if (this.shield || this.dashCharges <= 0) return;
    if (this.act && this.act.kind !== 'recover') return;
    const threat = p.attack || p.iaido;
    if (threat && !this.dodged.has(threat) && dist(p.x, p.y, this.x, this.y) < 64) {
      this.dodged.add(threat);
      if (chance(this.phase === 2 ? 0.3 : 0.4)) this.dash(-sign(p.x - this.x) || 1, -0.3);
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
    } else if (this.lungeT > 0) {
      this.lungeT -= dt;
      this.vx = this.lungeV; this.vy = Math.min(this.vy + 960 * dt, 430);
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
      const max = this.def.speed * S.enemies.speed * (this.phase === 2 ? 1.15 : 1);
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
    this.act = null; this.attack = null; this.beam = null; this.hover = false; this.tether = null; this.lungeT = 0;
    this.stopLoops();
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
    this.stopLoops();
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
    if (this.parryInvulnT > 0.3) return '#bff8ff';
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
      return !this.onGround || Math.abs(this.vx) < 15;
    }
    if (a.kind === 'melee' && a.phase === 'wind') {
      const mv = a.move;
      o.fF = [5, -1]; o.fB = [-5, -1]; o.lean = 0.2;
      if (mv === 'cleave') { o.lean = -0.15; o.hF = [-3, -21]; o.hB = [-1, -19]; o.swordAng = -2.3; }
      else if (mv === 'rise') { o.hipY = -7; o.hF = [-5, -5]; o.hB = [-3, -6]; o.swordAng = 2.6; }
      else if (mv === 'thrust') { o.lean = 0.35; o.hF = [-5, -12]; o.hB = [3, -11]; o.swordAng = 0; }
      else if (mv === 'spin') { o.hipY = -7; o.hF = [-6, -8]; o.hB = [4, -9]; o.swordAng = Math.PI; }
      else { o.hF = [-4, -11]; o.hB = [2, -8]; o.swordAng = Math.PI - 0.4; }
      return true;
    }
    if (a.kind === 'guard') {
      o.lean = -0.05; o.fF = [5, -1]; o.fB = [-5, -1]; o.hF = [6, -13]; o.hB = [3, -11]; o.swordAng = -0.2;
      return true;
    }
    if (a.kind === 'beam' && a.phase !== 'rise') {
      o.fF = [2, -3]; o.fB = [-3, -2]; o.hF = [6, -9]; o.hB = [-6, -15]; o.swordAng = 2.4; o.lean = 0.05;
      return true;
    }
    if (a.kind === 'grenade') {
      o.hB = [-6, -22]; o.hF = [4, -8]; o.swordAng = 2.5; o.fF = [5, -1]; o.fB = [-4, -1]; o.lean = -0.1;
      return true;
    }
    if (a.kind === 'limiter' || a.kind === 'intro') {
      o.hF = [7, -17]; o.hB = [-7, -17]; o.swordAng = -1.0; o.fF = [5, -1]; o.fB = [-5, -1];
      return true;
    }
    return false;
  }
  drawKatana(g, hx, hy, ang, len, hot, C) {
    // the greatblade: longer, two pixels thick, glowing edge
    const L = 21, c = Math.cos(ang), s = Math.sin(ang);
    g.fillStyle = C.handle; pline(g, hx - c * 4, hy - s * 4, hx, hy, 2);
    g.fillStyle = C.tsuba; pline(g, hx + c - s * 2, hy + s + c * 2, hx + c + s * 2, hy + s - c * 2, 1);
    g.fillStyle = hot ? '#ffffff' : C.blade; pline(g, hx + c * 2, hy + s * 2, hx + c * L, hy + s * L, 2);
    g.fillStyle = C.edge; pline(g, hx + c * 3 - s * 1.5, hy + s * 3 + c * 1.5, hx + c * (L - 1) - s * 1.5, hy + s * (L - 1) + c * 1.5, 1);
    g.fillStyle = '#2a3446'; g.fillRect(Math.round(hx + c * (L * 0.5)), Math.round(hy + s * (L * 0.5)), 1, 1);
  }
  drawExtras(g, J, C) {
    // shoulder pod; remember the off hand so the grenade orb can sit in it
    const [sx, sy] = J.Sh;
    g.fillStyle = C.dark; g.fillRect(Math.round(sx) - 6, Math.round(sy) - 5, 5, 4);
    g.fillStyle = C.light; g.fillRect(Math.round(sx) - 6, Math.round(sy) - 5, 5, 1);
    g.fillStyle = C.visor;
    g.fillRect(Math.round(sx) - 5, Math.round(sy) - 3, 1, 1); g.fillRect(Math.round(sx) - 3, Math.round(sy) - 3, 1, 1);
    this._handB = [this.x + J.HB[0] * this.facing, this.y + J.HB[1]];
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
    if (this.tether) drawBolt(ctx, x, y - 13, this.tether.x - camX, this.tether.y - camY, '#1a8aa8', '#e0ffff', 3, 1);
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
    } else if (this.phase === 1 && !this.dying && this.shieldDownT > 0 && this.shieldDownT < 2 && ((this.t * 10) | 0) % 2) {
      ctx.fillStyle = '#4af0ff';
      pring(ctx, x, cy, 16, 1.1, 1);
    }
    const a = this.act;
    if (a && a.kind === 'guard' && ((this.t * 16) | 0) % 2) {
      ctx.fillStyle = '#ffffff';
      pline(ctx, x + this.facing * 4, y - 16, x + this.facing * 16, y - 19, 1);
    }
    if (a && a.kind === 'gun' && a.t < this.tele(0.45)) {
      const [gx, gy] = this.gunPos();
      ctx.fillStyle = '#4af0ff';
      for (let i = 2; i < 40; i += 3) ctx.fillRect(Math.round(gx - camX + Math.cos(a.aim) * i), Math.round(gy - camY + Math.sin(a.aim) * i), 1, 1);
    }
    if (a && a.kind === 'grenade') {
      // charging orb plus the arc it is about to fly
      const [ox, oy] = this.orbPos(), k = clamp(a.t / this.tele(1.15), 0, 1);
      ctx.fillStyle = '#0b0910'; pdisc(ctx, ox - camX, oy - camY, 4 + k * 4);
      ctx.fillStyle = '#2ab8d8'; pdisc(ctx, ox - camX, oy - camY, 3 + k * 4);
      ctx.fillStyle = ((this.t * 20) | 0) % 2 ? '#ffffff' : '#bff8ff'; pdisc(ctx, ox - camX, oy - camY, 1 + k * 3);
      ctx.fillStyle = '#7af0ff'; pring(ctx, ox - camX, oy - camY, 10 - k * 4 + Math.sin(this.t * 30), 1, 1);
      if (a.plan && ((this.t * 12) | 0) % 3) {
        const P = a.plan;
        ctx.fillStyle = k > 0.8 ? '#ffffff' : '#4af0ff';
        for (let tt = 0.05; tt < P.T; tt += 0.05) {
          const px = P.x0 + P.vx * tt, py = P.y0 + P.vy * tt + 0.5 * GRENADE_G * tt * tt;
          ctx.fillRect(Math.round(px - camX), Math.round(py - camY), 2, 2);
        }
        const ex = P.x0 + P.vx * P.T, ey = P.y0 + P.vy * P.T + 0.5 * GRENADE_G * P.T * P.T;
        pring(ctx, ex - camX, ey - camY, 8, 0.4, 1);
      }
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
    if (this.windingUp() && a.kind !== 'grenade' && ((this.t * 14) | 0) % 2 === 0) {
      const riposte = a.move === 'riposte';
      drawText(ctx, riposte ? '!!!' : '!!', x, y - 32, { color: riposte ? '#ffd070' : this.phase === 2 ? '#ff8a9a' : '#4af0ff', align: 'center' });
    }
  }
  addLights() {
    if (this.spawning) { FX.frameLight(this.x, this.y - 30, 80, '#4af0ff', 0.9); return; }
    const [vx, vy] = this.visorPos();
    FX.frameLight(vx, vy, 16, this.phase === 2 ? '#ffffff' : '#4af0ff', 0.9);
    FX.frameLight(this.x, this.cy, this.shield ? 40 : 24, this.phase === 2 ? '#ff6a7a' : '#4af0ff', this.shield ? 0.55 : 0.3);
    if (this.act && this.act.kind === 'grenade') { const [ox, oy] = this.orbPos(); FX.frameLight(ox, oy, 30, '#4af0ff', 0.9); }
    if (this.beam && this.beam.firing) {
      const B = this.beam;
      for (let d = 0; d < B.len; d += 50) FX.frameLight(B.ox + Math.cos(B.ang) * d, B.oy + Math.sin(B.ang) * d, 36, '#4af0ff', 0.9);
    }
  }
}
for (const k of ['pose', 'updateScarf', 'makeGhost']) Rival.prototype[k] = Player.prototype[k];

function adxNear(e, p) { return Math.abs(p.x - e.x) < 34; }

// Pulse grenade: lobbed on an arc, bounces, and detonates on a timer. A hit disables the player's
// shield for a while. Tether it to swing it and throw it back; a thrown-back grenade breaks the shield.
class PulseGrenade {
  constructor(x, y, vx, vy, owner) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy; this.owner = owner;
    this.fuse = 2.6; this.maxFuse = 2.6; this.t = 0; this.state = 'flying';
    this.hostile = true; this.tetherable = true; this.grabR = 7; this.tethered = false; this.dead = false;
    this.indicator = true; this.R = 56;
  }
  get cx() { return this.x; }
  get cy() { return this.y; }
  grab() { this.state = 'towed'; this.hostile = false; }
  towTo(hx, hy, dt, p) {
    const dx = this.x - hx, dy = this.y - hy, d = Math.hypot(dx, dy) || 1;
    const L = Math.min(d, 22), tx = hx + (dx / d) * L, ty = hy + (dy / d) * L;
    this.vx = (tx - this.x) * 14 + p.vx * 0.5; this.vy = (ty - this.y) * 14 + p.vy * 0.5;
  }
  throwAt(ang) {
    this.state = 'thrown'; this.hostile = false;
    this.vx = Math.cos(ang) * 420; this.vy = Math.sin(ang) * 420;
    this.fuse = Math.max(this.fuse, 1.4);
    Sound.play('throw');
    FX.ring(this.x, this.y, 2, 12, 0.18, { w: 1 });
  }
  reflect(ang) { this.throwAt(ang); }
  update(dt) {
    this.t += dt; this.fuse -= dt;
    if (this.fuse <= 0) { this.explode(); return; }
    const p = Game.player, owner = this.owner;
    if (this.state === 'towed') {
      if (!this.tethered) { this.state = 'flying'; this.hostile = true; }
      this.x += this.vx * dt; this.y += this.vy * dt;
      return;
    }
    if (this.state === 'thrown' && owner && !owner.dead && !owner.dying) {
      // light homing so a rough throw still finds it
      const want = Math.atan2(owner.cy - this.y, owner.x - this.x), cur = Math.atan2(this.vy, this.vx), d = angDiff(cur, want);
      if (Math.abs(d) < 1.8) {
        const na = cur + clamp(d, -2.4 * dt, 2.4 * dt), sp = Math.hypot(this.vx, this.vy);
        this.vx = Math.cos(na) * sp; this.vy = Math.sin(na) * sp;
      }
      if (dist(this.x, this.y, owner.x, owner.cy) < 14) { this.explode(); return; }
    }
    const px = this.x, py = this.y;
    this.vy += (this.state === 'thrown' ? 200 : GRENADE_G) * dt;
    this.x += this.vx * dt; this.y += this.vy * dt;
    if (this.vy > 0 && Level.pointSolid(this.x, this.y + 3, py + 3)) {
      this.y = py; this.vy = -this.vy * 0.42; this.vx *= 0.7;
      if (Math.abs(this.vy) < 40) this.vy = 0;
      else Sound.play('barrelHit');
      if (this.state === 'thrown') this.state = 'flying';
    } else if (Level.pointSolid(this.x, this.y)) {
      this.x = px; this.y = py; this.vx = -this.vx * 0.5;
      if (this.vy < 0) this.vy *= 0.5;
    }
    if (this.vy === 0) this.vx = approach(this.vx, 0, 200 * dt);
    if (this.hostile && !p.dead && p.parryActive() && dist(this.x, this.y, p.x, p.cy) < 12) {
      p.doParry({ x: this.x, y: this.y, proj: this });
    }
    if (Math.random() < 0.5) FX.sparks(this.x, this.y, 1, rand(0, TAU), TAU, 20, 60, { c0: '#ffffff', c1: '#4af0ff', c2: '#145e6a', g: 0 });
  }
  explode() {
    if (this.dead) return;
    this.dead = true;
    const R = this.R, p = Game.player, owner = this.owner;
    const friendly = this.state === 'thrown' || (this.state === 'flying' && !this.hostile);
    if (owner && !owner.dead && dist(this.x, this.y, owner.x, owner.cy) < R + 4 && (friendly || this.state === 'thrown')) owner.pulseHit();
    if (friendly) {
      for (const e of Game.enemies) {
        if (e.dead || e.spawning || e === owner) continue;
        const d = dist(this.x, this.y, e.x, e.cy);
        if (d < R) hurtEnemy(e, 50, { kx: ((e.x - this.x) / (d || 1)) * 260, ky: -220, heavy: true, cause: 'barrel', angle: Math.atan2(e.cy - this.y, e.x - this.x) });
      }
    }
    // a hostile pulse, or one still on your tether, catches you
    if (!p.dead && (this.hostile || this.state === 'towed') && dist(this.x, this.y, p.x, p.cy) < R) {
      const r = p.takeHit({ dmg: 14 * (owner ? owner.dmgMul : 1), x: this.x, y: this.y, kind: 'explosion', knock: 240 });
      if (r === 'hit') p.disableShield(6);
    }
    for (const [r1, d] of [[R, 0.45], [R * 0.7, 0.35], [R * 0.4, 0.25]]) FX.ring(this.x, this.y, 3, r1, d, { c: '#2ab8d8', core: '#ffffff', w: 2 });
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + rand(-0.2, 0.2); FX.bolt(this.x, this.y, this.x + Math.cos(a) * R * 0.8, this.y + Math.sin(a) * R * 0.8, 0.2, { outer: '#2ab8d8', core: '#ffffff', jag: 5 }); }
    FX.sparks(this.x, this.y, 30, 0, TAU, 80, 300, { c0: '#ffffff', c1: '#7af0ff', c2: '#145e6a' });
    FX.light(this.x, this.y, 140, '#4af0ff', 1, 0.4);
    FX.flash('#bff8ff', 0.25);
    Sound.play('pulse');
    Game.shake(0.45);
    Game.hitstop(0.04);
  }
  drawEmissive(ctx, camX, camY) {
    const x = this.x - camX, y = this.y - camY;
    const k = this.fuse / this.maxFuse, blink = ((this.t * (4 + (1 - k) * 18)) | 0) % 2;
    ctx.fillStyle = '#0b0910'; pdisc(ctx, x, y, 5);
    ctx.fillStyle = this.hostile ? '#145e6a' : '#5a0c1a'; pdisc(ctx, x, y, 4);
    ctx.fillStyle = blink ? '#ffffff' : this.hostile ? '#4af0ff' : '#ff5a6a'; pdisc(ctx, x, y, 2);
    // fuse ring drains as the pulse gets closer
    const n = 16;
    for (let i = 0; i < n; i++) {
      if (i / n > k) continue;
      const a = -Math.PI / 2 + (i / n) * TAU;
      ctx.fillStyle = this.hostile ? '#7af0ff' : '#ff8a9a';
      ctx.fillRect(Math.round(x + Math.cos(a) * 7), Math.round(y + Math.sin(a) * 7), 1, 1);
    }
    if (this.hostile && blink) drawText(ctx, '!', x, y - 15, { color: '#7af0ff', align: 'center' });
  }
  addLights() { FX.frameLight(this.x, this.y, 34, this.hostile ? '#4af0ff' : '#ff3048', 0.9); }
}

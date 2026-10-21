'use strict';
// AEGIS-07: a rival cyborg on the player's own rig and movement model (run, double jump, wall jump,
// dash with i-frames, platform drops, tether zip).
// Phase 1 (above half health): shielded, with a forearm gun, a tracking visor beam, the greatblade,
// and a pulse grenade that must be tethered and slashed back to break the shield.
// At half health it blasts the player away and enrages in a short cutscene.
// Phase 2: shield and ranged weapons go offline and it fights in melee combos. Parry one of its
// attacks and it guards; it also raises guards of its own. Swing into a guard and it parries and
// ripostes in bullet time; parry the riposte to stun it.
// The last hit plays a slow-motion knockout cutscene and leaves it lying in the street.
// Its character definition lives in CHARACTERS so it can be made playable once unlocked.

const AEGIS_PAL = {
  dark: '#1c2130', mid: '#3c4760', light: '#7a8aa6', hi: '#c8d6ea', boot: '#0e1118',
  visor: '#4af0ff', core: '#4af0ff', scarf: '#3ad8e8', scarfD: '#145e6a',
  blade: '#d4dbe6', edge: '#4af0ff', handle: '#10202a', tsuba: '#8aa0b8', sheath: '#16303a', sheathD: '#22505c',
};
const AEGIS_PAL_P2 = Object.assign({}, AEGIS_PAL, { visor: '#ffffff', core: '#ffffff', edge: '#ff6a7a', scarf: '#bff8ff' });
const AEGIS_PAL_KO = Object.assign({}, AEGIS_PAL, { visor: '#1a2a34', core: '#22303a', edge: '#3a4a5a', scarf: '#2a6a74' });

const CHARACTERS = {
  // utility: the F ability (js/utilities.js); AEGIS-07 gets its own when it becomes playable
  ronin: { id: 'ronin', name: 'RONIN', pal: PCOL, weapon: 'katana', utility: 'overload', unlocked: () => true },
  aegis: { id: 'aegis', name: 'AEGIS-07', pal: AEGIS_PAL, weapon: 'greatblade', utility: null, unlocked: () => !!SaveData.unlocks.aegis },
};

ENEMY_DEFS.aegis = { hp: 900, w: 8, h: 20, speed: 145, score: 5000, mass: 6, dmg: 5, debris: ['#3c4760', '#7a8aa6', '#1c2130', '#4af0ff'] };
ENEMY_BASE_STATE.aegis = 'fight';

const BOLT_CYAN = { outer: '#2ab8d8', core: '#e0ffff', light: '#4af0ff' };
const GRENADE_G = 600;
// time scale of the bullet time that plays while its riposte winds up
const RIPOSTE_BT_SCALE = 0.7;

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
    this.cds = { gun: 1.2, blade: 0, beam: 8, grenade: 3, combo: 0.5, dash: 0, zip: 2, dodge: 0 };
    this.cracks = 0; this.p2Hp = 0;
    this.act = null; this.hover = false; this.beam = null; this.grenade = null; this.beamLoop = null;
    this.dodged = new WeakSet(); this.dying = false; this.dyingT = 0; this.boomT = 0;
    this.kite = chance(0.5) ? 1 : -1;
    this.riseV = 0; this.ko = null; this.koT = 0; this.intro = null;
    this.cds.guard = 2;
  }

  // Melee duel test mode: full health, and the enrage cutscene plays as soon as it lands.
  startDuel() { this.duel = true; }
  // Entry cutscene: the street rumbles, a beacon of energy erupts, it kneels inside it, stands, and its title hits.
  cinematicIntro() { this.intro = { t: 0, ct: 0, stage: 'gather', done: {}, started: false }; this.facing = sign(Game.player.x - this.x) || -1; }

  // ---------- damage hooks used by hurtEnemy ----------
  shielded() { return this.shield && !this.dying; }
  dodging() { return this.dashT > 0 || this.dodgeT > 0; }
  // The stun window is the payoff in phase 1; hits while it's merely unshielded count for less.
  damageTakenMul() { return this.stunT > 0 ? 1.3 : this.phase === 1 && !this.shield ? 0.6 : 1; }
  // In phase 2 your parry is met blade to blade: no counter, and it raises a guard instead.
  clashes() { return this.phase === 2 && !(this.act && this.act.move === 'riposte'); }
  // Later combos come faster as its health drops.
  rageGap() { return this.phase === 2 ? lerp(1.8, 0.8, clamp(1 - this.hp / (this.p2Hp || this.maxHp), 0, 1)) : 1; }
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
    // bolts sent back into the shield crack it; three cracks break it like a rebounded grenade
    if (o.cause === 'reflect' && this.phase === 1 && !this.dying) {
      this.cracks++;
      FX.ring(this.x, this.cy, 4, 18, 0.2, { c: '#ffffff', core: '#4af0ff', w: 1 });
      FX.text('CRACK ' + this.cracks + '/3', this.x, this.y - 40, { c: '#ffffff', always: true, dur: 0.8, vy: -22 });
      Sound.play('reflect');
      if (this.cracks >= 3) { this.breakShield(); return; }
    }
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
    this.shield = false; this.shieldDownT = 10; this.cracks = 0;
    this.stunFor(3.2);
    this.vx = -this.facing * 120; this.vy = -180;
    FX.ring(this.x, this.cy, 4, 60, 0.45, { c: '#4af0ff', core: '#ffffff', w: 2 });
    FX.sparks(this.x, this.cy, 40, 0, TAU, 80, 320, { c0: '#ffffff', c1: '#7af0ff', c2: '#145e6a' });
    FX.elec(this.x, this.cy, 30, 10, { outer: '#2ab8d8', core: '#ffffff' });
    FX.light(this.x, this.cy, 160, '#4af0ff', 1, 0.5);
    FX.flash('#bff8ff', 0.35);
    Sound.play('bossShieldBreak');
    Game.slowmo(0.25, 0.55, true);
    Game.shake(0.6);
    Game.hitstop(0.1);
    Game.announce('SHIELD DOWN', 'STRIKE NOW', '#4af0ff', 1.6);
  }
  restoreShield() {
    this.shield = true; this.cracks = 0;
    FX.ring(this.x, this.cy, 30, 6, 0.4, { c: '#4af0ff', core: '#ffffff', w: 1 });
    Sound.play('shieldUp');
    Game.announce('SHIELD RESTORED', 'TETHER ITS GRENADE, KICK IT BACK', '#4af0ff', 1.3, true);
  }
  pulseHit() {
    if (this.dying || this.transT > 0) return;
    if (this.shield) this.breakShield();
    else hurtEnemy(this, 60, { cause: 'barrel', heavy: true, kx: 0, ky: -150, angle: -Math.PI / 2, crit: true });
  }
  stunFor(dur) {
    this.stunT = dur; this.flinchT = 0; this.guardT = 0; this.parryInvulnT = 0;
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
        Game.slowmo(0.25, 0.5, true);
        Game.announce('STAGGERED', 'PUNISH IT', '#ffd070', 1.4);
        return;
      }
      // blades lock and it raises a guard, ready to parry whatever you throw next
      this.raiseGuard(1.4, 'clash');
      this.vx += kx / 4;
      return;
    }
    this.flinchT = 0.7; this.hurtT = 0.7;
    this.act = null; this.attack = null; this.hover = false; this.beam = null; this.lungeT = 0;
    this.vx += kx / 3;
  }
  // Phase 2 guard: anything swung into it is parried and answered with a riposte.
  // why: 'clash' (you parried its swing), 'read' (it saw your attack coming), 'stance' (it waits for you to commit).
  raiseGuard(dur, why) {
    this.attack = null; this.lungeT = 0;
    this.act = { kind: 'guard', t: 0, why };
    this.guardT = dur;
    this.facing = sign(Game.player.x - this.x) || this.facing;
    const [cx, cy] = this.chest();
    FX.ring(cx, cy, 22, 12, 0.25, { c: '#4af0ff', core: '#ffffff', w: 1 });
    FX.light(cx, cy, 60, '#4af0ff', 0.9, 0.3);
    Sound.play('guardUp');
    if (why === 'clash') { Sound.play('clash'); Game.bulletTime(0.3, { kind: 'clash', scale: 0.3, owner: this }); }
  }
  // 0..1 through the riposte wind-up, timed so the cue ring closes just before the blade lands.
  riposteCue() {
    const a = this.act;
    if (!a || a.move !== 'riposte' || a.phase !== 'wind') return 1;
    return clamp(a.t / Math.max(0.05, this.tele(a.m.wind) - 0.04), 0, 1);
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
    Game.shake(0.2);
    if (!p.dead) { p.vx = sign(p.x - this.x || 1) * 170; p.vy = Math.min(p.vy, -80); }
    this.startMove('riposte', null);
    // the world drains to grey, it glows gold, and a ring closes on you: parry as the ring closes
    const real = this.tele(RIVAL_MOVES.riposte.wind) / RIPOSTE_BT_SCALE;
    Game.bulletTime(real + 0.2, { kind: 'riposte', scale: RIPOSTE_BT_SCALE, owner: this });
    Sound.play('riposteCue', { dur: real + 0.06 });
    Game.announce('COUNTERED', 'PARRY AS THE RING CLOSES', '#ffd070', 1.0, true);
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
      if (this.intro) { this.updateIntro(dt); return; }
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        FX.ring(this.x, this.y - 2, 3, 46, 0.4, { sy: 0.35, c: '#4af0ff', core: '#ffffff', w: 2 });
        FX.sparks(this.x, this.cy, 30, -Math.PI / 2, TAU, 60, 260, { c0: '#ffffff', c1: '#4af0ff', c2: '#145e6a' });
        FX.dust(this.x, this.y, 14, { smax: 90 });
        FX.decal('crack', this.x, this.y, { len: 22, n: 7 });
        Sound.play('shockwave', { power: 0.8 });
        Sound.play('bossRoar');
        Game.shake(0.45);
        this.arrive(true);
      }
      return;
    }
    for (const k in this.cds) this.cds[k] -= dt * (k === 'dash' || k === 'zip' ? 1 : S.enemies.aggression);
    for (const k of ['flinchT', 'hurtT', 'spinT', 'postPose', 'dodgeT', 'jumpCD', 'deflectT', 'guardT', 'parryInvulnT', 'transT']) if (this[k] > 0) this[k] = Math.max(0, this[k] - dt);
    if (this.dashCharges < 2) { this.dashRecharge += dt; if (this.dashRecharge >= 1.2) { this.dashCharges++; this.dashRecharge = 0; } }
    // the riposte's bullet time lasts exactly as long as its wind-up
    const a0 = this.act;
    if (Game.btOwner === this && Game.btKind === 'riposte' && !(a0 && a0.move === 'riposte' && a0.phase === 'wind')) Game.endBulletTime();
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
  // Half health: a shockwave throws the player clear, then the enrage cutscene plays.
  enterPhase2(quick = false) {
    this.phase = 2; this.p2Hp = this.hp;
    if (quick) {
      // straight into the blade phase: duel retries skip the cutscene
      this.pal = AEGIS_PAL_P2; this.shield = false; this.act = null; this.transT = 0.3; this.cds.combo = 1.2;
      FX.ring(this.x, this.cy, 4, 60, 0.4, { c: '#ff6a7a', core: '#ffffff', w: 2 });
      Sound.play('bossRoar');
      Game.announce('MELEE DUEL', 'PARRY A SWING, THEN PARRY ITS RIPOSTE', '#ff6a7a', 2.2);
      return;
    }
    const hadShield = this.shield, p = Game.player;
    this.shield = false; this.stunT = 0; this.flinchT = 0; this.guardT = 0; this.parryInvulnT = 0;
    this.attack = null; this.beam = null; this.hover = false; this.tether = null; this.lungeT = 0; this.dashT = 0; this.riseV = 0;
    this.act = { kind: 'enrage', t: 0, done: {}, stage: 'brace' };
    this.transT = 99; this.cds.combo = 0.4;
    this.stopLoops();
    // anything still in the air fizzles out
    for (const b of Game.projectiles) {
      if (b.dead || !(b.hostile || b.owner === this)) continue;
      b.dead = true;
      FX.sparks(b.x, b.y, 6, 0, TAU, 40, 140, { c0: '#ffffff', c1: '#7af0ff', c2: '#145e6a' });
    }
    const cx = this.x, cy = this.cy;
    FX.ring(cx, cy, 6, 150, 0.55, { c: '#ff6a7a', core: '#ffffff', w: 3 });
    FX.ring(cx, cy, 4, 100, 0.45, { c: '#4af0ff', core: '#ffffff', w: 2 });
    FX.ring(cx, this.y - 1, 6, 130, 0.5, { sy: 0.3, c: '#ff6a7a', core: '#ffd0d8', w: 2 });
    if (hadShield) FX.sparks(cx, cy, 40, 0, TAU, 120, 360, { c0: '#ffffff', c1: '#7af0ff', c2: '#145e6a' });
    FX.sparks(cx, cy, 30, 0, TAU, 80, 300, { c0: '#ffffff', c1: '#ff6a7a', c2: '#145e6a' });
    FX.dust(cx, this.y, 24, { smin: 60, smax: 200, rise: 6, r1: 6 });
    FX.light(cx, cy, 220, '#ff6a7a', 1, 0.5);
    FX.flash('#ffffff', 0.45);
    Sound.play('bossShieldBreak');
    Sound.play('shockwave', { power: 1 });
    Game.shake(0.7);
    Game.hitstop(0.1);
    p.blastAway(this.x, clamp(1.25 - Math.abs(p.x - this.x) / 320, 0.35, 1));
    if (!p.dead) Game.startCine({ kind: 'enrage', focus: this, owner: this });
  }
  runEnrage(dt, a, p) {
    const C = Game.cine, own = C && C.owner === this, ct = own ? C.t : a.t;
    const once = (k) => (a.done[k] ? false : (a.done[k] = true));
    this.facing = sign(p.x - this.x) || this.facing;
    const [cx, cy] = this.chest();
    if (ct < 0.55) a.stage = 'brace';
    else if (ct < 1.75) {
      a.stage = 'charge';
      if (once('rise')) { this.hover = true; this.onGround = false; Sound.play('enrageCharge'); }
      this.riseV = ct < 1.4 ? -16 : 0;
      if (Math.random() < 0.7) FX.elec(cx, cy, 12 + (ct - 0.55) * 16, 1, { outer: '#ff6a7a', core: '#ffffff' });
      if (Math.random() < 0.5) FX.sparks(this.x + rand(-8, 8), this.y, 1, -Math.PI / 2, 0.6, 40, 140, { c0: '#ffffff', c1: '#ff6a7a', c2: '#145e6a', g: -120 });
      [0.8, 1.05, 1.3].forEach((tt, i) => { if (ct >= tt && once('pop' + i)) this.limiterPop(i); });
    } else if (ct < 2.85) {
      a.stage = 'roar';
      if (once('roar')) this.roar();
      this.riseV = 0;
      if (Math.random() < 0.8) FX.sparks(cx, cy, 2, rand(0, TAU), TAU, 80, 260, { c0: '#ffffff', c1: '#ff6a7a', c2: '#5a0c1a' });
      if (Math.random() < 0.35) { const ang = rand(0, TAU); FX.bolt(cx, cy, cx + Math.cos(ang) * 40, cy + Math.sin(ang) * 40, 0.08, { outer: '#ff3a52', core: '#ffffff', jag: 6 }); }
      Game.shake(0.012);
    } else {
      a.stage = 'land';
      if (once('drop')) { this.hover = false; this.riseV = 0; this.vy = 260; if (own) C.zoom = 1; }
      if (this.onGround && once('slam')) {
        FX.dust(this.x, this.y, 18, { smin: 40, smax: 150, rise: 6, r1: 5 });
        FX.debris(this.x, this.y - 1, 12, ['#4a4252', '#5c5464', '#3a3442'], 180);
        FX.decal('crack', this.x, this.y, { len: 24, n: 7, dur: 8 });
        FX.ring(this.x, this.y - 1, 4, 70, 0.4, { sy: 0.3, c: '#ff6a7a', core: '#ffd0d8', w: 2 });
        Sound.play('slam'); Sound.play('thud');
        Game.shake(0.45);
      }
      if (ct >= 3.4 && once('close')) this.endEnrage();
    }
    return { mx: 0 };
  }
  limiterPop(i) {
    const spots = [[-5, -18], [4, -15], [-3, -9]], [ox, oy] = spots[i % 3];
    const x = this.x + ox * this.facing, y = this.y + oy;
    FX.debris(x, y, 6, ['#3c4760', '#7a8aa6', '#1c2130', '#c8d6ea'], 220);
    FX.sparks(x, y, 14, rand(0, TAU), TAU, 80, 260, { c0: '#ffffff', c1: '#ff6a7a', c2: '#145e6a' });
    FX.ring(x, y, 2, 14, 0.2, { c: '#ff6a7a', core: '#ffffff', w: 1 });
    Sound.play('limiterPop');
    Game.shake(0.15);
  }
  roar() {
    const C = Game.cine;
    if (C && C.owner === this) { C.zoom = 2; C.caption = { text: 'LIMITERS OFF', color: '#ff6a7a', sub: 'NO SHIELD, NO GUNS. BLADE ONLY.' }; }
    this.pal = AEGIS_PAL_P2;
    const [cx, cy] = this.chest();
    FX.flash('#ffffff', 0.6);
    FX.ring(cx, cy, 4, 120, 0.6, { c: '#ff6a7a', core: '#ffffff', w: 2 });
    FX.ring(cx, cy, 2, 70, 0.45, { c: '#ff3a52', core: '#ffd0d8', w: 1 });
    FX.sparks(cx, cy, 50, 0, TAU, 100, 340, { c0: '#ffffff', c1: '#ff6a7a', c2: '#5a0c1a' });
    FX.elec(cx, cy, 40, 14, { outer: '#ff3a52', core: '#ffffff' });
    FX.light(cx, cy, 200, '#ff3048', 1, 0.9);
    Sound.play('enrageRoar');
    Sound.play('bossRoar');
    Game.shake(0.7);
    Game.hitstop(0.05);
  }
  endEnrage() {
    Game.closeCine();
    // a breather before the first combo
    this.act = null; this.transT = 0.3; this.cds.combo = 1.2; this.riseV = 0; this.hover = false;
    Game.announce(this.duel ? 'MELEE DUEL' : 'PHASE 2', 'PARRY A SWING, THEN PARRY ITS RIPOSTE', '#ff6a7a', 2.2);
  }
  chooseAct(p) {
    const dx = p.x - this.x, adx = Math.abs(dx), dy = p.y - this.y;
    if (p.dead) return;
    if (this.phase === 2) {
      if (this.cds.combo <= 0 && Math.abs(dy) < 40 && adx < 150) {
        // sometimes it opens with a guard and waits for you to swing into it
        if (adx < 120 && this.cds.guard <= 0 && chance(0.3)) { this.raiseGuard(rand(1.3, 1.8), 'stance'); this.cds.guard = rand(5, 8); return; }
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
        if ((this.duel || this.trainP2) && this.phase === 1 && a.t > 0.35) { this.enterPhase2(!!this.trainP2 || (Game.runs.duel || 0) > 1); return { mx: 0 }; }
        if (a.t > 1.1) this.act = null;
        return { mx: 0 };
      case 'enrage': return this.runEnrage(dt, a, p);
      case 'guard': {
        this.facing = sign(p.x - this.x) || this.facing;
        if (Math.random() < 0.4) FX.sparks(this.x + this.facing * 8, this.y - 13, 1, -Math.PI / 2, 1.5, 20, 60, { c0: '#ffffff', c1: '#4af0ff', c2: '#145e6a', g: 0 });
        // waiting it out works: the guard drops and it attacks straight away
        if (this.guardT <= 0) { this.act = null; this.cds.combo = a.why === 'stance' ? 0 : 0.2; }
        const creep = a.why === 'stance' && Math.abs(p.x - this.x) > 40;
        return { mx: creep ? sign(p.x - this.x) * 0.3 : 0 };
      }
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
      const wind = this.tele(m.wind);
      if (!a.glinted && a.t >= Math.max(0, wind - GLINT_LEAD)) {
        a.glinted = true;
        const col = a.move === 'riposte' ? '#ffd070' : this.phase === 2 ? '#ff9aaa' : '#9af4ff';
        const at = this._bladeGlint || this.chest();
        FX.glint(at[0], at[1], { c: col, size: 1.25, follow: () => this._bladeGlint });
        Sound.play('glint');
      }
      if (a.t >= wind) {
        a.phase = 'swing'; a.t = 0; a.hit = false; a.quaked = false;
        if (a.move === 'riposte' && Game.btOwner === this) Game.endBulletTime();
        let ang = this.aimAngle, dir = this.facing;
        if (m.spin) ang = -Math.PI / 2;
        if (m.rising) dir = -this.facing;
        if (m.thrust) { ang = this.facing > 0 ? 0 : Math.PI; this.lungeT = 0.16; this.lungeV = this.facing * 560; }
        else if (a.move === 'riposte') {
          // the riposte closes whatever gap your counter opened
          const gap = Math.max(0, Math.abs(p.x - this.x) - 18);
          this.lungeT = 0.14; this.lungeV = this.facing * Math.min(2200, gap / 0.14);
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
        this.act = { kind: 'recover', t: 0, dur: this.phase === 2 ? rand(0.55, 0.85) * this.rageGap() : 0.4 };
        this.cds.combo = rand(0.3, 0.8) * this.rageGap();
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
    if (mx && this.onGround && this.col && (this.col.wallL || this.col.wallR) && this.jumpCD <= 0) { jump = true; this.jumpCD = 0.3; }
    if (dy < -110 && this.cds.zip <= 0 && !this.act) this.zipTo(p);
    if (dy > 40 && this.onGround && Level.onOneWay(this)) drop = true;
    const closeIn = style === 'press' ? 150 : 280;
    if (adx > closeIn && this.cds.dash <= 0 && this.dashCharges > 0 && Math.abs(dy) < 60) this.dash(sign(dx), 0);
    return { mx: mx * speedMul, jump, drop };
  }
  react(p) {
    // with the shield down it answers incoming swings like a player would
    // only while idle or approaching: its recovery is your punish window, so it never rolls out of it
    if (this.shield || this.act || this.cds.dodge > 0) return;
    const threat = p.attack || p.iaido;
    if (!threat || this.dodged.has(threat) || dist(p.x, p.y, this.x, this.y) >= 70) return;
    this.dodged.add(threat);
    const r = Math.random();
    // phase 2 reads attacks, heavies most of all, and blocks them to start the riposte exchange
    const block = this.phase === 2 && this.cds.guard <= 0 ? (threat.heavy || (threat.cfg && threat.cfg.heavy) ? 0.55 : 0.25) : 0;
    if (r < block) { this.raiseGuard(0.6, 'read'); this.cds.guard = rand(3, 5); this.cds.dodge = 1.5; return; }
    if (this.dashCharges > 0 && r < block + (this.phase === 2 ? 0.25 : 0.4)) { this.dash(-sign(p.x - this.x) || 1, -0.3); this.cds.dodge = 2.5; }
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
      this.vy = approach(this.vy, this.riseV || Math.sin(this.t * 4) * 8, 600 * dt);
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

  // ---------- entry ----------
  // From here it fights. quick: the short beam drop (training, duel retries); otherwise the cutscene showed the title.
  arrive(quick) {
    this.spawning = false;
    if (!this.duel && !this.trainP2) {
      if (quick) Game.announce(this.name, 'TETHER ITS GRENADE, KICK IT BACK', '#4af0ff', 2.6);
      else Game.announce('TETHER ITS GRENADE', 'THEN KICK IT BACK INTO AEGIS', '#4af0ff', 2.6, true);
    }
    this.act = { kind: 'intro', t: quick ? 0 : 0.6 };
  }
  updateIntro(dt) {
    const I = this.intro, p = Game.player;
    if (!I.started) {
      I.started = true;
      if (!p.dead) Game.startCine({ kind: 'rivalIntro', focus: this, owner: this, camOY: -26 });
    }
    const C = Game.cine, own = C && C.owner === this;
    I.t += dt;
    const ct = (I.ct = own ? C.t : I.t);
    const once = (k) => (I.done[k] ? false : (I.done[k] = true));
    const x = this.x, gy = this.y, CY = { c0: '#ffffff', c1: '#4af0ff', c2: '#145e6a' };
    const grit = ['#4a4252', '#5c5464', '#3a3442', '#6e6678'];
    this.facing = sign(p.x - this.x) || this.facing;
    if (ct < 0.75) {
      I.stage = 'gather';
      if (once('rumble')) { Sound.play('beaconRumble'); FX.decal('crack', x, gy, { len: 14, n: 6, dur: 14 }); }
      // energy crawls in along the street and motes rise off the cracks
      if (Math.random() < 0.8) {
        const s = chance(0.5) ? 1 : -1, d = rand(24, 70);
        FX.sparks(x + s * d, gy - 1, 1, s > 0 ? Math.PI : 0, 0.2, d * 1.6, d * 2, Object.assign({ g: 0, life: 1.6 }, CY));
      }
      if (Math.random() < 0.5) FX.sparks(x + rand(-8, 8), gy - 1, 1, -Math.PI / 2, 0.4, 30, 90, Object.assign({ g: -40, life: 1.4 }, CY));
      if (Math.random() < 0.15) FX.debris(x + rand(-20, 20), gy - 1, 1, grit, 60);
      Game.shake(0.012 + ct * 0.02);
    } else if (ct < 2.0) {
      I.stage = 'erupt';
      if (once('erupt')) {
        Sound.play('beaconErupt');
        FX.flash('#bff8ff', 0.55);
        FX.ring(x, gy - 1, 4, 120, 0.6, { sy: 0.3, c: '#4af0ff', core: '#ffffff', w: 2 });
        FX.ring(x, gy - 1, 3, 70, 0.45, { sy: 0.3, c: '#ffffff', core: '#bff8ff', w: 1 });
        FX.debris(x, gy - 1, 34, grit, 340);
        FX.dust(x, gy, 26, { smin: 60, smax: 220, rise: 10, r1: 7 });
        FX.decal('crack', x, gy, { len: 32, n: 9, dur: 14 });
        FX.sparks(x, gy - 10, 50, -Math.PI / 2, 1.2, 120, 440, CY);
        FX.light(x, gy - 60, 260, '#4af0ff', 1, 0.8);
        Game.shake(0.75);
      }
      if (Math.random() < 0.9) FX.sparks(x + rand(-7, 7), gy - rand(0, 120), 1, -Math.PI / 2, 0.3, 120, 300, Object.assign({ g: -100 }, CY));
      if (Math.random() < 0.25) {
        const yy = gy - rand(10, 130), s = chance(0.5) ? 1 : -1;
        FX.bolt(x + s * 8, yy, x + s * rand(24, 50), yy + rand(-20, 20), 0.08, { outer: '#2ab8d8', core: '#ffffff', jag: 6 });
      }
      if (Math.random() < 0.3) FX.debris(x + rand(-14, 14), gy - 1, 1, grit, 200);
      if ((I.pulse = (I.pulse || 0) - dt) <= 0) { I.pulse = 0.32; FX.ring(x, gy - 1, 6, 50, 0.35, { sy: 0.3, c: '#4af0ff', core: '#ffffff', w: 1 }); }
      Game.shake(0.025);
    } else if (ct < 2.55) {
      I.stage = 'emerge';
      if (once('emerge')) Sound.play('enrageCharge');
      if (Math.random() < 0.6) FX.sparks(x + rand(-5, 5), gy - rand(0, 24), 1, -Math.PI / 2, 0.5, 60, 160, Object.assign({ g: -60 }, CY));
    } else if (ct < 3.1) {
      I.stage = 'rise';
      if (once('reveal')) {
        FX.ring(x, this.cy, 4, 70, 0.4, { c: '#4af0ff', core: '#ffffff', w: 2 });
        FX.sparks(x, this.cy, 40, 0, TAU, 80, 300, CY);
        FX.elec(x, this.cy, 26, 10, { outer: '#2ab8d8', core: '#ffffff' });
        FX.flash('#ffffff', 0.4);
        Sound.play('shockwave', { power: 0.6 });
        Sound.play('shieldUp');
        Game.shake(0.4);
      }
      if (ct >= 2.85 && once('visor')) {
        const [vx, vy] = this.visorPos();
        FX.light(vx, vy, 40, '#4af0ff', 1, 0.4);
        FX.ring(vx, vy, 1, 10, 0.2, { c: '#4af0ff', core: '#ffffff', w: 1 });
        Sound.play('glint');
      }
    } else {
      I.stage = 'title';
      if (once('title')) {
        if (own) { C.zoom = 2; C.zoomOY = 10; C.big = { style: 'title', text: this.name, color: '#4af0ff', tag: 'RIVAL FRAME', sub: this.duel ? 'MELEE DUEL' : 'SECTOR 9 ENFORCER' }; C.bigT = 0; }
        Sound.play('titleHit');
        Sound.play('bossRoar');
        FX.ring(x, this.cy, 4, 90, 0.5, { c: '#4af0ff', core: '#ffffff', w: 2 });
        FX.dust(x, gy, 16, { smin: 40, smax: 150, rise: 6, r1: 5 });
        Game.shake(0.5);
      }
      if (Math.random() < 0.3) FX.sparks(x + rand(-6, 6), gy - rand(4, 20), 1, -Math.PI / 2, 1, 20, 60, Object.assign({ g: -40 }, CY));
      if (ct >= 4.8 && once('end')) this.endIntro();
    }
    this.updateScarf(dt);
  }
  endIntro() {
    this.intro = null;
    if (Game.cine && Game.cine.owner === this) Game.closeCine();
    this.arrive(false);
  }
  introPose(o) {
    const I = this.intro, ct = I.ct;
    if (I.stage === 'rise') {
      // stands up out of the kneel
      const k = easeOutCubic(clamp((ct - 2.6) / 0.45, 0, 1));
      o.lean = lerp(0.35, 0.05, k); o.hipY = lerp(-6, -10, k); o.fF = [5, -1]; o.fB = [lerp(-6, -5, k), -1];
      o.hF = [lerp(5, 6, k), lerp(-16, -9, k)]; o.hB = [lerp(1, -3, k), lerp(-7, -8, k)]; o.swordAng = lerp(0.9, 2.2, k);
    } else if (I.stage === 'title') {
      o.hF = [7, -17]; o.hB = [-7, -17]; o.swordAng = -1.0; o.fF = [5, -1]; o.fB = [-5, -1]; o.tremble = ct < 3.6 ? 1 : 0;
    } else {
      // kneeling on its blade inside the beam
      o.lean = 0.35; o.hipY = -6; o.fF = [5, -1]; o.fB = [-6, -1]; o.hF = [5, -16]; o.hB = [1, -7]; o.swordAng = 0.9;
    }
    return true;
  }
  drawIntro(ctx, x, y) {
    const I = this.intro, ct = I.ct, t = this.t, top = -12;
    if (I.stage === 'gather') {
      // light pools at the spawn point; a thread from the sky flickers in at the end
      const k = ct / 0.75;
      ctx.fillStyle = '#145e6a'; pring(ctx, x, y - 1, 6 + k * 22, 0.25, 2);
      ctx.fillStyle = ((t * 20) | 0) % 2 ? '#4af0ff' : '#bff8ff'; pring(ctx, x, y - 1, 3 + k * 16, 0.25, 1);
      if (k > 0.55 && ((t * 30) | 0) % 3) { ctx.fillStyle = '#4af0ff'; ctx.fillRect(Math.round(x), top, 1, Math.round(y - top)); }
      return;
    }
    let W = 0;
    if (I.stage === 'erupt') W = 4 + 16 * easeOutBack(clamp((ct - 0.75) / 0.2, 0, 1)) + Math.sin(t * 50) * 1.5;
    else if (I.stage === 'emerge') W = lerp(20, 9, clamp((ct - 2.0) / 0.4, 0, 1)) + Math.sin(t * 50);
    else W = (1 - clamp((ct - 2.55) / 0.12, 0, 1)) * 9;
    if (W > 0.5) this.drawBeam(ctx, x, y, top, W, t);
    // a dark figure inside the light
    if (I.stage === 'emerge' && this.spriteCopy) Sprite.outlined(ctx, this.spriteCopy, x, y, '#ffffff', { fill: '#0b0910' });
  }
  drawBeam(ctx, x, y, top, W, t) {
    const xi = Math.round(x), h = Math.round(y - top);
    const band = (w, col) => { const ww = Math.max(1, Math.round(w)); ctx.fillStyle = col; ctx.fillRect(xi - (ww >> 1), top, ww, h); };
    ctx.globalAlpha = 0.45; band(W + 10, '#145e6a'); ctx.globalAlpha = 1;
    band(W + 2, '#2ab8d8'); band(W * 0.7, '#7af0ff'); band(Math.max(2, W * 0.35), '#ffffff');
    // pulses racing up the column
    ctx.fillStyle = '#ffffff';
    const bw = Math.round(W + 4);
    for (let i = 0; i < 5; i++) ctx.fillRect(xi - (bw >> 1), Math.round(y - ((t * 340 + i * 53) % (h + 20))), bw, 2);
    // ragged edges
    ctx.fillStyle = '#bff8ff';
    for (let yy = top; yy < y; yy += 3) {
      if (Math.random() < 0.3) ctx.fillRect(xi + (Math.random() < 0.5 ? -1 : 1) * Math.round(W / 2 + 1 + Math.random() * 3), yy, 1, 2);
    }
    // flared base
    ctx.fillStyle = '#4af0ff'; pring(ctx, x, y - 1, W * 1.4 + Math.sin(t * 30) * 2, 0.3, 2);
    ctx.fillStyle = '#ffffff'; pring(ctx, x, y - 1, W * 0.8, 0.3, 1);
  }

  // ---------- knockout ----------
  // The last hit freezes into slow motion, then it staggers, kneels on its blade and collapses.
  onDeath(o = {}) {
    if (this.dying) return;
    this.dying = true; this.hp = 0; this.koT = 0;
    this.act = null; this.attack = null; this.beam = null; this.hover = false; this.tether = null; this.lungeT = 0; this.dashT = 0;
    this.stunT = 0; this.flinchT = 0; this.guardT = 0; this.riseV = 0;
    this.stopLoops();
    this.ko = { stage: 'impact', done: {}, rot: 0 };
    const p = Game.player;
    this.facing = sign(p.x - this.x) || this.facing;
    this.vx = -this.facing * 160; this.vy = -140; this.onGround = false;
    for (const b of Game.projectiles) if (!b.dead && (b.hostile || b.owner === this)) b.dead = true;
    const [cx, cy] = this.chest(), ang = o.angle !== undefined ? o.angle : -0.5;
    // keep the close-up clean: no damage numbers over the knockout
    FX.texts = FX.texts.filter((q) => dist(q.x, q.y, this.x, this.y) > 60);
    FX.slashLine(cx - Math.cos(ang) * 46, cy - Math.sin(ang) * 46, cx + Math.cos(ang) * 46, cy + Math.sin(ang) * 46, { w: 5, dur: 0.22, grow: 0.01, pal: PALETTES.gold });
    FX.ring(cx, cy, 4, 90, 0.8, { c: '#ffd070', core: '#ffffff', w: 2 });
    FX.ring(cx, cy, 2, 50, 0.6, { c: '#ff6a7a', core: '#ffffff', w: 1 });
    FX.sparks(cx, cy, 60, ang, 2.2, 80, 420, { c0: '#ffffff', c1: '#ffe080', c2: '#ff5a3a' });
    FX.elec(cx, cy, 30, 10, { outer: '#ff3a52', core: '#ffffff' });
    FX.light(cx, cy, 200, '#ffffff', 1, 0.9);
    FX.flash('#ffffff', 0.7);
    Sound.play('koHit');
    Sound.setIntensity(0);
    Game.hitstop(0.12);
    Game.slowmo(0.12, 1.3, true);
    Game.shake(0.6);
    if (!p.dead) Game.startCine({ kind: 'ko', focus: this, owner: this, zoom: 2 });
  }
  updateDying(dt) {
    const K = this.ko, C = Game.cine, own = C && C.owner === this;
    this.koT += dt;
    const ct = own ? C.t : this.koT * 2.5;
    const once = (k) => (K.done[k] ? false : (K.done[k] = true));
    this.vx = approach(this.vx, 0, (this.onGround ? 600 : 120) * dt);
    this.vy = Math.min(this.vy + 960 * dt, 430);
    Level.moveBody(this, dt);
    this.updateScarf(dt);
    const [cx, cy] = this.chest();
    const CYAN = { outer: '#2ab8d8', core: '#ffffff' };
    if (ct < 1.3) {
      K.stage = 'impact';
      if (Math.random() < 0.5) FX.sparks(cx, cy, 2, rand(0, TAU), TAU, 60, 220, { c0: '#ffffff', c1: '#ffe080', c2: '#ff5a3a' });
      if (Math.random() < 0.3) FX.elec(cx, cy, 16, 1, { outer: '#ff3a52', core: '#ffffff' });
    } else if (ct < 2.1) {
      K.stage = 'stagger';
      if (once('stagger')) { if (own) C.zoom = 1; this.vx = -this.facing * 50; Sound.play('limiterPop'); FX.elec(cx, cy, 20, 6, CYAN); }
      if (Math.random() < 0.25) FX.elec(cx, cy, 12, 1, CYAN);
      if (Math.random() < 0.2) FX.sparks(cx, cy, 1, rand(0, TAU), TAU, 40, 140, { c0: '#ffffff', c1: '#7af0ff', c2: '#145e6a' });
    } else if (ct < 3.1) {
      K.stage = 'kneel';
      if (once('kneel')) { Sound.play('thud'); FX.dust(this.x, this.y, 8, { smax: 50 }); Game.shake(0.2); }
      this.pal = ((ct * 12) | 0) % 3 ? AEGIS_PAL_P2 : AEGIS_PAL_KO;
      if (Math.random() < 0.15) FX.elec(cx, cy, 10, 1, CYAN);
    } else if (ct < 3.45) {
      K.stage = 'collapse'; K.rot = clamp((ct - 3.1) / 0.35, 0, 1);
      this.pal = AEGIS_PAL_KO;
    } else {
      K.stage = 'down'; K.rot = 1; this.pal = AEGIS_PAL_KO;
      const hx = this.x + this.facing * 10;
      if (once('down')) {
        Sound.play('thud'); Sound.play('slam');
        FX.dust(hx, this.y, 16, { smin: 30, smax: 90, rise: 4, r1: 5 });
        FX.debris(hx, this.y - 1, 8, this.def.debris, 120);
        FX.decal('crack', hx, this.y, { len: 18, n: 6, dur: 10 });
        Game.shake(0.35);
      }
      if (ct >= 3.65 && once('big')) {
        if (own) { C.big = { text: 'KNOCKOUT', color: '#ffd070', sub: this.name + ' IS DOWN' }; C.bigT = 0; }
        Sound.play('ko');
        FX.flash('#fff4d0', 0.35);
        Game.shake(0.3);
      }
      if (Math.random() < 0.05) FX.elec(hx, this.y - 3, 8, 1, CYAN);
      if (ct >= 5.4 && once('finish')) this.finishKO();
    }
  }
  // Hold-to-skip from Game: jump to the end of whichever cutscene this rival is running.
  skipCine() {
    if (this.intro) { this.endIntro(); return; }
    if (this.act && this.act.kind === 'enrage') {
      this.pal = AEGIS_PAL_P2; this.hover = false; this.riseV = 0; this.vy = 300;
      this.endEnrage();
    } else if (this.dying && this.ko && !this.dead) {
      this.ko.stage = 'down'; this.ko.rot = 1; this.pal = AEGIS_PAL_KO; this.vx = 0;
      // draw once so the husk keeps the lying pose
      this.draw(makeCanvas(VIEW_W, VIEW_H).ctx, this.x - VIEW_W / 2, this.y - VIEW_H / 2);
      this.finishKO();
    }
  }
  finishKO() {
    this.dead = true;
    this.stopLoops();
    if (this.spriteCopy) Game.props.push(new RivalHusk(this));
    Game.onKill(this, { cause: 'boss' });
    Game.closeCine();
    Sound.setIntensity(0.3);
    // the duel and training are practice, so only a full fight unlocks the character
    if (this.duel || Game.mode === 'training') return;
    SaveData.unlocks.aegis = true;
    SaveData.bossKills++;
    saveProgress();
    Game.announce('AEGIS-07 UNLOCKED', 'DEFEATED RIVALS JOIN YOUR ROSTER', '#ffd070', 3);
  }
  koPose(o) {
    const K = this.ko;
    switch (K.stage) {
      case 'impact':
        o.lean = -0.55; o.fF = [5, -2]; o.fB = [-5, -1]; o.hF = [-5, -19]; o.hB = [-8, -13]; o.swordAng = -2.5;
        if (!this.onGround) { o.fF = [4, -5]; o.fB = [-3, -3]; }
        break;
      case 'stagger':
        o.lean = -0.2 + Math.sin(this.t * 9) * 0.08; o.hipY = -9; o.fF = [3, -1]; o.fB = [-6, -1];
        o.hF = [3, -5]; o.hB = [-3, -5]; o.swordAng = 1.9;
        break;
      case 'kneel':
        o.lean = 0.35; o.hipY = -6; o.fF = [5, -1]; o.fB = [-6, -1]; o.hF = [5, -16]; o.hB = [1, -7]; o.swordAng = 0.9;
        break;
      default: {
        // fall forward around the feet: straighten out, arm reaching past the head, blade along the body
        const u = K.rot;
        o.lean = lerp(0.35, 0, u); o.hipY = lerp(-6, -10, u);
        o.fF = [lerp(5, 1, u), -1]; o.fB = [lerp(-6, -1, u), -1];
        o.hF = [lerp(5, 1, u), lerp(-16, -21, u)]; o.hB = [lerp(1, -1, u), lerp(-7, -14, u)];
        o.swordAng = lerp(0.9, 1.72, u);
        o.rot = 1.5 * u * u; o.pivotY = -2.5;
      }
    }
    return true;
  }

  // ---------- drawing ----------
  drawFlash() {
    if (this.hitFlash > 0) return '#ffffff';
    if (this.intro && this.intro.stage === 'rise' && this.intro.ct < 2.7) return '#ffffff';
    if (this.dying && this.ko && this.ko.stage === 'impact' && ((this.t * 40) | 0) % 2) return '#fff4d0';
    if (this.parryInvulnT > 0.3) return '#bff8ff';
    if (this.cutMark && ((this.t * 30) | 0) % 2) return '#4af0ff';
    return null;
  }
  customPose(o, la) {
    const a = this.act;
    if (this.dying && this.ko) return this.koPose(o);
    if (this.intro) return this.introPose(o);
    if (this.stunT > 0) {
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
    if (a.kind === 'enrage') {
      if (a.stage === 'brace') { o.lean = 0.3; o.hipY = -7; o.fF = [6, -1]; o.fB = [-6, -1]; o.hF = [8, -12]; o.hB = [-6, -9]; o.swordAng = 0.3; }
      else if (a.stage === 'charge') {
        const tr = Math.random() < 0.5 ? 0.5 : -0.5;
        o.lean = 0.15; o.hipY = -9 + tr * 0.5; o.fF = [3, -3]; o.fB = [-3, -2]; o.hF = [4, -10]; o.hB = [-4, -10]; o.swordAng = 1.6; o.tremble = 1;
      } else if (a.stage === 'roar') {
        o.lean = -0.45; o.hipY = -10; o.fF = [5, -2]; o.fB = [-5, -2]; o.hF = [9, -18]; o.hB = [-9, -18]; o.swordAng = -0.6; o.tremble = 1;
      } else { o.lean = 0.45; o.hipY = -6; o.fF = [7, -1]; o.fB = [-6, -1]; o.hF = [9, -4]; o.hB = [-4, -7]; o.swordAng = 1.2; }
      return true;
    }
    if (a.kind === 'intro') {
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
    this._bladeGlint = [this.x + (hx + c * L * 0.8) * this.facing, this.y + hy + s * L * 0.8];
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
    // during the entry the body exists from the moment its silhouette shows in the beam
    if (this.spawning && !(this.intro && this.intro.stage !== 'gather' && this.intro.stage !== 'erupt')) return;
    Player.prototype.draw.call(this, ctx, camX, camY);
  }
  drawEmissive(ctx, camX, camY) {
    const x = this.x - camX, y = this.y - camY;
    if (this.spawning && this.intro) {
      this.drawIntro(ctx, x, y);
      if (this.intro.stage !== 'rise' && this.intro.stage !== 'title') return;
    } else if (this.spawning) {
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
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < this.cracks; i++) {
        const a0 = -2.2 + i * 1.6;
        pline(ctx, x + Math.cos(a0) * 14, cy + Math.sin(a0) * 16, x + Math.cos(a0 + 0.3) * 7, cy + Math.sin(a0 + 0.3) * 8, 1);
        pline(ctx, x + Math.cos(a0 + 0.3) * 7, cy + Math.sin(a0 + 0.3) * 8, x + Math.cos(a0 - 0.2) * 3, cy + Math.sin(a0 - 0.2) * 3, 1);
      }
    } else if (this.phase === 1 && !this.dying && this.shieldDownT > 0 && this.shieldDownT < 2 && ((this.t * 10) | 0) % 2) {
      ctx.fillStyle = '#4af0ff';
      pring(ctx, x, cy, 16, 1.1, 1);
    }
    const a = this.act;
    if (a && a.kind === 'guard') {
      // a distinct guard: it glows cyan behind a deflector arc, so its counter-parry isn't a surprise
      if (this.spriteCopy && Game.btOwner !== this) Sprite.outlined(ctx, this.spriteCopy, x, y, ((this.t * 8) | 0) % 2 ? '#4af0ff' : '#bff8ff', { glow: 0.25 });
      const fa = this.facing > 0 ? 0 : Math.PI, ar = 16 + Math.sin(this.t * 14);
      for (let i = -9; i <= 9; i++) {
        const ang = fa + i * 0.12, px = x + Math.cos(ang) * ar, py = y - 11 + Math.sin(ang) * ar * 1.2;
        ctx.fillStyle = Math.abs(i) < 6 ? '#ffffff' : '#4af0ff'; ctx.fillRect(Math.round(px), Math.round(py), 1, 2);
        ctx.fillStyle = '#4af0ff'; ctx.fillRect(Math.round(px - Math.cos(ang)), Math.round(py - Math.sin(ang)), 1, 1);
      }
      ctx.fillStyle = '#4af0ff';
      pring(ctx, x, y - 11, 14 + Math.sin(this.t * 14) * 1.5, 1.3, 1);
      if (((this.t * 16) | 0) % 2) { ctx.fillStyle = '#ffffff'; pline(ctx, x + this.facing * 4, y - 16, x + this.facing * 16, y - 19, 1); }
      if (((this.t * 6) | 0) % 2) drawText(ctx, 'GUARD - BAIT IT', x, y - 38, { color: '#4af0ff', align: 'center', outline: '#0b0910' });
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
        drawBlastZone(ctx, ex - camX, Level.groundBelow(ex, ey) - camY, 56, this.t);
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
    if (this.spawning && this.intro) {
      const st = this.intro.stage;
      if (st === 'gather') { FX.frameLight(this.x, this.y - 4, 30 + this.intro.ct * 40, '#4af0ff', 0.8); return; }
      if (st === 'erupt' || st === 'emerge') { for (let d = 0; d < 220; d += 44) FX.frameLight(this.x, this.y - d, 80, '#4af0ff', 1); return; }
    } else if (this.spawning) { FX.frameLight(this.x, this.y - 30, 80, '#4af0ff', 0.9); return; }
    if (this.dying && this.ko && this.pal === AEGIS_PAL_KO) return;
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

// Ground ellipse showing where a grenade blast will reach.
function drawBlastZone(ctx, x, y, R, t) {
  const blink = ((t * 12) | 0) % 2, n = 44;
  ctx.fillStyle = blink ? '#ffffff' : '#4af0ff';
  for (let i = 0; i < n; i += 2) {
    const a = (i / n) * TAU + t * 0.8;
    ctx.fillRect(Math.round(x + Math.cos(a) * R), Math.round(y + Math.sin(a) * R * 0.22), 2, 1);
  }
  ctx.fillStyle = '#4af0ff';
  pline(ctx, x - 3, y - 2, x + 3, y + 2, 1); pline(ctx, x - 3, y + 2, x + 3, y - 2, 1);
}

// Pulse grenade: lobbed on an arc, it detonates the moment it touches anything. A hostile blast knocks the
// player's shield offline. Tether it in flight to slow time, reel in and kick it back toward the cursor;
// a rebounded grenade breaks the rival's shield. A parry smothers it; any sword hit sets it off.
class PulseGrenade {
  // o: { g, R, dmg, disable (seconds the blast knocks your shield out), size } for smaller throwers
  constructor(x, y, vx, vy, owner, o = {}) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy; this.owner = owner;
    this.fuse = 4; this.t = 0; this.state = 'flying';
    this.hostile = true; this.rebound = true; this.grabR = 11; this.tethered = false; this.dead = false;
    this.indicator = true; this.R = o.R || 56; this.impact = null; this.predT = 0;
    this.g = o.g || GRENADE_G; this.dmg = o.dmg || 14; this.disable = o.disable !== undefined ? o.disable : 6; this.size = o.size || 1;
  }
  get cx() { return this.x; }
  get cy() { return this.y; }
  get tetherable() { return this.state === 'flying' && !this.dead; }
  catch() { this.state = 'caught'; this.hostile = false; this.impact = null; }
  kick(ang) {
    this.state = 'kicked'; this.hostile = false;
    this.vx = Math.cos(ang) * 600; this.vy = Math.sin(ang) * 600;
    this.fuse = Math.max(this.fuse, 2);
  }
  reflect() { this.explode({ blocked: true }); }
  onSlash() {
    Game.announce('TETHER IT FIRST', 'TETHER THE GRENADE, THEN KICK IT BACK', '#4af0ff', 1.8, true);
    this.explode();
  }
  update(dt) {
    this.t += dt;
    if (this.state !== 'caught') this.fuse -= dt;
    if (this.fuse <= 0) { this.explode(); return; }
    if (this.state === 'caught') {
      if (this.tethered) {
        // hangs in the air while you reel in
        const k = Math.max(0, 1 - 5 * dt);
        this.vx *= k; this.vy *= k;
        this.x += this.vx * dt; this.y += this.vy * dt;
        if (Math.random() < 0.6) FX.elec(this.x, this.y, 9, 1, { outer: '#ffb040', core: '#ffffff' });
        return;
      }
      this.state = 'flying'; this.hostile = true;
    }
    const owner = this.owner, kicked = this.state === 'kicked';
    if (kicked && owner && !owner.dead && !owner.dying) {
      // light homing so a rough slash still finds it
      const want = Math.atan2(owner.cy - this.y, owner.x - this.x), cur = Math.atan2(this.vy, this.vx), d = angDiff(cur, want);
      if (Math.abs(d) < 1.0) {
        const na = cur + clamp(d, -2.2 * dt, 2.2 * dt), sp = Math.hypot(this.vx, this.vy);
        this.vx = Math.cos(na) * sp; this.vy = Math.sin(na) * sp;
      }
    }
    this.vy += (kicked ? 120 : this.g) * dt;
    for (let i = 0; i < 3; i++) {
      const py = this.y;
      this.x += (this.vx * dt) / 3; this.y += (this.vy * dt) / 3;
      if (this.contact(py)) return;
    }
    if (this.hostile && (this.predT -= dt) <= 0) { this.predT = 0.05; this.impact = this.predict(); }
    if (Math.random() < 0.6) FX.sparks(this.x, this.y, 1, rand(0, TAU), TAU, 20, 60, kicked ? { c0: '#ffffff', c1: '#ffd070', c2: '#ff3a52', g: 0 } : { c0: '#ffffff', c1: '#4af0ff', c2: '#145e6a', g: 0 });
  }
  // Explodes on terrain, platforms, barrels, the player (while hostile) or any enemy (once rebounded).
  contact(py) {
    if (Level.pointSolid(this.x, this.y, py)) { this.explode(); return true; }
    const p = Game.player;
    if (this.hostile) {
      if (!p.dead && circleRect(this.x, this.y, 4, p.x - p.w / 2, p.y - p.h, p.w, p.h)) {
        if (p.parryActive()) p.doParry({ x: this.x, y: this.y, proj: this });
        else this.explode();
        return true;
      }
    } else {
      for (const e of Game.enemies) {
        if (e.dead || e.spawning) continue;
        if (circleRect(this.x, this.y, 6, e.x - e.w / 2, e.y - e.h, e.w, e.h)) { this.explode(); return true; }
      }
    }
    for (const pr of Game.props) {
      if (!pr.dead && pr.grabR && circleRect(this.x, this.y, 4, pr.x - pr.w / 2, pr.y - pr.h, pr.w, pr.h)) { this.explode(); return true; }
    }
    return false;
  }
  predict() {
    let x = this.x, y = this.y, vy = this.vy;
    for (let i = 0; i < 120; i++) {
      const py = y;
      vy += this.g / 60; x += this.vx / 60; y += vy / 60;
      if (Level.pointSolid(x, y, py)) return [x, Level.groundBelow(x, py)];
    }
    return null;
  }
  explode(o = {}) {
    if (this.dead) return;
    this.dead = true;
    const R = this.R, p = Game.player, owner = this.owner;
    if (o.blocked) {
      FX.ring(this.x, this.y, 3, 30, 0.3, { c: '#ffd070', core: '#ffffff', w: 2 });
      FX.sparks(this.x, this.y, 20, 0, TAU, 60, 220, { c0: '#ffffff', c1: '#ffe080', c2: '#145e6a' });
      FX.text('BLOCKED', this.x, this.y - 14, { c: '#ffd070', always: true, dur: 0.7, vy: -24 });
      Sound.play('blocked');
      Game.shake(0.2);
      return;
    }
    const friendly = this.state === 'kicked';
    if (friendly) {
      if (owner && !owner.dead && dist(this.x, this.y, owner.x, owner.cy) < R + 6) owner.pulseHit();
      for (const e of Game.enemies) {
        if (e.dead || e.spawning || e === owner) continue;
        const d = dist(this.x, this.y, e.x, e.cy);
        if (d < R) hurtEnemy(e, 50, { kx: ((e.x - this.x) / (d || 1)) * 260, ky: -220, heavy: true, cause: 'barrel', angle: Math.atan2(e.cy - this.y, e.x - this.x) });
      }
    } else if (!p.dead && dist(this.x, this.y, p.x, p.cy) < R) {
      const r = p.takeHit({ dmg: this.dmg * (owner ? owner.dmgMul : 1), x: this.x, y: this.y, kind: 'explosion', knock: 240 });
      if (r === 'hit' && this.disable > 0) p.disableShield(this.disable);
    }
    for (const pr of Game.props) {
      if (!pr.dead && pr.grabR && dist(this.x, this.y, pr.x, pr.cy) < R) pr.hit(30, { heavy: true, kx: (pr.x - this.x) * 4, ky: -200 });
    }
    const c1 = friendly ? '#ffd070' : '#2ab8d8';
    for (const [r1, d] of [[R, 0.45], [R * 0.7, 0.35], [R * 0.4, 0.25]]) FX.ring(this.x, this.y, 3, r1, d, { c: c1, core: '#ffffff', w: 2 });
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + rand(-0.2, 0.2); FX.bolt(this.x, this.y, this.x + Math.cos(a) * R * 0.8, this.y + Math.sin(a) * R * 0.8, 0.2, { outer: c1, core: '#ffffff', jag: 5 }); }
    FX.sparks(this.x, this.y, 30, 0, TAU, 80, 300, { c0: '#ffffff', c1: friendly ? '#ffe080' : '#7af0ff', c2: '#145e6a' });
    FX.light(this.x, this.y, 140, friendly ? '#ffd070' : '#4af0ff', 1, 0.4);
    FX.flash('#bff8ff', 0.25);
    Sound.play('pulse');
    Game.shake(0.45);
    Game.hitstop(0.04);
  }
  drawEmissive(ctx, camX, camY) {
    const x = this.x - camX, y = this.y - camY;
    if (this.hostile && this.impact) drawBlastZone(ctx, this.impact[0] - camX, this.impact[1] - camY, this.R, this.t);
    const blink = ((this.t * 14) | 0) % 2, st = this.state;
    const mid = st === 'flying' ? '#145e6a' : st === 'caught' ? '#6a4a10' : '#5a0c1a';
    const core = st === 'flying' ? '#4af0ff' : st === 'caught' ? '#ffd070' : '#ff5a6a';
    const z = this.size;
    ctx.fillStyle = '#0b0910'; pdisc(ctx, x, y, 5 * z);
    ctx.fillStyle = mid; pdisc(ctx, x, y, 4 * z);
    ctx.fillStyle = blink ? '#ffffff' : core; pdisc(ctx, x, y, 2 * z);
    ctx.fillStyle = core;
    pring(ctx, x, y, 7 * z + Math.sin(this.t * 20), 1, 1);
    if (this.hostile && blink) drawText(ctx, '!', x, y - 15, { color: '#7af0ff', align: 'center' });
  }
  addLights() { FX.frameLight(this.x, this.y, 34, this.state === 'flying' ? '#4af0ff' : this.state === 'caught' ? '#ffd070' : '#ff3048', 0.9); }
}

// What's left of the rival after a knockout: its last pose, lying in the street until the next wave.
class RivalHusk {
  constructor(r) {
    this.x = r.x + r.facing * 9; this.y = r.y; this.w = 22; this.h = 6; this.dead = false;
    this.ox = r.x; this.facing = r.facing; this.t = 0; this.wave = Director.wave; this.fade = 0;
    this.img = makeCanvas(Sprite.SIZE, Sprite.SIZE);
    this.img.ctx.drawImage(r.spriteCopy, 0, 0);
  }
  get cx() { return this.x; }
  get cy() { return this.y - 3; }
  hit() { FX.sparks(this.x, this.y - 3, 4, -Math.PI / 2, 1.6, 40, 120, { c0: '#ffffff', c1: '#7af0ff', c2: '#145e6a' }); }
  update(dt) {
    this.t += dt;
    if (!this.fade && Director.wave !== this.wave) {
      this.fade = 0.001;
      FX.ring(this.x, this.y - 2, 3, 30, 0.4, { sy: 0.35, c: '#4af0ff', core: '#ffffff', w: 1 });
      Sound.play('spawn');
    }
    if (this.fade) { this.fade += dt; if (this.fade > 0.5) this.dead = true; }
    if (Math.random() < 0.015) FX.elec(this.x + rand(-8, 8), this.y - 3, 7, 1, { outer: '#2ab8d8', core: '#ffffff' });
    if (Math.random() < 0.04) FX.dust(this.x + rand(-6, 6), this.y - 4, 1, { c: '#3a3442', smax: 10, rise: 18, life: 1.6 });
  }
  draw(ctx, camX, camY) {
    const g = Sprite.begin(1);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(this.img, 0, 0);
    Sprite.end(ctx, this.ox - camX, this.y - camY, { alpha: this.fade ? 1 - this.fade / 0.5 : 1 });
  }
  addLights() {
    if (((this.t * 3) | 0) % 4 === 0) FX.frameLight(this.x + this.facing * 9, this.y - 3, 14, '#4af0ff', 0.3);
  }
}

'use strict';
// KRAG, the Molten Fist: the second boss, a hulking cyborg brawler of rust-brown stone blocks with molten seams,
// an onyx left arm with a fist as wide as its chest, and a mohawk of flame. Violent, rough and unrelenting: it
// always presses in, never dodges, and nothing you hit it with interrupts what it's doing. Ported from the 3D
// version's kragboss.js, with the same rules and timings; distances convert at about 11 px a metre.
//   Heat builds from fighting (about 2 a second), from every blow it throws, and most from blows it lands or
//   you parry and from its stomps. It shows only on its body: the seams glow from dull red to white, steam
//   pours off it, the mohawk grows. At full heat the mohawk tears up and it can throw the Molten Fist.
//   The onyx arm's durability is its own thing, worn by blows on its guard and shown on the arm (plates going
//   ashen, fractures glowing through) and in how a blocked blow sounds. Break it and the guard shatters: it
//   reels and can't guard for 8 s while the arm re-forms. Left alone a worn arm mends.
//   Strings of jabs, crosses, hooks, elbows, knees and kicks drive straight through a parry (no damage, but
//   you're shoved back, lose a little shield and get no counter). Each ends on a stopper that winds up in gold
//   (outline, fire round the limb, rings closing on its feet, a gong, then a glint and a bell): parry that and
//   it's knocked off balance and you get the counter.
//   The guard comes up only when you're a threat at range (a held counter, a thrown crucible or barrel, a tether
//   on it, ranged hits) or right after a stagger: a blue flash off the arm, then the arm up. Blows from the front
//   do 15% and wear the arm. At full heat the arm is a liability: hit it while it guards and it goes off in its
//   face (12% of its health, a blast that throws it on its back, a 3.4 s stun).
//   The Molten Fist is its red flash: bullet time, a red shell, and the street ahead of it marked red from its
//   feet a long way out (down off any ledge too). It tracks you for half the wind-up, then the visor flashes red
//   and the line holds. No parry and no dash's protection saves you in it; get behind it (dash through its body
//   or jump over its head) or high above it. It hits for 55 straight to health, throws you, and dazes you for
//   1.5 s; the chasm then erupts in vents for a few seconds and seals.
//   Getting to you: shoulder charges, stomps that split the street in glowing cracks with shockwaves and vents,
//   and from far off a leap onto you or a swing on a chain from something high to fling itself at you.

ENEMY_DEFS.krag = { hp: 1500, w: 18, h: 33, speed: 92, score: 6000, mass: 9, dmg: 6, heavy: true, debris: ['#9a6440', '#7c4c30', '#2e2834', '#1e1a24', '#ff6a1a', '#c08a44'] };
ENEMY_BASE_STATE.krag = 'fight';

const KRAG_SPARK = { c0: '#fff4d0', c1: '#ffa040', c2: '#a02a08' };
const KRAG_FIRE = { c0: '#fff0c0', c1: '#ff7a1a', c2: '#7a1a04' };
const KRAG_GOLD = { c0: '#ffffff', c1: '#ffd070', c2: '#a06010' };
const KRAG_STEAM = '#9a9296';
const KRAG_ORANGE = '#ff7a2a';
const KRAG_STONE = ['#9a6440', '#7c4c30', '#5a3a2a', '#3a2c2a', '#2a2026', '#c08a44'];
const KRAG_ONYX = { plate: '#1e1a24', mid: '#2e2834', hi: '#463c50' };
const HEAT_RAMP = ['#5a1606', '#8a2a0a', '#b8400e', '#e05414', '#ff6a1a', '#ff8a2a', '#ffa840', '#ffc460', '#ffd890'];
PALETTES.molten = [[255, 248, 220], [255, 190, 80], [255, 96, 24], [120, 24, 6]];
// heat: per second of fighting, per blow thrown, per blow landed, per blow parried, per stomp, per point of
// damage taken; no heat for VENT seconds after it discharges
const HEAT = { MAX: 100, EXERT: 2.2, THROW: 1.5, LAND: 10, PARRIED: 6, STOMP: 6, PAIN: 0.08, VENT: 3.5 };
// the arm: wear per point of a blocked blow (at most CAP a blow), mending MEND a second after REST seconds
// alone; broken for DOWN seconds, back at BACK; the break costs BREAK of its health
const ARM = { MAX: 100, WEAR: 0.9, CAP: 28, MEND: 2.5, REST: 4, DOWN: 8, BACK: 55, BREAK: 0.04 };
const BLOCK_MUL = 0.15;
// the Molten Fist: wind-up, bullet time speed, when it locks, the zone's length (at least LEN, and 150 px
// past where you stood, up to MAX), damage, knock, daze, the vent after, how fast the split races out, and how
// high over its level it reaches you standing (LIFT) or in the air (FLY)
const FIST = { WIND: 1.15, BT: 0.65, LOCK: 0.5, LEN: 290, MAX: 430, DMG: 55, KNOCK: 430, DAZE: 1.5, VENT: 1.9, FRONT: 770, LIFT: 50, FLY: 99 };
const CHASM = { DUR: 6.2, ERUPT: 4.6, RATE: 5, HIT: 0.2 };
const DETONATE = { DMG: 0.12, STUN: 3.4 };
const KCHARGE = { WIND: 0.42, SPEED: 430, MAX: 242, DMG: 22, KNOCK: 330 };
const KJUMP = { WIND: 0.42, LIFT: 55, DMG: 26, R: 35, MIN: 176 };
const KSWING = { MIN_D: 110, MAX_D: 330, DMG: 30, FLY: 520 };
const GUARD_RISE = 0.3;
// a molten vent: half-width, seconds of glowing crack before it bursts, seconds it erupts, damage, height
const VENT = { HALF: 15, TELL: 0.55, ERUPT: 0.45, DMG: 14, TALL: 38 };
const KRAG_G = 960;

// Its blows. wind = telegraph; swing = active time; r = reach from the chest (px). kind 'line' straight along
// its facing, 'arc' a swing (over: down from above, rising: up from below), 'spin' all round. limb: R the
// back (stone) arm, L the onyx arm, F a leg, B both fists. stopper: parry it to stagger it.
const KRAG_MOVES = {
  jab: { limb: 'R', wind: 0.24, swing: 0.14, r: 30, dmg: 9, knock: 150, kind: 'line', lunge: 6 },
  cross: { limb: 'R', wind: 0.28, swing: 0.16, r: 33, dmg: 12, knock: 170, kind: 'line', lunge: 8 },
  elbow: { limb: 'R', wind: 0.24, swing: 0.14, r: 27, dmg: 11, knock: 160, kind: 'arc', span: 1.8, lunge: 5 },
  hook: { limb: 'L', wind: 0.32, swing: 0.18, r: 33, dmg: 14, knock: 200, kind: 'arc', span: 2.4, lunge: 6 },
  knee: { limb: 'F', wind: 0.26, swing: 0.16, r: 26, dmg: 12, knock: 150, kind: 'line', low: true, launch: 150, lunge: 6 },
  kick: { limb: 'F', wind: 0.32, swing: 0.18, r: 36, dmg: 12, knock: 290, kind: 'line', low: true, lunge: 4 },
  shove: { limb: 'L', wind: 0.22, swing: 0.16, r: 32, dmg: 8, knock: 270, kind: 'line', lunge: 6 },
  haymaker: { limb: 'L', wind: 0.55, swing: 0.2, r: 37, dmg: 26, knock: 310, kind: 'arc', span: 2.4, over: true, lunge: 12, stopper: true },
  uppercut: { limb: 'L', wind: 0.5, swing: 0.2, r: 33, dmg: 22, knock: 160, kind: 'arc', span: 2.0, rising: true, launch: 330, lunge: 7, stopper: true },
  hammer: { limb: 'B', wind: 0.6, swing: 0.22, r: 36, dmg: 24, knock: 270, kind: 'arc', span: 1.8, over: true, quake: true, lunge: 5, stopper: true },
  spinFist: { limb: 'L', wind: 0.5, swing: 0.32, r: 38, dmg: 22, knock: 290, kind: 'spin', lunge: 4, stopper: true },
  flyKnee: { limb: 'F', wind: 0.45, swing: 0.3, r: 29, dmg: 24, knock: 250, kind: 'line', leapV: 260, lunge: 16, launch: 250, stopper: true },
};
const KRAG_COMBOS = [
  ['jab', 'cross', 'hook', 'haymaker'], ['jab', 'jab', 'knee', 'uppercut'], ['hook', 'cross', 'kick'],
  ['elbow', 'hook', 'hammer'], ['jab', 'cross', 'jab', 'spinFist'], ['knee', 'elbow', 'flyKnee'],
  ['cross', 'hook', 'hook', 'haymaker'], ['jab', 'hook', 'uppercut'], ['kick', 'jab', 'cross', 'hammer'],
];
// the poses each blow draws back into and strikes out to: fists (hL onyx, hR stone) and the front foot
const KRAG_POSE = {
  jab: { w: { hR: [-6, -23], lean: 0.05 }, s: { hR: [17, -23], lean: 0.2 } },
  cross: { w: { hR: [-8, -22], lean: -0.05 }, s: { hR: [19, -22], lean: 0.3, fB: [-9, 0] } },
  elbow: { w: { hR: [-3, -27], lean: 0.05 }, s: { hR: [9, -26], lean: 0.25 } },
  hook: { w: { hL: [-6, -20], lean: -0.1 }, s: { hL: [15, -24], lean: 0.25 } },
  knee: { w: { fF: [1, -2], lean: 0 }, s: { fF: [10, -13], lean: -0.1 } },
  kick: { w: { fF: [-3, -4], lean: -0.15 }, s: { fF: [19, -11], lean: -0.3, fB: [-4, 0] } },
  shove: { w: { hL: [2, -21], hR: [0, -20] }, s: { hL: [17, -21], hR: [15, -20], lean: 0.3 } },
  haymaker: { w: { hL: [-11, -34], lean: -0.2, fB: [-8, 0] }, s: { hL: [17, -14], lean: 0.45 } },
  uppercut: { w: { hL: [3, -6], lean: 0.35, crouch: 3 }, s: { hL: [12, -40], lean: -0.15 } },
  hammer: { w: { hL: [1, -46], hR: [-2, -46], lean: -0.2 }, s: { hL: [15, -4], hR: [12, -5], lean: 0.5, crouch: 3 } },
  spinFist: { w: { hL: [-11, -22], lean: -0.15 }, s: { hL: [18, -22], lean: 0.1 } },
  flyKnee: { w: { crouch: 4, lean: 0.3, hL: [-4, -18] }, s: { fF: [11, -17], fB: [-5, -6], hL: [-5, -28], lean: 0.1 } },
};

class Krag extends Enemy {
  constructor(x, y, scale = {}) {
    super('krag', x, y, scale);
    this.isBoss = true; this.name = 'KRAG'; this.immovable = true;
    this.barCol = '#ff7a2a'; this.barHi = '#ffc890'; this.barName = '#ffc8a0';
    this.spawnT = 1.5; this.heat = 0; this.ventT = 0; this.pulseT = 0; this.flared = false;
    this.stunT = 0; this.transT = 0; this.perilFlash = 0; this.hitT = 0; this.rangedHurt = 0; this.thrownT = 0;
    this.act = null; this.attack = null; this.lunge = null; this.drive = null; this.leap = null; this.want = 0;
    this.cds = { combo: 0.6, closer: 0, stomp: 3, charge: 2, jump: 4, swing: 5, punch: 0, guard: 0, leap: 0 };
    this.dying = false; this.ko = null; this.koT = 0; this.intro = null;
    this.steamT = 0; this.arm = ARM.MAX; this.armRest = 0; this.armDown = 0; this.reformT = 0; this.armCreak = 2;
    this.walk = 0; this.lastStep = [1, 1]; this.stuckT = 0; this.lastX = x; this.turnT = 0; this.animT = 0;
    this.dropThrough = false; this.dropT = 0;
    this._L = [x, y - 14]; this._R = [x, y - 14]; this._F = [x, y - 3]; this._visor = [x, y - 30]; this._crest = [x, y - 34];
  }
  get cy() { return this.y - 16; }
  // It waits under the street until it bursts up out of it.
  cinematicIntro() { this.intro = { t: 0, ct: 0, stage: 'quake', done: {}, started: false, oy: 0, vy: 0, lit: false }; this.facing = sign(Game.player.x - this.x) || -1; }

  // ---------- where its parts are ----------
  chest() { return [this.x + this.facing * 2, this.y - 21]; }
  visorPos() { return this._visor; }
  limbPos(l) { return l === 'R' ? this._R : l === 'F' ? this._F : this._L; }
  charged() { return this.heat >= HEAT.MAX; }
  heatK() { return clamp(this.heat / HEAT.MAX, 0, 1); }
  // the onyx arm's wear: 0 whole, 1 about to break (1 while broken)
  wearK() { return this.armDown > 0 ? 1 : clamp(1 - this.arm / ARM.MAX, 0, 1); }
  rageK() { return clamp(1 - this.hp / this.maxHp, 0, 1); }
  rageGap() { return lerp(1, 0.65, this.rageK()); }
  runSpeed() { return this.def.speed * S.enemies.speed * (this.charged() ? 1.15 : 1) * lerp(1, 1.15, this.rageK()); }
  // the Molten Fist speeds up less than the rest on the harder settings, as the rival's red flash does
  fistWind() { const T = S.enemies.telegraph; return FIST.WIND * (T < 1 ? 1 - (1 - T) * 0.55 : T); }
  windingUp() {
    const a = this.act;
    if (!a) return false;
    return (a.kind === 'melee' && a.phase === 'wind') || (a.kind === 'punch' && a.phase === 'wind') || (a.kind === 'charge' && a.phase === 'wind') ||
      (a.kind === 'jump' && a.phase !== 'land') || (a.kind === 'stomp' && a.phase === 'wind') || (a.kind === 'swing' && a.phase !== 'land');
  }
  stopLoops() {}

  // ---------- damage hooks used by hurtEnemy ----------
  damageTakenMul() { return this.stunT > 0 ? 1.35 : 1; }
  // its blows meet a parry and drive on through it (no counter); only a stopper can be caught
  clashes() { return !this.stopperNow(); }
  stopperNow() {
    const a = this.act;
    return !!a && ((a.kind === 'melee' && a.m.stopper) || (a.kind === 'charge' && a.phase === 'run') || a.kind === 'jump' || (a.kind === 'swing' && a.phase === 'fly'));
  }
  intercept(o, dmg) {
    if (this.transT > 0) return true;
    const a = this.act;
    if (a && a.kind === 'guard' && a.t >= a.rise && !this.dying && this.blocks(o)) { this.blockHit(o, dmg || 0); return true; }
    return false;
  }
  // whether a blow comes at it from the front: by the way it pushes, or from where you stand
  blocks(o) {
    if (o.cause === 'fall' || o.cause === 'lava') return false;
    const from = o.kx ? -sign(o.kx) : sign(Game.player.x - this.x) || this.facing;
    return from === this.facing;
  }
  onHurt(d, o) {
    if (o.cause === 'reflect' || o.cause === 'rock' || o.cause === 'barrel' || o.cause === 'chain' || o.cause === 'tether') this.rangedHurt += d;
    this.addHeat(d * HEAT.PAIN);
  }
  canGuard() { return this.armDown <= 0; }
  addHeat(n) {
    if (this.ventT > 0 || this.dying || this.spawning || n <= 0) return false;
    const was = this.heat < HEAT.MAX;
    this.heat = Math.min(HEAT.MAX, this.heat + n);
    if (was && this.heat >= HEAT.MAX) { this.onCharged(); return true; }
    return false;
  }
  // full heat: the mohawk tears up off its head with an orange pulse, and it roars
  onCharged() {
    this.pulseT = 0.9; this.flared = true;
    const [hx, hy] = this._crest, [cx, cy] = this.chest();
    FX.sparks(hx, hy, 40, -Math.PI / 2, 1.1, 60, 220, Object.assign({ g: -80, life: 1.4 }, KRAG_FIRE));
    FX.embers(hx, hy, 20);
    FX.ring(cx, cy, 4, 90, 0.55, { c: KRAG_ORANGE, core: '#ffe0a0', w: 2 });
    FX.ring(this.x, this.y - 1, 4, 70, 0.45, { sy: 0.3, c: '#ffb040', core: '#ffe0a0', w: 1 });
    FX.light(hx, hy, 120, '#ff8a2a', 1, 0.5);
    FX.flash('#ff8a3a', 0.18);
    Sound.play('heatMax'); Sound.play('kragRoar');
    Game.shake(0.35);
    const a = this.act;
    if (!this.stunT && (!a || a.kind === 'recover')) this.act = { kind: 'flare', t: 0 };
  }
  // A blow on the guard: most of it is stopped and it wears the arm. How it lands tells you how worn the arm is.
  // At full heat the arm goes off instead.
  blockHit(o, dmg) {
    const a = this.act, p = Game.player;
    if (this.charged()) { this.detonate(o); return; }
    const small = o.cause === 'rock' || o.cause === 'chain' || o.cause === 'tether';
    this.arm = Math.max(0, this.arm - Math.min(ARM.CAP, dmg * ARM.WEAR * (small ? 0.6 : 1)));
    this.armRest = 0;
    const d = Math.max(1, Math.round(dmg * BLOCK_MUL)), w = this.wearK();
    this.hp = Math.max(1, this.hp - d);
    this.hitT = 0.15; a.blocked = (a.blocked || 0) + 1;
    const [fx, fy] = this._L, u = sign(p.x - this.x) || this.facing, hx = fx + u * 4;
    if (S.visuals.damageNumbers) FX.text(String(d), fx, this.y - this.h - 6, { c: '#a8a0a8' });
    Game.registerHit(d, o.cause);
    if (!small || !this._blkT || Game.time > this._blkT) {
      this._blkT = Game.time + 0.1;
      const n = small ? 0.35 : o.heavy ? 1.6 : 1;
      FX.sparks(hx, fy, Math.round((12 - 6 * w) * n), u > 0 ? 0 : Math.PI, 1.5, 60, 220, KRAG_SPARK);
      if (w > 0.2) FX.debris(hx, fy, Math.round((2 + 10 * w) * n), ['#2e2834', '#1e1a24', '#463c50', '#7a6a62'], 90 + 90 * w);
      if (w > 0.45) FX.dust(hx, fy, Math.round(3 * w * n + 1), { c: '#4a4248', smax: 24, rise: 18, life: 1 });
      if (w > 0.7 && !small) { FX.bolt(fx - 3, fy - 10, fx + 3, fy + 6, 0.08, { outer: '#ff8a2a', core: '#ffffff', jag: 3 }); FX.light(fx, fy, 40, '#ffd0a0', 1, 0.1); }
      FX.light(fx, fy, small ? 16 : 40, '#ff8a2a', 0.9, 0.12);
      Sound.play('kragBlock', { heavy: !!o.heavy, wear: w });
      if (!small) { Game.hitstop(0.03); Game.shake(o.heavy ? 0.2 : 0.08); }
    }
    this.vx -= u * (small ? 5 : o.heavy ? 60 : 30);
    if (this.arm <= 0) this.breakArm();
  }
  // The arm gives out: the guard shatters in onyx shards, it reels, and the arm hangs broken.
  breakArm() {
    const [fx, fy] = this._L, d = Math.round(this.maxHp * ARM.BREAK);
    this.arm = 0; this.armDown = ARM.DOWN;
    this.hp = Math.max(1, this.hp - d); this.hitFlash = 0.1;
    FX.text(String(d), this.x, this.y - this.h - 8, { c: '#ffd070', scale: 2 });
    Game.registerHit(d, 'armbreak');
    FX.debris(fx, fy, 40, ['#2e2834', '#1e1a24', '#463c50', '#7a6a62', '#ff7a1a'], 260);
    FX.sparks(fx, fy, 50, 0, TAU, 80, 340, KRAG_FIRE);
    FX.sparks(fx, fy, 20, 0, TAU, 50, 180, { c0: '#ffffff', c1: '#d0c8d0', c2: '#5a5060' });
    FX.dust(fx, fy, 18, { c: '#3a3036', smax: 70, rise: 24, life: 1.6 });
    FX.ring(fx, fy, 3, 60, 0.4, { c: '#ffd0a0', core: '#ffffff', w: 2 });
    FX.light(fx, fy, 110, '#ffb040', 1, 0.4);
    FX.flash('#ffe0c0', 0.3);
    Sound.play('armBreak');
    Game.shake(0.6); Game.hitstop(0.09);
    this.attack = null; this.lunge = null; this.drive = null;
    this.act = { kind: 'flinch', t: 0, dur: 0.95, broke: true };
    this.vx = sign(this.x - Game.player.x || -this.facing) * 80;
  }
  // the broken arm re-forms: molten seams run through it and close, and it comes back part worn
  armReform() {
    this.armDown = 0; this.arm = ARM.BACK; this.armRest = 0; this.reformT = 0.6;
    const [fx, fy] = this._L;
    FX.sparks(fx, fy, 24, -Math.PI / 2, 1.4, 40, 130, Object.assign({ g: -40, life: 1 }, KRAG_FIRE));
    FX.dust(fx, fy, 8, { c: KRAG_STEAM, smax: 24, rise: 36, life: 1.3 });
    FX.light(fx, fy, 50, '#ffb040', 1, 0.4);
    Sound.play('armReform');
  }
  // The charged arm takes a blow on the guard and all its heat goes off in its face: big damage, a blast that
  // throws it on its back, and the only stun it has.
  detonate(o) {
    const p = Game.player, [fx, fy] = this._L;
    this.heat = 0; this.ventT = HEAT.VENT + 1; this.flared = false; this.pulseT = 0;
    this.arm = Math.max(1, this.arm - 35); this.armRest = 0;
    const d = Math.round(this.maxHp * DETONATE.DMG * (Game.has('glass') ? 1.35 : 1));
    this.hp -= d; this.hitFlash = 0.12;
    FX.text(String(d), this.x, this.y - this.h - 10, { c: '#ffd070', scale: 2 });
    Game.registerHit(d, 'detonate');
    FX.ring(fx, fy, 4, 80, 0.5, { c: '#ffb040', core: '#ffffff', w: 3 });
    FX.ring(fx, fy, 3, 44, 0.35, { c: '#ffffff', core: '#ffe0a0', w: 2 });
    FX.ring(this.x, this.y - 1, 6, 100, 0.5, { sy: 0.3, c: KRAG_ORANGE, core: '#ffe0a0', w: 2 });
    FX.sparks(fx, fy, 70, 0, TAU, 100, 420, KRAG_FIRE);
    FX.sparks(fx, fy, 30, -Math.PI / 2, 1.5, 80, 280, Object.assign({ g: -60, life: 1.6 }, KRAG_FIRE));
    FX.embers(fx, fy, 30);
    FX.debris(fx, fy, 20, this.def.debris, 260);
    FX.dust(fx, fy, 22, { c: '#2a2026', smax: 110, life: 1.6, rise: 24, r1: 8 });
    FX.decal('scorch', this.x, this.y, { r: 26, dur: 10 });
    KragFX.fireball(fx, fy, 46, 0.55);
    KragFX.crack(this.x, this.y, { r: 50, life: 9 });
    FX.light(fx, fy, 200, '#ffb040', 1, 0.6);
    FX.flash('#ffd0a0', 0.6);
    Sound.play('detonate');
    Game.shake(0.95); Game.hitstop(0.12);
    Game.slowmo(0.2, 0.7, true);
    if (!p.dead && Math.abs(p.x - this.x) < 50 && Math.abs(p.y - this.y) < 50) { p.vx += sign(p.x - this.x || 1) * 160; p.vy = Math.min(p.vy, -140); p.onGround = false; }
    if (this.hp <= 0) { this.hp = 0; killEnemy(this, { cause: 'detonate', angle: -Math.PI / 2 }); return; }
    this.stunFor(DETONATE.STUN);
    this.vx = -this.facing * 180; this.vy = -200; this.onGround = false;
  }
  stunFor(dur) {
    this.stunT = this.stunMax = dur;
    this.act = null; this.attack = null; this.lunge = null; this.drive = null; this.leap = null;
    if (Game.btOwner === this) Game.endBulletTime();
  }
  // Called when you parry one of its blows (with the parry's knock; hits pass none, so no hit staggers it): a
  // stopper knocks it back off balance; anything else it drives through.
  stagger(dur, kx) {
    if (this.dying || dur < 1.2 || kx === undefined || this.stunT > 0 || !this.stopperNow()) return;
    this.act = { kind: 'flinch', t: 0, dur: 0.85 * lerp(1, 0.85, this.rageK()) };
    this.attack = null; this.lunge = null; this.drive = null; this.leap = null;
    this.vx = sign(kx || -this.facing) * 90;
    const [cx, cy] = this.chest();
    FX.sparks(cx, cy, 26, -Math.PI / 2, TAU, 60, 260, KRAG_GOLD);
    FX.ring(cx, cy, 3, 34, 0.3, { c: '#ffd070', core: '#ffffff', w: 2 });
    Sound.play('kragStagger');
  }
  // the molten river throws it back out, unhurt
  throwOut(side) {
    this.vy = -420; this.vx = side * 230; this.onGround = false; this.thrownT = 0.7;
    this.lunge = null; this.drive = null; this.leap = null;
    if (this.act && this.act.kind !== 'punch' && this.act.kind !== 'guard') this.act = null;
  }

  // ---------- update ----------
  update(dt) {
    this.t += dt; this.st += dt; this.animT += dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    if (this.spawning) {
      if (this.intro) { this.updateIntro(dt); return; }
      // without the cutscene it still comes up out of the street: cracks spreading, then the burst
      if (!this.quaking) {
        this.quaking = true;
        KragFX.crack(this.x, this.y, { r: 50, grow: this.spawnT * 0.8, life: this.spawnT + 6 });
        Sound.play('kragQuake', { dur: this.spawnT });
      }
      if (Math.random() < 0.5) FX.sparks(this.x + rand(-22, 22), this.y - 1, 1, -Math.PI / 2, 0.5, 30, 100, Object.assign({ life: 0.8 }, KRAG_FIRE));
      if (Math.random() < 0.3) Game.shake(0.03);
      this.spawnT -= dt;
      if (this.spawnT <= 0) { this.eruptOut(); this.arrive(true); }
      return;
    }
    for (const k in this.cds) this.cds[k] -= dt * (k === 'leap' ? 1 : S.enemies.aggression);
    for (const k of ['transT', 'ventT', 'perilFlash', 'hitT', 'reformT', 'thrownT']) if (this[k] > 0) this[k] = Math.max(0, this[k] - dt);
    if (this.armDown > 0) { this.armDown -= dt; if (this.armDown <= 0) this.armReform(); }
    else if ((this.armRest += dt) > ARM.REST) this.arm = Math.min(ARM.MAX, this.arm + ARM.MEND * dt);
    this.rangedHurt = Math.max(0, this.rangedHurt - dt * 14);
    if (this.dropThrough && (this.dropT -= dt) <= 0) this.dropThrough = false;
    // the Fist's bullet time lasts exactly as long as its wind-up
    const a0 = this.act;
    if (Game.btOwner === this && Game.btKind === 'peril' && !(a0 && a0.kind === 'punch' && a0.phase === 'wind')) Game.endBulletTime();
    if (this.dying) { this.updateDying(dt); return; }
    const p = Game.player;
    this.want = 0;
    if (this.stunT > 0) {
      this.stunT -= dt;
      if (this.stunT <= 0) this.getUp();
    } else if (this.thrownT <= 0) {
      this.addHeat(HEAT.EXERT * dt);
      if (!this.act) this.chooseAct(p);
      if (this.act) this.runAct(dt, p);
      else this.navigate(dt, p);
      this.react(p);
    }
    this.heatFX(dt);
    this.armFX(dt);
    this.physics(dt);
  }
  // A worn arm shows it all the time: smoke, chips falling, and near the end crackling light and creaking.
  armFX(dt) {
    const w = this.wearK(), broken = this.armDown > 0, [fx, fy] = this._L;
    if (w < 0.3 && !broken) return;
    const ax = fx + rand(-4, 4), ay = fy - rand(0, 12);
    if (Math.random() < (broken ? 0.7 : (w - 0.3) * 0.6)) FX.dust(ax, ay, 1, { c: broken ? '#2a2428' : '#5a5258', smax: 8, rise: 20 + w * 14, life: 1.2 });
    if ((w > 0.55 || broken) && Math.random() < (broken ? 0.12 : (w - 0.55) * 0.25)) FX.debris(ax, ay, 1, ['#2e2834', '#463c50', '#7a6a62'], 30);
    if (broken && Math.random() < 0.3) FX.sparks(fx, fy, 1, Math.PI / 2, 0.6, 10, 40, Object.assign({ life: 0.8 }, KRAG_FIRE));
    if (!broken && w > 0.75 && Math.random() < (w - 0.75) * 0.4) FX.bolt(ax, ay, ax + rand(-5, 5), ay + rand(2, 7), 0.06, { outer: '#ff8a2a', core: '#fff0c0', jag: 2 });
    if (!broken && w > 0.55 && (this.armCreak -= dt) <= 0) { this.armCreak = lerp(3.2, 1.1, (w - 0.55) / 0.45) * rand(0.8, 1.2); Sound.play('armCreak', { wear: w }); }
  }
  // steam, embers and sparks off the body by its heat; at full heat an orange pulse every so often
  heatFX(dt) {
    const k = this.heatK(), [cx, cy] = this.chest();
    if (Math.random() < 0.08 + 0.5 * k) FX.embers(this.x + rand(-7, 7), this.y - rand(8, 30), 1);
    if ((this.steamT -= dt) <= 0) {
      this.steamT = lerp(0.6, 0.08, k);
      FX.dust(this.x - this.facing * rand(2, 6), this.y - 30, 1 + Math.round(k * 2), { c: KRAG_STEAM, smax: 10, rise: 26 + 24 * k, life: 1.3 });
      if (k > 0.5) FX.dust(this._L[0], this._L[1] - 2, 1, { c: KRAG_STEAM, smax: 8, rise: 22, life: 1 });
    }
    if (this.stunT > 0 && Math.random() < 0.5) FX.dust(this._L[0], this._L[1], 1, { c: '#3a3036', smax: 10, rise: 28, life: 1.5 });
    if (this.charged()) {
      if (Math.random() < 0.4) FX.sparks(this._crest[0], this._crest[1], 2, -Math.PI / 2, 0.8, 40, 110, Object.assign({ g: -90, life: 1.2 }, KRAG_FIRE));
      if ((this.pulseT -= dt) <= 0) {
        this.pulseT = 1.1;
        FX.ring(cx, cy, 4, 40, 0.4, { c: KRAG_ORANGE, core: '#ffe0a0', w: 1 });
        FX.light(cx, cy, 70, '#ff8a2a', 0.9, 0.25);
      }
    }
    const a = this.act;
    if (a && a.kind === 'guard' && a.charged && Math.random() < 0.7) {
      const [fx, fy] = this._L;
      FX.sparks(fx, fy, 2, 0, TAU, 20, 90, Object.assign({ g: 0, life: 0.6 }, KRAG_FIRE));
      if (Math.random() < 0.2) FX.bolt(fx, fy, fx + rand(-9, 9), fy + rand(-7, 9), 0.06, { outer: '#ff8a2a', core: '#ffffff', jag: 2 });
    }
  }
  getUp() {
    this.act = { kind: 'recover', t: 0, dur: 0.55 };
    this.cds.combo = 0.2;
    FX.sparks(this._crest[0], this._crest[1], 20, -Math.PI / 2, 1, 40, 140, Object.assign({ g: -60, life: 1.2 }, KRAG_FIRE));
    Sound.play('kragRoar');
  }

  // ---------- choosing what to do ----------
  chooseAct(p) {
    if (p.dead) return;
    const dx = p.x - this.x, d = Math.abs(dx), dy = p.y - this.y, level = Math.abs(dy) < 24, near = d < 42 && Math.abs(dy) < 29;
    // a string starts from a stride or two off: it steps in with the first blow
    const reach = d < 72 && Math.abs(dy) < 29 && this.lineClear(p, d);
    if (this.charged()) {
      // full heat: it wants the Fist on you, from a few strides off with a clear line, or from above
      if (this.cds.punch <= 0 && this.onGround && (level ? d > 29 && d < 220 : this.fistReaches(p, d, dy)) && this.lineClear(p, d)) { this.startPunch(p, false); return; }
      if (reach && this.cds.combo <= 0) { this.startCombo(true); return; }
    } else if (reach && this.cds.combo <= 0) { this.startCombo(false); return; }
    if (near || this.cds.closer > 0) return;
    this.cds.closer = rand(0.3, 0.6);
    // up close and mid-range it charges and stomps; only from far off does it leap or swing on its chain
    const opts = [];
    if (level && d > 44 && d < 132 && this.cds.stomp <= 0) opts.push(['stomp', 1.3]);
    if (level && d > 88 && d < 286 && this.cds.charge <= 0 && this.lineClear(p, d)) opts.push(['charge', 1.6]);
    if (d > KJUMP.MIN && d < 374 && this.cds.jump <= 0) opts.push(['jump', 0.8]);
    if (level && d > KSWING.MIN_D && d < KSWING.MAX_D && this.cds.swing <= 0) opts.push(['swing', 1.5]);
    if (!opts.length) return;
    let r = Math.random() * opts.reduce((s, o) => s + o[1], 0), pk = opts[0][0];
    for (const [k, w] of opts) { if (r < w) { pk = k; break; } r -= w; }
    if (pk === 'stomp') this.startStomp(p, chance(0.4 + 0.3 * this.rageK()) ? 3 : 1);
    else if (pk === 'charge') this.startCharge(p);
    else if (pk === 'jump') this.startJump(p);
    else if (!this.startSwing(p)) this.cds.swing = 3;
  }
  // you on the ground below its ledge, where the Fist's zone falls
  fistReaches(p, d, dy) { return dy > 24 && dy < 132 && d > 44 && d < FIST.LEN - 30; }
  lineClear(p, d) { return Level.raycast(this.x, this.y - 8, this.x + sign(p.x - this.x) * Math.max(1, d - 6), this.y - 8) >= 1; }
  // what it reads as a threat from range: a counter held ready, something thrown at it, its own tether, ranged hits
  threat(p, d) {
    if (d < 66 || p.dead) return null;
    if (p.sheathe && p.sheathe.empowered) return 'big';
    for (const pr of Game.props) if (pr instanceof Barrel && !pr.dead && pr.thrown > 0 && Math.abs(pr.x - this.x) < 130 && sign(pr.vx) === sign(this.x - pr.x)) return 'big';
    if (p.tether && p.tether.target === this) return 'small';
    if (this.rangedHurt > 8) return 'small';
    return null;
  }
  // It guards only when you're a threat at range (at full heat only against something big, and not always),
  // out of an idle moment, a walk or a recovery.
  react(p) {
    const a = this.act;
    if ((a && a.kind !== 'recover') || this.cds.guard > 0 || !this.onGround || !this.canGuard()) return;
    const th = this.threat(p, Math.abs(p.x - this.x));
    if (!th) return;
    if (this.charged() && !(th === 'big' && chance(0.7))) { this.cds.guard = 0.8; return; }
    this.raiseGuard(rand(1.6, 2.4), 'range');
    this.cds.guard = rand(3.5, 5.5);
  }
  // The guard: a blue flash off the onyx arm as it comes up (blows still land until it's up), then the arm up.
  raiseGuard(dur, why) {
    if (this.stunT > 0 || this.dying || !this.canGuard()) return false;
    this.attack = null; this.lunge = null; this.drive = null;
    const rise = GUARD_RISE * clamp(S.enemies.telegraph, 0.6, 1.4);
    this.act = { kind: 'guard', t: 0, dur: dur + rise, rise, up: false, why, charged: this.charged(), closeT: 0, blocked: 0, noShove: (why === 'stagger' ? 0.9 : 0.35) + rise };
    this.facing = sign(Game.player.x - this.x) || this.facing; this.turnT = 0;
    const [fx, fy] = this._L;
    FX.glint(fx, fy, { c: '#5ac0ff', size: 2.2, dur: rise + 0.06, follow: () => this._L });
    FX.ring(fx, fy, 3, 30, 0.3, { c: '#5ac0ff', core: '#e0f4ff', w: 1 });
    FX.sparks(fx, fy, 16, 0, TAU, 40, 130, { c0: '#ffffff', c1: '#7ad0ff', c2: '#1a4a9a', g: 0, life: 0.7 });
    FX.light(fx, fy, 60, '#3aa8ff', 1, rise);
    Sound.play('kragGuardCue');
    return true;
  }
  runAct(dt, p) {
    const a = this.act;
    a.t += dt;
    switch (a.kind) {
      case 'intro': this.facing = sign(p.x - this.x) || this.facing; if (a.t > 0.9) this.act = null; return;
      case 'flare': this.facing = sign(p.x - this.x) || this.facing; if (a.t > 0.6) this.act = null; return;
      case 'recover': if (a.t > a.dur) this.act = null; return;
      case 'flinch':
        if (a.t > a.dur && !this.raiseGuard(rand(1.4, 1.9), 'stagger')) { this.act = null; this.cds.combo = 0.1; }
        return;
      case 'guard': this.runGuard(dt, a, p); return;
      case 'melee': this.runMelee(dt, a, p); return;
      case 'punch': this.runPunch(dt, a, p); return;
      case 'charge': this.runCharge(dt, a, p); return;
      case 'jump': this.runJump(dt, a, p); return;
      case 'stomp': this.runStomp(dt, a, p); return;
      case 'swing': this.runSwing(dt, a, p); return;
    }
  }
  // Always pressing in: at you along the street, leaping up to whatever you stand on and over molten gaps,
  // dropping through platforms after you.
  navigate(dt, p) {
    const dx = p.x - this.x, d = Math.abs(dx), dy = p.y - this.y;
    this.facing = sign(dx) || this.facing;
    if (d > 31) this.want = sign(dx);
    if (!this.onGround) return;
    if (dy < -40 && d < 170 && this.cds.leap <= 0 && p.onGround) { this.leapTo(p.x - sign(dx) * 26, p.y, 40); return; }
    if (dy > 30 && d < 70 && Level.onOneWay(this)) { this.dropThrough = true; this.dropT = 0.3; this.vy = 40; this.onGround = false; return; }
    // walked into something it can't step over: up and over it toward you
    if (this.want && this.col && (this.col.wallL || this.col.wallR) && this.cds.leap <= 0) {
      const tx = this.x + this.want * 70, ty = Level.groundBelow(tx, this.y - 90);
      if (ty < Level.H && !Level.lavaAt(tx)) { this.leapTo(tx, ty, 30); return; }
    }
    const g = this.want && Level.lavaAt(this.x + this.want * (this.w / 2 + 6));
    if (g && !Level.lavaAt(this.x) && this.cds.leap <= 0) { this.leapTo(this.want > 0 ? g.x1 + 16 : g.x0 - 16, Level.GROUND, 30); return; }
    // it hasn't got anywhere for a while: leap to a clear spot near you
    const moved = Math.abs(this.x - this.lastX);
    if (moved > 7 || !this.want) { this.stuckT = 0; this.lastX = this.x; }
    else if ((this.stuckT += dt) > 1.4 && this.cds.leap <= 0) {
      this.stuckT = 0;
      const tx = this.spotNear(p.x, 30, 70);
      if (tx !== null) this.leapTo(tx, Level.groundBelow(tx, p.y - 20), 50);
    }
  }
  // a clear spot on the street (or your level) near x, rMin..rMax away, out of the molten river
  spotNear(x, rMin, rMax) {
    for (let i = 0; i < 16; i++) {
      const tx = clamp(x + (chance(0.5) ? -1 : 1) * rand(rMin, rMax), 60, Level.W - 60);
      if (Level.lavaAt(tx - this.w / 2) || Level.lavaAt(tx + this.w / 2)) continue;
      const gy = Level.groundBelow(tx, Game.player.y - 30);
      if (gy > Level.H || !Level.rectFree(tx - this.w / 2, gy - this.h - 1, this.w, this.h)) continue;
      return tx;
    }
    return null;
  }
  // A leap up over whatever is between and down onto (tx, ty), timed to land there.
  leapTo(tx, ty, lift, attack = false) {
    const g = KRAG_G * 0.8, apex = Math.max(-40, Math.min(this.y, ty) - lift);
    const vy = -Math.sqrt(2 * g * Math.max(8, this.y - apex)), T = -vy / g + Math.sqrt(2 * Math.max(4, ty - apex) / g);
    tx = clamp(tx, 50, Level.W - 50);
    this.leap = { tx, ty, t: 0, T, g, vx: (tx - this.x) / T, attack };
    this.vy = vy; this.onGround = false; this.dropThrough = ty > this.y + 4; this.dropT = 0.2;
    this.cds.leap = 1.2;
    this.facing = sign(tx - this.x) || this.facing;
    Sound.play('jump'); FX.dust(this.x, this.y, 8, { smax: 50 });
    return this.leap;
  }
  // open floor ahead along dir, up to L px: stops at walls, drops and the molten river
  legRoom(dir, L) {
    const hit = Level.raycast(this.x, this.y - 8, this.x + dir * (L + this.w / 2), this.y - 8);
    let free = Math.max(0, (L + this.w / 2) * hit - this.w / 2 - 2);
    for (let s = 4; s <= free; s += 4) {
      const x = this.x + dir * s;
      if (Level.lavaAt(x + dir * this.w / 2) || Level.groundBelow(x, this.y - 2) > this.y + 14) { free = s - 4; break; }
    }
    return Math.max(0, free);
  }
  // The guard: the onyx arm up, turning slowly to keep you in front (get round it and you're behind it for a
  // moment), walking in behind it from range. Crowd it in front and it shoves you off; wait it out and it attacks.
  runGuard(dt, a, p) {
    const dx = p.x - this.x, d = Math.abs(dx);
    if (!a.up && a.t >= a.rise) {
      a.up = true;
      const [fx, fy] = this._L;
      FX.sparks(fx, fy, 10, -Math.PI / 2, 1.2, 30, 110, KRAG_SPARK);
      Sound.play('kragGuard');
      Game.shake(0.06);
    }
    // full heat reached behind the guard: a guard raised on instinct holds, charged; otherwise it drops the
    // guard straight into the Molten Fist
    if (this.charged() && !a.charged) {
      if (a.why === 'stagger') a.charged = true;
      else { this.startPunch(p, true); return; }
    }
    const behind = dx && sign(dx) !== this.facing;
    this.turnT = behind ? this.turnT + dt : 0;
    if (this.turnT > (a.up ? 0.4 : 0.1)) { this.facing = sign(dx); this.turnT = 0; }
    if (d > 35 && !behind) this.want = sign(dx) * 0.45;
    a.closeT = d < 33 && !behind && Math.abs(p.y - this.y) < 30 ? a.closeT + dt : 0;
    if (a.t > a.noShove && a.closeT > 0.45 && !a.charged) { this.startMove('shove', null); this.cds.combo = 0.4; return; }
    if (a.t >= a.dur) { this.act = null; this.cds.combo = 0; }
  }

  // ---------- blows ----------
  startCombo(stopper) {
    const p = Game.player, d = Math.abs(p.x - this.x);
    let opts = stopper ? KRAG_COMBOS.filter((c) => KRAG_MOVES[c[c.length - 1]].stopper) : KRAG_COMBOS;
    if (d > 35) opts = opts.filter((c) => KRAG_MOVES[c[0]].r >= 32 || KRAG_MOVES[c[0]].lunge >= 8).concat(opts.slice(0, 1));
    const combo = pick(opts);
    this.startMove(combo[0], { list: combo, i: 0 });
  }
  startMove(name, combo) {
    const m = KRAG_MOVES[name], p = Game.player;
    this.attack = null; this.lunge = null;
    this.act = { kind: 'melee', move: name, m, phase: 'wind', t: 0, wind: this.tele(m.wind), combo, glinted: false };
    this.facing = sign(p.x - this.x) || this.facing;
    // through a string it stays on you: out of reach, it steps in after you before the next blow
    const d = Math.abs(p.x - this.x);
    if (combo && this.onGround && d > m.r - 3) { this.stepIn(p, d - m.r * 0.55, 0.2); this.act.steps = 1; }
    if (m.stopper) {
      // a stopper winds up in gold from the start: fire round the limb, gold rings closing on its feet, a gong
      const [lx, ly] = this.limbPos(m.limb);
      FX.sparks(lx, ly, 18, 0, TAU, 20, 100, Object.assign({ g: -20, life: 0.9 }, KRAG_GOLD));
      FX.ring(this.x, this.y - 1, 46, 8, this.act.wind * 0.9, { sy: 0.3, c: '#ffd070', core: '#fff4d0', w: 1 });
      FX.ring(this.x, this.y - 1, 30, 6, this.act.wind * 0.7, { sy: 0.3, c: '#ffd070', core: '#fff4d0', w: 1 });
      FX.light(lx, ly, 46, '#ffd070', 1, 0.3);
      Sound.play('stopperWind');
    } else Sound.play('kragGrunt', { pm: rand(0.9, 1.15) });
  }
  // a quick hard step at you: dist px over dur seconds, toward where you're going
  stepIn(p, dist, dur) {
    dist = clamp(dist, 0, 77);
    if (dist < 4) return;
    const dir = sign(p.x + p.vx * 0.15 - this.x) || this.facing;
    this.lunge = { t: 0, dur, v: dir * (2 * dist) / dur };
    this.facing = dir;
    FX.dust(this.x, this.y, 6, { smax: 40 });
    FX.sparks(this.x - dir * 4, this.y - 1, 6, dir > 0 ? Math.PI : 0, 0.7, 40, 120, KRAG_FIRE);
    Sound.play('kragStep');
  }
  runMelee(dt, a, p) {
    const m = a.m, d = Math.abs(p.x - this.x);
    if (a.phase === 'wind') {
      // it stays on you: turning with you through the wind-up and walking in on where you're going
      const lead = p.x + p.vx * 0.2, dl = Math.abs(lead - this.x);
      if (a.t < a.wind * (m.stopper ? 0.75 : 0.9)) this.facing = sign(lead - this.x) || this.facing;
      if (dl > m.r - 10 && a.t < a.wind * 0.9 && !this.lunge) this.want = clamp((dl - m.r + 13) / 40, 0.3, m.stopper ? 0.55 : 0.9) * this.facing;
      if ((a.steps || 0) < 2 && !this.lunge && this.onGround && dl > m.r + 9 && a.t < a.wind * 0.8) { a.steps = (a.steps || 0) + 1; this.stepIn(p, dl - m.r * 0.55, 0.18); }
      if (!a.glinted && a.t >= Math.max(0, a.wind - GLINT_LEAD)) {
        a.glinted = true;
        const [lx, ly] = this.limbPos(m.limb);
        if (m.stopper) {
          // the stopper's tell: a big gold glint off the limb and the visor, a gold burst and a bell
          FX.glint(lx, ly, { c: '#ffd070', size: 2.4, follow: () => this.limbPos(m.limb) });
          this.eyeGlint('#ffd070', 1.4);
          FX.ring(lx, ly, 3, 34, 0.28, { c: '#ffd070', core: '#ffffff', w: 1 });
          FX.sparks(lx, ly, 22, 0, TAU, 40, 140, Object.assign({ g: 0, life: 0.8 }, KRAG_GOLD));
          Sound.play('stopperCue'); Sound.play('glint');
        } else {
          // a string blow only flicks embers off the limb: nothing gold, nothing to parry
          FX.sparks(lx, ly, 7, 0, TAU, 20, 70, Object.assign({ g: 40, life: 0.6 }, KRAG_FIRE));
          FX.glint(lx, ly, { c: '#ff5a1a', size: 0.5, dur: 0.16, follow: () => this.limbPos(m.limb) });
        }
      }
      if (m.stopper && Math.random() < 0.8) { const [lx, ly] = this.limbPos(m.limb); FX.sparks(lx + rand(-3, 3), ly + rand(-3, 3), 1, -Math.PI / 2, 1.2, 15, 60, Object.assign({ g: -30, life: 0.7 }, KRAG_GOLD)); }
      if (a.t >= a.wind) this.beginBlow(a, m, p);
      return;
    }
    if (m.kind === 'spin' && a.t > m.swing * 0.25 && !a.turned) { a.turned = true; this.facing = -this.facing; }
    if (m.kind === 'spin' && a.t > m.swing * 0.6 && !a.turned2) { a.turned2 = true; this.facing = -this.facing; }
    if (!a.hit && !p.dead && a.t > 0.02 && a.t < m.swing * 0.85 && this.blowHits(m, p)) {
      a.hit = true;
      const [cx, cy] = this.chest();
      const res = p.takeHit({ dmg: m.dmg * this.dmgMul, x: this.x, y: cy, kind: 'melee', source: this, knock: m.knock });
      if (this.act !== a) return;
      if (res === 'hit') {
        this.addHeat(HEAT.LAND);
        if (m.launch && !p.dead) { p.vy = Math.min(p.vy, -m.launch); p.onGround = false; }
        const [pcx, pcy] = p.chest();
        FX.sparks(pcx, pcy, m.stopper ? 26 : 12, this.facing > 0 ? 0 : Math.PI, 1.3, 80, m.stopper ? 320 : 240, KRAG_SPARK);
        FX.ring(pcx, pcy, 3, m.stopper ? 30 : 16, 0.22, { c: m.stopper ? '#ffb040' : KRAG_ORANGE, core: '#ffe0a0', w: 1 });
        if (m.stopper) { FX.debris(pcx, pcy, 8, KRAG_STONE, 160); FX.flash('#ff8a3a', 0.15); }
        Sound.play('kragHit', { heavy: !!m.stopper });
        Game.hitstop(m.stopper ? 0.09 : 0.04); Game.shake(m.stopper ? 0.4 : 0.15);
      } else if (res === 'parried' && !m.stopper) this.plowThrough(p, m);
    }
    if (m.quake && !a.quaked && a.t > 0.1) {
      a.quaked = true;
      if (this.onGround) {
        const f = this.facing, ax = this.x + f * 24;
        Game.hazards.push(new Shockwave(ax, this.y, f, 230 * S.enemies.speed, 10 * this.dmgMul, this));
        for (const s of [50, 82]) this.spawnVent(this.x + f * s, VENT.TELL);
        KragFX.crack(ax, this.y, { line: f, len: 100, life: 7, grow: 0.2 });
        this.slamFX(ax, this.y, 0.6);
      }
    }
    if (a.t >= m.swing) {
      this.attack = null;
      const cb = a.combo;
      if (cb && cb.i + 1 < cb.list.length && d < 110) { cb.i++; this.startMove(cb.list[cb.i], cb); return; }
      this.act = { kind: 'recover', t: 0, dur: (m.stopper ? rand(0.6, 0.85) : rand(0.4, 0.6)) * this.rageGap() };
      this.cds.combo = rand(0.25, 0.6) * this.rageGap();
    }
  }
  // the blow lands its weight on your parry anyway: you're driven back and it costs you shield
  plowThrough(p, m) {
    const u = sign(p.x - this.x) || this.facing;
    p.vx = u * (110 + m.knock * 0.3);
    if (!S.gameplay.invincible) p.shield = Math.max(0, p.shield - 6);
    this.addHeat(HEAT.PARRIED);
    const [pcx, pcy] = p.chest();
    FX.sparks(pcx, pcy, 8, u > 0 ? 0 : Math.PI, 1.2, 50, 160, KRAG_SPARK);
    Sound.play('kragBlock', { wear: 0 });
  }
  beginBlow(a, m, p) {
    a.phase = 'swing'; a.t = 0; a.hit = false; a.quaked = false;
    this.addHeat(HEAT.THROW);
    const d = Math.abs(p.x - this.x), f = this.facing;
    // drives into the blow after where you're going, never past you
    const dl = Math.max(0, (p.x + p.vx * 0.12 - this.x) * f);
    const v = Math.min(m.lunge * 26, (Math.max(0, Math.max(d, dl) - 19) / m.swing) * 2);
    this.lunge = { t: 0, dur: m.swing, v: f * v };
    if (m.leapV && this.onGround) { this.vy = -m.leapV; this.onGround = false; }
    const [lx, ly] = this.limbPos(m.limb), [cx, cy] = this.chest();
    if (m.kind === 'arc' && m.stopper) {
      const ang = (f > 0 ? 0 : Math.PI) + (m.over ? 0.25 : m.rising ? -0.45 : 0) * f;
      FX.swoosh({ x: cx, y: cy, follow: this, ox: f * 2, oy: -21, r: m.r, span: m.span, ang, dir: m.rising ? -f : f, sweep: m.swing * 0.6, dur: m.swing + 0.12, thick: 14, pal: PALETTES.molten, trail: 0.9, bolts: false });
    } else if (m.kind === 'spin') {
      FX.swoosh({ x: cx, y: cy, follow: this, ox: 0, oy: -21, r: m.r, span: TAU - 0.05, ang: -Math.PI / 2, dir: f, sweep: m.swing * 0.9, dur: m.swing + 0.15, thick: 12, pal: PALETTES.molten, trail: 0.9, bolts: false });
    }
    FX.sparks(lx, ly, m.stopper ? 14 : 5, f > 0 ? 0 : Math.PI, 0.8, 50, 180, KRAG_FIRE);
    if (m.stopper) FX.dust(this.x, this.y, 8, { smax: 50 });
    Sound.play('kragSwing', { heavy: !!m.stopper });
  }
  blowHits(m, p) {
    const [cx, cy0] = this.chest(), f = this.facing, cy = cy0 + (m.low ? 8 : 0);
    const bx = p.x - p.w / 2, by = p.y - p.h;
    if (m.kind === 'spin') return circleRect(cx, cy, m.r, bx, by, p.w, p.h);
    if (m.kind === 'arc') {
      const ang = (f > 0 ? 0 : Math.PI) + (m.over ? 0.25 : m.rising ? -0.45 : 0) * f;
      return sectorRect(cx, cy, m.r + 2, ang, m.span, bx, by, p.w, p.h);
    }
    const [pcx, pcy] = p.chest(), pa = clamp(Math.atan2(pcy - cy, Math.max(14, Math.abs(pcx - cx))), -0.5, 0.5);
    return segRect(cx, cy, cx + f * Math.cos(pa) * m.r, cy + Math.sin(pa) * m.r, 6, bx, by, p.w, p.h);
  }
  eyeGlint(c, size) { FX.glint(this._visor[0], this._visor[1], { c, size, dur: 0.24, follow: () => this._visor }); }

  // ---------- the Molten Fist ----------
  // overflow: it reached full heat behind its guard, and answers at once
  startPunch(p, overflow) {
    this.attack = null; this.lunge = null; this.drive = null;
    const wind = this.fistWind();
    this.facing = sign(p.x - this.x) || this.facing;
    this.act = { kind: 'punch', phase: 'wind', t: 0, wind, lockAt: wind * FIST.LOCK, locked: false, flashed: false, overflow: !!overflow, len: FIST.LEN, prof: null };
    this.planZone(this.act, p);
    this.perilFlash = 0.16;
    this.cds.punch = 99;
    Game.bulletTime(wind / FIST.BT + 0.2, { kind: 'peril', scale: FIST.BT, owner: this });
    Sound.play('peril', { dur: Math.max(0.1, (wind - CUE_LEAD) / FIST.BT) });
    Sound.play('kragCharge', { dur: wind / FIST.BT });
    const [cx, cy] = this.chest();
    FX.ring(this.x, this.y - 1, 6, 130, 0.45, { sy: 0.3, c: '#ff2a3a', core: '#ffd0d4', w: 2 });
    FX.ring(cx, cy, 4, 60, 0.35, { c: '#ffd0d4', core: '#ffffff', w: 1 });
    FX.sparks(cx, cy, 40, -Math.PI / 2, 1.2, 80, 280, { c0: '#ffffff', c1: '#ff5a6a', c2: '#781e2a' });
    FX.debris(this.x, this.y - 1, 14, KRAG_STONE, 120);
    FX.light(cx, cy, 130, '#ff2a3a', 1, 0.5);
    FX.flash('#ff2a3a', 0.12);
    // the street splits red under it as it gathers the blow
    KragFX.crack(this.x, this.y, { r: 60, red: true, grow: wind * 0.9, life: wind + 3 });
    Game.shake(0.35);
  }
  // The zone the Fist will split: from just behind its feet, a long way ahead along its facing, stopping at
  // walls; off a ledge it carries on along the ground below. prof: the surface under each step, null over the
  // molten river.
  planZone(a, p) {
    const f = this.facing, x0 = this.x - f * 7;
    let len = clamp(Math.abs(p.x - this.x) + 150, FIST.LEN, FIST.MAX);
    len = Math.max(20, (len + 4) * Level.raycast(x0, this.y - 6, x0 + f * (len + 4), this.y - 6) - 4);
    const prof = [];
    for (let s = 0; s <= len; s += 4) {
      const x = x0 + f * s, gy = Level.groundBelow(x, this.y - 3);
      prof.push(Level.lavaAt(x) || gy > Level.H ? null : gy);
    }
    a.x0 = x0; a.f = f; a.len = len; a.ky = this.y; a.prof = prof;
  }
  // 0..1 through the wind-up, reaching 1 as its visor flashes white just before the blow (the HUD's cue reads it)
  cueProgress() {
    const a = this.act;
    if (!a || a.kind !== 'punch' || a.phase !== 'wind') return 1;
    return clamp(a.t / Math.max(0.05, a.wind - CUE_LEAD), 0, 1);
  }
  // Its body is a wall during the wind-up: a dash carries you through to its back, or a jump over its head.
  blockPassage(p) {
    const rel = (p.x - this.x) * this.facing;
    if (p.dead || p.dashT > 0 || p.iaido || rel < -3 || rel >= 11 || p.y < this.y - this.h - 2) return;
    p.x = this.x + this.facing * 11;
    if (p.vx * this.facing < 0) p.vx = 0;
  }
  runPunch(dt, a, p) {
    if (a.phase === 'wind') {
      const [fx, fy] = this._L, k = clamp(a.t / Math.max(0.05, a.wind - CUE_LEAD), 0, 1);
      // it tracks you for the first half of the wind-up, then holds that line: the red flash off its visor
      if (a.t < a.lockAt) { this.facing = sign(p.x - this.x) || this.facing; this.planZone(a, p); }
      else if (!a.locked) {
        a.locked = true;
        this.planZone(a, p);
        this.eyeGlint('#ff2a3a', 3);
        FX.ring(this._visor[0], this._visor[1], 2, 40, 0.25, { c: '#ff8a8a', core: '#ffffff', w: 1 });
        FX.ring(this.x, this.y - 1, 6, 90, 0.3, { sy: 0.3, c: '#ff2a3a', core: '#ffd0d4', w: 2 });
        FX.flash('#ff2a3a', 0.16);
        Sound.play('kragLock');
        Game.shake(0.3);
      }
      this.blockPassage(p);
      // and just before the blow its visor flashes white
      if (!a.flashed && a.t >= a.wind - CUE_LEAD) {
        a.flashed = true;
        this.eyeGlint('#ffffff', 3);
        FX.light(fx, fy, 90, '#ffffff', 1, 0.25);
        Sound.play('glint');
      }
      // red energy and fire stream into the drawn-back fist
      for (let i = 0; i < 2; i++) {
        const ang = rand(0, TAU), R = lerp(36, 14, k);
        FX.sparks(fx + Math.cos(ang) * R, fy + Math.sin(ang) * R, 1, ang + Math.PI, 0.05, R * 3, R * 3.6, { c0: '#ffffff', c1: '#ff4a3a', c2: '#781e1a', g: 0, life: 0.8 });
      }
      if (Math.random() < 0.35 + 0.5 * k) { const ang = rand(0, TAU), R = lerp(40, 14, k); FX.bolt(fx + Math.cos(ang) * R, fy + Math.sin(ang) * R, fx, fy, 0.07, { outer: '#ff2a3a', core: '#ffffff', jag: 4 }); }
      // grit lifts off the street round it, and fire licks up out of the cracks
      if (Math.random() < 0.7) FX.add({ k: 'px', x: this.x + rand(-60, 60), y: this.y - 1, vx: 0, vy: -rand(20, 50), t: 0, dur: rand(0.8, 1.4), g: -10, drag: 0.5, c: pick(KRAG_STONE), sz: 1, bounce: 0 });
      if (Math.random() < 0.4) FX.sparks(this.x + rand(-50, 50), this.y - 1, 1, -Math.PI / 2, 0.4, 30, 90, { c0: '#ffffff', c1: '#ff4a3a', c2: '#781e1a', g: -40, life: 0.9 });
      if (Math.random() < 0.6) Game.shake(0.05 + 0.1 * k);
      if (a.t >= a.wind) {
        // a short heavy step in as the fist comes down into the street
        a.phase = 'strike'; a.t = 0;
        if (Game.btOwner === this) Game.endBulletTime();
        const L = Math.min(13, this.legRoom(this.facing, 13));
        this.lunge = { t: 0, dur: 0.08, v: this.facing * (2 * L / 0.08) };
        Sound.play('kragSwing', { heavy: true });
      }
      return;
    }
    if (a.phase === 'strike') {
      if (a.t >= 0.07) this.fistBlast(a, p);
      return;
    }
    // venting after it: the arm smokes, the rest of it heaves
    if (Math.random() < 0.6) FX.dust(this._L[0], this._L[1], 1, { c: KRAG_STEAM, smax: 10, rise: 30, life: 1.2 });
    if (a.t >= FIST.VENT * this.rageGap()) { this.act = null; this.cds.combo = 0.3; this.cds.punch = 1.5; }
  }
  // The fist goes into the street and the whole zone splits open into a molten chasm.
  fistBlast(a, p) {
    a.phase = 'vent'; a.t = 0;
    const f = this.facing, gx = this.x + f * 18, gy = this.y;
    this.heat = 0; this.ventT = HEAT.VENT; this.flared = false;
    Game.hazards.push(new MoltenChasm(this, a));
    KragFX.fireball(gx, gy - 8, 55, 0.55);
    FX.ring(gx, gy - 1, 6, 150, 0.55, { sy: 0.3, c: '#ff2a3a', core: '#ffd0d4', w: 2 });
    FX.ring(gx, gy - 1, 4, 80, 0.35, { sy: 0.3, c: '#ffffff', core: '#ffe0a0', w: 1 });
    FX.ring(gx, gy - 8, 4, 100, 0.45, { c: '#ffb040', core: '#ffe0a0', w: 2 });
    FX.sparks(gx, gy - 6, 70, f > 0 ? -0.5 : Math.PI + 0.5, 1.2, 120, 460, KRAG_FIRE);
    FX.sparks(gx, gy - 6, 40, -Math.PI / 2, TAU, 70, 260, KRAG_FIRE);
    FX.embers(gx, gy - 6, 40);
    FX.debris(gx, gy - 4, 34, KRAG_STONE, 260);
    FX.dust(gx, gy - 4, 26, { c: '#2a2026', smax: 120, rise: 24, life: 1.8, r1: 8 });
    FX.decal('scorch', gx, gy, { r: 34, dur: 14 });
    FX.light(gx, gy - 10, 260, '#ffa040', 1, 0.6);
    FX.flash('#ffb070', 0.45);
    Sound.play('kragPunch');
    Game.shake(1); Game.hitstop(0.06);
  }

  // ---------- getting to you ----------
  // The shoulder charge: the spiked pauldron dropped, then a long drive at you that ends in an explosion.
  startCharge(p) {
    this.attack = null; this.lunge = null;
    this.act = { kind: 'charge', phase: 'wind', t: 0, wind: this.tele(KCHARGE.WIND), glinted: false, hit: false };
    this.facing = sign(p.x - this.x) || this.facing;
    this.cds.charge = rand(4, 6);
    Sound.play('enemyWindup', { pm: 0.4 });
  }
  runCharge(dt, a, p) {
    const f = this.facing;
    if (a.phase === 'wind') {
      if (a.t < a.wind * 0.8) this.facing = sign(p.x - this.x) || this.facing;
      if (Math.random() < 0.6) FX.sparks(this.x - f * 6, this.y - 1, 1, f > 0 ? Math.PI : 0, 0.6, 30, 90, KRAG_FIRE);
      if (!a.glinted && a.t >= Math.max(0, a.wind - GLINT_LEAD)) {
        a.glinted = true;
        FX.glint(this._L[0], this.y - 28, { c: '#ffd070', size: 1.6, follow: () => [this.x + this.facing * 6, this.y - 28] });
        Sound.play('stopperCue');
      }
      if (a.t >= a.wind) {
        const L = Math.min(Math.abs(p.x - this.x) + 55, KCHARGE.MAX, this.legRoom(f, KCHARGE.MAX));
        if (L < 30) { this.act = { kind: 'recover', t: 0, dur: 0.3 }; return; }
        a.phase = 'run'; a.t = 0;
        const V = KCHARGE.SPEED * Math.sqrt(S.enemies.speed);
        this.drive = { vx: f * V, t: 0, dur: L / V };
        a.from = this.x;
        a.gouge = FX.decal('gouge', this.x, this.y, { len: 1, dur: 8 });
        this.burst(this.x - f * 4, this.y - 6, 0.6);
        Sound.play('kragLaunch');
      }
      return;
    }
    if (a.phase === 'run') {
      if (a.gouge && this.onGround) { a.gouge.x = Math.min(a.from, this.x); a.gouge.len = Math.abs(this.x - a.from); }
      FX.sparks(this.x - f * 4, this.y - rand(4, 24), 2, f > 0 ? Math.PI : 0, 0.5, 30, 110, Object.assign({ life: 0.9 }, KRAG_FIRE));
      if (Math.random() < 0.5) FX.dust(this.x - f * 4, this.y, 1, { smax: 40 });
      if (!a.hit && !p.dead && Math.abs(p.x - this.x) < (this.w + p.w) / 2 + 6 && p.y > this.y - this.h - 4 && p.y - p.h < this.y + 4) {
        a.hit = true;
        const res = p.takeHit({ dmg: KCHARGE.DMG * this.dmgMul, x: this.x, y: this.cy, kind: 'melee', source: this, knock: KCHARGE.KNOCK });
        if (this.act !== a) return;
        if (res === 'hit') { this.addHeat(HEAT.LAND); this.burst((this.x + p.x) / 2, p.cy, 0.8); this.drive = null; }
      }
      if (!this.drive) {
        a.phase = 'skid'; a.t = 0; a.wall = !!(this.col && (this.col.wallL || this.col.wallR));
        if (a.wall) { this.burst(this.x + f * 10, this.y - 18, 1); FX.decal('crack', this.x + f * 10, this.y - 12, { len: 14 }); }
      }
      return;
    }
    if (Math.random() < 0.7) FX.sparks(this.x + f * 4, this.y - 1, 1, f > 0 ? -2.4 : -0.7, 0.6, 40, 130, KRAG_SPARK);
    if (a.t > 0.45) { this.act = { kind: 'recover', t: 0, dur: (a.wall ? 1.0 : 0.6) * this.rageGap() }; this.cds.combo = 0.2; }
  }
  // the leap onto you: it sinks, launches, and comes down on where you're heading with all its weight
  startJump(p) {
    const q = this.landingSpot(p);
    if (q === null) { this.cds.jump = 2; return; }
    this.attack = null; this.lunge = null;
    this.act = { kind: 'jump', phase: 'crouch', t: 0, wind: this.tele(KJUMP.WIND), tx: q, ty: Level.groundBelow(q, p.y - 20), glinted: false, hit: false };
    this.facing = sign(q - this.x) || this.facing;
    this.cds.jump = rand(10, 14);
    Sound.play('enemyWindup', { pm: 0.35 });
  }
  landingSpot(p) {
    const x = clamp(p.x + clamp(p.vx * 0.45, -55, 55), 60, Level.W - 60);
    if (!Level.lavaAt(x - 9) && !Level.lavaAt(x + 9) && Math.abs(Level.groundBelow(x, p.y - 20) - p.y) < 18) return x;
    return this.spotNear(p.x, 6, 34);
  }
  runJump(dt, a, p) {
    if (a.phase === 'crouch') {
      if (a.t < a.wind * 0.8) { const q = this.landingSpot(p); if (q !== null) { a.tx = q; a.ty = Level.groundBelow(q, p.y - 20); } }
      this.facing = sign(a.tx - this.x) || this.facing;
      if (Math.random() < 0.7) FX.sparks(this.x + rand(-8, 8), this.y - 1, 1, -Math.PI / 2, 0.6, 20, 80, KRAG_FIRE);
      if (a.t >= a.wind) {
        a.phase = 'air'; a.t = 0;
        this.leapTo(a.tx, a.ty, KJUMP.LIFT, true);
        this.burst(this.x, this.y - 2, 0.6);
        FX.decal('crack', this.x, this.y, { len: 14 });
      }
      return;
    }
    if (a.phase === 'air') {
      const L = this.leap;
      if (L && !a.glinted && L.T - L.t <= GLINT_LEAD) {
        a.glinted = true;
        FX.glint(this._L[0], this._L[1], { c: '#ffd070', size: 1.6, follow: () => this._L });
        Sound.play('stopperCue');
      }
      if (Math.random() < 0.6) FX.sparks(this.x + rand(-6, 6), this.y - rand(4, 26), 1, Math.PI / 2, 0.6, 20, 70, KRAG_FIRE);
      return;
    }
    if (a.t > 0.75 * this.rageGap()) { this.act = { kind: 'recover', t: 0, dur: 0.3 }; this.cds.combo = 0.2; }
  }
  // Coming down with all its weight: a blast round it, shockwaves both ways and vents round it.
  slamImpact(r, dmg, vents) {
    const p = Game.player, a = this.act;
    if (!p.dead && !(a && a.hit) && Math.abs(p.x - this.x) < r + p.w / 2 && p.y > this.y - r - 10 && p.y - p.h < this.y + 4) {
      if (a) a.hit = true;
      const res = p.takeHit({ dmg: dmg * this.dmgMul, x: this.x, y: this.y - 10, kind: 'melee', source: this, knock: 330 });
      if (res === 'hit') this.addHeat(HEAT.LAND);
      if (this.act !== a) return;
    }
    for (const d of [-1, 1]) Game.hazards.push(new Shockwave(this.x + d * 16, this.y, d, 260 * S.enemies.speed, 12 * this.dmgMul, this));
    const offs = [-100, -58, 58, 100].slice(0, vents);
    for (const o of offs) this.spawnVent(this.x + o + rand(-6, 6), VENT.TELL);
    this.slamFX(this.x, this.y, 1);
  }
  // Stomps: a foot hauled up and driven down, a shockwave out round it and vents raised along the street at you;
  // three in a row as it rages.
  startStomp(p, n) {
    this.attack = null; this.lunge = null;
    this.act = { kind: 'stomp', phase: 'wind', t: 0, wind: this.tele(0.55), n, i: 0 };
    this.facing = sign(p.x - this.x) || this.facing;
    this.cds.stomp = rand(5, 7);
    Sound.play('enemyWindup', { pm: 0.35 });
  }
  runStomp(dt, a, p) {
    if (a.phase === 'wind') {
      this.facing = sign(p.x - this.x) || this.facing;
      if (Math.random() < 0.5) FX.sparks(this._F[0], this._F[1], 1, Math.PI / 2, 0.8, 15, 50, KRAG_FIRE);
      if (a.t >= a.wind) {
        a.phase = 'slam'; a.t = 0;
        const f = this.facing, at = this.x + f * 6, last = a.i + 1 >= a.n;
        if (this.onGround) {
          for (const d of [-1, 1]) Game.hazards.push(new Shockwave(at + d * 10, this.y, d, 230 * S.enemies.speed, 12 * this.dmgMul, this));
          KragFX.crack(at, this.y, { r: last ? 58 : 42, life: 8 });
          KragFX.crack(at, this.y, { line: f, len: last ? 120 : 88, life: 7, grow: 0.22 });
          const line = last ? [38, 72, 105] : [44, 77];
          line.forEach((s, i) => this.spawnVent(this.x + f * s, VENT.TELL - 0.15 + i * 0.12));
          if (last && a.n > 1) for (const s of [-50, -90]) this.spawnVent(this.x + f * s, VENT.TELL + 0.15);
          this.slamFX(at, this.y, last ? 0.9 : 0.6);
          this.addHeat(HEAT.STOMP);
        }
      }
      return;
    }
    if (a.t > 0.22) {
      if (++a.i < a.n) { a.phase = 'wind'; a.t = 0; a.wind = this.tele(0.32); return; }
      this.act = { kind: 'recover', t: 0, dur: 0.55 * this.rageGap() };
      this.cds.combo = 0.2;
    }
  }
  spawnVent(x, delay) {
    if (x < 50 || x > Level.W - 50 || Level.lavaAt(x)) return null;
    const y = Level.groundBelow(x, this.y - 20);
    if (y > Level.H || Math.abs(y - this.y) > 18) return null;
    const v = new MoltenVent(x, y, delay, this);
    Game.hazards.push(v);
    return v;
  }

  // ---------- the chain swing ----------
  // Something high to swing from: the underside of a platform or girder, or a street lamp's head, above and
  // near it, with room for a pendulum under it and a clear line from the far end of the swing to you.
  planSwing(p) {
    const cands = [], ky = this.y - 16, dirP = sign(p.x - this.x) || this.facing;
    for (const q of Level.platforms) {
      const uy = q.y + (q.kind === 'gantry' ? 8 : 4);
      for (let x = q.x + 4; x <= q.x + q.w - 4; x += 24) cands.push({ x, y: uy });
    }
    for (const l of Level.lamps) if (l.hx) cands.push({ x: l.x + 1, y: l.hy - 4, lamp: true });
    let best = null, bs = -Infinity;
    for (const A of cands) {
      const dx = A.x - this.x, up = ky - A.y;
      const R = Math.hypot(dx, up);
      if (up < 40 || up > 150 || Math.abs(dx) > 120 || R < 50 || R > 160) continue;
      // the anchor between it and you, or above it: it swings out under it toward you
      if (dx * dirP < -50) continue;
      const relX = A.x + dirP * Math.sin(1.1) * R, relY = A.y + Math.cos(1.1) * R + 16;
      if (!Level.rectFree(relX - this.w / 2, relY - this.h, this.w, this.h - 2)) continue;
      if (Level.raycast(A.x, A.y + 6, relX, relY - 16) < 1) continue;
      if (Level.raycast(relX, relY - 16, p.x, p.cy) < 1) continue;
      const score = -Math.abs(dx - dirP * 30) * 0.02 + R * 0.02 + rand(0, 1);
      if (score > bs) { bs = score; best = { A, R }; }
    }
    return best;
  }
  startSwing(p) {
    const plan = this.planSwing(p);
    if (!plan) return false;
    this.attack = null; this.lunge = null;
    const dirP = sign(p.x - this.x) || this.facing;
    this.act = { kind: 'swing', phase: 'fire', t: 0, plan, dirP, line: 0, glinted: false, hit: false };
    this.facing = sign(plan.A.x - this.x) || dirP;
    this.cds.swing = rand(9, 12);
    Sound.play('chain');
    return true;
  }
  // the bob's angle from straight down under the anchor (positive toward +x)
  swingAngle(A) { return Math.atan2(this.x - A.x, this.y - 16 - A.y); }
  runSwing(dt, a, p) {
    const P = a.plan, A = P.A;
    if (a.phase === 'fire') {
      // the chain flies from its right hand and bites
      a.line = clamp(a.t / 0.22, 0, 1);
      if (a.t >= 0.22) {
        a.phase = 'orbit'; a.t = 0;
        FX.sparks(A.x, A.y, 14, Math.PI / 2, TAU, 40, 160, KRAG_SPARK); FX.light(A.x, A.y, 40, '#ffb040', 1, 0.2);
        Sound.play('tetherAttach'); Sound.play('chainSwing');
        // it swings out under the anchor toward you, the swing growing each pass
        const th0 = this.swingAngle(A);
        a.amp0 = Math.max(Math.abs(th0), 0.45);
        // starting where it stands, moving toward you
        a.ph = -a.dirP * Math.acos(clamp(th0 / a.amp0, -1, 1));
        a.w = Math.sqrt(KRAG_G / P.R) * 1.05;
        a.passed = false; a.lastTh = th0;
      }
      return;
    }
    if (a.phase === 'orbit') {
      const amp = Math.min(1.25, a.amp0 + a.t * 0.55), th = amp * Math.cos(a.ph + a.t * a.w);
      // a pendulum: rising and falling under the anchor, its feet dragging on the street at the bottom
      const bx = A.x + Math.sin(th) * P.R, by = A.y + Math.cos(th) * P.R + 16;
      const gy = Level.groundBelow(bx, A.y + 8);
      const tx = bx, ty = Math.min(by, gy);
      this.vx = (tx - this.x) / dt; this.vy = (ty - this.y) / dt;
      const vth = th - a.lastTh; a.lastTh = th;
      this.facing = sign(vth) || this.facing;
      if (Math.sign(th) !== Math.sign(th - vth) && a.t > 0.1) a.passed = true;
      const spd = Math.abs(vth / dt) * P.R;
      if (by >= gy - 1 && spd > 40 && Math.random() < 0.8) { FX.sparks(this.x, this.y - 1, 2, this.facing > 0 ? Math.PI : 0, 0.7, 40, 140, KRAG_SPARK); FX.dust(this.x, this.y, 1, { smax: 30 }); }
      FX.sparks(this.x - this.facing * 4, this.y - rand(4, 26), 1, this.facing > 0 ? Math.PI : 0, 0.4, 20, 70, Object.assign({ life: 0.8 }, KRAG_FIRE));
      if (Math.random() < 0.4) FX.sparks(A.x, A.y, 1, Math.PI / 2, 1.5, 10, 40, KRAG_SPARK);
      if ((a.whoosh = (a.whoosh || 0) - dt) <= 0) { a.whoosh = Math.PI / a.w / 1.5; Sound.play('chainWhoosh', { pm: 0.8 + 0.4 * (amp / 1.25) }); }
      // let go on the upswing toward you, once it has come through the bottom
      const toward = sign(vth) === a.dirP && th * a.dirP > 0.35;
      const clear = Level.raycast(this.x, this.y - 16, p.x, p.cy) >= 1;
      if (a.passed && toward && clear && amp > 0.8 && !p.dead) this.releaseSwing(a, p);
      else if (a.t > 3 || (this.col && (this.col.wallL || this.col.wallR || this.col.ceil) && a.t > 0.2)) {
        // snagged, or no line at you: the chain lets go and it stumbles out of the swing
        FX.sparks(A.x, A.y, 10, Math.PI / 2, TAU, 30, 110, KRAG_SPARK);
        this.vx *= 0.4; this.vy = Math.max(this.vy, -100);
        this.act = { kind: 'recover', t: 0, dur: 0.5 };
      }
      return;
    }
    if (a.phase === 'fly') {
      const D = this.drive;
      if (D && !a.glinted && D.dur - D.t <= GLINT_LEAD + 0.05) {
        a.glinted = true;
        FX.glint(this._L[0], this._L[1], { c: '#ffd070', size: 1.6, follow: () => this._L });
        Sound.play('stopperCue');
      }
      if (Math.random() < 0.9) FX.sparks(this.x, this.cy, 2, Math.atan2(-this.vy, -this.vx), 0.5, 40, 120, Object.assign({ life: 0.7 }, KRAG_FIRE));
      if (!a.hit && !p.dead && dist(this.x, this.cy, p.x, p.cy) < 24) {
        a.hit = true;
        const res = p.takeHit({ dmg: KSWING.DMG * this.dmgMul, x: this.x, y: this.cy, kind: 'melee', source: this, knock: 380 });
        if (this.act !== a) return;
        if (res === 'hit') this.addHeat(HEAT.LAND);
        this.drive = null;
      }
      if (!this.drive) { a.phase = 'land'; a.t = 0; this.slamImpact(28, 16, 4); }
      return;
    }
    if (a.t > 0.7 * this.rageGap()) { this.act = { kind: 'recover', t: 0, dur: 0.3 }; this.cds.combo = 0.2; }
  }
  // It lets go and slings itself at you like a comet.
  releaseSwing(a, p) {
    a.phase = 'fly'; a.t = 0;
    const lx = p.x + p.vx * 0.15, ly = p.cy, dx = lx - this.x, dy = ly - this.cy, dh = Math.abs(dx) || 1;
    const V = KSWING.FLY * Math.sqrt(S.enemies.speed), T = clamp(dh / V, 0.15, 1.1), g = 600;
    this.drive = { vx: dx / T, vy: clamp(dy / T - 0.5 * g * T, -420, 300), g, t: 0, dur: T + 0.5 };
    this.facing = sign(dx) || this.facing;
    FX.sparks(a.plan.A.x, a.plan.A.y, 14, Math.PI / 2, TAU, 40, 160, KRAG_SPARK);
    this.burst(this.x - this.facing * 4, this.cy, 0.7);
    Sound.play('kragLaunch'); Sound.play('kragRoar', { pm: 1.15 });
  }

  // ---------- physics ----------
  physics(dt) {
    const a = this.act, p = Game.player;
    let gravity = true;
    if (this.drive) {
      // a straight drive: the charge, the flight off the chain
      const D = this.drive;
      D.t += dt;
      this.vx = D.vx;
      if (D.g) { D.vy += D.g * dt; this.vy = D.vy; gravity = false; }
      this.facing = sign(D.vx) || this.facing;
    } else if (this.leap) {
      const L = this.leap;
      L.t += dt; this.vx = L.vx; this.vy += L.g * dt; gravity = false;
    } else if (a && a.kind === 'swing' && a.phase === 'orbit') {
      gravity = false;
    } else if (this.lunge) {
      const L = this.lunge;
      L.t += dt;
      this.vx = L.v * Math.max(0, 1 - L.t / L.dur);
      if (L.t >= L.dur) this.lunge = null;
    } else if (this.thrownT <= 0) {
      const stunned = this.stunT > 0 || (a && a.kind === 'flinch');
      const W = !stunned ? this.want : 0;
      const acc = (this.onGround ? 1400 : 300) * dt;
      this.vx = approach(this.vx, W * this.runSpeed(), W || this.onGround ? acc : 40 * dt);
      if (Math.abs(this.vx) > 10 && this.onGround) this.stepWalk(dt);
    }
    if (gravity) this.vy = Math.min(this.vy + KRAG_G * dt * Game.gravMul(), 520);
    const wasGround = this.onGround, vy0 = this.vy;
    Level.moveBody(this, dt, { step: this.onGround || this.drive ? 11 : 0 });
    if (this.drive) {
      const D = this.drive;
      if (D.t >= D.dur || ((this.col.wallL || this.col.wallR) && D.t > 0.03) || (D.g && this.onGround && D.t > 0.1)) { this.drive = null; this.vx *= 0.2; }
    }
    if (this.leap) {
      const L = this.leap;
      if ((this.onGround && L.t > 0.1) || L.t > L.T + 0.6) { this.leap = null; this.onLand(L); }
    } else if (this.onGround && !wasGround && vy0 > 300) this.landingBurst(clamp(vy0 / 700, 0.25, 0.8));
    this.x = clamp(this.x, 44 + this.w / 2, Level.W - 44 - this.w / 2);
    if (this.y > Level.H + 40) { this.x = Level.freeGroundX(Level.W / 2, this.w); this.y = Level.GROUND - 60; this.vx = this.vy = 0; this.drive = null; this.leap = null; }
  }
  // its walk: footfalls that shake the street and leave smouldering prints
  stepWalk(dt) {
    const prev = this.walk;
    this.walk += Math.abs(this.vx) * dt * 0.11;
    for (const [i, off] of [[0, 0], [1, Math.PI]]) {
      const c0 = Math.cos(prev + off), c1 = Math.cos(this.walk + off);
      if (c0 > 0 && c1 <= 0) this.footfall(i);
    }
  }
  footfall(i) {
    const d = Math.abs(this.x - Game.player.x);
    if (d < 240) Game.shake(0.1 * clamp(1 - d / 240, 0.25, 1));
    Sound.play('kragStep');
    const fx = this.x + this.facing * (i ? -3 : 4);
    if (Level.lavaAt(fx)) return;
    FX.dust(fx, this.y, 2, { smax: 22 });
    if (chance(0.5)) FX.embers(fx, this.y - 1, 1);
    KragFX.print(fx, this.y);
  }
  // every landing is explosive; the leap onto you most of all
  onLand(L) {
    const a = this.act;
    if (L.attack && a && a.kind === 'jump') { a.phase = 'land'; a.t = 0; this.slamImpact(KJUMP.R, KJUMP.DMG, 4); return; }
    this.landingBurst(0.45);
  }
  landingBurst(k) {
    FX.dust(this.x, this.y, Math.round(18 * k + 4), { smax: 40 + 90 * k });
    FX.ring(this.x, this.y - 1, 3, 20 + 44 * k, 0.3, { sy: 0.3, c: KRAG_ORANGE, core: '#ffe0a0', w: 1 });
    FX.sparks(this.x, this.y - 1, Math.round(14 * k + 3), -Math.PI / 2, 1.6, 40, 120 + 110 * k, KRAG_FIRE);
    if (k > 0.4) { FX.decal('crack', this.x, this.y, { len: 14 + 12 * k }); KragFX.crack(this.x, this.y, { r: 22 + 28 * k, life: 6 }); FX.debris(this.x, this.y - 1, 14, KRAG_STONE, 160); Sound.play('kragStomp'); }
    Sound.play('land');
    Game.shake(0.15 + 0.4 * k);
  }
  // A blast at the ground: glowing cracks split out, a ring, a wall of dust, stone thrown up, fire.
  slamFX(x, y, k) {
    const near = clamp(1 - Math.abs(x - Game.player.x) / 330, 0.3, 1);
    FX.ring(x, y - 1, 4, 40 + 66 * k, 0.45, { sy: 0.3, c: KRAG_ORANGE, core: '#ffe0a0', w: 2 });
    FX.ring(x, y - 1, 3, 22 + 33 * k, 0.3, { sy: 0.3, c: '#ffd070', core: '#ffffff', w: 1 });
    FX.ring(x, y - 10, 4, 28 + 44 * k, 0.3, { c: '#ffb040', core: '#ffe0a0', w: 1 });
    FX.dust(x, y, Math.round(18 + 22 * k), { smin: 30, smax: 80 + 100 * k, rise: 10 });
    FX.dust(x, y, Math.round(8 + 8 * k), { c: '#2a2026', smax: 34, rise: 34, life: 1.6 });
    FX.debris(x, y - 1, Math.round(12 + 16 * k), KRAG_STONE, 170 + 100 * k);
    FX.sparks(x, y - 3, Math.round(16 + 20 * k), -Math.PI / 2, 1.4, 60, 200, KRAG_FIRE);
    FX.embers(x, y - 2, Math.round(6 + 8 * k));
    FX.decal('crack', x, y, { len: 18 + 18 * k });
    KragFX.crack(x, y, { r: 30 + 30 * k, life: 7 });
    FX.light(x, y - 9, 70 + 50 * k, '#ff8a2a', 1, 0.4);
    Sound.play('kragStomp', { big: k > 0.75 });
    Game.shake((0.35 + 0.5 * k) * near); Game.hitstop(0.035 * k);
  }
  // an explosion of fire off its body: setting off on a charge or a leap, meeting you, hitting a wall
  burst(x, y, k) {
    FX.ring(x, y, 3, 22 + 38 * k, 0.3, { c: KRAG_ORANGE, core: '#ffe0a0', w: 2 });
    FX.sparks(x, y, Math.round(18 + 24 * k), 0, TAU, 50, 180 + 130 * k, KRAG_FIRE);
    FX.dust(x, y, Math.round(6 + 10 * k), { c: '#2a2026', smax: 50, rise: 18 });
    FX.debris(x, y, Math.round(4 + 8 * k), KRAG_STONE, 140);
    if (k >= 0.5) KragFX.fireball(x, y, 18 + 22 * k, 0.35);
    FX.light(x, y, 60 + 50 * k, '#ff8a2a', 1, 0.28);
    Sound.play('explode', { big: k > 0.7 });
    Game.shake(0.18 + 0.35 * k);
  }

  // ---------- entry ----------
  // the quick way up out of the street (no cutscene): the street bursts round it in fire and stone
  eruptOut() {
    KragFX.fireball(this.x, this.y - 14, 46, 0.5);
    KragFX.crack(this.x, this.y, { r: 66, life: 10 });
    FX.ring(this.x, this.y - 1, 4, 110, 0.5, { sy: 0.3, c: KRAG_ORANGE, core: '#ffe0a0', w: 2 });
    FX.debris(this.x, this.y - 1, 30, KRAG_STONE, 280);
    FX.dust(this.x, this.y, 24, { smax: 140, rise: 16, life: 1.4 });
    FX.sparks(this.x, this.y - 4, 40, -Math.PI / 2, 0.9, 100, 320, Object.assign({ life: 1.1 }, KRAG_FIRE));
    FX.decal('scorch', this.x, this.y, { r: 30, dur: 12 });
    FX.light(this.x, this.y - 22, 200, '#ff8a2a', 1, 0.6);
    Sound.play('kragErupt');
    Game.shake(0.6);
  }
  // From here it fights. quick: no cutscene (training, retries); otherwise the cutscene showed the title.
  arrive(quick) {
    this.spawning = false;
    if (quick) Game.announce(this.name, null, '#ff9a5a', 2.6);
    this.act = { kind: 'intro', t: quick ? 0 : 0.5 };
  }
  // Entry: the street quakes and splits in glowing cracks round a spot, fire spitting out of them; the street
  // bursts in a column of fire and it's thrown up out of it, onyx fist first; it comes down in a crouch with a
  // blast, stands with steam pouring off it as its mohawk catches, roars, and its title hits as it beats its
  // fist into its palm.
  updateIntro(dt) {
    const I = this.intro, p = Game.player, B = 1.5;
    if (!I.started) {
      I.started = true;
      if (!p.dead) Game.startCine({ kind: 'kragIntro', focus: this, owner: this, camOY: -16 });
    }
    const C = Game.cine, own = C && C.owner === this;
    I.t += dt;
    const ct = (I.ct = own ? C.t : I.t);
    const once = (k) => (I.done[k] ? false : (I.done[k] = true));
    const x = this.x, gy = this.y;
    this.facing = sign(p.x - this.x) || this.facing;
    if (ct < B) {
      I.stage = 'quake';
      const k = ct / B;
      if (once('rumble')) {
        Sound.play('kragQuake', { dur: B });
        KragFX.crack(x, gy, { r: 55, grow: B * 0.8, life: 14 });
        Game.hazards.push(new MoltenVent(x, gy, B - 0.05, this, { half: 20, tall: 2, erupt: 0.9, harmless: true }));
      }
      if (ct > B * 0.45 && once('crack2')) { KragFX.crack(x, gy, { r: 90, grow: B * 0.5, life: 14 }); for (const d of [-1, 1]) KragFX.crack(x + d * 20, gy, { line: d, len: rand(80, 120), grow: B * 0.5, life: 14 }); }
      for (let i = 0; i < 1 + k * 3; i++) {
        const q = x + rand(-1, 1) * (4 + 50 * k);
        if (Math.random() < 0.6) FX.sparks(q, gy - 1, 1, -Math.PI / 2, 0.5, 30, 70 + 70 * k, Object.assign({ life: 0.8 }, KRAG_FIRE));
        else FX.debris(q, gy - 1, 1, KRAG_STONE, 40 + 60 * k);
      }
      if (Math.random() < 0.4) FX.dust(x + rand(-20, 20), gy, 1, { c: KRAG_STEAM, smax: 14, rise: 30, life: 1.6 });
      Game.shake(0.02 + 0.06 * k);
    } else if (ct < B + 1.05) {
      I.stage = 'burst';
      if (once('burst')) {
        // the street bursts and it's thrown up out of it
        I.oy = 40; I.vy = -620;
        Sound.play('kragErupt'); Sound.play('kragRoar');
        FX.flash('#ffd0a0', 0.55);
        KragFX.fireball(x, gy - 14, 60, 0.6);
        FX.ring(x, gy - 1, 4, 150, 0.6, { sy: 0.3, c: KRAG_ORANGE, core: '#ffe0a0', w: 2 });
        FX.ring(x, gy - 1, 3, 80, 0.45, { sy: 0.3, c: '#ffd070', core: '#ffffff', w: 1 });
        FX.debris(x, gy - 1, 50, KRAG_STONE, 340);
        FX.dust(x, gy, 34, { smax: 170, rise: 16, life: 1.6 });
        FX.dust(x, gy, 16, { c: '#2a2026', smax: 40, rise: 50, life: 2 });
        FX.sparks(x, gy - 4, 70, -Math.PI / 2, 0.9, 120, 380, Object.assign({ life: 1.3 }, KRAG_FIRE));
        FX.embers(x, gy - 4, 40);
        FX.decal('scorch', x, gy, { r: 36, dur: 16 });
        FX.decal('crack', x, gy, { len: 34, n: 8, dur: 16 });
        FX.light(x, gy - 22, 260, '#ff8a2a', 1, 0.8);
        Game.shake(0.9); Game.hitstop(0.05);
      }
      // the arc up out of the hole and back down
      I.vy += 1500 * dt;
      I.oy = Math.min(40, I.oy + I.vy * dt);
      if (I.vy > 0 && I.oy >= 0) { I.oy = 0; I.landed = true; }
      FX.sparks(x, gy + I.oy - 16, 3, I.vy < 0 ? Math.PI / 2 : -Math.PI / 2, 0.7, 40, 120, Object.assign({ life: 0.8 }, KRAG_FIRE));
      if (Math.random() < 0.6) FX.embers(x, gy + I.oy - 16, 1);
      if (I.landed && once('impact')) this.introLand();
    } else if (ct < B + 1.75) {
      I.stage = 'impact'; I.oy = 0;
      if (once('impact')) this.introLand();
      if (Math.random() < 0.6) FX.dust(x + rand(-7, 7), gy - rand(10, 28), 1, { c: KRAG_STEAM, smax: 12, rise: 30, life: 1.4 });
    } else if (ct < B + 2.75) {
      I.stage = 'rise';
      if (Math.random() < 0.8) FX.dust(x + rand(-7, 7), gy - rand(12, 30), 1, { c: KRAG_STEAM, smax: 12, rise: 30, life: 1.4 });
      if (ct >= B + 2.2 && once('lit')) {
        I.lit = true;
        FX.sparks(this._crest[0], this._crest[1], 30, -Math.PI / 2, 1, 40, 150, Object.assign({ g: -60, life: 1.2 }, KRAG_FIRE));
        FX.light(this._crest[0], this._crest[1], 60, '#ff8a2a', 1, 0.4);
        Sound.play('heatMax');
      }
    } else if (ct < B + 3.65) {
      I.stage = 'roar'; I.lit = true;
      if (once('roar')) {
        const [cx, cy] = this.chest();
        if (own) C.zoom = 2;
        FX.ring(cx, cy, 4, 130, 0.6, { c: KRAG_ORANGE, core: '#ffe0a0', w: 2 });
        FX.ring(x, gy - 1, 6, 110, 0.6, { sy: 0.3, c: '#ffb040', core: '#ffe0a0', w: 2 });
        FX.sparks(cx, cy, 50, 0, TAU, 80, 300, KRAG_FIRE);
        FX.dust(x, gy, 20, { smax: 110, rise: 8 });
        FX.light(cx, cy, 200, '#ff8a2a', 1, 0.8);
        FX.flash('#ff9a5a', 0.3);
        Sound.play('kragRoar'); Sound.play('enrageRoar');
        Game.shake(0.7);
      }
      if (Math.random() < 0.8) FX.sparks(this._crest[0], this._crest[1], 2, -Math.PI / 2, 0.8, 40, 120, Object.assign({ g: -70, life: 1 }, KRAG_FIRE));
    } else {
      I.stage = 'title';
      const t0 = B + 3.65;
      if (once('title')) {
        if (own) { C.zoom = 1; C.big = { style: 'title', text: this.name, color: '#ff8a3a', tag: 'FOUNDRY FRAME', sub: 'THE MOLTEN FIST' }; C.bigT = 0; }
        Sound.play('titleHit');
        FX.ring(x, this.cy, 4, 90, 0.5, { c: KRAG_ORANGE, core: '#ffe0a0', w: 2 });
        Game.shake(0.45);
      }
      // the fist beating into the palm
      const beat = Math.floor(((ct - t0) * 9) / Math.PI);
      if (beat !== I.beat) { I.beat = beat; if (beat % 2 === 0) { FX.sparks(this._L[0], this._L[1], 10, 0, TAU, 30, 110, KRAG_SPARK); Sound.play('kragBlock', { wear: 0 }); Game.shake(0.08); } }
      if (ct >= t0 + 1.55 && once('end')) this.endIntro();
    }
  }
  // it comes down out of the air in a crouch, the onyx fist driven into the street
  introLand() {
    const I = this.intro;
    I.oy = 0; I.vy = 0; this.onGround = true;
    Sound.play('kragStomp', { big: true });
    FX.ring(this.x, this.y - 1, 4, 100, 0.5, { sy: 0.3, c: KRAG_ORANGE, core: '#ffe0a0', w: 2 });
    FX.dust(this.x, this.y, 26, { smax: 130, rise: 10, life: 1.4 });
    FX.debris(this.x, this.y - 1, 20, KRAG_STONE, 200);
    KragFX.crack(this.x + this.facing * 12, this.y, { r: 38, life: 12 });
    FX.light(this.x, this.y - 10, 120, '#ff8a2a', 1, 0.4);
    Game.shake(0.7);
  }
  endIntro() {
    if (this.intro) this.intro.oy = 0;
    this.intro = null;
    if (Game.cine && Game.cine.owner === this) Game.closeCine();
    this.arrive(false);
  }

  // ---------- knockout ----------
  // The last hit freezes into slow motion; it staggers, vents everything it has, drops to a knee with the onyx
  // fist planted, and falls on its face as its fire goes out.
  onDeath(o = {}) {
    if (this.dying) return;
    this.dying = true; this.hp = 0; this.koT = 0;
    this.act = null; this.attack = null; this.lunge = null; this.drive = null; this.leap = null; this.stunT = 0;
    if (Game.btOwner === this) Game.endBulletTime();
    this.ko = { stage: 'impact', done: {}, rot: 0 };
    const p = Game.player;
    this.facing = sign(p.x - this.x) || this.facing;
    this.vx = -this.facing * 120; this.vy = -120; this.onGround = false;
    for (const h of Game.hazards) if ((h instanceof MoltenVent || h instanceof MoltenChasm) && h.owner === this) { if (h.seal) h.seal(true); h.dead = true; }
    FX.texts = FX.texts.filter((q) => dist(q.x, q.y, this.x, this.y) > 60);
    const [cx, cy] = this.chest(), ang = o.angle !== undefined ? o.angle : -0.5;
    FX.slashLine(cx - Math.cos(ang) * 50, cy - Math.sin(ang) * 50, cx + Math.cos(ang) * 50, cy + Math.sin(ang) * 50, { w: 5, dur: 0.22, grow: 0.01, pal: PALETTES.gold });
    FX.ring(cx, cy, 4, 90, 0.8, { c: '#ffd070', core: '#ffffff', w: 2 });
    FX.ring(cx, cy, 2, 50, 0.6, { c: KRAG_ORANGE, core: '#ffffff', w: 1 });
    FX.sparks(cx, cy, 60, ang, 2.2, 80, 420, KRAG_FIRE);
    FX.light(cx, cy, 200, '#ffffff', 1, 0.9);
    FX.flash('#ffffff', 0.7);
    Sound.play('koHit');
    Sound.setIntensity(0);
    Game.hitstop(0.12);
    Game.slowmo(0.12, 1.3, true);
    Game.shake(0.6);
    if (!p.dead) Game.startCine({ kind: 'kragKo', focus: this, owner: this, zoom: 2 });
  }
  updateDying(dt) {
    const K = this.ko, C = Game.cine, own = C && C.owner === this;
    this.koT += dt;
    const ct = own ? C.t : this.koT * 2.5;
    const once = (k) => (K.done[k] ? false : (K.done[k] = true));
    this.vx = approach(this.vx, 0, (this.onGround ? 600 : 120) * dt);
    this.vy = Math.min(this.vy + KRAG_G * dt, 520);
    Level.moveBody(this, dt);
    const [cx, cy] = this.chest();
    if (ct < 1.3) {
      K.stage = 'impact';
      if (Math.random() < 0.5) FX.sparks(cx, cy, 2, rand(0, TAU), TAU, 60, 220, KRAG_FIRE);
    } else if (ct < 2.1) {
      K.stage = 'stagger';
      if (once('stagger')) { if (own) C.zoom = 1; this.vx = -this.facing * 50; FX.dust(this._L[0], this._L[1], 10, { c: KRAG_STEAM, smax: 34, rise: 34, life: 1.6 }); Sound.play('steam'); }
      if (Math.random() < 0.6) FX.dust(this.x + rand(-7, 7), this.y - rand(10, 30), 1, { c: KRAG_STEAM, smax: 14, rise: 30, life: 1.4 });
    } else if (ct < 3.1) {
      K.stage = 'kneel';
      if (once('kneel')) { Sound.play('kragStomp'); FX.dust(this.x, this.y, 10, { smax: 60 }); Game.shake(0.3); KragFX.crack(this.x + this.facing * 14, this.y, { r: 26, life: 8 }); }
      if (Math.random() < 0.4) FX.dust(this.x + rand(-7, 7), this.y - rand(8, 24), 1, { c: KRAG_STEAM, smax: 12, rise: 24, life: 1.4 });
    } else if (ct < 3.45) {
      K.stage = 'collapse'; K.rot = clamp((ct - 3.1) / 0.35, 0, 1);
    } else {
      K.stage = 'down'; K.rot = 1;
      const hx = this.x + this.facing * 16;
      if (once('down')) {
        Sound.play('thud'); Sound.play('kragStomp');
        FX.dust(hx, this.y, 20, { smax: 100, rise: 6 });
        FX.debris(hx, this.y - 1, 10, this.def.debris, 130);
        FX.decal('crack', hx, this.y, { len: 30, dur: 10 });
        Game.shake(0.45);
      }
      if (ct >= 3.65 && once('big')) {
        if (own) { C.big = { text: 'KNOCKOUT', color: '#ffd070', sub: 'KRAG IS DOWN' }; C.bigT = 0; }
        Sound.play('ko');
        FX.flash('#fff4d0', 0.35);
        Game.shake(0.3);
      }
      if (Math.random() < 0.08) FX.embers(hx + rand(-9, 9), this.y - 4, 1);
      if (ct >= 5.4 && once('finish')) this.finishKO();
    }
  }
  // hold-to-skip from Game: jump to the end of whichever cutscene it is running
  skipCine() {
    if (this.intro) { this.endIntro(); return; }
    if (this.dying && this.ko && !this.dead) {
      this.ko.stage = 'down'; this.ko.rot = 1; this.vx = 0;
      this.draw(makeCanvas(VIEW_W, VIEW_H).ctx, this.x - VIEW_W / 2, this.y - VIEW_H / 2);
      this.finishKO();
    }
  }
  finishKO() {
    this.dead = true;
    if (this.spriteCopy) Game.props.push(new KragHusk(this));
    Game.onKill(this, { cause: 'boss' });
    Game.closeCine();
    Sound.setIntensity(0.3);
    if (Game.mode === 'training') return;
    SaveData.unlocks.krag = true;
    SaveData.bossKills++;
    saveProgress();
  }

  // ---------- drawing ----------
  // the colours of its molten light by heat, and of the onyx arm by wear
  tints() {
    const P = this._tint || (this._tint = {}), a = this.act, k = this.heatK(), w = this.wearK();
    const at = (u) => HEAT_RAMP[clamp(Math.round(u * (HEAT_RAMP.length - 1)), 0, HEAT_RAMP.length - 1)];
    const flick = ((this.t * 18) | 0) % 2, max = this.charged(), K = this.ko;
    const out = this.dying && K && (K.stage === 'collapse' || K.stage === 'down' || (K.stage === 'kneel' && ((this.t * 10) | 0) % 3 === 0));
    const dim = this.intro && !this.intro.lit;
    const stunned = this.stunT > 0;
    P.vein = out ? '#2a1a14' : dim ? '#5a1606' : stunned ? at(0.15) : max && flick ? '#ffe8b0' : at(0.35 + 0.6 * k);
    const hotArm = (a && a.kind === 'punch' && a.phase === 'wind') || (a && a.kind === 'guard' && a.charged);
    P.avein = out ? '#1a1210' : dim ? '#3a1408' : stunned || (a && a.kind === 'punch' && a.phase === 'vent') ? '#3a1408' : hotArm ? (flick ? '#ffffff' : '#ffd060') : max && flick ? '#fff0c8' : at(0.45 + 0.55 * k);
    P.visor = out ? '#1a1210' : dim ? '#5a1606' : this.windingUp() && flick ? '#ffffff' : '#ff9a30';
    P.core = out ? '#2a1a14' : dim ? '#5a1606' : max ? (flick ? '#ffffff' : '#ffd060') : at(0.55 + 0.45 * k);
    P.toe = out ? '#2a1a14' : at(0.4 + 0.5 * k);
    const broken = this.armDown > 0, plate = broken ? 0.85 : Math.round(w * 0.95 * 20) / 20, ash = broken ? '#3a302e' : '#8a7a70';
    for (const t in KRAG_ONYX) P[t] = plate > 0 ? mixHex(KRAG_ONYX[t], ash, plate) : KRAG_ONYX[t];
    const glow = (u) => (u <= 0 ? null : u < 0.35 ? mixHex('#1a161e', '#b02a08', u / 0.35) : u < 0.75 ? mixHex('#b02a08', '#ff6a1a', (u - 0.35) / 0.4) : mixHex('#ff6a1a', '#ffd890', Math.min(1, (u - 0.75) / 0.25)));
    const reform = this.reformT > 0 && ((this.t * 16) | 0) % 2;
    if (broken) { P.frac1 = P.frac2 = ((this.t * 3) | 0) % 2 ? '#5a1a0a' : '#3a1006'; }
    else {
      P.frac1 = reform ? '#ffd070' : glow((w - 0.15) / 0.45);
      P.frac2 = reform ? '#ffd070' : glow((w - 0.5) / 0.4);
      if (w > 0.85 && ((this.t * 12) | 0) % 3 === 0) { P.frac1 = '#fff0c0'; P.frac2 = '#ffffff'; }
    }
    return P;
  }
  // The pose: hip, lean, feet (fF front, fB back), fists (hL onyx, hR stone), crouch, and a whole-body rotation.
  pose() {
    const o = { hipX: 0, hipY: -13, lean: 0.06, fF: [4, 0], fB: [-4, 0], hL: [7, -13], hR: [-5, -13], crouch: 0, rot: 0, pivotY: -2, headBack: 0 };
    const a = this.act, I = this.intro, K = this.ko, t = this.t;
    const ease = (k) => easeOutCubic(clamp(k, 0, 1));
    const set = (src, k = 1) => { for (const key in src) { const v = src[key]; if (Array.isArray(v)) o[key] = [lerp(o[key][0], v[0], k), lerp(o[key][1], v[1], k)]; else o[key] = lerp(o[key], v, k); } };
    // walking: a heavy stride, arms swinging
    if (this.onGround && Math.abs(this.vx) > 15 && !(a && (a.kind === 'punch' || a.kind === 'guard' || a.kind === 'stomp'))) {
      const ph = this.walk;
      o.fF = [Math.sin(ph) * 6 + 1, -Math.max(0, Math.cos(ph)) * 3.5];
      o.fB = [Math.sin(ph + Math.PI) * 6 - 1, -Math.max(0, Math.cos(ph + Math.PI)) * 3.5];
      o.hL = [6 - Math.sin(ph) * 3, -13]; o.hR = [-4 + Math.sin(ph) * 3, -13];
      o.hipY = -13 + Math.abs(Math.sin(ph)) * 0.8; o.lean = 0.12;
    }
    if (!this.onGround && !(a && (a.kind === 'swing' || a.kind === 'jump'))) { o.fF = [4, -4]; o.fB = [-4, -3]; }
    if (this.dying && K) {
      if (K.stage === 'impact') set({ lean: -0.5, hL: [-4, -28], hR: [-9, -24], fF: [5, -1], fB: [-6, 0] });
      else if (K.stage === 'stagger') set({ lean: -0.2 + Math.sin(t * 9) * 0.08, hipY: -12, hL: [4, -6], hR: [-4, -7], fF: [3, 0], fB: [-7, 0] });
      else {
        set({ lean: 0.4, hipY: -9, fF: [7, 0], fB: [-8, -1], hL: [13, -1], hR: [3, -8] });
        if (K.stage === 'collapse' || K.stage === 'down') { const u = K.rot; set({ lean: lerp(0.4, 0.05, u), hL: [lerp(13, 22, u), lerp(-1, -16, u)], hR: [lerp(3, 4, u), lerp(-8, -22, u)], fF: [2, 0], fB: [-2, 0] }); o.rot = 1.5 * u * u; }
      }
      return o;
    }
    if (I) {
      if (I.stage === 'burst') set({ crouch: 5, lean: 0.4, hL: [9, -26], hR: [-4, -12], fF: [4, -6], fB: [-4, -5] });
      else if (I.stage === 'impact') set({ crouch: 6, lean: 0.5, hL: [14, -1], hR: [2, -8], fF: [7, 0], fB: [-7, 0] });
      else if (I.stage === 'rise') { const k = ease((I.ct - 3.25) / 0.6); set({ crouch: lerp(6, 0, k), lean: lerp(0.5, 0.05, k), hL: [lerp(14, 8, k), lerp(-1, -13, k)], hR: [lerp(2, -5, k), lerp(-8, -13, k)], fF: [lerp(7, 5, k), 0], fB: [lerp(-7, -5, k), 0] }); }
      else if (I.stage === 'roar') set({ lean: -0.3, headBack: 1, hL: [14, -33], hR: [-12, -31], fF: [6, 0], fB: [-6, 0] });
      else if (I.stage === 'title') { const b = Math.sin(((I.ct - 5.15) * 9) / 2); set({ lean: 0.05, hR: [9, -21], hL: [b > 0 ? 9 : 11, b > 0 ? -21 : -30], fF: [5, 0], fB: [-5, 0] }); }
      else set({ crouch: 8, lean: 0.6, hL: [12, -2], hR: [3, -5] });
      return o;
    }
    if (this.stunT > 0) {
      // thrown on its back, dazed, the arm smoking
      set({ lean: 0, hipY: -12, fF: [4, -2], fB: [-3, 0], hL: [9, -9], hR: [-7, -10] });
      o.rot = -1.45 * (this.onGround ? 1 : clamp((DETONATE.STUN - this.stunT) / 0.3, 0, 1)); o.pivotY = -2;
      return o;
    }
    if (!a) return o;
    const prog = (d) => clamp(a.t / Math.max(0.01, d), 0, 1);
    switch (a.kind) {
      case 'flinch': set({ lean: -0.35, hL: [-2, -16], hR: [-9, -19], fB: [-8, 0], fF: [4, 0] }); break;
      case 'flare': set({ lean: -0.3, headBack: 1, hL: [12, -30], hR: [-11, -29] }); break;
      case 'guard': {
        const k = ease(a.t / Math.max(0.01, a.rise));
        set({ lean: 0.08, hL: [9, -31], hR: [4, -17], fF: [6, 0], fB: [-6, 0] }, k);
        if (a.closeT > 0.2) set({ lean: 0.15 });
        break;
      }
      case 'melee': {
        const P = KRAG_POSE[a.move];
        if (a.phase === 'wind') set(P.w, ease(prog(a.wind * 0.8)));
        else { set(P.w); set(P.s, ease(prog(a.m.swing * 0.4))); }
        if (a.move === 'spinFist' && a.phase === 'swing') o.hL = [17, -22];
        break;
      }
      case 'punch':
        if (a.phase === 'wind') { const k = ease(prog(a.wind * 0.6)); set({ crouch: 3, lean: 0.25, hL: [-15, -31], hR: [7, -15], fF: [8, 0], fB: [-8, 0] }, k); }
        else if (a.phase === 'strike') set({ crouch: 7, lean: 0.65, hL: [17, -1], hR: [-3, -10], fF: [9, 0], fB: [-8, 0] });
        else set({ crouch: 6, lean: 0.55, hL: [14, -2], hR: [-2, -9], fF: [8, 0], fB: [-8, 0] });
        break;
      case 'charge':
        if (a.phase === 'wind') set({ lean: 0.55, crouch: 2, hL: [6, -15], hR: [-8, -11], fF: [6, 0], fB: [-9, 0] }, ease(prog(a.wind * 0.6)));
        else if (a.phase === 'run') { set({ lean: 0.7, crouch: 2, hL: [8, -17], hR: [-9, -12] }); const ph = t * 22; o.fF = [Math.sin(ph) * 7 + 2, -Math.max(0, Math.cos(ph)) * 4]; o.fB = [Math.sin(ph + Math.PI) * 7, -Math.max(0, Math.cos(ph + Math.PI)) * 4]; }
        else set({ lean: -0.1, hL: [5, -12], hR: [-6, -12], fF: [9, 0], fB: [-6, 0] });
        break;
      case 'jump':
        if (a.phase === 'crouch') set({ crouch: 6, lean: 0.35, hL: [5, -6], hR: [-6, -6], fF: [6, 0], fB: [-6, 0] }, ease(prog(a.wind)));
        else if (a.phase === 'air') set({ lean: 0.2, hL: [5, -36], hR: [-5, -32], fF: [5, -7], fB: [-4, -5] });
        else set({ crouch: 7, lean: 0.55, hL: [15, -1], hR: [2, -8], fF: [8, 0], fB: [-8, 0] });
        break;
      case 'stomp':
        if (a.phase === 'wind') set({ lean: -0.1, hL: [10, -18], hR: [-10, -18], fF: [4, -13], fB: [-4, 0] }, ease(prog(a.wind * 0.7)));
        else set({ crouch: 3, lean: 0.2, hL: [9, -14], hR: [-8, -14], fF: [7, 0], fB: [-5, 0] });
        break;
      case 'swing': {
        const A = a.plan.A, lx = (A.x - this.x) * this.facing, ly = A.y - this.y;
        const L = Math.hypot(lx, ly + 24) || 1, rx = (lx / L) * 15, ry = ((ly + 24) / L) * 15;
        if (a.phase === 'fire' || a.phase === 'orbit') set({ lean: -0.25, hR: [-3 + rx, -24 + ry], hL: [6, -16], fF: [6, -3], fB: [-6, -1] });
        else if (a.phase === 'fly') set({ lean: 0.5, hL: [16, -18], hR: [-9, -20], fF: [3, -8], fB: [-8, -6] });
        else set({ crouch: 6, lean: 0.5, hL: [14, -1], hR: [2, -8], fF: [8, 0], fB: [-8, 0] });
        break;
      }
      case 'intro': set({ lean: 0.05, hR: [9, -21], hL: [10, -24] }); break;
    }
    return o;
  }
  // Paints the body. EM: the emissive pass, which draws only what glows and cuts out what stands in front of it.
  render(g, EM) {
    const o = this.pose(), T = this.tints(), f = this.facing, t = this.t;
    const R = (x, y) => rotPt(x, y, 0, o.pivotY, o.rot);
    const P = (col, glow) => {
      if (!EM) { g.fillStyle = col; return; }
      g.globalCompositeOperation = glow ? 'source-over' : 'destination-out';
      g.fillStyle = glow ? col : '#000000';
    };
    const hip = [o.hipX, o.hipY + o.crouch];
    const neck = [hip[0] + Math.sin(o.lean) * 14, hip[1] - Math.cos(o.lean) * 14];
    const head = [neck[0] + Math.sin(o.lean * 0.7) * 4 + 1.5 - o.headBack * 2, neck[1] - Math.cos(o.lean * 0.7) * 5];
    const shL = [neck[0], neck[1] + 3], shR = [neck[0] - 3, neck[1] + 2];
    const [kFx, kFy, fFx, fFy] = ik2(hip[0] + 1, hip[1], o.fF[0], o.fF[1], 7.5, 7.5, 1);
    const [kBx, kBy, fBx, fBy] = ik2(hip[0] - 1, hip[1], o.fB[0], o.fB[1], 7.5, 7.5, 1);
    const [eLx, eLy, hLx, hLy] = ik2(shL[0], shL[1], o.hL[0], o.hL[1], 7, 7, -1);
    const [eRx, eRy, hRx, hRy] = ik2(shR[0], shR[1], o.hR[0], o.hR[1], 6.5, 6.5, -1);
    const J = (p) => R(p[0], p[1]);
    const [Hip, Neck, Head, ShL, ShR] = [J(hip), J(neck), J(head), J(shL), J(shR)];
    const [KF, FF, KB, FB] = [R(kFx, kFy), R(fFx, fFy), R(kBx, kBy), R(fBx, fBy)];
    const [EL, HL, ER, HR] = [R(eLx, eLy), R(hLx, hLy), R(eRx, eRy), R(hRx, hRy)];
    const rnd = Math.round;
    // stone limb: a thick block line with a seam glowing at its joint
    const stoneLimb = (a, b, w, col, dark) => {
      P(dark, false); pline(g, a[0], a[1] + 1, b[0], b[1] + 1, w);
      P(col, false); pline(g, a[0], a[1], b[0], b[1], w - 1);
      P(T.vein, true); g.fillRect(rnd((a[0] + b[0]) / 2), rnd((a[1] + b[1]) / 2), 1, 1);
    };
    const boot = (F, front) => {
      P('#2a2026', false); g.fillRect(rnd(F[0]) - 3, rnd(F[1]) - 3, 8, 3);
      P(front ? '#5a3a2a' : '#3a2c2a', false); g.fillRect(rnd(F[0]) - 3, rnd(F[1]) - 3, 7, 1);
      P(T.toe, true); g.fillRect(rnd(F[0]) + 3, rnd(F[1]) - 1, 2, 1); g.fillRect(rnd(F[0]) - 2, rnd(F[1]) - 1, 4, 1);
    };
    // back arm (stone, the chain hand) and its small pauldron
    stoneLimb(ShR, ER, 5, '#5a3a2a', '#3a2c2a');
    stoneLimb(ER, HR, 5, '#5a3a2a', '#3a2c2a');
    P('#3a2c2a', false); g.fillRect(rnd(HR[0]) - 2, rnd(HR[1]) - 2, 5, 5);
    P(T.vein, true); g.fillRect(rnd(HR[0]) - 1, rnd(HR[1]), 3, 1);
    P('#5a3a2a', false); g.fillRect(rnd(ShR[0]) - 3, rnd(ShR[1]) - 3, 6, 4);
    // back leg, with the spike off its knee
    stoneLimb([Hip[0] - 1, Hip[1]], KB, 6, '#5a3a2a', '#3a2c2a');
    stoneLimb(KB, FB, 5, '#5a3a2a', '#3a2c2a');
    P('#c08a44', false); pline(g, KB[0], KB[1], KB[0] + 3, KB[1] - 2, 1);
    boot(FB, false);
    // torso: stone blocks over a molten core, wide at the shoulders
    const ax = Neck[0] - Hip[0], ay = Neck[1] - Hip[1], al = Math.hypot(ax, ay) || 1, nx = -ay / al, ny = ax / al;
    for (let i = 0; i <= 14; i++) {
      const k = i / 14, half = lerp(5, 8, k), cx = Hip[0] + ax * k, cy = Hip[1] + ay * k;
      const row = Math.floor(k * 4), shade = row % 2 ? '#7c4c30' : '#9a6440';
      P(i === 14 ? '#c08a44' : shade, false);
      pline(g, cx - nx * half, cy - ny * half, cx + nx * half, cy + ny * half, 2);
    }
    // its seams: between the block rows and down the blocks, glowing by heat
    P(T.vein, true);
    for (const k of [0.27, 0.52, 0.77]) {
      const half = lerp(5, 8, k), cx = Hip[0] + ax * k, cy = Hip[1] + ay * k;
      pline(g, cx - nx * half, cy - ny * half, cx + nx * (half - 1), cy + ny * (half - 1), 1);
    }
    for (const [k, s] of [[0.15, -2], [0.4, 3], [0.65, -3], [0.88, 2]]) g.fillRect(rnd(Hip[0] + ax * k + nx * s), rnd(Hip[1] + ay * k + ny * s), 1, 2);
    // the hexagonal core in its chest
    const cc = [Hip[0] + ax * 0.62 + nx * 2.5, Hip[1] + ay * 0.62 + ny * 2.5];
    P('#2a1a14', false); pdisc(g, cc[0], cc[1], 3);
    P(T.core, true); pdisc(g, cc[0], cc[1], 2.1);
    if (this.heatK() > 0.7) { P('#ffffff', true); g.fillRect(rnd(cc[0]), rnd(cc[1]), 1, 1); }
    // the head, sunk between the shoulders: a dark plate with three glowing slits, the mohawk of flame on top
    P('#2a2026', false); g.fillRect(rnd(Head[0]) - 3, rnd(Head[1]) - 3, 7, 6);
    P('#3a2c2a', false); g.fillRect(rnd(Head[0]) - 3, rnd(Head[1]) - 3, 7, 1);
    P(T.visor, true);
    for (const yy of [-1, 1]) g.fillRect(rnd(Head[0]) + 1, rnd(Head[1]) + yy, 3, 1);
    g.fillRect(rnd(Head[0]) + 3, rnd(Head[1]), 1, 1);
    const crest = [Head[0] - 1, Head[1] - 3];
    if (!(this.dying && this.ko && this.ko.stage !== 'impact' && this.ko.stage !== 'stagger') && !(this.intro && !this.intro.lit)) {
      const k = this.heatK(), tall = (this.charged() ? 9 : 3 + k * 5) * (this.stunT > 0 ? 0.4 : 1);
      for (let i = -2; i <= 2; i++) {
        const h = Math.max(1, tall * (1 - Math.abs(i) * 0.22) + Math.sin(t * 17 + i * 2.1) * 1.6);
        P('#ff6a1a', true); g.fillRect(rnd(crest[0] + i), rnd(crest[1] - h), 1, rnd(h));
        P('#ffd070', true); g.fillRect(rnd(crest[0] + i), rnd(crest[1] - h * 0.55), 1, rnd(h * 0.55));
        if (h > 5) { P('#fff4d0', true); g.fillRect(rnd(crest[0] + i), rnd(crest[1] - h * 0.3), 1, Math.max(1, rnd(h * 0.3))); }
      }
    }
    // front leg
    stoneLimb([Hip[0] + 1, Hip[1]], KF, 6, '#9a6440', '#5a3a2a');
    stoneLimb(KF, FF, 5, '#9a6440', '#5a3a2a');
    boot(FF, true);
    // the onyx arm: a pauldron twice the size with a great spike, a ridge of spikes down the forearm, and a fist
    // as wide as its chest, spiked across the knuckles with its plates glowing between them
    P(T.mid, false); pline(g, ShL[0], ShL[1], EL[0], EL[1], 5);
    P(T.plate, false); pline(g, EL[0], EL[1], HL[0], HL[1], 6);
    P(T.hi, false); pline(g, EL[0], EL[1] - 1, HL[0], HL[1] - 2, 1);
    const fdx = HL[0] - EL[0], fdy = HL[1] - EL[1], fl = Math.hypot(fdx, fdy) || 1;
    P('#c8c0c8', false);
    for (const k of [0.25, 0.55, 0.85]) { const sx = EL[0] + fdx * k, sy = EL[1] + fdy * k; pline(g, sx, sy, sx + (fdy / fl) * 3, sy - (fdx / fl) * 3, 1); }
    if (T.frac1) { P(T.frac1, true); pline(g, EL[0] + fdx * 0.2, EL[1] + fdy * 0.2 + 1, EL[0] + fdx * 0.6, EL[1] + fdy * 0.6 - 1, 1); }
    if (T.frac2) { P(T.frac2, true); pline(g, EL[0] + fdx * 0.55, EL[1] + fdy * 0.55, EL[0] + fdx * 0.8 + 1, EL[1] + fdy * 0.8 + 1, 1); }
    // the fist
    const hx = rnd(HL[0]), hy = rnd(HL[1]);
    P(T.plate, false); g.fillRect(hx - 4, hy - 4, 8, 8);
    P(T.hi, false); g.fillRect(hx - 4, hy - 4, 8, 1);
    P(T.mid, false); g.fillRect(hx - 4, hy + 3, 8, 1);
    P(T.avein, true); g.fillRect(hx - 3, hy - 1, 6, 1); g.fillRect(hx, hy - 3, 1, 6);
    P('#d8d0d8', false); for (const yy of [-3, 0, 3]) g.fillRect(hx + 4, hy + yy, 2, 1);
    // the great pauldron
    const px = rnd(ShL[0]), py = rnd(ShL[1]);
    P(T.plate, false); g.fillRect(px - 6, py - 3, 10, 6);
    P(T.hi, false); g.fillRect(px - 6, py - 3, 10, 1); g.fillRect(px - 6, py - 3, 1, 5);
    P(T.mid, false); g.fillRect(px - 6, py + 2, 10, 1);
    P('#d8d0d8', false); pline(g, px - 2, py - 3, px - 4, py - 8, 1); pline(g, px - 1, py - 3, px - 3, py - 7, 1);
    if (T.frac1) { P(T.frac1, true); pline(g, px - 4, py - 2, px + 1, py + 1, 1); }
    P(T.avein, true); g.fillRect(px - 5, py, 8, 1);
    if (EM) g.globalCompositeOperation = 'source-over';
    // where its parts are, in the world
    const W = (p) => [this.x + p[0] * f, this.y + p[1]];
    this._L = W(HL); this._R = W(HR); this._F = W(FF); this._visor = W([Head[0] + 3, Head[1]]); this._crest = W(crest);
  }
  draw(ctx, camX, camY) {
    const I = this.intro;
    if (this.spawning && !(I && I.stage !== 'quake')) return;
    const oy = I ? I.oy : 0, gy = this.y - camY;
    const g = Sprite.begin(this.facing);
    this.render(g, false);
    if (!this.spriteCopy) this.spriteCopy = makeCanvas(Sprite.SIZE, Sprite.SIZE);
    const cc = this.spriteCopy.ctx;
    cc.clearRect(0, 0, Sprite.SIZE, Sprite.SIZE);
    cc.drawImage(Sprite.scratch, 0, 0);
    const flash = this.hitFlash > 0 ? '#ffffff' : this.dying && this.ko && this.ko.stage === 'impact' && ((this.t * 40) | 0) % 2 ? '#fff4d0' : this.cutMark && ((this.t * 30) | 0) % 2 ? '#ff8a2a' : null;
    // bursting up out of the street, it's hidden below the street's surface
    if (oy > 0) { ctx.save(); ctx.beginPath(); ctx.rect(0, 0, VIEW_W, Math.round(gy)); ctx.clip(); }
    Sprite.end(ctx, this.x - camX, gy + oy, { flash });
    if (oy > 0) ctx.restore();
  }
  // the outline tells (red: the Fist; gold: a stopper; blue: the guard coming up; white hot: the charged guard),
  // then its molten light over the lit scene, then the Fist's zone, the leap's mark and the chain
  drawEmissive(ctx, camX, camY) {
    const x = this.x - camX, y = this.y - camY, a = this.act, I = this.intro;
    if (this.dead) return;
    if (this.spawning && !(I && I.stage !== 'quake')) return;
    const oy = I ? I.oy : 0;
    if (!this.dying && !this.spawning && this.spriteCopy) {
      const fl = ((this.t * 24) | 0) % 2;
      let rim = null, glow = 0.35;
      if (a && a.kind === 'punch' && a.phase === 'wind') { rim = this.perilFlash > 0 && ((this.t * 30) | 0) % 2 ? '#ffffff' : '#ff2a3a'; glow = Game.btOwner === this ? 0 : 0.5; }
      else if (a && a.kind === 'guard' && a.t < a.rise) rim = fl ? '#bfe8ff' : '#2a9aff';
      else if (a && a.kind === 'guard' && a.charged) rim = ((this.t * 14) | 0) % 2 ? '#fff0c8' : '#ff8a2a';
      else if (a && a.kind === 'melee' && a.m.stopper && a.phase === 'wind') { rim = a.glinted && fl ? '#ffffff' : '#ffd070'; glow = 0.45; }
      if (rim) Sprite.outlined(ctx, this.spriteCopy, x, y, rim, { glow });
    }
    if (oy > 0) { ctx.save(); ctx.beginPath(); ctx.rect(0, 0, VIEW_W, Math.round(y)); ctx.clip(); }
    const g = Sprite.begin(this.facing);
    this.render(g, true);
    g.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(Sprite.scratch, Math.round(x) - Sprite.OX, Math.round(y + oy) - Sprite.OY);
    if (oy > 0) ctx.restore();
    if (this.spawning || this.dying) return;
    if (a && a.kind === 'punch' && a.phase === 'wind' && a.prof) drawFistZone(ctx, a, camX, camY, this.t, a.locked);
    if (a && a.kind === 'jump' && a.phase !== 'land') {
      // where it will land: a ring and a cross on the street, blinking faster as it falls
      const L = this.leap, k = L ? clamp(L.t / L.T, 0, 1) : 0, mx = Math.round(a.tx - camX), my = Math.round(a.ty - camY);
      const on = ((this.t * (6 + k * 20)) | 0) % 2;
      ctx.fillStyle = on ? '#ffffff' : KRAG_ORANGE;
      pring(ctx, mx, my - 1, KJUMP.R, 0.25, 1);
      pline(ctx, mx - 6, my - 3, mx + 6, my + 1, 1); pline(ctx, mx - 6, my + 1, mx + 6, my - 3, 1);
    }
    if (a && a.kind === 'swing' && (a.phase === 'fire' || a.phase === 'orbit')) {
      // the chain from its stone hand to what it bit
      const [hx, hy] = this._R, A = a.plan.A, k = a.phase === 'fire' ? a.line : 1;
      const ex = hx + (A.x - hx) * k, ey = hy + (A.y - hy) * k, L = Math.hypot(ex - hx, ey - hy);
      for (let d = 0; d < L; d += 2) {
        ctx.fillStyle = (d / 2) % 2 ? '#5a5054' : '#8a8088';
        ctx.fillRect(Math.round(hx + ((ex - hx) * d) / L - camX), Math.round(hy + ((ey - hy) * d) / L - camY), 1, 1);
      }
      if (k >= 1) { ctx.fillStyle = '#ffd070'; ctx.fillRect(Math.round(A.x - camX) - 1, Math.round(A.y - camY) - 1, 3, 3); }
    }
    if (this.stunT > 0) {
      const [vx, vy] = this._visor;
      for (let i = 0; i < 3; i++) {
        const an = this.t * 5 + (i * TAU) / 3;
        ctx.fillStyle = i ? '#ffd070' : '#ffffff';
        ctx.fillRect(Math.round(vx - camX + Math.cos(an) * 8), Math.round(vy - camY - 6 + Math.sin(an) * 2), 1, 1);
      }
    }
  }
  addLights() {
    if (this.spawning && !(this.intro && this.intro.stage !== 'quake')) { FX.frameLight(this.x, this.y - 4, 60, '#ff7a2a', 0.8); return; }
    if (this.dying && this.ko && (this.ko.stage === 'collapse' || this.ko.stage === 'down')) return;
    const k = this.heatK(), [cx, cy] = this.chest();
    FX.frameLight(cx, cy, 40 + 40 * k, '#ff7a2a', 0.5 + 0.4 * k);
    FX.frameLight(this._visor[0], this._visor[1], 16, '#ff9a30', 0.9);
    FX.frameLight(this._L[0], this._L[1], 20 + 20 * k, '#ff6a1a', 0.5 + 0.3 * k);
    const a = this.act;
    if (a && a.kind === 'punch' && a.phase === 'wind') FX.frameLight(this._L[0], this._L[1], 70, '#ff2a3a', 1);
    if (a && a.kind === 'guard' && a.t < a.rise) FX.frameLight(this._L[0], this._L[1], 40, '#3aa8ff', 0.9);
  }
}

// The Molten Fist's zone on the street: red along every step of it, hard ends, flickering once it holds.
function drawFistZone(ctx, a, camX, camY, t, locked) {
  const blink = ((t * (locked ? 24 : 8)) | 0) % 2;
  let last = null, lastY = 0;
  for (let i = 0; i < a.prof.length; i++) {
    const gy = a.prof[i];
    if (gy === null) { last = null; continue; }
    const x = Math.round(a.x0 + a.f * i * 4 - camX), y = Math.round(gy - camY);
    if (x < -6 || x > VIEW_W + 6) { last = x; lastY = y; continue; }
    ctx.globalAlpha = 0.35; ctx.fillStyle = '#ff2a3a'; ctx.fillRect(Math.min(x, x + a.f * 4), y - 3, 4, 3); ctx.globalAlpha = 1;
    ctx.fillStyle = locked ? '#ff2a3a' : '#c81a2a'; ctx.fillRect(Math.min(x, x + a.f * 4), y, 4, 1);
    if (i % 3 === 0) { ctx.fillStyle = '#ffd0d4'; ctx.fillRect(x, y - 1, 1, 1); }
    // a step down off a ledge: the red runs down the drop
    if (last !== null && y - lastY > 6) { ctx.fillStyle = '#ff2a3a'; for (let yy = lastY; yy < y; yy += 3) ctx.fillRect(x, yy, 1, 2); }
    last = x; lastY = y;
  }
  // the end caps
  const ends = [0, a.prof.length - 1];
  for (const i of ends) {
    let j = i;
    while (j >= 0 && j < a.prof.length && a.prof[j] === null) j += i === 0 ? 1 : -1;
    if (j < 0 || j >= a.prof.length) continue;
    const x = Math.round(a.x0 + a.f * j * 4 - camX), y = Math.round(a.prof[j] - camY);
    ctx.fillStyle = locked && blink ? '#ffffff' : '#ff2a3a';
    ctx.fillRect(x, y - 9, 1, 10); ctx.fillRect(x - a.f, y - 9, 1, 2);
  }
}

// The Molten Fist's chasm: the split races out from the fist to the end of the zone (and down off any ledge in
// it onto the ground below), throwing fire and stone up as it goes, and hits you as it reaches you: on its level
// or below, jumping or not. It hits only as it passes; step in after and only its vents can hurt you. Then it
// erupts in vents for a few seconds, every one done before it seals at once in a hiss of steam.
class MoltenChasm {
  constructor(owner, a) {
    this.owner = owner; this.x0 = a.x0; this.f = a.f; this.len = a.len; this.ky = a.ky; this.prof = a.prof.slice();
    this.t = 0; this.front = 0; this.s = 8; this.n = 0; this.ventT = 0.4; this.hit = false; this.dodged = false; this.sealed = false; this.dead = false; this.sealT = 0;
  }
  surf(s) { const i = clamp(Math.round(s / 4), 0, this.prof.length - 1); return this.prof[i]; }
  update(dt) {
    this.t += dt;
    const P = Game.player, K = this.owner;
    this.front = Math.min(this.len, this.front + FIST.FRONT * dt);
    if (!this.hit && !P.dead && K && !K.dead) {
      const along = (P.x - this.x0) * this.f;
      const level = P.y > this.ky - (P.onGround ? FIST.LIFT : FIST.FLY);
      if (level && along >= -4 && along <= this.len && along <= this.front + 6 && this.t <= Math.max(0, along) / FIST.FRONT + CHASM.HIT) {
        this.hit = true;
        const res = P.takeHit({ dmg: FIST.DMG * K.dmgMul, x: P.x - this.f * 20, y: P.y + 4, kind: 'melee', source: K, knock: FIST.KNOCK, unparryable: true, pierce: true, through: true, daze: FIST.DAZE });
        if (res === 'hit') {
          P.vy = -380; P.onGround = false;
          const [pcx, pcy] = P.chest();
          FX.sparks(pcx, pcy, 40, this.f > 0 ? -0.6 : Math.PI + 0.6, 1.6, 120, 460, KRAG_FIRE);
          FX.flash('#ff3010', 0.6);
          Game.hitstop(0.18); Game.slowmo(0.3, 0.45, true);
        }
      } else if (!this.dodged && this.front >= this.len && Math.abs(P.x - this.x0) < this.len + 60) { this.dodged = true; P.perilDodge(K); }
    }
    // the split racing out: fire and stone thrown up along it
    while (this.s < this.front) {
      const s = this.s, gy = this.surf(s), x = this.x0 + this.f * s;
      if (gy !== null) {
        FX.sparks(x, gy - 2, 5, -Math.PI / 2 + this.f * 0.3, 0.7, 80, 280, Object.assign({ life: 1.1 }, KRAG_FIRE));
        if (Math.random() < 0.5) FX.dust(x, gy, 2, { c: '#2a2026', smax: 40, rise: 34, life: 1.4 });
        if (Math.random() < 0.4) FX.debris(x, gy - 1, 2, KRAG_STONE, 180);
        if (this.n++ % 4 === 1) { KragFX.fireball(x, gy - 10, rand(20, 32), 0.42); FX.light(x, gy - 10, 60, '#ff8a2a', 1, 0.3); }
        if (this.n % 3 === 0) KragFX.crack(x, gy, { r: rand(22, 36), life: CHASM.DUR + 1, grow: 0.12, hot: true, owner: this });
      }
      this.s += 8;
    }
    if (this.front >= this.len && !this.boomed) { this.boomed = true; Sound.play('kragRumble'); Game.shake(0.35); }
    // its floor erupting: vents up through it, never right under you while you're dazed, all done as it seals
    const lastVent = CHASM.ERUPT - Math.max(0.2, VENT.TELL * S.enemies.telegraph) - VENT.ERUPT;
    if (this.front >= this.len && this.t < lastVent && K && !K.dead && !K.dying && (this.ventT -= dt) <= 0) {
      this.ventT = (1 / CHASM.RATE) * rand(0.7, 1.3);
      for (let tries = 0; tries < 4; tries++) {
        const s = rand(33, this.len - 11), gy = this.surf(s), x = this.x0 + this.f * s;
        if (gy === null || (P.dazeT > 0 && Math.abs(x - P.x) < 38)) continue;
        Game.hazards.push(new MoltenVent(x, gy, VENT.TELL, K, { chasm: this }));
        break;
      }
    }
    if (this.t >= CHASM.ERUPT && !this.sealed) this.seal();
    if (this.sealed) this.sealT += dt;
    if (this.t >= CHASM.DUR) this.dead = true;
  }
  // crusting over all at once in a hiss of steam: nothing in it hurts from here
  seal(quiet) {
    if (this.sealed) return;
    this.sealed = true;
    KragFX.seal(this);
    if (quiet) return;
    for (let s = 12; s < this.len; s += 20) {
      const gy = this.surf(s);
      if (gy !== null) FX.dust(this.x0 + this.f * s, gy, 2, { c: KRAG_STEAM, smax: 40, rise: 40, life: 1.8 });
    }
    Sound.play('chasmSeal');
    Game.shake(0.15);
  }
  // the chasm's floor glowing molten behind the split, then a dark crust that fades
  drawEmissive(ctx, camX, camY) {
    const glow = this.sealed ? clamp(1 - this.sealT / 0.5, 0, 1) : 1, crust = this.sealed ? clamp(1 - (this.sealT - 0.3) / 1.4, 0, 1) : 0;
    for (let s = 0; s < this.front; s += 2) {
      const gy = this.surf(s);
      if (gy === null) continue;
      const x = Math.round(this.x0 + this.f * s - camX), y = Math.round(gy - camY);
      if (x < -2 || x > VIEW_W + 2) continue;
      const age = this.t - s / FIST.FRONT, n = Math.sin(s * 0.7 + this.t * 6) * 0.5 + 0.5;
      if (glow > 0) {
        ctx.globalAlpha = glow;
        ctx.fillStyle = age < 0.15 ? '#ffffff' : n > 0.7 ? '#ffd070' : n > 0.3 ? '#ff8a2a' : '#e05414';
        ctx.fillRect(x, y, 2, 2);
        if (n > 0.55) { ctx.fillStyle = '#ff6a1a'; ctx.fillRect(x, y - 1, 2, 1); }
        ctx.globalAlpha = 1;
      }
      if (crust > 0) { ctx.globalAlpha = crust; ctx.fillStyle = '#2a2026'; ctx.fillRect(x, y, 2, 2); ctx.globalAlpha = 1; }
    }
  }
  addLights() {
    if (this.sealed && this.sealT > 0.5) return;
    for (let s = 10; s < this.front; s += 50) { const gy = this.surf(s); if (gy !== null) FX.frameLight(this.x0 + this.f * s, gy - 4, 46, '#ff6a1a', 0.85); }
  }
}

// A molten vent: a glowing crack in the street, bubbling and pulsing faster, that bursts into a column of fire.
// Standing on it as it erupts throws you up out of it. o.half, o.tall, o.erupt size it; o.harmless for show.
class MoltenVent {
  constructor(x, y, delay, owner, o = {}) {
    this.x = x; this.y = y; this.owner = owner; this.half = o.half || VENT.HALF; this.tall = o.tall || 1; this.erupt = o.erupt || VENT.ERUPT; this.harmless = !!o.harmless;
    this.delay = Math.max(0.2, delay * (this.harmless ? 1 : S.enemies.telegraph));
    this.t = 0; this.phase = 'tell'; this.dead = false; this.hit = false;
    KragFX.crack(x, y, { r: this.half * 1.6, life: this.delay + 3, grow: Math.min(0.4, this.delay * 0.6), owner: o.chasm || null });
  }
  update(dt) {
    this.t += dt;
    if (this.phase === 'tell') {
      if (Math.random() < 0.5) FX.sparks(this.x + rand(-this.half, this.half) * 0.6, this.y - 1, 1, -Math.PI / 2, 0.5, 15, 50, KRAG_FIRE);
      if (this.t >= this.delay) {
        this.phase = 'erupt'; this.t = 0;
        const k = this.half / VENT.HALF;
        FX.sparks(this.x, this.y - 3, Math.round(28 * k), -Math.PI / 2, 0.6, 100, 300 * Math.sqrt(this.tall), Object.assign({ life: 1.2 }, KRAG_FIRE));
        FX.embers(this.x, this.y - 2, Math.round(12 * k));
        FX.dust(this.x, this.y, Math.round(7 * k), { c: '#2a2026', smax: 34 * k, rise: 34, life: 1.3 });
        FX.debris(this.x, this.y - 1, Math.round(4 * k), KRAG_STONE, 150);
        FX.ring(this.x, this.y - 1, this.half * 0.6, this.half * 1.8, 0.3, { sy: 0.3, c: '#ffb040', core: '#ffe0a0', w: 1 });
        FX.light(this.x, this.y - 16, 70 * k, '#ff8a2a', 1, 0.45);
        if (Math.abs(this.x - Game.player.x) < 330) Sound.play('molten', { big: k > 1.2 });
      }
      return;
    }
    if (this.phase === 'erupt') {
      if (Math.random() < 0.9) FX.sparks(this.x + rand(-0.4, 0.4) * this.half, this.y - rand(4, VENT.TALL * this.tall), 1, -Math.PI / 2, 0.5, 50, 140, KRAG_FIRE);
      const P = Game.player;
      if (!this.harmless && !this.hit && !P.dead && Math.abs(P.x - this.x) < this.half + P.w / 2 && P.y > this.y - VENT.TALL * this.tall && P.y < this.y + 4) {
        this.hit = true;
        const res = P.takeHit({ dmg: VENT.DMG * (this.owner ? this.owner.dmgMul : 1), x: this.x, y: this.y + 8, kind: 'shockwave', source: this.owner && !this.owner.dead ? this.owner : null, knock: 120 });
        if (res === 'hit') { P.vy = -360; P.onGround = false; }
      }
      if (this.t >= this.erupt) { this.phase = 'fade'; this.t = 0; }
      return;
    }
    if (this.t >= 0.4) this.dead = true;
  }
  drawEmissive(ctx, camX, camY) {
    const x = this.x - camX, y = Math.round(this.y - camY);
    if (this.phase === 'tell') {
      // a crack bubbling and pulsing faster
      const k = clamp(this.t / this.delay, 0, 1), on = ((this.t * (5 + k * 20)) | 0) % 2;
      ctx.fillStyle = on ? '#ffd070' : '#ff6a1a';
      ctx.fillRect(Math.round(x - this.half * 0.6 * k) , y - 1, Math.max(1, Math.round(this.half * 1.2 * k)), 1);
      for (let i = 0; i < 3; i++) { const bx = x + Math.sin(this.t * 7 + i * 2.3) * this.half * 0.5, ph = (this.t * 3 + i * 0.37) % 1; ctx.fillStyle = '#fff0c0'; pdisc(ctx, bx, y - 1 - ph * 3, 0.6 + ph); }
      return;
    }
    const H = VENT.TALL * this.tall, k = this.phase === 'erupt' ? (this.t < 0.08 ? this.t / 0.08 : 1) : clamp(1 - this.t / 0.4, 0, 1);
    const w = Math.max(1, this.half * 1.1 * k);
    for (let yy = 0; yy < H * k; yy++) {
      const u = yy / H, ww = w * (1 - u * 0.6) + Math.sin(yy * 0.6 + this.t * 30) * 1.2;
      ctx.fillStyle = u < 0.25 ? '#fff0c0' : u < 0.55 ? '#ffb040' : u < 0.8 ? '#ff7a1a' : '#c8400e';
      ctx.fillRect(Math.round(x - ww / 2), y - yy, Math.max(1, Math.round(ww)), 1);
      if (u < 0.6) { ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(x - ww * 0.15), y - yy, Math.max(1, Math.round(ww * 0.3)), 1); }
    }
  }
  addLights() {
    if (this.phase === 'tell') FX.frameLight(this.x, this.y - 3, 14 + 18 * clamp(this.t / this.delay, 0, 1), '#ff6a1a', 0.8);
    else FX.frameLight(this.x, this.y - 18, 60, '#ff8a2a', this.phase === 'erupt' ? 1 : 0.5);
  }
}

// What's left of KRAG after a knockout: its last pose, smoking in the street until the next wave.
class KragHusk {
  constructor(r) {
    this.x = r.x + r.facing * 16; this.y = r.y; this.w = 34; this.h = 9; this.dead = false;
    this.ox = r.x; this.facing = r.facing; this.t = 0; this.wave = Director.wave; this.fade = 0;
    this.img = makeCanvas(Sprite.SIZE, Sprite.SIZE);
    this.img.ctx.drawImage(r.spriteCopy, 0, 0);
  }
  get cx() { return this.x; }
  get cy() { return this.y - 4; }
  hit() { FX.sparks(this.x, this.y - 4, 6, -Math.PI / 2, 1.6, 40, 140, KRAG_SPARK); }
  update(dt) {
    this.t += dt;
    if (!this.fade && Director.wave !== this.wave) {
      this.fade = 0.001;
      FX.ring(this.x, this.y - 2, 3, 34, 0.4, { sy: 0.35, c: KRAG_ORANGE, core: '#ffe0a0', w: 1 });
      Sound.play('spawn');
    }
    if (this.fade) { this.fade += dt; if (this.fade > 0.5) this.dead = true; }
    if (Math.random() < 0.05) FX.dust(this.x + rand(-12, 12), this.y - 6, 1, { c: '#3a3442', smax: 10, rise: 18, life: 1.8 });
    if (Math.random() < 0.03) FX.embers(this.x + rand(-12, 12), this.y - 4, 1);
  }
  draw(ctx, camX, camY) {
    const g = Sprite.begin(1);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(this.img, 0, 0);
    Sprite.end(ctx, this.ox - camX, this.y - camY, { alpha: this.fade ? 1 - this.fade / 0.5 : 1 });
  }
  addLights() { if (((this.t * 2) | 0) % 3 === 0) FX.frameLight(this.x, this.y - 4, 16, '#ff6a1a', 0.3); }
}

// KRAG's marks on the street, drawn over the lighting: glowing cracks that cool from white through orange to a
// dull red and fade (a sealed chasm's go dark at once), smouldering footprints, and fireballs.
const KragFX = {
  cracks: [], prints: [], balls: [],
  clear() { this.cracks.length = 0; this.prints.length = 0; this.balls.length = 0; },
  // o.r: a burst spreading both ways along the street; o.line (+1/-1) and o.len: a split running one way.
  // o.grow: seconds to spread; o.hot: white to start; o.red: the Fist's wind-up red.
  crack(x, y, o = {}) {
    if (this.cracks.length > 70) this.cracks.shift();
    const segs = [], add = (dir, len, depth) => {
      const pts = [0, 0];
      let px = 0, py = 0;
      const n = Math.max(2, Math.round(len / 6));
      for (let i = 0; i < n; i++) {
        px += dir * (len / n) * rand(0.7, 1.3); py = clamp(py + rand(-1.4, 1.4), 0, depth);
        pts.push(px, py);
        if (Math.random() < 0.25) segs.push({ pts: [px, py, px + dir * rand(3, 7), clamp(py + rand(-2, 3), 0, depth + 1)], at: Math.abs(px) });
      }
      segs.push({ pts, at: 0 });
    };
    if (o.line) { add(o.line, o.len || 80, 5); add(o.line, (o.len || 80) * 0.6, 4); }
    else { const r = o.r || 30; for (let i = 0; i < 2; i++) { add(-1, r * rand(0.6, 1), 5); add(1, r * rand(0.6, 1), 5); } }
    const c = { x, y, segs, t: 0, life: o.life || 6, grow: o.grow || 0.12, hot: !!o.hot, red: !!o.red, owner: o.owner || null, sealT: -1, reach: o.line ? o.len || 80 : o.r || 30 };
    this.cracks.push(c);
    return c;
  },
  seal(owner) { for (const c of this.cracks) if (c.owner === owner) c.sealT = 0; },
  print(x, y) { if (this.prints.length > 40) this.prints.shift(); this.prints.push({ x, y, t: 0 }); },
  fireball(x, y, r, dur) { this.balls.push({ x, y, r, t: 0, dur }); FX.dust(x, y, 4, { c: '#2a2026', smax: r, rise: 30, life: 1.4 }); },
  update(dt) {
    for (const c of this.cracks) { c.t += dt; if (c.sealT >= 0) c.sealT += dt; }
    this.cracks = this.cracks.filter((c) => c.t < c.life && !(c.sealT > 1.6));
    for (const p of this.prints) p.t += dt;
    this.prints = this.prints.filter((p) => p.t < 4);
    for (const b of this.balls) b.t += dt;
    this.balls = this.balls.filter((b) => b.t < b.dur);
  },
  // colour of a crack by how far it has cooled
  heat(c) {
    if (c.sealT >= 0) return c.sealT < 0.5 ? mixHex('#ff6a1a', '#2a2026', c.sealT / 0.5) : '#2a2026';
    const u = c.t / c.life;
    if (c.red) return u < 0.5 ? (((c.t * 16) | 0) % 2 ? '#ff2a3a' : '#ff6a7a') : '#7a1018';
    if (c.hot && c.t < 0.15) return '#ffffff';
    return u < 0.08 ? '#fff0c0' : u < 0.2 ? '#ffd070' : u < 0.4 ? '#ff8a2a' : u < 0.65 ? '#c8400e' : '#5a1606';
  },
  draw(ctx, cx, cy) {
    for (const c of this.cracks) {
      const x = c.x - cx, y = c.y - cy;
      if (x < -c.reach - 10 || x > VIEW_W + c.reach + 10) continue;
      const fade = c.sealT >= 0 ? clamp(1 - (c.sealT - 0.5) / 1.1, 0, 1) : clamp((c.life - c.t) / (c.life * 0.25), 0, 1);
      const reach = (c.reach + 6) * clamp(c.t / c.grow, 0, 1);
      ctx.globalAlpha = fade; ctx.fillStyle = this.heat(c);
      for (const s of c.segs) {
        if (s.at > reach) continue;
        const P = s.pts;
        for (let i = 0; i < P.length - 2; i += 2) {
          if (Math.abs(P[i]) > reach) break;
          pline(ctx, x + P[i], y + P[i + 1], x + P[i + 2], y + P[i + 3], 1);
        }
      }
      ctx.globalAlpha = 1;
    }
    for (const p of this.prints) {
      const u = p.t / 4, x = Math.round(p.x - cx), y = Math.round(p.y - cy);
      ctx.globalAlpha = 1 - u * u;
      ctx.fillStyle = u < 0.15 ? '#ffd070' : u < 0.45 ? '#ff7a1a' : '#8a2a0a';
      ctx.fillRect(x - 2, y, 5, 1);
      ctx.globalAlpha = 1;
    }
    for (const b of this.balls) {
      const k = b.t / b.dur, r = b.r * easeOutCubic(Math.min(1, k * 1.6)), x = b.x - cx, y = b.y - cy - k * b.r * 0.5;
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = '#c8400e'; pdisc(ctx, x, y, r);
      ctx.fillStyle = '#ff8a2a'; pdisc(ctx, x, y + r * 0.1, r * 0.72);
      ctx.fillStyle = '#ffd070'; pdisc(ctx, x, y + r * 0.2, r * 0.45 * (1 - k));
      if (k < 0.3) { ctx.fillStyle = '#ffffff'; pdisc(ctx, x, y + r * 0.2, r * 0.25); }
      ctx.globalAlpha = 1;
    }
  },
  addLights() {
    for (const c of this.cracks) if (c.sealT < 0 && c.t / c.life < 0.4) FX.frameLight(c.x, c.y - 2, 20 + c.reach * 0.4, c.red ? '#ff2a3a' : '#ff6a1a', 0.7);
    for (const b of this.balls) FX.frameLight(b.x, b.y, b.r * 2.4, '#ff8a2a', 1 - b.t / b.dur);
  },
};

'use strict';
// Specialist enemies, each built around one of the player's moves:
//   shielder  - a riot shield blocks frontal hits; parry its bash or get behind it
//   crawler   - armour shrugs off slashes; plunges, ground cuts and explosions crack it
//   grenadier - lobs a small pulse grenade; tether it and kick it back
//   sniper    - perches on rooftops and relocates by tether; tether up to it

Object.assign(ENEMY_DEFS, {
  shielder: { hp: 60, w: 11, h: 19, speed: 70, score: 180, mass: 1.4, dmg: 14, debris: ['#3a4250', '#6a7a8a', '#d8b040', '#2a3038'] },
  crawler: { hp: 70, w: 18, h: 10, speed: 62, score: 170, mass: 2, dmg: 12, debris: ['#4a4a56', '#7a7a86', '#2a2a32', '#ff7a2a'] },
  grenadier: { hp: 50, w: 12, h: 18, speed: 55, score: 200, mass: 1.2, dmg: 12, debris: ['#3a5a5a', '#2a3a3a', '#4af0ff', '#6a8a7a'] },
  sniper: { hp: 40, w: 10, h: 19, speed: 0, score: 220, mass: 1, dmg: 18, debris: ['#5a2a3a', '#3a1a24', '#2a2a30', '#ff3a52'] },
});
Object.assign(ENEMY_BASE_STATE, { shielder: 'chase', crawler: 'crawl', grenadier: 'move', sniper: 'perch' });

// Hits that ignore the shielder's shield and crack the crawler's armour.
const ARMOR_BREAKERS = new Set(['plunge', 'groundcut', 'rock', 'barrel', 'saw']);
const SHIELD_BYPASS = new Set(['plunge', 'chain', 'barrel', 'saw']);
const SNIPER_BOLT = { outer: '#ff3a52', core: '#ffe0e8', light: '#ff3048' };
const GRENADIER_G = 420;

Enemy.prototype.initType = function () {
  this.guardBrokenT = 0; this.turnT = 0; this.crackT = 0; this.fleeCD = 0; this.blockedT = 0; this.grenade = null;
  if (this.type === 'sniper') this.cd = rand(1.2, 2);
  if (this.type === 'grenadier') this.cd = rand(1.5, 2.5);
};

// Ground movement toward a direction without snapping facing (the shielder turns slowly).
Enemy.prototype.walkToward = function (dt, dir, spd) {
  const p = Game.player;
  this.vx = approach(this.vx, dir * spd, 700 * dt);
  if (this.onGround && this.jumpCD <= 0) {
    const blocked = this.col && (this.col.wallL || this.col.wallR) && dir;
    const dy = p.y - this.y;
    if (blocked || (dy < -36 && Math.abs(p.x - this.x) < 90 && p.onGround && chance(0.03))) { this.vy = -330; this.jumpCD = 0.8; this.onGround = false; }
    else if (dy > 30 && Math.abs(p.x - this.x) < 40 && Level.onOneWay(this) && chance(0.05)) { this.dropThrough = true; this.dropT = 0.25; this.vy = 30; }
  }
  if (this.dropThrough) { this.dropT -= dt; if (this.dropT <= 0) this.dropThrough = false; }
  if (Math.abs(this.vx) > 10 && this.onGround) this.walk += Math.abs(this.vx) * dt * 0.13;
};

// ---------- damage hooks (hurtEnemy calls these) ----------
Enemy.prototype.shielded = function (o = {}) {
  if (this.type === 'shielder') {
    if (this.guardBrokenT > 0 || SHIELD_BYPASS.has(o.cause)) return false;
    // projectiles are judged by travel direction, everything else by where the player stands
    const front = (o.cause === 'reflect' || o.cause === 'rock') && o.kx ? sign(o.kx) === -this.facing : (Game.player.x - this.x) * this.facing > 0;
    return front;
  }
  if (this.type === 'crawler') {
    if (this.crackT > 0) return false;
    if (ARMOR_BREAKERS.has(o.cause)) { this.crackArmor(); return false; }
    return true;
  }
  return false;
};
Enemy.prototype.shieldHit = function (o = {}) {
  const p = Game.player;
  // a heavy knocks the riot shield aside instead of bouncing off it
  if (this.type === 'shielder' && o.guardBreak && this.guardBrokenT <= 0) {
    this.stagger(1.3, sign(o.kx || this.x - p.x) * 140);
    Sound.play('shieldDeflect');
    Game.shake(0.2);
    return;
  }
  const sx = this.type === 'shielder' ? this.x + this.facing * 9 : this.x, sy = this.type === 'shielder' ? this.y - 11 : this.y - 7;
  FX.sparks(sx, sy, 7, this.facing > 0 ? 0 : Math.PI, 1.6, 60, 200, { c0: '#ffffff', c1: '#ffe080', c2: '#6a5a3a' });
  Sound.play('shieldDeflect');
  if (dist(p.x, p.y, this.x, this.y) < 44 && !p.ult) p.vx += sign(p.x - this.x || -this.facing) * 90;
  if (!this._blockT || Game.time > this._blockT) {
    this._blockT = Game.time + 0.8;
    FX.text(this.type === 'crawler' ? 'ARMOURED' : 'BLOCKED', this.x, this.y - this.h - 8, { c: '#ffe080', always: true, dur: 0.6, vy: -20 });
  }
};
Enemy.prototype.crackArmor = function () {
  this.crackT = 4;
  FX.debris(this.x, this.y - 6, 10, this.def.debris, 180);
  FX.sparks(this.x, this.y - 6, 14, -Math.PI / 2, 2, 80, 240, { c0: '#ffffff', c1: '#ffb040', c2: '#7a3e28' });
  FX.text('CRACKED', this.x, this.y - this.h - 10, { c: '#ffb040', always: true, dur: 0.8, vy: -22 });
  Sound.play('barrelHit');
};
const baseStagger = Enemy.prototype.stagger;
Enemy.prototype.stagger = function (dur, kx = 0) {
  // a parried bash knocks the shield aside
  if (this.type === 'shielder' && dur >= 1.2 && this.guardBrokenT <= 0) {
    this.guardBrokenT = 2.6;
    FX.sparks(this.x + this.facing * 8, this.y - 12, 16, -Math.PI / 2, 2.2, 80, 260, { c0: '#ffffff', c1: '#ffe080', c2: '#6a5a3a' });
    FX.text('GUARD BROKEN', this.x, this.y - this.h - 10, { c: '#ffd070', always: true, dur: 0.9, vy: -22 });
    Sound.play('reflect');
  }
  return baseStagger.call(this, dur, kx);
};
// A rebounded grenade landing on its own thrower.
Enemy.prototype.pulseHit = function () {
  hurtEnemy(this, 90, { cause: 'barrel', heavy: true, kx: 0, ky: -220, crit: true, angle: -Math.PI / 2 });
};

// ---------- AI ----------
Enemy.prototype.shielder = function (dt) {
  const p = Game.player, dx = p.x - this.x, dy = p.y - this.y;
  if (this.guardBrokenT > 0) this.guardBrokenT -= dt;
  // it turns slowly, so getting behind it works
  const behind = dx !== 0 && sign(dx) !== this.facing;
  this.turnT = behind ? this.turnT + dt : 0;
  if (this.turnT > 0.45 && this.state === 'chase') { this.facing = sign(dx); this.turnT = 0; }
  switch (this.state) {
    case 'chase': {
      const token = meleeTokensFree(this);
      const stop = token ? 20 : 48;
      this.walkToward(dt, Math.abs(dx) > stop ? sign(dx) : !token && Math.abs(dx) < 40 ? -sign(dx) : 0, this.scaleSpeed() * (token ? 1 : 0.6));
      if (token && !behind && Math.abs(dx) < 34 && Math.abs(dy) < 24 && this.cd <= 0 && !p.dead && this.onGround) {
        this.setState('bashWind');
        Sound.play('enemyWindup', { pm: 0.8 });
      }
      break;
    }
    case 'bashWind':
      this.vx = approach(this.vx, 0, 900 * dt);
      if (this.st >= this.tele(0.5)) { this.setState('bash'); this.vx = this.facing * 230; this.struck = false; Sound.play('enemyMelee'); }
      break;
    case 'bash':
      this.meleeCheck(this.x, this.x + this.facing * 22, this.y - 19, this.y - 2, this.dmg(), 240);
      if (this.st > 0.16) this.setState('recover');
      break;
    case 'recover':
      this.vx = approach(this.vx, 0, 900 * dt);
      if (this.st > 0.55) { this.setState('chase'); this.cd = rand(1.0, 1.8); }
      break;
  }
};

Enemy.prototype.crawler = function (dt) {
  const p = Game.player, dx = p.x - this.x, dy = p.y - this.y;
  if (this.crackT > 0) this.crackT -= dt;
  switch (this.state) {
    case 'crawl': {
      const token = meleeTokensFree(this);
      this.groundChase(dt, this.scaleSpeed() * (token ? 1 : 0.6), token ? 26 : 52);
      if (token && Math.abs(dx) < 60 && Math.abs(dy) < 20 && this.cd <= 0 && !p.dead && this.onGround) {
        this.setState('lungeWind'); this.facing = sign(dx) || this.facing;
        Sound.play('enemyWindup', { pm: 0.75 });
      }
      break;
    }
    case 'lungeWind':
      this.vx = approach(this.vx, 0, 900 * dt);
      if (this.st >= this.tele(0.45)) { this.setState('lunge'); this.vx = this.facing * 260; this.vy = -150; this.onGround = false; this.struck = false; Sound.play('enemyMelee'); }
      break;
    case 'lunge':
      this.meleeCheck(this.x - 9, this.x + this.facing * 14, this.y - 12, this.y, this.dmg(), 180);
      if ((this.onGround && this.st > 0.1) || this.st > 0.6) this.setState('recover');
      break;
    case 'recover':
      this.vx = approach(this.vx, 0, 900 * dt);
      if (this.st > 0.6) { this.setState('crawl'); this.cd = rand(1.2, 2.0); }
      break;
  }
};

Enemy.prototype.orbPos = function () { return this._hand || [this.x - this.facing * 3, this.y - 22]; };
Enemy.prototype.grenadier = function (dt) {
  const p = Game.player, dx = p.x - this.x, adx = Math.abs(dx);
  if (this.grenade && this.grenade.dead) this.grenade = null;
  switch (this.state) {
    case 'move': {
      this.facing = sign(dx) || this.facing;
      let want = 0;
      if (adx < 110) want = -this.facing; else if (adx > 220) want = this.facing;
      this.walkToward(dt, want, this.scaleSpeed());
      if (this.cd <= 0 && adx < 300 && !p.dead && this.onGround && !this.grenade) { this.setState('throwWind'); Sound.play('enemyWindup', { pm: 0.6 }); }
      break;
    }
    case 'throwWind': {
      this.vx = approach(this.vx, 0, 900 * dt);
      this.facing = sign(dx) || this.facing;
      const [ox, oy] = this.orbPos();
      const T = clamp(dist(ox, oy, p.x, p.y) / 170, 0.8, 1.4);
      this.plan = { x0: ox, y0: oy, T, vx: (p.x - ox) / T, vy: (p.y - 6 - oy) / T - 0.5 * GRENADIER_G * T };
      if (Math.random() < 0.5) FX.elec(ox, oy, 5 + this.st * 6, 1, { outer: '#2ab8d8', core: '#ffffff' });
      if (this.st >= this.tele(1.0)) {
        this.grenade = new PulseGrenade(ox, oy, this.plan.vx, this.plan.vy, this, { g: GRENADIER_G, R: 40, dmg: 12, disable: 0, size: 0.75 });
        Game.projectiles.push(this.grenade);
        Sound.play('throw');
        this.setState('cool');
      }
      break;
    }
    case 'cool':
      this.vx = approach(this.vx, 0, 900 * dt);
      if (this.st > 0.6) { this.setState('move'); this.cd = rand(3.5, 5.5); }
      break;
  }
};

Enemy.prototype.sniper = function (dt) {
  const p = Game.player, dx = p.x - this.x;
  this.skipPhysics = this.state === 'zip';
  if (this.fleeCD > 0) this.fleeCD -= dt;
  if (this.state !== 'zip') this.facing = sign(dx) || this.facing;
  const [mx, my] = this.muzzle();
  const toP = Math.atan2(p.cy - my, p.x - mx);
  const close = Math.abs(dx) < 60 && Math.abs(p.y - this.y) < 30;
  switch (this.state) {
    case 'perch': {
      this.vx = approach(this.vx, 0, 600 * dt);
      if (close && this.fleeCD <= 0) { this.relocate(p); break; }
      const clear = Level.raycast(mx, my, p.x, p.cy) >= 1;
      if (this.cd <= 0 && !p.dead && dist(mx, my, p.x, p.cy) < 440 && clear) {
        this.setState('aim'); this.aim = toP; this.blockedT = 0;
        Sound.play('enemyWindup', { pm: 0.5 });
      } else if (!clear && this.cd <= 0) {
        this.blockedT += dt;
        if (this.blockedT > 2.5 && this.fleeCD <= 0) this.relocate(p);
      }
      break;
    }
    case 'aim': {
      const dur = this.tele(1.1);
      if (this.st < dur - 0.25) this.aim = toP;
      if (this.st >= dur) {
        Game.projectiles.push(new Bolt(mx + Math.cos(this.aim) * 4, my + Math.sin(this.aim) * 4, this.aim, 520 * S.enemies.speed, this.dmg(), SNIPER_BOLT));
        Sound.play('bossGun'); Sound.play('enemyShoot');
        FX.sparks(mx, my, 8, this.aim, 0.5, 80, 220, { c0: '#ffffff', c1: '#ff5a6a', c2: '#5a0c1a' });
        FX.light(mx, my, 40, '#ff3048', 1, 0.1);
        this.setState('cool');
      }
      break;
    }
    case 'cool':
      if (this.st > 0.8) { this.setState('perch'); this.cd = rand(2.2, 3.4); }
      break;
    case 'zip': {
      // reels itself to another perch along its own tether
      const T = this.zipTo, ddx = T.x - this.x, ddy = T.y - this.y, d = Math.hypot(ddx, ddy), step = 420 * dt;
      if (d <= step || this.st > 1.6) {
        this.x = T.x; this.y = T.y; this.vx = 0; this.vy = 0; this.zipTo = null; this.skipPhysics = false;
        this.setState('perch'); this.cd = Math.max(this.cd, 0.8);
      } else { this.x += (ddx / d) * step; this.y += (ddy / d) * step; this.facing = sign(ddx) || this.facing; }
      break;
    }
  }
};
Enemy.prototype.muzzle = function () {
  const a = this.state === 'aim' || this.state === 'cool' ? this.aim : this.facing > 0 ? 0 : Math.PI;
  return [this.x + this.facing + Math.cos(a) * 14, this.y - 14 + Math.sin(a) * 14];
};
Enemy.prototype.relocate = function (p) {
  const far = Level.perches.filter((q) => dist(q.x, q.y, p.x, p.y) > 170 && dist(q.x, q.y, this.x, this.y) > 60 && dist(q.x, q.y, this.x, this.y) < 520);
  if (!far.length) { this.fleeCD = 2; return; }
  const clear = far.filter((q) => Level.raycast(q.x, q.y - 14, p.x, p.cy) >= 1);
  const q = pick(clear.length ? clear : far);
  this.zipTo = { x: q.x + rand(-6, 6), y: q.y };
  this.setState('zip'); this.skipPhysics = true; this.fleeCD = 4.5; this.blockedT = 0;
  Sound.play('tetherFire');
};

// ---------- rendering ----------
Enemy.prototype.renderShielder = function (g) {
  const st = this.state, broken = this.guardBrokenT > 0;
  const front = this.legs(g, -8, 3.5, '#6a7a8a', '#3a4250', 4.5, 4.5);
  g.fillStyle = '#3a4250'; pline(g, 0, -8, 1, -15, 5);
  g.fillStyle = '#6a7a8a'; pline(g, 1, -9, 2, -14, 1);
  g.fillStyle = '#2a3038'; g.fillRect(-1, -20, 6, 5);
  g.fillStyle = '#6a7a8a'; g.fillRect(-1, -20, 6, 1);
  g.fillStyle = this.windingUp() ? '#ffffff' : '#ffd040'; g.fillRect(3, -18, 2, 1);
  front();
  if (broken) {
    // shield knocked aside and hanging low behind it
    g.fillStyle = '#6a7a8a'; pline(g, 1, -14, -4, -9, 2);
    g.fillStyle = '#2a3038'; pline(g, -8, -11, -4, -2, 4);
    g.fillStyle = '#4a5464'; pline(g, -8, -10, -4, -3, 2);
    g.fillStyle = '#d8b040'; g.fillRect(-7, -7, 2, 1);
    return;
  }
  let sx = 7;
  if (st === 'bashWind') sx = 5 - clamp(this.st / this.tele(0.5), 0, 1) * 2;
  else if (st === 'bash') sx = 10;
  g.fillStyle = '#6a7a8a'; pline(g, 2, -14, sx, -11, 2);
  g.fillStyle = '#2a3038'; g.fillRect(sx - 1, -21, 5, 20);
  g.fillStyle = '#4a5464'; g.fillRect(sx, -20, 3, 18);
  g.fillStyle = '#9aaaba'; g.fillRect(sx + 2, -20, 1, 18);
  g.fillStyle = '#d8b040'; g.fillRect(sx, -12, 3, 2);
  g.fillStyle = '#1a2028'; g.fillRect(sx, -17, 2, 1);
};
Enemy.prototype.renderCrawler = function (g) {
  const cracked = this.crackT > 0, lunging = this.state === 'lunge';
  const bob = this.onGround ? Math.round(Math.abs(Math.sin(this.walk * 1.5)) * 0.6) : 0;
  g.fillStyle = '#2a2a32';
  for (let i = 0; i < 3; i++) {
    const lx = -6 + i * 6, ph = Math.sin(this.walk * 2 + i * 2) * 2;
    pline(g, lx, -3 - bob, lx + ph - 2, 0, 1); pline(g, lx + 1, -3 - bob, lx - ph + 3, 0, 1);
  }
  const rows = [[-10, 5], [-9, 7], [-8, 8], [-7, 9], [-6, 9], [-5, 9], [-4, 9], [-3, 8]];
  for (const [yy, hw] of rows) {
    g.fillStyle = yy < -8 ? '#8a8a96' : yy > -5 ? '#2e2e38' : '#4a4a56';
    g.fillRect(-hw, yy - bob, hw * 2, 1);
  }
  g.fillStyle = '#24242c';
  for (const sx of [-4, 1, 6]) g.fillRect(sx, -9 - bob, 1, 6);
  if (cracked) {
    const hot = ((this.t * 10) | 0) % 2 ? '#ffd080' : '#ff7a2a';
    g.fillStyle = '#ff7a2a'; pline(g, -5, -8 - bob, -2, -5 - bob, 1); pline(g, 2, -9 - bob, 5, -6 - bob, 1);
    g.fillStyle = hot; g.fillRect(-1, -7 - bob, 3, 2);
  }
  const hy = lunging ? -9 : -7;
  g.fillStyle = '#3a3a44'; g.fillRect(8, hy - bob, 4, 4);
  g.fillStyle = this.windingUp() ? '#ffffff' : '#ff3a3a'; g.fillRect(10, hy + 1 - bob, 2, 1);
  g.fillStyle = '#6a6a76'; g.fillRect(12, hy + 2 - bob, 2, 1); g.fillRect(12, hy + 4 - bob, 2, 1);
};
Enemy.prototype.renderGrenadier = function (g) {
  const front = this.legs(g, -8, 3, '#4a6a6a', '#2a3a3a', 4.5, 4.5);
  g.fillStyle = '#2a3a3a'; g.fillRect(-6, -17, 4, 9);
  g.fillStyle = '#4af0ff'; g.fillRect(-5, -15, 2, 1); g.fillRect(-5, -12, 2, 1);
  g.fillStyle = '#3a5a5a'; pline(g, 0, -8, 0.5, -15, 6);
  g.fillStyle = '#6a8a7a'; pline(g, 1, -9, 1.5, -14, 1);
  g.fillStyle = '#2a3a3a'; pdisc(g, 1, -18, 2.8);
  g.fillStyle = '#9ab0a0'; g.fillRect(2, -19, 2, 2);
  g.fillStyle = this.windingUp() ? '#ffffff' : '#4af0ff'; g.fillRect(3, -19, 1, 1);
  front();
  const hand = this.state === 'throwWind' ? [-3, -23] : this.state === 'cool' ? [8, -12] : [5, -9];
  const [ex, ey, hx, hy] = ik2(1, -14, hand[0], hand[1], 4, 5, -1);
  limb(g, 1, -14, ex, ey, hx, hy, '#6a8a7a', 2);
  this._hand = [this.x + hx * this.facing, this.y + hy - 2];
};
Enemy.prototype.renderSniper = function (g) {
  const front = this.legs(g, -9, 3, '#5a2a3a', '#2a1a24', 5, 4.5);
  g.fillStyle = '#3a1a24'; pline(g, -1, -9, -5, -2, 3);
  g.fillStyle = '#5a2a3a'; pline(g, 0, -9, 0.5, -15, 5);
  g.fillStyle = '#3a1a24'; pdisc(g, 1, -18, 2.8);
  g.fillStyle = this.state === 'aim' ? '#ffffff' : '#ff3a52'; g.fillRect(3, -18, 1, 1);
  front();
  const aimed = this.state === 'aim' || this.state === 'cool';
  const la = localAngle(aimed ? this.aim : this.facing > 0 ? 0.15 : Math.PI - 0.15, this.facing);
  const c = Math.cos(la), s = Math.sin(la), sx = 1, sy = -14;
  g.fillStyle = '#1a1a20'; pline(g, sx - c * 4, sy - s * 4, sx + c * 13, sy + s * 13, 2);
  g.fillStyle = '#6a6a76'; pline(g, sx + c * 9, sy + s * 9, sx + c * 15, sy + s * 15, 1);
  g.fillStyle = '#ff3a52'; g.fillRect(Math.round(sx + c * 3), Math.round(sy + s * 3) - 2, 2, 1);
  g.fillStyle = '#5a2a3a'; pline(g, 1, -13, sx + c * 4, sy + s * 4, 2);
};

// Emissive extras: the sniper's laser and tether, the grenadier's charge and arc.
Enemy.prototype.drawSpecial = function (ctx, x, y) {
  const camX = Game.cam.rx, camY = Game.cam.ry;
  if (this.type === 'sniper') {
    if (this.state === 'aim') {
      const [mx, my] = this.muzzle(), dur = this.tele(1.1), locked = this.st >= dur - 0.25;
      const L = 520, t = Level.raycast(mx, my, mx + Math.cos(this.aim) * L, my + Math.sin(this.aim) * L);
      const n = Math.floor((L * t) / 2);
      ctx.fillStyle = locked ? (((this.t * 30) | 0) % 2 ? '#ffffff' : '#ff3a52') : '#ff3a52';
      for (let i = 0; i < n; i++) {
        if (!locked && i % 3 === 2) continue;
        ctx.fillRect(Math.round(mx - camX + Math.cos(this.aim) * i * 2), Math.round(my - camY + Math.sin(this.aim) * i * 2), 1, 1);
      }
      if (!Game.mod('glints') && ((this.st * 14) | 0) % 2 === 0) drawText(ctx, '!', x, y - this.h - 11, { color: locked ? '#ffffff' : '#ff8a9a', align: 'center' });
    } else if (this.state === 'zip' && this.zipTo) {
      drawBolt(ctx, x, y - 13, this.zipTo.x - camX, this.zipTo.y - 4 - camY, '#a01828', '#ffd0d8', 3, 1);
    }
  } else if (this.type === 'grenadier' && this.state === 'throwWind' && this.plan) {
    const [ox, oy] = this.orbPos(), k = clamp(this.st / this.tele(1.0), 0, 1), P = this.plan;
    ctx.fillStyle = '#2ab8d8'; pdisc(ctx, ox - camX, oy - camY, 2 + k * 2);
    ctx.fillStyle = ((this.t * 20) | 0) % 2 ? '#ffffff' : '#bff8ff'; pdisc(ctx, ox - camX, oy - camY, 1 + k);
    if (((this.t * 12) | 0) % 3) {
      ctx.fillStyle = k > 0.8 ? '#ffffff' : '#4af0ff';
      for (let tt = 0.06; tt < P.T; tt += 0.06) {
        const px = P.x0 + P.vx * tt, py = P.y0 + P.vy * tt + 0.5 * GRENADIER_G * tt * tt;
        ctx.fillRect(Math.round(px - camX), Math.round(py - camY), 1, 1);
      }
      const ex = P.x0 + P.vx * P.T, ey = P.y0 + P.vy * P.T + 0.5 * GRENADIER_G * P.T * P.T;
      drawBlastZone(ctx, ex - camX, Level.groundBelow(ex, ey) - camY, 40, this.t);
    }
  }
  if (this.type === 'shielder' && this.guardBrokenT > 0 && ((this.t * 8) | 0) % 2) drawText(ctx, 'OPEN', x, y - this.h - 11, { color: '#ffd070', align: 'center' });
  if (this.type === 'crawler' && this.crackT > 0 && ((this.t * 8) | 0) % 2) drawText(ctx, 'OPEN', x, y - this.h - 11, { color: '#ffb040', align: 'center' });
};

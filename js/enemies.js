'use strict';
// Enemies, projectiles, hazards, props and pickups.

const ENEMY_DEFS = {
  scrapper: { hp: 44, w: 10, h: 18, speed: 82, score: 100, mass: 1, dmg: 12, debris: ['#6b4a3a', '#3e2a24', '#8e6a52', '#8a8a90'] },
  gunner: { hp: 32, w: 10, h: 19, speed: 62, score: 130, mass: 1, dmg: 10, debris: ['#4a5a3a', '#3e4a32', '#2a2a30', '#6a7a52'] },
  drone: { hp: 22, w: 12, h: 9, speed: 125, score: 90, mass: 0.7, dmg: 12, flying: true, debris: ['#5a5a66', '#8a8a96', '#3a3a44', '#ffd040'] },
  brute: { hp: 250, w: 20, h: 31, speed: 42, score: 450, mass: 3.5, dmg: 22, heavy: true, debris: ['#3a3a44', '#55555f', '#24242c', '#7a3e28', '#ff7a2a'] },
};
const ENEMY_BASE_STATE = { scrapper: 'chase', gunner: 'move', drone: 'hover', brute: 'walk' };

class Enemy {
  constructor(type, x, y, scale = {}) {
    const d = ENEMY_DEFS[type];
    this.type = type; this.def = d; this.isEnemy = true;
    this.x = x; this.y = y; this.w = d.w; this.h = d.h; this.vx = 0; this.vy = 0;
    this.maxHp = this.hp = Math.max(1, Math.round(d.hp * S.enemies.health * (scale.hp || 1)));
    this.dmgMul = scale.dmg || 1;
    this.heavy = !!d.heavy; this.flying = !!d.flying; this.mass = d.mass;
    this.state = ENEMY_BASE_STATE[type]; this.st = 0; this.cd = rand(0.6, 1.5);
    this.stun = 0; this.hitFlash = 0; this.facing = x > Game.player.x ? -1 : 1;
    this.spawning = true; this.spawnT = 0.75; this.dead = false; this.t = rand(0, 10);
    this.tethered = false; this.cutMark = 0; this.poise = 0;
    this.speedVar = rand(0.88, 1.12); this.aim = 0; this.side = chance(0.5) ? 1 : -1; this.jumpCD = 0;
    this.struck = false; this.walk = 0; this.onGround = false;
  }
  get cy() { return this.y - this.h / 2; }
  setState(s) { this.state = s; this.st = 0; }
  windingUp() { return this.state === 'windup' || this.state === 'aim' || this.state === 'tele' || this.state === 'punchWind' || this.state === 'slamWind'; }
  stagger(dur, kx = 0) {
    if (this.heavy && dur < 1) dur *= 0.5;
    this.stun = Math.max(this.stun, dur);
    this.vx += kx / this.mass;
    if (this.state !== ENEMY_BASE_STATE[this.type]) this.setState(ENEMY_BASE_STATE[this.type]);
    this.cd = Math.max(this.cd, 0.4);
  }
  scaleSpeed() { return this.def.speed * S.enemies.speed * this.speedVar; }
  tele(base) { return base * S.enemies.telegraph; }
  dmg() { return this.def.dmg * this.dmgMul; }

  update(dt) {
    this.t += dt; this.st += dt; this.jumpCD -= dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    if (this.spawning) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawning = false;
        FX.ring(this.x, this.y - 2, 2, 18, 0.25, { sy: 0.4, c: '#ff7a3a', core: '#ffe0a0', w: 1 });
        FX.sparks(this.x, this.cy, 10, -Math.PI / 2, TAU, 40, 140, { c0: '#fff4d0', c1: '#ff9a3a', c2: '#7a2a10' });
        FX.dust(this.x, this.y, 5, { smax: 40 });
      }
      return;
    }
    this.cd -= dt * S.enemies.aggression;
    if (this.stun > 0) {
      this.stun -= dt;
      this.physics(dt, true);
      return;
    }
    this[this.type](dt);
    this.physics(dt, false);
  }
  physics(dt, stunned) {
    if (this.flying && !stunned) {
      Level.moveBody(this, dt, { oneWay: false });
      const floor = Level.groundBelow(this.x, this.y - 2) - 8;
      if (this.y > floor) { this.y = floor; this.vy = Math.min(this.vy, 0); }
      if (this.y < -30) this.vy = Math.max(this.vy, 40);
    } else {
      this.vy = Math.min(this.vy + 900 * dt * (this.flying ? 0.6 : 1), 520);
      if (this.onGround && stunned) this.vx = approach(this.vx, 0, 700 * dt);
      else if (!this.onGround && stunned) this.vx = approach(this.vx, 0, 120 * dt);
      Level.moveBody(this, dt, { oneWay: true, step: stunned ? 0 : 11 });
    }
    if (this.x < 44) { this.x = 44; this.vx = Math.abs(this.vx) * 0.3; }
    if (this.x > Level.W - 44) { this.x = Level.W - 44; this.vx = -Math.abs(this.vx) * 0.3; }
    if (this.y > Level.H + 60) { this.dead = true; Game.onKill(this, { cause: 'fall' }); }
  }
  groundChase(dt, spd, stopDist) {
    const p = Game.player, dx = p.x - this.x;
    this.facing = sign(dx) || this.facing;
    if (Math.abs(dx) > stopDist) this.vx = approach(this.vx, this.facing * spd, 700 * dt);
    else this.vx = approach(this.vx, 0, 900 * dt);
    if (this.onGround && this.jumpCD <= 0) {
      const blocked = this.col && (this.col.wallL || this.col.wallR);
      const dy = p.y - this.y;
      if (blocked || (dy < -36 && Math.abs(dx) < 90 && p.onGround && chance(0.03))) {
        this.vy = -330; this.jumpCD = 0.8; this.onGround = false;
      } else if (dy > 30 && Math.abs(dx) < 40 && Level.onOneWay(this) && chance(0.05)) {
        this.dropThrough = true; this.dropT = 0.25; this.vy = 30;
      }
    }
    if (this.dropThrough) { this.dropT -= dt; if (this.dropT <= 0) this.dropThrough = false; }
    if (Math.abs(this.vx) > 10 && this.onGround) this.walk += Math.abs(this.vx) * dt * 0.13;
  }
  meleeCheck(x0, x1, y0, y1, dmg, knock) {
    if (this.struck) return;
    const p = Game.player;
    const l = Math.min(x0, x1), r = Math.max(x0, x1);
    if (aabb(l, y0, r - l, y1 - y0, p.x - p.w / 2, p.y - p.h, p.w, p.h)) {
      this.struck = true;
      const res = p.takeHit({ dmg, x: this.x, y: this.cy, kind: 'melee', source: this, knock });
      if (res === 'hit') FX.sparks(p.x, p.cy, 8, this.facing > 0 ? 0 : Math.PI, 1.2, 60, 200);
    }
  }

  // ---------- AI ----------
  scrapper(dt) {
    const p = Game.player, dx = p.x - this.x, dy = p.y - this.y;
    switch (this.state) {
      case 'chase':
        this.groundChase(dt, this.scaleSpeed(), 18);
        if (Math.abs(dx) < 30 && Math.abs(dy) < 24 && this.cd <= 0 && !p.dead && this.onGround) {
          this.setState('windup'); this.facing = sign(dx) || this.facing;
          Sound.play('enemyWindup');
        }
        break;
      case 'windup':
        this.vx = approach(this.vx, 0, 900 * dt);
        if (this.st >= this.tele(0.45)) { this.setState('strike'); this.vx = this.facing * 190; this.struck = false; Sound.play('enemyMelee'); }
        break;
      case 'strike':
        this.meleeCheck(this.x, this.x + this.facing * 24, this.y - 17, this.y - 3, this.dmg(), 170);
        if (this.st > 0.15) this.setState('recover');
        break;
      case 'recover':
        this.vx = approach(this.vx, 0, 900 * dt);
        if (this.st > 0.5) { this.setState('chase'); this.cd = rand(0.9, 1.7); }
        break;
    }
  }
  gunner(dt) {
    const p = Game.player, dx = p.x - this.x, adx = Math.abs(dx);
    const mx = this.x + this.facing * 6, my = this.y - 13;
    const toP = Math.atan2(p.cy - my, p.x - mx);
    switch (this.state) {
      case 'move': {
        this.facing = sign(dx) || this.facing;
        let want = 0;
        if (adx < 100) want = -this.facing; else if (adx > 185) want = this.facing;
        const spd = this.scaleSpeed();
        this.vx = approach(this.vx, want * spd, 600 * dt);
        if (this.onGround && this.col && (this.col.wallL || this.col.wallR) && this.jumpCD <= 0 && want) { this.vy = -320; this.jumpCD = 1; }
        if (Math.abs(this.vx) > 10 && this.onGround) this.walk += Math.abs(this.vx) * dt * 0.13;
        if (this.cd <= 0 && adx < 280 && !p.dead && this.onGround && Level.raycast(mx, my, p.x, p.cy) >= 1) {
          this.setState('aim'); this.aim = toP; Sound.play('enemyWindup', { pm: 0.7 });
        }
        break;
      }
      case 'aim': {
        this.vx = approach(this.vx, 0, 900 * dt);
        const dur = this.tele(0.75);
        if (this.st < dur - 0.2) { this.aim = toP; this.facing = Math.cos(toP) >= 0 ? 1 : -1; }
        if (this.st >= dur) {
          Game.projectiles.push(new Bolt(mx + Math.cos(this.aim) * 4, my + Math.sin(this.aim) * 4, this.aim, 245 * S.enemies.speed, this.dmg()));
          Sound.play('enemyShoot');
          FX.sparks(mx, my, 5, this.aim, 0.6, 60, 160, { c0: '#fff4d0', c1: '#ffb040', c2: '#a04010' });
          FX.light(mx, my, 30, '#ffb040', 0.9, 0.1);
          this.vx = -this.facing * 40;
          this.setState('cool');
        }
        break;
      }
      case 'cool':
        this.vx = approach(this.vx, 0, 600 * dt);
        if (this.st > 0.45) { this.setState('move'); this.cd = rand(1.4, 2.5); }
        break;
    }
  }
  drone(dt) {
    const p = Game.player;
    switch (this.state) {
      case 'hover': {
        const tx = p.x + this.side * 62 + Math.sin(this.t * 0.8) * 20, ty = p.y - 58 + Math.sin(this.t * 2.2) * 8;
        const spd = this.scaleSpeed();
        const dx = tx - this.x, dy = ty - this.y, d = Math.hypot(dx, dy) || 1;
        const s = Math.min(spd, d * 3);
        this.vx = approach(this.vx, (dx / d) * s, 400 * dt);
        this.vy = approach(this.vy, (dy / d) * s, 400 * dt);
        this.facing = sign(p.x - this.x) || this.facing;
        if (this.cd <= 0 && dist(this.x, this.y, p.x, p.y) < 200 && !p.dead) { this.setState('tele'); Sound.play('enemyWindup', { pm: 1.3 }); }
        break;
      }
      case 'tele':
        this.vx = approach(this.vx, 0, 500 * dt); this.vy = approach(this.vy, -10, 500 * dt);
        if (this.st >= this.tele(0.5)) {
          const a = Math.atan2(p.cy - this.cy, p.x - this.x), sp = 320 * S.enemies.speed;
          this.vx = Math.cos(a) * sp; this.vy = Math.sin(a) * sp;
          this.setState('dive'); this.struck = false;
          Sound.play('droneDive');
        }
        break;
      case 'dive': {
        const pl = Game.player;
        if (!this.struck && aabb(this.x - this.w / 2, this.y - this.h, this.w, this.h, pl.x - pl.w / 2, pl.y - pl.h, pl.w, pl.h)) {
          this.struck = true;
          pl.takeHit({ dmg: this.dmg(), x: this.x, y: this.cy, kind: 'melee', source: this, knock: 150 });
        }
        if (Math.random() < 0.6) FX.sparks(this.x, this.cy, 1, Math.atan2(-this.vy, -this.vx), 0.4, 30, 80, { c0: '#fff4d0', c1: '#ffb040', c2: '#a04010' });
        const hitWall = this.col && (this.col.wallL || this.col.wallR || this.col.ground || this.col.ceil);
        if (this.st > 0.6 || this.struck || hitWall) { this.setState('recover'); this.side = -this.side; }
        break;
      }
      case 'recover':
        this.vx = approach(this.vx, 0, 400 * dt); this.vy = approach(this.vy, -90, 600 * dt);
        if (this.st > 0.6) { this.setState('hover'); this.cd = rand(1.6, 2.8); }
        break;
    }
  }
  brute(dt) {
    const p = Game.player, dx = p.x - this.x, adx = Math.abs(dx), dy = p.y - this.y;
    switch (this.state) {
      case 'walk':
        this.groundChase(dt, this.scaleSpeed(), 24);
        if (this.cd <= 0 && !p.dead && this.onGround) {
          if (adx < 36 && Math.abs(dy) < 34) { this.setState('punchWind'); this.facing = sign(dx) || this.facing; Sound.play('enemyWindup', { pm: 0.5 }); }
          else if (adx < 170 && Math.abs(dy) < 50 && chance(0.02)) { this.setState('slamWind'); Sound.play('enemyWindup', { pm: 0.4 }); }
        }
        break;
      case 'punchWind':
        this.vx = approach(this.vx, 0, 900 * dt);
        if (this.st >= this.tele(0.55)) { this.setState('punch'); this.struck = false; this.vx = this.facing * 120; Sound.play('enemyMelee'); }
        break;
      case 'punch':
        this.meleeCheck(this.x, this.x + this.facing * 30, this.y - 26, this.y - 6, this.dmg(), 280);
        if (this.st > 0.18) this.setState('recover');
        break;
      case 'slamWind':
        this.vx = approach(this.vx, 0, 900 * dt);
        if (this.st >= this.tele(0.85)) {
          this.setState('slam');
          for (const d of [-1, 1]) Game.hazards.push(new Shockwave(this.x + d * 12, this.y, d, 230 * S.enemies.speed, this.dmg() * 0.8, this));
          Sound.play('slam');
          Game.shake(0.3);
          FX.dust(this.x, this.y, 16, { ang: Math.PI, spread: 0.6, smax: 120 });
          FX.dust(this.x, this.y, 16, { ang: 0, spread: 0.6, smax: 120 });
          FX.debris(this.x, this.y - 1, 12, ['#4a4252', '#5c5464', '#3a3442'], 160);
          FX.decal('crack', this.x, this.y, { len: 20, n: 6 });
          FX.ring(this.x, this.y - 1, 4, 40, 0.3, { sy: 0.3, c: '#ff7a2a', core: '#ffd080' });
        }
        break;
      case 'slam':
        if (this.st > 0.2) this.setState('recover');
        break;
      case 'recover':
        this.vx = approach(this.vx, 0, 900 * dt);
        if (this.st > 0.7) { this.setState('walk'); this.cd = rand(1.0, 1.9); }
        break;
    }
  }

  // ---------- rendering ----------
  draw(ctx, camX, camY) {
    if (this.spawning) return;
    const g = Sprite.begin(this.facing);
    this.render(g);
    const flash = this.hitFlash > 0 ? '#ffffff' : this.cutMark ? (((this.t * 30) | 0) % 2 ? '#ff3048' : null) : null;
    Sprite.end(ctx, this.x - camX, this.y - camY, { flash });
  }
  render(g) {
    if (this.type === 'scrapper') this.renderScrapper(g);
    else if (this.type === 'gunner') this.renderGunner(g);
    else if (this.type === 'drone') this.renderDrone(g);
    else this.renderBrute(g);
  }
  legs(g, hipY, stride, col, colB, l1, l2, w = 2) {
    const ph = this.walk;
    const air = !this.onGround;
    const fF = air ? [3, -3] : [Math.sin(ph) * stride + 1, -1 - Math.max(0, Math.cos(ph)) * 2.5];
    const fB = air ? [-2, -2] : [Math.sin(ph + Math.PI) * stride + 1, -1 - Math.max(0, Math.cos(ph + Math.PI)) * 2.5];
    const [kBx, kBy, bx, by] = ik2(0, hipY, fB[0], fB[1], l1, l2, 1);
    limb(g, 0, hipY, kBx, kBy, bx, by, colB, w);
    const [kFx, kFy, fx, fy] = ik2(0, hipY, fF[0], fF[1], l1, l2, 1);
    return () => { limb(g, 0, hipY, kFx, kFy, fx, fy, col, w); g.fillStyle = '#16121a'; g.fillRect(Math.round(fx) - 1, Math.round(fy), 3, 1); g.fillRect(Math.round(bx) - 1, Math.round(by), 3, 1); };
  }
  renderScrapper(g) {
    const st = this.state, k = this.windingUp() ? clamp(this.st / this.tele(0.45), 0, 1) : 0;
    const front = this.legs(g, -8, 4, '#8e6a52', '#4e3628', 4.5, 4.5);
    // hunched torso
    const sh = [3, -14 - k];
    g.fillStyle = '#3e2a24'; pline(g, -2, -12, sh[0] - 1, sh[1] + 1, 2);
    g.fillStyle = '#6b4a3a'; pline(g, 0, -8, sh[0], sh[1], 5);
    g.fillStyle = '#8e6a52'; pline(g, 1, -9, sh[0] + 1, sh[1], 1);
    g.fillStyle = '#c86a3a'; g.fillRect(-1, -11, 2, 1);
    // head
    g.fillStyle = '#5a3e30'; g.fillRect(4, -18 - k, 5, 4);
    g.fillStyle = '#8e6a52'; g.fillRect(4, -18 - k, 5, 1);
    g.fillStyle = this.windingUp() ? '#ffffff' : '#c8ff3a'; g.fillRect(7, -17 - k, 2, 2);
    g.fillStyle = '#3e2a24'; g.fillRect(5, -20 - k, 1, 2);
    front();
    // cleaver arm
    let hand, ba;
    if (st === 'windup') { hand = [1, -22]; ba = -Math.PI / 2 - 0.4; }
    else if (st === 'strike') { hand = [10, -10]; ba = 0.35; }
    else if (st === 'recover') { hand = [9, -6]; ba = 1.1; }
    else { hand = [6 + Math.sin(this.walk) * 1.5, -8]; ba = 1.25; }
    const [ex, ey, hx, hy] = ik2(sh[0], sh[1], hand[0], hand[1], 4, 5, -1);
    limb(g, sh[0], sh[1], ex, ey, hx, hy, '#8a8a90', 2);
    const c = Math.cos(ba), s = Math.sin(ba);
    g.fillStyle = st === 'windup' ? '#ffd040' : '#b8b8c0';
    pline(g, hx, hy, hx + c * 8, hy + s * 8, 2);
    g.fillStyle = '#e8e8f0'; pline(g, hx + c * 2 + s, hy + s * 2 - c, hx + c * 8 + s, hy + s * 8 - c, 1);
  }
  renderGunner(g) {
    const front = this.legs(g, -9, 3.5, '#5a6a42', '#2e3824', 5, 4.5);
    g.fillStyle = '#3e4a32'; pline(g, 0, -9, 0.5, -15, 5);
    g.fillStyle = '#6a7a52'; pline(g, 1, -10, 1.5, -14, 1);
    g.fillStyle = '#2a2a30'; g.fillRect(-2, -10, 5, 1);
    g.fillStyle = '#4a5a3a'; pdisc(g, 1, -18, 2.7);
    g.fillStyle = '#6a7a52'; g.fillRect(-1, -21, 4, 1);
    g.fillStyle = this.state === 'aim' ? '#ffffff' : '#ffaa30'; g.fillRect(2, -18, 2, 1);
    front();
    const la = localAngle(this.state === 'aim' || this.state === 'cool' ? this.aim : (this.facing > 0 ? 0.25 : Math.PI - 0.25), this.facing);
    const sx = 1, sy = -14, c = Math.cos(la), s = Math.sin(la);
    const gx = sx + c * 3, gy = sy + s * 3 + 1;
    g.fillStyle = '#2a2a30'; pline(g, gx - c * 4, gy - s * 4, gx + c * 8, gy + s * 8, 2);
    g.fillStyle = '#5a5a66'; pline(g, gx + c * 6, gy + s * 6, gx + c * 9, gy + s * 9, 1);
    g.fillStyle = '#6a7a52'; pline(g, sx, sy, gx + c * 2, gy + s * 2, 2);
  }
  renderDrone(g) {
    const tele = this.state === 'tele';
    const blink = tele && ((this.st * 16) | 0) % 2;
    const bob = this.state === 'hover' ? Math.round(Math.sin(this.t * 6)) : 0;
    const y = -5 + bob;
    g.fillStyle = '#3a3a44';
    pline(g, -4, y - 2, -8, y - 5, 1); pline(g, 4, y - 2, 8, y - 5, 1);
    g.fillStyle = '#9a9aa6';
    const rl = 3 + (((this.t * 40) | 0) % 2);
    g.fillRect(-8 - rl, y - 6, rl * 2 + 1, 1); g.fillRect(8 - rl, y - 6, rl * 2 + 1, 1);
    g.fillStyle = blink ? '#ff5050' : '#5a5a66'; g.fillRect(-5, y - 2, 10, 4);
    g.fillRect(-4, y - 3, 8, 1); g.fillRect(-4, y + 2, 8, 1);
    g.fillStyle = '#8a8a96'; g.fillRect(-4, y - 3, 8, 1);
    g.fillStyle = '#3a3a44'; g.fillRect(-4, y + 2, 8, 1);
    g.fillStyle = tele ? '#ff3030' : '#ffd040'; g.fillRect(2, y - 1, 2, 2);
    if (((this.t * 20) | 0) % 2) { g.fillStyle = '#ff9030'; g.fillRect(-1, y + 3, 2, 1); }
  }
  renderBrute(g) {
    const st = this.state;
    const front = this.legs(g, -12, 4, '#5e5e6a', '#2a2a32', 6, 6, 4);
    const bob = this.onGround ? Math.round(Math.abs(Math.sin(this.walk)) * 1) : 0;
    let fF, fB;
    if (st === 'punchWind') { fF = [-6, -22]; fB = [9, -8]; }
    else if (st === 'punch') { fF = [19, -19]; fB = [-5, -8]; }
    else if (st === 'slamWind') { fF = [6, -40]; fB = [-2, -39]; }
    else if (st === 'slam') { fF = [13, -4]; fB = [-6, -4]; }
    else { fF = [10 + Math.sin(this.walk) * 2.5, -5]; fB = [-7 - Math.sin(this.walk) * 2.5, -5]; }
    const shF = [6, -25 + bob], shB = [-6, -26 + bob];
    // back arm
    const [ebx, eby, hbx, hby] = ik2(shB[0], shB[1], fB[0], fB[1], 9, 9, -1);
    limb(g, shB[0], shB[1], ebx, eby, hbx, hby, '#2a2a32', 4);
    g.fillStyle = '#24242c'; g.fillRect(Math.round(hbx) - 3, Math.round(hby) - 3, 6, 6);
    // hunched torso: wide shoulders tapering to the waist
    for (let y = -30; y <= -11; y++) {
      const k = (y + 30) / 19, half = Math.round(lerp(10, 5, k)), off = Math.round(lerp(1, -1, k));
      g.fillStyle = y < -28 ? '#6e6e7a' : y > -14 ? '#24242c' : '#3c3c48';
      g.fillRect(off - half, y + bob, half * 2, 1);
    }
    g.fillStyle = '#24242c'; g.fillRect(-9, -27 + bob, 2, 10);
    g.fillStyle = '#7a3e28'; g.fillRect(-6, -18 + bob, 3, 2); g.fillRect(5, -27 + bob, 3, 1);
    const furnace = this.windingUp() ? '#ffe080' : '#ff7a2a';
    g.fillStyle = '#141016'; g.fillRect(-1, -24 + bob, 7, 7);
    g.fillStyle = furnace; for (let i = 0; i < 3; i++) g.fillRect(0, -23 + bob + i * 2, 5, 1);
    g.fillStyle = '#6e6e7a'; g.fillRect(-1, -25 + bob, 7, 1);
    // head sunk between the shoulders
    g.fillStyle = '#2a2a32'; g.fillRect(4, -31 + bob, 7, 6);
    g.fillStyle = '#5e5e6a'; g.fillRect(4, -31 + bob, 7, 1);
    g.fillStyle = this.windingUp() ? '#ffffff' : '#ffb040'; g.fillRect(8, -29 + bob, 1, 1); g.fillRect(10, -29 + bob, 1, 1);
    g.fillStyle = '#141016'; g.fillRect(7, -27 + bob, 4, 1);
    front();
    // front arm + fist
    const [efx, efy, hfx, hfy] = ik2(shF[0], shF[1], fF[0], fF[1], 9, 9, -1);
    limb(g, shF[0], shF[1], efx, efy, hfx, hfy, '#5e5e6a', 4);
    g.fillStyle = '#8a8a96'; g.fillRect(shF[0] - 2, shF[1] - 2, 5, 4);
    g.fillStyle = '#6e6e7a'; g.fillRect(Math.round(hfx) - 3, Math.round(hfy) - 3, 7, 7);
    g.fillStyle = '#3c3c48'; g.fillRect(Math.round(hfx) - 3, Math.round(hfy) + 2, 7, 1);
    g.fillStyle = '#9a9aa6'; g.fillRect(Math.round(hfx) - 3, Math.round(hfy) - 3, 7, 1);
    g.fillStyle = '#7a3e28'; g.fillRect(Math.round(hfx), Math.round(hfy) - 1, 2, 1);
  }
  drawEmissive(ctx, camX, camY) {
    const x = this.x - camX, y = this.y - camY;
    if (this.spawning) {
      const k = 1 - this.spawnT / 0.75;
      const w = Math.max(1, Math.round((1 - k) * 3)), top = this.flying ? y - 60 : -10;
      if (((this.t * 30) | 0) % 3) {
        ctx.fillStyle = '#ff6a3a'; ctx.fillRect(Math.round(x) - w, top, w * 2 + 1, Math.round(y - top));
        ctx.fillStyle = '#ffe0a0'; ctx.fillRect(Math.round(x), top, 1, Math.round(y - top));
      }
      ctx.fillStyle = '#ff9a3a'; pring(ctx, x, y - 1, 3 + k * 10, 0.35, 1);
      return;
    }
    if (this.dead) return;
    if (this.windingUp() && this.type !== 'gunner') {
      if (((this.st * 14) | 0) % 2 === 0) drawText(ctx, this.heavy ? '!!' : '!', x, y - this.h - 11, { color: '#ffd040', align: 'center' });
    }
    if (this.type === 'gunner' && this.state === 'aim') {
      const mx = x + this.facing * 6, my = y - 13;
      const dur = this.tele(0.75), locked = this.st >= dur - 0.2;
      const L = 400, ex = mx + Math.cos(this.aim) * L, ey = my + Math.sin(this.aim) * L;
      const t = Level.raycast(mx + camX, my + camY, ex + camX, ey + camY);
      ctx.fillStyle = locked ? '#ffffff' : '#ff7a3a';
      const n = Math.floor((L * t) / 3);
      for (let i = 0; i < n; i++) {
        if (!locked && i % 2) continue;
        ctx.fillRect(Math.round(mx + Math.cos(this.aim) * i * 3), Math.round(my + Math.sin(this.aim) * i * 3), 1, 1);
      }
      if (((this.st * 14) | 0) % 2 === 0) drawText(ctx, '!', x, y - this.h - 11, { color: locked ? '#ffffff' : '#ffd040', align: 'center' });
    }
    if (this.hp < this.maxHp) {
      const bw = Math.max(12, this.w + 4), bx = Math.round(x - bw / 2), by = Math.round(y - this.h - 5);
      ctx.fillStyle = '#1a0a10'; ctx.fillRect(bx - 1, by - 1, bw + 2, 3);
      ctx.fillStyle = '#ff3048'; ctx.fillRect(bx, by, Math.round((bw * Math.max(0, this.hp)) / this.maxHp), 1);
    }
    if (this.tethered && Math.random() < 0.5) FX.elec(this.x, this.cy, 10, 1);
  }
  addLights() {
    if (this.spawning) { FX.frameLight(this.x, this.y - 10, 40, '#ff7a3a', 0.8); return; }
    const c = this.type === 'scrapper' ? '#c8ff3a' : this.type === 'gunner' ? '#ffaa30' : this.type === 'drone' ? (this.state === 'tele' ? '#ff3030' : '#ffd040') : '#ff7a2a';
    FX.frameLight(this.x + this.facing * 4, this.y - this.h + 3, this.heavy ? 34 : 16, c, 0.7);
    if (this.windingUp()) FX.frameLight(this.x, this.cy, 30, '#ffd040', 0.6);
  }
}

function hurtEnemy(e, dmg, o = {}) {
  if (e.dead || e.spawning || e.dying) return 0;
  if (e.shielded && e.shielded()) { e.shieldHit(o); return 0; }
  if (e.dodging && e.dodging()) {
    if (!e._missT || Game.time > e._missT) { e._missT = Game.time + 0.4; FX.text('DODGE', e.x, e.y - e.h - 8, { c: '#7af0ff', always: true, dur: 0.5, vy: -20 }); }
    return 0;
  }
  let d = dmg * (e.damageTakenMul ? e.damageTakenMul() : 1);
  if (e.tethered) d *= 1.25;
  d = Math.max(1, Math.round(d));
  e.hp -= d;
  e.hitFlash = 0.08;
  if (!o.noKnock) {
    const m = e.heavy ? (o.heavy ? 3 : 9) : e.mass;
    e.vx = (o.kx || 0) / m + e.vx * 0.2;
    const ky = (o.ky || 0) / m;
    if (ky < 0) { e.vy = Math.min(e.vy, ky); if (ky < -60) e.onGround = false; }
    else if (ky > 0) e.vy = Math.max(e.vy, ky);
  }
  if (e.heavy) {
    e.poise += d;
    if (o.heavy || e.poise > 80) { e.poise = 0; e.stagger(o.stagger || 0.4); }
  } else e.stagger(Math.max(o.stagger || 0.2, 0.12));
  const hx = e.x, hy = e.cy;
  const ang = o.angle !== undefined ? o.angle : Math.atan2(hy - Game.player.cy, hx - Game.player.x);
  FX.sparks(hx, hy, o.heavy ? 12 : 7, ang, 1.3, 60, 240);
  FX.oil(hx, hy, o.heavy ? 5 : 2, ang, 120);
  FX.text(d, hx + rand(-4, 4), e.y - e.h - 6, { c: o.crit ? '#ffd070' : o.heavy || d >= 30 ? '#ff8a9a' : '#ffffff', scale: o.crit || d >= 60 ? 2 : 1 });
  FX.light(hx, hy, 26, '#ff3048', 0.7, 0.1);
  Sound.play('hit', { heavy: o.heavy || d >= 30 });
  if (o.hitstop) Game.hitstop(o.hitstop);
  if (o.shake) Game.shake(o.shake);
  Game.registerHit(d);
  if (e.hp <= 0) killEnemy(e, o);
  return d;
}

function killEnemy(e, o) {
  if (e.onDeath) { e.onDeath(o); return; }
  e.dead = true; e.tethered = false; e.hp = 0;
  const g = Sprite.begin(e.facing);
  e.render(g);
  const img = Sprite.snapshot();
  const cx = e.x, cy = e.cy;
  const cut = ['slash', 'iaido', 'saw', 'tether', 'plunge', 'chain'].includes(o.cause);
  const ang = o.angle !== undefined ? o.angle : rand(0, TAU);
  const base = ((o.kx || 0) * 0.35) / e.mass;
  const nx = Math.cos(ang + Math.PI / 2), ny = Math.sin(ang + Math.PI / 2);
  if (cut) {
    FX.gib(img, cx, cy, Sprite.OX, Sprite.OY - e.h / 2, ang, 1, base + nx * 80, -110 + ny * 80, e.h * 0.4);
    FX.gib(img, cx, cy, Sprite.OX, Sprite.OY - e.h / 2, ang, -1, base - nx * 80, -150 - ny * 80, e.h * 0.4);
    const L = Math.max(e.w, e.h) * 0.8 + 6;
    FX.slashLine(cx - Math.cos(ang) * L, cy - Math.sin(ang) * L, cx + Math.cos(ang) * L, cy + Math.sin(ang) * L, { w: 2, dur: 0.2, grow: 0.02 });
  } else {
    FX.gib(img, cx, cy, Sprite.OX, Sprite.OY - e.h / 2, 0, 1, base + rand(-60, 60), -200, e.h * 0.4);
    FX.gib(img, cx, cy, Sprite.OX, Sprite.OY - e.h / 2, 0, -1, base + rand(-60, 60), -160, e.h * 0.4);
  }
  const big = e.heavy ? 2 : 1;
  FX.oil(cx, cy, 10 * big, -Math.PI / 2, 170);
  FX.sparks(cx, cy, 16 * big, 0, TAU, 60, 260);
  FX.debris(cx, cy, 10 * big, e.def.debris, 170);
  FX.elec(cx, cy, 14 * big, 4);
  FX.light(cx, cy, 50 * big, '#ff5030', 1, 0.25);
  if (e.type === 'drone' || e.heavy) {
    FX.ring(cx, cy, 3, 22 * big, 0.3, { c: '#ff7a2a', core: '#ffe0a0', w: 2 });
    FX.dust(cx, cy, 8 * big, { c: '#2a2026', smax: 60, r1: 6, life: 1.5, rise: 20 });
    FX.embers(cx, cy, 8 * big);
    Sound.play('explode', { big: e.heavy });
    Game.shake(e.heavy ? 0.45 : 0.15);
    if (e.heavy) { Game.hitstop(0.08); FX.flash('#ff7a3a', 0.2); FX.decal('scorch', cx, e.y, { r: 16 }); }
  }
  Sound.play('kill');
  Game.onKill(e, o);
}

class Bolt {
  constructor(x, y, ang, speed, dmg, col) {
    this.x = x; this.y = y; this.vx = Math.cos(ang) * speed; this.vy = Math.sin(ang) * speed;
    this.dmg = dmg; this.hostile = true; this.life = 3; this.dead = false;
    this.col = col || { outer: '#ff7a2a', core: '#fff0a0', light: '#ffb040' };
  }
  reflect(ang, mul, dmg) {
    const sp = Math.max(300, Math.hypot(this.vx, this.vy) * mul);
    this.vx = Math.cos(ang) * sp; this.vy = Math.sin(ang) * sp;
    this.hostile = false; this.dmg = dmg; this.life = 2;
    FX.sparks(this.x, this.y, 10, ang, 1, 80, 240, { c0: '#ffffff', c1: '#ff5a6a', c2: '#8a0c22' });
    FX.ring(this.x, this.y, 2, 10, 0.15, { w: 1 });
  }
  update(dt) {
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    const steps = 3;
    for (let i = 0; i < steps; i++) {
      this.x += (this.vx * dt) / steps; this.y += (this.vy * dt) / steps;
      if (Level.pointSolid(this.x, this.y)) {
        this.dead = true;
        FX.sparks(this.x, this.y, 6, Math.atan2(-this.vy, -this.vx), 1.4, 40, 140, this.hostile ? { c0: '#fff4d0', c1: '#ffb040', c2: '#a04010' } : {});
        return;
      }
      if (this.hostile) {
        const p = Game.player;
        if (!p.dead && this.x > p.x - p.w / 2 - 2 && this.x < p.x + p.w / 2 + 2 && this.y > p.y - p.h - 2 && this.y < p.y + 1) {
          const r = p.takeHit({ dmg: this.dmg, x: this.x - this.vx * 0.05, y: this.y, kind: 'projectile', proj: this, knock: 120 });
          if (r === 'hit' || r === 'immune') { this.dead = true; FX.sparks(this.x, this.y, 8, Math.atan2(-this.vy, -this.vx), 1.4, 40, 160); return; }
          if (r === 'parried') return;
        }
      } else {
        for (const e of Game.enemies) {
          if (e.dead || e.spawning) continue;
          if (this.x > e.x - e.w / 2 - 2 && this.x < e.x + e.w / 2 + 2 && this.y > e.y - e.h - 2 && this.y < e.y + 2) {
            hurtEnemy(e, this.dmg, { kx: this.vx * 0.3, ky: -80, heavy: true, cause: 'reflect', angle: Math.atan2(this.vy, this.vx), stagger: 0.5, hitstop: 0.03 });
            this.dead = true;
            return;
          }
        }
      }
    }
  }
  drawEmissive(ctx, camX, camY) {
    const x = this.x - camX, y = this.y - camY, sp = Math.hypot(this.vx, this.vy) || 1;
    const tx = x - (this.vx / sp) * 8, ty = y - (this.vy / sp) * 8;
    ctx.fillStyle = this.hostile ? this.col.outer : '#ff2a48'; pline(ctx, tx, ty, x, y, 2);
    ctx.fillStyle = this.hostile ? this.col.core : '#ffffff'; pline(ctx, x - (this.vx / sp) * 3, y - (this.vy / sp) * 3, x, y, 1);
    ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
  }
  addLights() { FX.frameLight(this.x, this.y, 24, this.hostile ? this.col.light : '#ff3048', 0.9); }
}

class Shockwave {
  constructor(x, y, dir, speed, dmg, owner) {
    this.x = x; this.y = y; this.dir = dir; this.speed = speed; this.dmg = dmg; this.owner = owner;
    this.t = 0; this.dur = 0.8; this.dead = false; this.hit = false;
  }
  update(dt) {
    this.t += dt;
    this.x += this.dir * this.speed * dt;
    if (this.t > this.dur || Level.pointSolid(this.x + this.dir * 3, this.y - 4) || !Level.pointSolid(this.x, this.y + 1, this.y)) { this.dead = true; return; }
    if (Math.random() < 0.8) FX.dust(this.x, this.y, 1, { smax: 30, rise: 30, c: '#6a5a5a' });
    if (Math.random() < 0.5) FX.debris(this.x, this.y - 1, 1, ['#4a4252', '#5c5464'], 120);
    const p = Game.player;
    if (!this.hit && !p.dead && Math.abs(p.x - this.x) < 8 && p.y > this.y - 7 && p.y < this.y + 3) {
      const r = p.takeHit({ dmg: this.dmg, x: this.x - this.dir * 10, y: this.y - 4, kind: 'shockwave', source: this.owner && !this.owner.dead ? this.owner : null, knock: 200 });
      if (r !== 'ignored') { this.hit = true; if (r === 'parried') this.dead = true; }
    }
  }
  drawEmissive(ctx, camX, camY) {
    const x = Math.round(this.x - camX), y = Math.round(this.y - camY), k = 1 - this.t / this.dur;
    const h = Math.round(5 + k * 6);
    ctx.fillStyle = '#ff7a2a'; ctx.fillRect(x - 1, y - h, 3, h);
    ctx.fillStyle = '#ffe080'; ctx.fillRect(x, y - h + 1, 1, h - 1);
    ctx.fillStyle = '#c04a1a'; ctx.fillRect(x - this.dir * 3 - 1, y - h + 3, 2, h - 3);
  }
  addLights() { FX.frameLight(this.x, this.y - 5, 26, '#ff7a2a', 0.8); }
}

class Barrel {
  constructor(x, y) {
    this.x = x; this.y = y; this.w = 10; this.h = 14; this.vx = 0; this.vy = 0;
    this.fuse = -1; this.dead = false; this.thrown = 0; this.tethered = false; this.isEnemy = false; this.heavy = false;
    this.onGround = false; this.towed = false; this.grabR = 9;
  }
  get cx() { return this.x; }
  get cy() { return this.y - 7; }
  hit(dmg, o = {}) {
    if (this.dead) return;
    this.vx += (o.kx || 0) * 0.5; this.vy = Math.min(this.vy, (o.ky || 0) * 0.5);
    if (this.fuse < 0) { this.fuse = o.heavy ? 0.12 : 0.38; Sound.play('barrelHit'); }
    FX.sparks(this.x, this.y - 7, 5, rand(0, TAU), TAU, 40, 140);
  }
  grab() { this.towed = true; this.onGround = false; }
  // Swing on the tether a short distance from the hand.
  towTo(hx, hy, dt, p) {
    const dx = this.x - hx, dy = this.cy - hy, d = Math.hypot(dx, dy) || 1;
    const L = Math.min(d, 26), tx = hx + (dx / d) * L, ty = hy + (dy / d) * L - 6;
    this.vx = (tx - this.x) * 14 + p.vx * 0.5; this.vy = (ty - this.cy) * 14 + p.vy * 0.5;
  }
  throwAt(ang) {
    this.towed = false;
    this.vx = Math.cos(ang) * 400; this.vy = Math.sin(ang) * 400 - 60;
    this.thrown = 1.4; this.onGround = false;
    if (this.fuse < 0) this.fuse = 1.3;
  }
  update(dt) {
    if (this.dead) return;
    if (this.towed) {
      if (!this.tethered) this.towed = false;
      this.x += this.vx * dt; this.y += this.vy * dt;
      return;
    }
    this.vy = Math.min(this.vy + 900 * dt, 520);
    if (this.onGround) this.vx = approach(this.vx, 0, 500 * dt);
    Level.moveBody(this, dt, { oneWay: true });
    this.x = clamp(this.x, 44, Level.W - 44);
    if (this.thrown > 0) {
      this.thrown -= dt;
      if (Math.hypot(this.vx, this.vy) > 120) {
        for (const e of Game.enemies) {
          if (!e.dead && !e.spawning && aabb(this.x - 6, this.y - 15, 12, 16, e.x - e.w / 2, e.y - e.h, e.w, e.h)) { this.explode(); return; }
        }
      }
    }
    if (this.fuse >= 0) {
      this.fuse -= dt;
      if (Math.random() < 0.4) FX.sparks(this.x, this.y - 15, 1, -Math.PI / 2, 1, 20, 60, { c0: '#fff4d0', c1: '#ffb040', c2: '#a04010' });
      if (this.fuse <= 0) this.explode();
    }
  }
  explode() {
    if (this.dead) return;
    this.dead = true;
    const cx = this.x, cy = this.y - 7, R = 58;
    for (const e of Game.enemies) {
      if (e.dead || e.spawning) continue;
      const d = dist(cx, cy, e.x, e.cy);
      if (d < R + e.w / 2) hurtEnemy(e, 70 * (1 - (d / (R + e.w)) * 0.5), { kx: ((e.x - cx) / (d || 1)) * 320, ky: -300, heavy: true, cause: 'barrel', stagger: 1, angle: Math.atan2(e.cy - cy, e.x - cx) });
    }
    for (const pr of Game.props) if (pr !== this && !pr.dead && dist(cx, cy, pr.x, pr.y) < R) pr.hit(10, { heavy: true, kx: (pr.x - cx) * 4, ky: -200 });
    const p = Game.player;
    const pd = dist(cx, cy, p.x, p.cy);
    if (pd < R * 0.8 && !p.dead && !p.ult) { p.vx += ((p.x - cx) / (pd || 1)) * 200; p.vy = Math.min(p.vy, -160); }
    FX.ring(cx, cy, 4, R, 0.35, { c: '#ff7a2a', core: '#ffe080', w: 2 });
    FX.sparks(cx, cy, 30, 0, TAU, 80, 300, { c0: '#ffffff', c1: '#ffb040', c2: '#a03010' });
    FX.dust(cx, cy, 16, { c: '#2a2026', smax: 90, r1: 8, life: 1.6, rise: 25 });
    FX.embers(cx, cy, 14);
    FX.debris(cx, cy, 12, ['#8a1a1a', '#c8a040', '#3a1a1a'], 220);
    FX.decal('scorch', cx, this.y, { r: 18 });
    FX.light(cx, cy, 140, '#ff8a3a', 1, 0.4);
    FX.flash('#ff8a3a', 0.25);
    Sound.play('explode', { big: true });
    Game.shake(0.5);
    Game.hitstop(0.05);
  }
  draw(ctx, camX, camY) {
    if (this.dead) return;
    const x = Math.round(this.x - camX) - 5, y = Math.round(this.y - camY) - 14;
    const blink = this.fuse >= 0 && ((this.fuse * 16) | 0) % 2;
    ctx.fillStyle = '#0b0910'; ctx.fillRect(x - 1, y, 12, 14); ctx.fillRect(x, y - 1, 10, 16);
    ctx.fillStyle = blink ? '#ffffff' : '#a01c1c'; ctx.fillRect(x, y, 10, 14);
    ctx.fillStyle = blink ? '#ffffff' : '#c83030'; ctx.fillRect(x + 1, y, 2, 14);
    ctx.fillStyle = '#5a0e0e'; ctx.fillRect(x + 8, y, 2, 14);
    ctx.fillStyle = '#3a0a0a'; ctx.fillRect(x, y + 3, 10, 1); ctx.fillRect(x, y + 10, 10, 1);
    ctx.fillStyle = '#e8c040'; ctx.fillRect(x + 3, y + 5, 4, 4);
    ctx.fillStyle = '#1a1010'; ctx.fillRect(x + 4, y + 6, 2, 2);
  }
  addLights() { if (this.fuse >= 0) FX.frameLight(this.x, this.y - 7, 24, '#ffb040', 0.7); }
}

class Pickup {
  constructor(x, y, kind) {
    this.x = x; this.y = y; this.kind = kind; this.vx = rand(-60, 60); this.vy = -180; this.w = 6; this.h = 6;
    this.t = 0; this.dead = false; this.onGround = false;
  }
  update(dt) {
    this.t += dt;
    const p = Game.player;
    const d = dist(this.x, this.y - 3, p.x, p.cy);
    if (this.t > 0.4 && d < 60 && !p.dead) {
      const sp = 260;
      this.vx = ((p.x - this.x) / d) * sp; this.vy = ((p.cy - this.y) / d) * sp;
      this.x += this.vx * dt; this.y += this.vy * dt;
      if (d < 8) this.collect(p);
      return;
    }
    this.vy = Math.min(this.vy + 700 * dt, 300);
    if (this.onGround) this.vx = approach(this.vx, 0, 300 * dt);
    Level.moveBody(this, dt);
    if (this.t > 14) this.dead = true;
  }
  collect(p) {
    this.dead = true;
    if (this.kind === 'hp') { p.heal(15); FX.text('+15', p.x, p.y - 28, { c: '#7dff8a', always: true }); }
    Sound.play('pickup');
    FX.sparks(this.x, this.y, 8, 0, TAU, 40, 120, { c0: '#ffffff', c1: '#7dff8a', c2: '#1a7a3a' });
  }
  drawEmissive(ctx, camX, camY) {
    if (this.t > 11 && ((this.t * 10) | 0) % 2) return;
    const x = Math.round(this.x - camX), y = Math.round(this.y - camY - 4 + Math.sin(this.t * 5) * 1.5);
    ctx.fillStyle = '#0b2a14'; ctx.fillRect(x - 3, y - 2, 7, 5); ctx.fillRect(x - 2, y - 3, 5, 7);
    ctx.fillStyle = '#5aff7a'; ctx.fillRect(x - 2, y, 5, 1); ctx.fillRect(x, y - 2, 1, 5);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, 1, 1);
  }
  addLights() { FX.frameLight(this.x, this.y - 4, 18, '#5aff7a', 0.7); }
}

// Rubble kicked up by the slide attack.
class Rock {
  constructor(x, y, vx, vy, dmg) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy; this.dmg = dmg;
    this.hostile = false; this.dead = false; this.life = 1.2; this.sz = Math.random() < 0.4 ? 3 : 2;
    this.c = pick(['#5c5464', '#6e6678', '#4a4252', '#7a6a5a']);
  }
  update(dt) {
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    const py = this.y;
    this.vy += 620 * dt;
    this.x += this.vx * dt; this.y += this.vy * dt;
    if (Level.pointSolid(this.x, this.y, py)) {
      this.dead = true;
      FX.dust(this.x, py, 1, { smax: 20, r1: 2, c: '#6a5a5a' });
      return;
    }
    for (const e of Game.enemies) {
      if (e.dead || e.spawning) continue;
      if (this.x > e.x - e.w / 2 - 1 && this.x < e.x + e.w / 2 + 1 && this.y > e.y - e.h - 1 && this.y < e.y + 1) {
        hurtEnemy(e, this.dmg, { kx: this.vx * 0.4, ky: -80, cause: 'rock', angle: Math.atan2(this.vy, this.vx), stagger: 0.3, hitstop: 0.01 });
        FX.debris(this.x, this.y, 3, [this.c], 80);
        this.dead = true;
        return;
      }
    }
  }
  draw(ctx, camX, camY) {
    const x = Math.round(this.x - camX), y = Math.round(this.y - camY);
    ctx.fillStyle = '#0b0910'; ctx.fillRect(x - 1, y - 1, this.sz + 2, this.sz + 2);
    ctx.fillStyle = this.c; ctx.fillRect(x, y, this.sz, this.sz);
    ctx.fillStyle = '#9a90a0'; ctx.fillRect(x, y, 1, 1);
  }
}

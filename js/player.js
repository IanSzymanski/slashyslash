'use strict';
// The cyborg swordsman: movement, combat, tether, shield, ultimate hook-up, and rig animation.

const PC = {
  W: 8, H: 20, CROUCH_H: 13, SLIDE_H: 10,
  RUN: 152, ACCEL: 1500, AIR_ACCEL: 1050, FRICTION: 1700, AIR_DRAG: 240, OVER_DRAG: 360,
  GRAV: 960, MAX_FALL: 430, JUMP: 300, DJUMP: 282, JUMP_CUT: 0.45, COYOTE: 0.09, JUMP_BUF: 0.13,
  WALL_SLIDE: 70, WALL_JUMP_X: 180, WALL_JUMP_Y: 290,
  CROUCH_SPEED: 55, SLIDE_MIN: 100, SLIDE_BOOST: 255, SLIDE_FRICTION: 230, BULLET: 375,
  DASH_SPEED: 480, DASH_TIME: 0.14, DASH_IFRAMES: 0.2, DASH_RECHARGE: 1.0, DASH_CHARGES: 2,
  TETHER_RANGE: 230, TETHER_COST: 15, TETHER_SPEED: 1150, ZIP_SPEED: 480,
  MAX_HP: 100, MAX_SHIELD: 100, SHIELD_DELAY: 3.0, SHIELD_RATE: 38,
  PARRY_COST: 15, PARRY_CD: 0.4, PARRY_CD_HIT: 0.25, STANCE_MAX: 0.9, DROP_HOLD: 0.16, DASH_ATTACK_WINDOW: 0.14,
  // presses made while an action is busy are remembered this long
  INPUT_BUF: 0.12,
  // a dash that cancels an attack waits this long, so swinging isn't free
  CANCEL_RECOVERY: 0.1,
  // re-pressing parry within this time shrinks the window (to 50% at most)
  PARRY_SPAM_DECAY: 0.6,
  DROP_TAP: 0.28,
  // below this much shield, a hit that breaks it carries its leftover damage
  SHIELD_OVERFLOW_AT: 25,
  // holding attack this long turns the press into a heavy; shorter presses are lights
  HEAVY_HOLD: 0.15,
};

const SWINGS = {
  1: { dur: 0.22, sweep: 0.075, act0: 0, act1: 0.11, span: 2.7, r: 36, thick: 10, dmg: 14, knock: 120, hitstop: 0.035, shake: 0.08, fade: 0.14 },
  2: { dur: 0.22, sweep: 0.075, act0: 0, act1: 0.11, span: 2.7, r: 36, thick: 10, dmg: 14, knock: 120, hitstop: 0.035, shake: 0.08, fade: 0.14 },
  3: { dur: 0.38, sweep: 0.12, act0: 0.03, act1: 0.18, span: 4.1, r: 54, thick: 17, dmg: 32, knock: 340, hitstop: 0.08, shake: 0.28, fade: 0.22, lunge: 210 },
};
// Heavy swings (hold attack). Times count from the start of the wind-up; act0/act1 bound the hit window.
// rise opens a string, crescent is a mid-string heavy, slam ends one with ground waves.
const HEAVIES = {
  rise: { wind: 0.08, dur: 0.44, sweep: 0.12, act0: 0.08, act1: 0.21, span: 3.0, r: 46, thick: 16, dmg: 30, knock: 180, launch: 330, hitstop: 0.07, shake: 0.24, fade: 0.24, lunge: 80 },
  crescent: { wind: 0.08, dur: 0.46, sweep: 0.13, act0: 0.08, act1: 0.23, span: 3.7, r: 54, thick: 18, dmg: 34, knock: 380, launch: 110, hitstop: 0.08, shake: 0.3, fade: 0.26, lunge: 200 },
  slam: { wind: 0.11, dur: 0.58, sweep: 0.12, act0: 0.11, act1: 0.25, span: 3.4, r: 52, thick: 20, dmg: 46, knock: 300, launch: 220, hitstop: 0.1, shake: 0.42, fade: 0.3, lunge: 120, quake: true, finisher: true },
};

// Drawn slashes: the dash attack, and the counter released after a parry.
const IAIDO = {
  dash: { len: 82, dmg: 26, arcR: 46, span: 3.0, thick: 12, lineW: 3, delayed: false, empowered: false, chain: false, post: 0.16, flash: 0.08, shake: 0.18 },
  dashHeavy: { len: 120, dmg: 42, arcR: 58, span: 3.6, thick: 17, lineW: 5, delayed: true, empowered: false, chain: false, post: 0.22, flash: 0.14, shake: 0.32, heavy: true },
  counter: { len: 165, dmg: 135, arcR: 115, span: 4.4, thick: 26, lineW: 7, delayed: true, empowered: true, chain: true, post: 0.32, flash: 0.35, shake: 0.6 },
};

const PCOL = {
  dark: '#363c50', mid: '#6b7591', light: '#a3adc4', hi: '#e2e8f2', boot: '#171a24',
  visor: '#ff2a48', core: '#ff3a50', scarf: '#ff2a44', scarfD: '#9a1228',
  blade: '#eef1fa', edge: '#ff4a64', handle: '#3a0a12', tsuba: '#d8b048', sheath: '#5a0c1a', sheathD: '#8e1426',
};

class Player {
  constructor(x, y) {
    this.x = x; this.y = y; this.w = PC.W; this.h = PC.H; this.vx = 0; this.vy = 0;
    this.facing = 1; this.onGround = false; this.col = null; this.dropThrough = false;
    this.hp = PC.MAX_HP; this.shield = PC.MAX_SHIELD; this.shieldDelay = 0; this.shieldFlash = 0; this.regenOn = false;
    this.dashCharges = PC.DASH_CHARGES; this.dashRecharge = 0; this.dashT = 0; this.dashVX = 0; this.dashVY = 0;
    this.iframes = 0; this.hurtT = 0;
    this.coyote = 0; this.jumpBuf = 0; this.airJumps = 1; this.jumpCuttable = false;
    this.crouching = false; this.sliding = false; this.slideT = 0; this.dropHoldT = 0; this.dropT = 0; this.crouchTapT = -1;
    this.dashBuf = 0; this.dashHold = 0; this.parryBuf = 0; this.parrySpam = 0; this.shieldWasFull = true; this.shieldFullFlash = 0;
    this.wallDir = 0; this.wallSliding = false; this.wallJumpLock = 0;
    this.spinT = 0; this.spinDur = 0; this.bulletT = 0;
    this.attack = null; this.comboTimer = 0; this.attackQueued = null; this.attackCD = 0;
    this.atkPend = null; this.strN = 0; this.strLights = 0; this.lastDir = 1; this.kickAnim = null;
    this.charId = 'ronin'; this.utilCD = 0; this.utilT = 0; this.utilFlash = 0;
    this.plunge = null; this.landLag = 0;
    this.shieldOffT = 0;
    this.sheathe = null; this.parryCD = 0; this.parryFlash = 0; this.postPose = 0; this.iaido = null; this.dashEndT = 0;
    this.tether = null;
    this.ult = null; this.ultCharge = 0; this.ultHold = 0; this.ultReadyPlayed = false;
    this.dead = false; this.deadT = 0; this.blinkT = 0; this.hoverAvail = true;
    this.runPhase = 0; this.animT = 0; this.landSquash = 0; this.ghostT = 0; this.stepT = 0;
    this.aimAngle = 0; this.aimX = x; this.aimY = y;
    this.loops = {};
    this.scarf = [];
    for (let i = 0; i < 6; i++) this.scarf.push({ x: x - i * 2, y: y - 16, px: x - i * 2, py: y - 16 });
  }

  get cx() { return this.x; }
  get cy() { return this.y - this.h * 0.55; }
  chest() { return [this.x, this.y - (this.h >= PC.H ? 12 : this.h * 0.62)]; }
  hand() { return [this.x + this.facing * 2, this.y - (this.h >= PC.H ? 13 : this.h * 0.65)]; }
  canStand(h = PC.H) { return Level.rectFree(this.x - this.w / 2, this.y - h, this.w, h - 0.01); }
  setHeight(h) {
    if (h > this.h && !this.canStand(h)) return false;
    this.h = h;
    return true;
  }
  stopLoop(k) { if (this.loops[k]) { this.loops[k].stop(); this.loops[k] = null; } }
  stopAllLoops() { for (const k in this.loops) this.stopLoop(k); }

  // ================= update =================
  update(dt) {
    this.animT += dt;
    const C = Game.cine, m = C && C.focus && Input.locked ? { x: C.focus.x, y: C.focus.cy } : Game.mouseWorld();
    this.aimX = m.x; this.aimY = m.y;
    const [cx, cy] = this.chest();
    this.aimAngle = Math.atan2(m.y - cy, m.x - cx);

    const dec = (k) => { if (this[k] > 0) this[k] = Math.max(0, this[k] - dt); };
    for (const k of ['iframes', 'hurtT', 'coyote', 'jumpBuf', 'attackCD', 'landLag', 'postPose', 'parryCD', 'parryFlash', 'dashEndT', 'shieldOffT', 'dropT', 'wallJumpLock', 'landSquash', 'shieldFlash', 'spinT', 'bulletT', 'blinkT', 'parryBuf', 'dashHold', 'shieldFullFlash', 'utilT', 'utilFlash']) dec(k);
    this.parrySpam = Math.max(0, this.parrySpam - dt / PC.PARRY_SPAM_DECAY);
    if (this.onGround) this.hoverAvail = true;
    if (this.dropT <= 0) this.dropThrough = false;
    if (this.dashCharges < PC.DASH_CHARGES) {
      this.dashRecharge += dt;
      if (this.dashRecharge >= PC.DASH_RECHARGE + (Game.has('emberWake') ? 0.25 : 0)) { this.dashCharges++; this.dashRecharge = 0; }
    }
    this.shieldDelay -= dt;
    if (this.shieldDelay <= 0 && this.shieldOffT <= 0 && this.shield < PC.MAX_SHIELD && !this.dead) {
      if (!this.regenOn) { this.regenOn = true; Sound.play('shieldRegen'); FX.ring(this.x, this.cy, 14, 6, 0.25, { c: '#2a8ad0', core: '#a0e8ff', w: 1 }); }
      this.shield = Math.min(PC.MAX_SHIELD, this.shield + PC.SHIELD_RATE * dt);
      if (this.shield >= PC.MAX_SHIELD) this.onShieldFull();
    } else if (this.shieldDelay > 0) this.regenOn = false;
    if (this.shield < PC.MAX_SHIELD - 0.5) this.shieldWasFull = false;
    // training: health comes back once you've gone a few seconds without being hit
    if (Game.mode === 'training' && this.shieldDelay < -1 && this.hp < PC.MAX_HP) this.hp = Math.min(PC.MAX_HP, this.hp + 40 * dt);
    if (this.utilCD > 0) {
      this.utilCD -= dt;
      if (this.utilCD <= 0) { this.utilCD = 0; Sound.play('utilReady'); FX.ring(this.x, this.cy, 4, 16, 0.25, { w: 1, c: '#ff3a52', core: '#ffd0d8' }); }
    }
    if (this.ultCharge >= 1 && !this.ultReadyPlayed) {
      this.ultReadyPlayed = true; Sound.play('ultReady');
      Game.announce('ULTIMATE READY', null, '#ff3a52', 1.4, true);
    }

    if (this.dead) { this.updateDead(dt); return; }
    if (this.ult) { getUltimate(this.ult.id).update(this, dt); this.updateScarf(dt); return; }

    const left = Input.isDown('left'), right = Input.isDown('right');
    const up = Input.isDown('jump'), down = Input.isDown('crouch');
    const mx = (right ? 1 : 0) - (left ? 1 : 0);

    this.updateUltHold(dt);
    this.updateSheathe(dt);
    if (Input.wasPressed('dash')) { this.dashBuf = PC.INPUT_BUF; if (this.attack && !this.dashHold) this.dashHold = PC.CANCEL_RECOVERY; }
    this.updateDashBuffer(dt, mx, up, down);
    this.updateTetherInput();
    this.updateTether(dt);
    if (Input.wasPressed('attack')) this.onAttackPressed(down);
    this.updateAttackInput(dt);
    if (Input.wasPressed('utility')) this.tryUtility();
    if (Input.wasPressed('jump')) this.jumpBuf = PC.JUMP_BUF;
    if (Input.wasReleased('jump') && this.vy < 0 && this.jumpCuttable) { this.vy *= PC.JUMP_CUT; this.jumpCuttable = false; }

    const wasGround = this.onGround, preVy = this.vy;
    if (this.dashT > 0) this.moveDash(dt);
    else if (this.iaido) this.moveIaido(dt);
    else if (this.rebounding()) this.moveRebound(dt);
    else if (this.zipping()) this.moveZip(dt);
    else if (this.plunge) this.movePlunge(dt, mx);
    else this.moveNormal(dt, mx, up, down);

    const col = Level.moveBody(this, dt, { step: this.plunge ? 0 : 11 });
    if (col.ground && !wasGround) this.onLand(preVy);
    if (!col.ground && wasGround && this.vy >= 0) this.coyote = PC.COYOTE;
    if (this.zipping() && (col.wallL || col.wallR || col.ceil || col.ground) && this.tether.kind === 'world') {
      const T = this.tether;
      if (Math.hypot(T.x - this.x, T.y - this.cy) < 26) this.arriveZip();
    }
    if (this.iaido && (col.wallL || col.wallR)) this.iaido.t = this.iaido.dur;

    this.updateAttack(dt);
    this.updateKick(dt);
    this.updateScarf(dt);
    this.updateGhosts(dt);
    if (this.onGround && Math.abs(this.vx) > 15) this.runPhase += Math.abs(this.vx) * dt * 0.105;
    if (this.onGround && Math.abs(this.vx) > 40 && !this.sliding) {
      this.stepT -= dt * Math.abs(this.vx) / 150;
      if (this.stepT <= 0) { this.stepT = 0.26; Sound.play('step'); if (Math.random() < 0.4) FX.dust(this.x - this.facing * 2, this.y, 1, { smax: 20, r1: 2 }); }
    }
  }

  moveNormal(dt, mx, up, down) {
    // crouch / slide on the ground
    if (this.onGround) {
      this.airJumps = 1;
      if (Input.wasPressed('crouch') && Math.abs(this.vx) > PC.SLIDE_MIN && !this.sliding && !this.attack && !this.sheathe) this.startSlide();
      // double-tap crouch on a one-way platform to drop through it (or hold, if set that way)
      const onOneWay = Level.onOneWay(this);
      let drop = false;
      if (S.controls.dropDoubleTap) {
        if (Input.wasPressed('crouch') && onOneWay) {
          if (this.crouchTapT >= 0 && Game.time - this.crouchTapT < PC.DROP_TAP) { drop = true; this.crouchTapT = -1; }
          else this.crouchTapT = Game.time;
        }
      } else if (down && !this.sliding && onOneWay) {
        this.dropHoldT += dt;
        if (this.dropHoldT >= PC.DROP_HOLD) { this.dropHoldT = 0; drop = true; }
      } else this.dropHoldT = 0;
      if (drop) {
        this.sliding = false;
        this.dropT = 0.22; this.dropThrough = true; this.onGround = false; this.vy = 40;
        this.crouching = false; this.setHeight(PC.H);
      }
    }
    if (this.sliding) {
      this.slideT -= dt;
      this.vx = approach(this.vx, 0, PC.SLIDE_FRICTION * dt);
      if (Math.random() < 0.6) FX.sparks(this.x + this.facing * 4, this.y - 1, 1, this.facing > 0 ? Math.PI + 0.35 : -0.35, 0.6, 40, 120, { life: 0.6, g: 200 });
      if (Math.random() < 0.3) FX.dust(this.x, this.y, 1, { smax: 25 });
      const end = !this.onGround || Math.abs(this.vx) < 65 || this.slideT <= 0 || (!down && this.canStand());
      if (end) {
        this.sliding = false;
        if (down && this.onGround) { this.crouching = true; this.setHeight(PC.CROUCH_H); }
        else if (!this.setHeight(PC.H)) { this.crouching = true; this.setHeight(PC.CROUCH_H); }
      }
    } else if (this.onGround && down && !this.dropThrough) {
      if (!this.crouching) { this.crouching = true; this.setHeight(PC.CROUCH_H); }
    } else if (this.crouching && (!down || !this.onGround)) {
      if (this.setHeight(PC.H)) this.crouching = false;
    }

    // horizontal
    let maxSpd = this.crouching ? PC.CROUCH_SPEED : PC.RUN;
    if (this.sheathe) maxSpd = this.onGround ? 38 : 70;
    if (this.attack && this.onGround) maxSpd *= this.attack.heavy && this.attack.t <= this.attack.act1 ? 0.25 : 0.45;
    if (this.ultHold > 0) maxSpd *= 0.5;
    if (this.landLag > 0 || this.postPose > 0.12) maxSpd *= 0.2;
    if (!this.sliding) {
      const accel = this.onGround ? PC.ACCEL : PC.AIR_ACCEL;
      if (mx !== 0 && this.wallJumpLock <= 0) {
        if (Math.abs(this.vx) > maxSpd && sign(this.vx) === mx) this.vx = approach(this.vx, mx * maxSpd, (this.onGround ? PC.OVER_DRAG * 2 : PC.OVER_DRAG * 0.5) * dt);
        else this.vx = approach(this.vx, mx * maxSpd, accel * dt);
      } else {
        const fr = this.onGround ? PC.FRICTION : PC.AIR_DRAG;
        this.vx = approach(this.vx, 0, fr * dt);
      }
    }
    const busy = this.attack || this.sheathe || this.ultHold > 0 || (this.tether && (this.tether.phase === 'fly' || this.tether.mode === 'tow'));
    if (busy) this.facing = Math.cos(this.aimAngle) >= 0 ? 1 : -1;
    else if (mx !== 0 && !this.sliding) this.facing = mx;
    else if (this.onGround && !this.sliding && Math.abs(this.vx) < 20 && this.postPose <= 0) this.facing = Math.cos(this.aimAngle) >= 0 ? 1 : -1;

    // walls
    this.wallDir = !this.onGround ? (Level.touchingWall(this, 1) ? 1 : Level.touchingWall(this, -1) ? -1 : 0) : 0;
    this.wallSliding = this.wallDir !== 0 && mx === this.wallDir && this.vy > 0 && !this.attack;

    // gravity
    let grav = PC.GRAV * Game.gravMul();
    if (this.vy > 0 && !up) grav *= 1.12;
    if (this.attack && !this.onGround && this.vy > 0) grav *= 0.45;
    if (this.sheathe && !this.onGround && this.sheathe.hover > 0) {
      grav *= 0.12; this.vy = Math.min(this.vy, 25); this.sheathe.hover -= dt;
    }
    this.vy = Math.min(this.vy + grav * dt, PC.MAX_FALL);
    if (this.wallSliding) {
      this.vy = Math.min(this.vy, PC.WALL_SLIDE);
      this.facing = -this.wallDir;
      if (Math.random() < 0.2) FX.dust(this.x + this.wallDir * 4, this.y - 10, 1, { smax: 10, r1: 2 });
    }

    // jumping
    if (this.jumpBuf > 0 && !this.sheathe && this.landLag <= 0.05) {
      if (this.onGround || this.coyote > 0) {
        if ((this.crouching || this.sliding) && this.onGround) this.bulletJump();
        else this.groundJump();
        this.jumpBuf = 0;
      } else if (this.wallDir !== 0) { this.wallJump(); this.jumpBuf = 0; }
      else if (this.airJumps > 0) { this.doubleJump(); this.jumpBuf = 0; }
    }
  }

  startSlide() {
    this.sliding = true; this.crouching = false; this.slideT = 0.7;
    this.facing = sign(this.vx);
    this.vx = sign(this.vx) * Math.max(Math.abs(this.vx) * 1.15, PC.SLIDE_BOOST);
    this.setHeight(PC.SLIDE_H);
    Sound.play('slide');
    FX.dust(this.x, this.y, 5, { ang: this.facing > 0 ? Math.PI : 0, spread: 1.2, smax: 50 });
  }
  groundJump() {
    this.vy = -PC.JUMP; this.coyote = 0; this.onGround = false; this.jumpCuttable = true;
    if (this.crouching) { this.crouching = false; this.setHeight(PC.H); }
    Sound.play('jump');
    FX.dust(this.x, this.y, 4, { smax: 35, rise: 4 });
  }
  doubleJump() {
    this.vy = -PC.DJUMP; this.airJumps--; this.jumpCuttable = true;
    this.spinT = 0.32; this.spinDur = 0.32;
    Sound.play('djump');
    FX.ring(this.x, this.y, 2, 12, 0.22, { sy: 0.35, w: 1, c: '#ff3a52', core: '#ffd0d8' });
    FX.sparks(this.x, this.y, 6, Math.PI / 2, 2.2, 40, 120, { life: 0.7 });
  }
  wallJump() {
    this.vx = -this.wallDir * PC.WALL_JUMP_X; this.vy = -PC.WALL_JUMP_Y;
    this.wallJumpLock = 0.13; this.facing = -this.wallDir; this.airJumps = 1; this.jumpCuttable = true;
    Sound.play('walljump');
    FX.dust(this.x + this.wallDir * 4, this.y - 8, 5, { ang: this.wallDir > 0 ? Math.PI : 0, spread: 1, smax: 50 });
    FX.sparks(this.x + this.wallDir * 4, this.y - 8, 4, this.wallDir > 0 ? Math.PI : 0, 1.4, 40, 140);
    this.wallDir = 0;
  }
  bulletJump() {
    let dx = Math.cos(this.aimAngle), dy = Math.sin(this.aimAngle);
    if (dy > -0.28) { dy = -0.28; const l = Math.hypot(dx, dy); dx /= l; dy /= l; }
    this.sliding = false; this.crouching = false;
    if (!this.setHeight(PC.H)) this.setHeight(PC.CROUCH_H);
    this.vx = dx * PC.BULLET; this.vy = dy * PC.BULLET;
    this.onGround = false; this.coyote = 0; this.jumpCuttable = false;
    this.facing = dx >= 0 ? 1 : -1;
    this.spinT = 0.45; this.spinDur = 0.45; this.bulletT = 0.4;
    Sound.play('bulletjump');
    FX.dust(this.x, this.y, 8, { smax: 70, rise: 10 });
    FX.ring(this.x, this.y - 6, 3, 18, 0.25, { w: 1 });
    FX.sparks(this.x, this.y - 4, 10, Math.atan2(-dy, -dx), 1.3, 60, 200);
    Game.shake(0.08);
  }
  onLand(preVy) {
    this.airJumps = 1; this.spinT = 0; this.bulletT = 0;
    if (this.kickAnim && this.kickAnim.t > 0.1) this.kickAnim = null;
    if (this.plunge) { this.plungeImpact(); return; }
    if (preVy > 200) {
      this.landSquash = 0.12;
      Sound.play('land', { v: clamp(preVy / 400, 0.4, 1.2) });
      FX.dust(this.x, this.y, 4 + ((preVy / 100) | 0), { smax: 40, rise: 3 });
    }
    if (Input.isDown('crouch') && Math.abs(this.vx) > PC.SLIDE_MIN && !this.attack && !this.sheathe && !this.iaido) this.startSlide();
  }

  // ---------- dash ----------
  // Finishers, heavies and slide attacks can't be cancelled until their blade has done its work.
  committed() {
    const a = this.attack;
    return !!a && (a.finisher || a.heavy || a.groundCut) && a.t <= a.act1;
  }
  updateDashBuffer(dt, mx, up, down) {
    if (this.dashBuf <= 0) return;
    const waiting = this.committed() || this.dashHold > 0;
    if (!waiting && this.dashCharges > 0 && this.dashT <= 0 && !this.iaido) { this.dashBuf = 0; this.dashHold = 0; this.tryDash(mx, up, down); return; }
    // a dash held back by an attack stays queued until the attack allows it
    if (!waiting) this.dashBuf -= dt;
  }
  tryDash(mx, up, down) {
    if (this.dashCharges <= 0 || this.dashT > 0 || this.iaido) return;
    let dx = mx, dy = (down ? 1 : 0) - (up ? 1 : 0);
    if (this.onGround && dy > 0) dy = 0;
    if (dx === 0 && dy === 0) dx = this.facing;
    const l = Math.hypot(dx, dy); dx /= l; dy /= l;
    if (this.sheathe) this.cancelSheathe();
    if (this.tether) this.releaseTether();
    this.attack = null; this.attackQueued = null; this.plunge = null; this.postPose = 0; this.landLag = 0; this.kickAnim = null;
    if (this.sliding || this.crouching) { this.sliding = false; this.crouching = false; if (!this.setHeight(PC.H)) this.setHeight(PC.SLIDE_H); }
    const spd = this.ult ? PC.DASH_SPEED * 1.25 : PC.DASH_SPEED;
    this.dashT = PC.DASH_TIME; this.dashVX = dx * spd; this.dashVY = dy * spd * 0.85; this.dashHits = new Set();
    this.iframes = Math.max(this.iframes, PC.DASH_IFRAMES);
    if (this.dashCharges === PC.DASH_CHARGES) this.dashRecharge = 0;
    this.dashCharges--;
    if (dx !== 0) this.facing = sign(dx);
    Sound.play('dash');
    const [cx, cy] = this.chest();
    FX.ring(cx, cy, 2, 14, 0.18, { w: 1 });
    FX.sparks(cx, cy, 8, Math.atan2(-dy, -dx), 1.2, 60, 200);
    FX.light(cx, cy, 40, '#ff3048', 0.8, 0.15);
    Game.shake(0.06);
  }
  moveDash(dt) {
    this.dashT -= dt;
    this.vx = this.dashVX; this.vy = this.dashVY;
    if (Game.has('emberWake')) {
      for (const e of Game.enemies) {
        if (e.dead || e.spawning || this.dashHits.has(e)) continue;
        if (aabb(this.x - this.w / 2 - 4, this.y - this.h, this.w + 8, this.h, e.x - e.w / 2, e.y - e.h, e.w, e.h)) {
          this.dashHits.add(e);
          hurtEnemy(e, 20, { kx: sign(this.dashVX || this.facing) * 80, ky: -60, cause: 'dash', angle: Math.atan2(this.dashVY, this.dashVX), stagger: 0.3, hitstop: 0.02 });
          FX.sparks(e.x, e.cy, 8, Math.atan2(this.dashVY, this.dashVX), 1, 60, 200, { c0: '#ffffff', c1: '#ffb040', c2: '#ff3048' });
        }
      }
      if (Math.random() < 0.7) FX.embers(this.x, this.y - 4, 1);
    }
    if (this.dashT <= 0) {
      this.dashT = 0;
      this.dashEndT = PC.DASH_ATTACK_WINDOW;
      this.vx *= 0.55;
      this.vy = this.dashVY < 0 ? this.dashVY * 0.45 : this.dashVY * 0.3;
    }
  }

  // ---------- melee ----------
  // A tap is a light, a hold (PC.HEAVY_HOLD) is a heavy. Dash attacks lock their context at the press.
  onAttackPressed(down) {
    if (this.sheathe || this.iaido || this.ultHold > 0) return;
    const dashing = this.dashT > 0 || this.dashEndT > 0;
    if (!dashing && !this.onGround && down && !this.plunge) { this.atkPend = null; this.startPlunge(); return; }
    if (this.plunge) return;
    this.atkPend = { t: 0, dash: dashing };
  }
  updateAttackInput(dt) {
    const P = this.atkPend;
    if (!P) return;
    P.t += dt;
    const held = Input.isDown('attack');
    if (held && P.t < PC.HEAVY_HOLD) return;
    this.atkPend = null;
    this.resolveAttack(held ? 'H' : 'L', P.dash);
  }
  resolveAttack(kind, dash) {
    if (this.sheathe || this.iaido || this.ultHold > 0 || this.plunge || this.dead) return;
    if (kind === 'H') {
      const [hx, hy] = this.hand();
      Sound.play('heavyDraw');
      FX.ring(hx, hy - 4, 2, 12, 0.16, { w: 1, c: '#ff3a52', core: '#ffffff' });
      FX.light(hx, hy, 30, '#ff3048', 0.8, 0.12);
    }
    if (dash || this.dashT > 0 || this.dashEndT > 0) { this.dashAttack(kind); return; }
    if (this.attack || this.attackCD > 0) { this.attackQueued = kind; return; }
    if (this.sliding && this.onGround && !this.stringLive()) { this.startGroundCut(kind); return; }
    this.startString(kind, false);
  }
  stringLive() { return this.comboTimer > 0 && this.strN > 0 && this.strN < 4; }
  // Attacking during (or right after) a dash turns it into a drawn slash along the cursor line.
  dashAttack(kind = 'L') {
    this.dashT = 0; this.dashEndT = 0;
    this.attack = null; this.attackQueued = null;
    this.startIaido(kind === 'H' ? IAIDO.dashHeavy : IAIDO.dash);
    this.iaido.kind = kind;
  }
  // The basic string: up to four hits mixing lights and heavies (L H L, H L L H, L L H...).
  // Three lights in a row, or a light fourth hit, end in the lunging finisher; a heavy third or fourth hit ends in a slam.
  startString(kind, chained) {
    const cont = (chained || this.comboTimer > 0) && this.strN > 0 && this.strN < 4;
    const n = cont ? this.strN + 1 : 1, lights = cont ? this.strLights : 0;
    let type;
    if (kind === 'L') type = lights >= 2 || n >= 4 ? 'L3' : 'L';
    else type = n >= 3 ? 'slam' : n === 1 ? 'rise' : 'crescent';
    this.startSwing(type, cont);
    this.strN = n; this.strLights = kind === 'L' ? lights + 1 : 0;
    if (this.attack.finisher) { this.strN = 0; this.strLights = 0; }
  }
  startSwing(type, cont) {
    const heavy = type !== 'L' && type !== 'L3';
    const d = heavy ? HEAVIES[type] : SWINGS[type === 'L3' ? 3 : 1];
    const ang = this.aimAngle, fdir = Math.cos(ang) >= 0 ? 1 : -1;
    this.facing = fdir;
    if (this.sliding) { this.sliding = false; if (!this.setHeight(PC.H)) { this.crouching = true; this.setHeight(PC.CROUCH_H); } }
    // lights alternate direction; a rising heavy sweeps upward, a slam comes down over the top
    let dir = fdir;
    if (type === 'L' || type === 'crescent') dir = cont ? -this.lastDir : fdir;
    else if (type === 'rise') dir = -fdir;
    this.lastDir = dir;
    this.attack = Object.assign({ type, heavy, finisher: type === 'L3', stage: type === 'L3' ? 3 : 1, wind: 0, t: 0, ang, dir, hit: new Set(), swept: false }, d);
    this.attackQueued = null; this.postPose = 0; this.kickAnim = null;
    if (!heavy) this.beginSweep(this.attack);
    else if (type === 'rise' && !this.onGround) this.vy = Math.min(this.vy, -60);
  }
  // The blade starts moving: lights at once, heavies after their wind-up.
  beginSweep(a) {
    a.swept = true;
    const [, cy] = this.chest();
    FX.swoosh({
      x: this.x, y: cy, follow: this, ox: 0, oy: cy - this.y, r: a.r, span: a.span, ang: a.ang, dir: a.dir,
      sweep: a.sweep, dur: a.sweep + a.fade, thick: a.thick, pal: PALETTES.red, trail: a.heavy ? 1 : a.stage === 3 ? 0.95 : 0.85,
    });
    Sound.play('swing', { stage: a.stage === 3 || a.heavy ? 3 : 1 });
    if (a.heavy) Sound.play('heavySwing');
    if (a.lunge) {
      this.vx = this.vx * 0.3 + Math.cos(a.ang) * a.lunge;
      if (!this.onGround) this.vy = Math.min(this.vy, Math.sin(a.ang) * a.lunge * 0.6);
      Game.shake(a.heavy ? 0.1 : 0.06);
    } else if (this.onGround) this.vx += this.facing * 40;
    if (a.type === 'rise' && !this.onGround) this.vy = Math.min(this.vy, -150);
    if (!this.onGround && this.vy > 0) this.vy *= 0.4;
    FX.light(this.x + Math.cos(a.ang) * a.r * 0.6, cy + Math.sin(a.ang) * a.r * 0.6, a.r * (a.heavy ? 2 : 1.6), '#ff2040', 0.9, a.sweep + a.fade);
  }
  // Slide attacks. Light: the blade bites into the street and sprays rubble ahead.
  // Heavy: it digs in deep and brakes the slide, then rips upward through an eruption of rock that launches.
  startGroundCut(kind = 'L') {
    const f = this.facing;
    if (kind === 'H') {
      this.attack = { stage: 4, groundCut: true, heavy: true, t: 0, dur: 0.5, rip: 0.16, act0: 0.16, act1: 0.27, ang: f > 0 ? -1.1 : Math.PI + 1.1, dir: -f, span: 0, sweep: 0.08, hit: new Set(), rocks: false, dug: false };
      this.vx = f * Math.max(Math.abs(this.vx) * 0.45, 70);
      this.slideT = Math.max(this.slideT, 0.2);
    } else {
      this.attack = { stage: 4, groundCut: true, t: 0, dur: 0.36, act0: 0.02, act1: 0.22, ang: f > 0 ? 0.3 : Math.PI - 0.3, dir: f, span: 0, sweep: 0.08, hit: new Set(), rocks: false };
      this.slideT = Math.max(this.slideT, 0.32);
      this.vx = f * Math.max(Math.abs(this.vx), 170);
    }
    this.attackQueued = null; this.kickAnim = null;
    Sound.play('groundCut');
  }
  // Where the buried blade breaks the surface, in world x.
  bladeEntryX(a) { return this.x + this.facing * (a.heavy ? 9 : 13); }
  updateGroundCut(a) {
    const f = this.facing, ex = this.bladeEntryX(a), ey = this.y - 1;
    const grit = ['#4a4252', '#5c5464', '#3a3442', '#6e6678'];
    if (a.heavy) { this.updateHeavyGroundCut(a, ex, ey, grit); return; }
    if (a.t >= 0.04 && a.t < 0.27) {
      // the buried blade drags a furrow: sparks stream back, grit kicks up off the entry point
      FX.sparks(ex, ey, 2, f > 0 ? Math.PI + 0.4 : -0.4, 0.8, 60, 200, { life: 0.6 });
      if (Math.random() < 0.6) FX.debris(ex, ey, 1, grit, 150, 0.5);
      if (Math.random() < 0.5) FX.dust(ex, this.y, 1, { smax: 30, c: '#6a5a5a' });
    }
    if (a.t >= a.act0 && a.t <= a.act1) {
      for (const e of Game.enemies) {
        if (e.dead || e.spawning || a.hit.has(e)) continue;
        if (aabb(f > 0 ? this.x : this.x - 28, this.y - 12, 28, 12, e.x - e.w / 2, e.y - e.h, e.w, e.h)) {
          a.hit.add(e);
          hurtEnemy(e, 12, { kx: f * 160, ky: -170, cause: 'groundcut', angle: f > 0 ? -0.3 : Math.PI + 0.3, stagger: 0.4, hitstop: 0.03 });
        }
      }
    }
    if (!a.rocks && a.t >= 0.05) {
      a.rocks = true;
      for (let i = 0; i < 10; i++) {
        const ang = (f > 0 ? 0 : Math.PI) - f * rand(0.12, 0.95), sp = rand(170, 330);
        Game.projectiles.push(new Rock(ex + rand(-2, 2), ey - rand(0, 3), Math.cos(ang) * sp, Math.sin(ang) * sp, 7));
      }
      FX.debris(ex, ey, 12, grit, 200);
      FX.dust(ex, this.y, 10, { ang: f > 0 ? -0.4 : Math.PI + 0.4, spread: 0.8, smin: 40, smax: 140, rise: 10, r1: 5 });
      FX.sparks(ex, ey, 10, f > 0 ? -0.5 : Math.PI + 0.5, 0.9, 80, 260);
      FX.decal('gouge', ex - f * 11, this.y, { len: 26 * f, dur: 5 });
      Game.shake(0.12);
      Sound.play('rocks');
    }
  }
  updateHeavyGroundCut(a, ex, ey, grit) {
    const f = this.facing;
    if (a.t < a.rip) {
      if (!a.dug && a.t >= 0.04) {
        a.dug = true;
        FX.debris(ex, ey, 8, grit, 150);
        FX.sparks(ex, ey, 10, f > 0 ? Math.PI + 0.5 : -0.5, 1, 60, 220, { life: 0.7 });
        FX.decal('gouge', ex - f * 8, this.y, { len: 14 * f, dur: 5 });
        Sound.play('rocks');
        Game.shake(0.12);
      }
      if (a.dug && Math.random() < 0.7) FX.sparks(ex, ey, 1, -Math.PI / 2 + rand(-0.6, 0.6), 0.4, 40, 140, { life: 0.5 });
    } else if (!a.rocks) {
      a.rocks = true;
      for (let i = 0; i < 16; i++) {
        const ang = (f > 0 ? 0 : Math.PI) - f * rand(0.5, 1.4), sp = rand(220, 400);
        Game.projectiles.push(new Rock(ex + rand(-4, 4), ey - rand(0, 4), Math.cos(ang) * sp, Math.sin(ang) * sp, 9));
      }
      FX.debris(ex, ey, 22, grit, 300);
      FX.dust(ex, this.y, 14, { ang: -Math.PI / 2 + f * 0.5, spread: 1, smin: 40, smax: 160, rise: 14, r1: 6 });
      FX.sparks(ex, ey, 18, -Math.PI / 2 + f * 0.4, 1.2, 100, 320);
      FX.ring(ex, this.y - 1, 3, 40, 0.3, { sy: 0.3, w: 2 });
      FX.decal('crack', ex, this.y, { len: 18, n: 6, dur: 6 });
      FX.swoosh({ x: this.x, y: this.cy, follow: this, ox: 0, oy: this.cy - this.y, r: 30, span: 2.6, ang: f > 0 ? -0.7 : Math.PI + 0.7, dir: -f, sweep: 0.08, dur: 0.3, thick: 14, trail: 1 });
      FX.light(ex, this.y - 10, 90, '#ff3048', 1, 0.3);
      FX.flash('#ff3048', 0.12);
      Sound.play('slam'); Sound.play('swing', { stage: 3 }); Sound.play('heavySwing');
      Game.shake(0.32);
      Game.hitstop(0.05);
      // the rip throws you up out of the slide, ready for an air string
      this.sliding = false; this.crouching = false;
      if (!this.setHeight(PC.H)) { this.crouching = true; this.setHeight(PC.CROUCH_H); }
      if (!this.crouching) { this.vy = -230; this.vx = f * 50; this.onGround = false; this.airJumps = 1; }
    }
    if (a.t >= a.act0 && a.t <= a.act1) {
      for (const e of Game.enemies) {
        if (e.dead || e.spawning || a.hit.has(e)) continue;
        if (aabb(f > 0 ? this.x - 4 : this.x - 36, this.y - 28, 40, 30, e.x - e.w / 2, e.y - e.h, e.w, e.h)) {
          a.hit.add(e);
          hurtEnemy(e, 30, { kx: f * 120, ky: -380, heavy: true, cause: 'groundcut', angle: -Math.PI / 2 + f * 0.3, stagger: 0.8, hitstop: 0.05, guardBreak: true });
        }
      }
    }
  }
  // A slide attack opens a string: stand up out of it into lights or heavies.
  endGroundCut(a) {
    this.attack = null;
    this.strN = 1; this.strLights = a.heavy ? 0 : 1; this.lastDir = a.heavy ? -this.facing : this.facing;
    this.comboTimer = a.heavy ? 0.5 : 0.42;
  }
  updateAttack(dt) {
    if (!this.attack) {
      if (this.comboTimer > 0) { this.comboTimer -= dt; if (this.comboTimer <= 0) { this.strN = 0; this.strLights = 0; } }
      if (this.attackQueued && this.attackCD <= 0 && !this.sheathe && !this.iaido && !this.plunge && this.dashT <= 0) {
        const k = this.attackQueued;
        this.attackQueued = null;
        if (this.sliding && this.onGround && !this.stringLive()) this.startGroundCut(k);
        else this.startString(k, false);
      }
      return;
    }
    const a = this.attack;
    a.t += dt;
    if (a.groundCut) {
      this.updateGroundCut(a);
      if (this.attack === a && a.t >= a.dur) this.endGroundCut(a);
      return;
    }
    if (!a.swept && a.t >= a.wind) this.beginSweep(a);
    if (a.swept && a.t >= a.act0 && a.t <= a.act1) {
      const [cx, cy] = this.chest();
      const reach = a.r + 3;
      const big = a.finisher || a.heavy;
      const brk = Game.has('breaker');
      let any = false;
      for (const e of Game.enemies) {
        if (e.dead || e.spawning || a.hit.has(e)) continue;
        if (sectorRect(cx, cy, reach, a.ang, a.span, e.x - e.w / 2, e.y - e.h, e.w, e.h)) {
          a.hit.add(e);
          any = true;
          const mul = brk ? (a.finisher || a.type === 'slam' ? 1.6 : a.heavy ? 1 : 0.8) : 1;
          let ky;
          if (a.heavy) ky = a.type === 'slam' && !this.onGround ? 200 : -a.launch - (brk && a.type === 'slam' ? 150 : 0);
          else ky = Math.sin(a.ang) * a.knock * 0.5 - (big ? (brk ? 300 : 140) : 50);
          hurtEnemy(e, a.dmg * mul, {
            kx: Math.cos(a.ang) * a.knock, ky, heavy: big, cause: a.heavy ? 'heavy' : 'slash', heavyAtk: a.heavy, angle: a.ang + a.dir * 0.6,
            stagger: a.heavy ? 0.7 : big ? 0.55 : 0.22, hitstop: a.hitstop, shake: a.shake, guardBreak: a.heavy,
          });
        }
      }
      for (const pr of Game.props) {
        if (pr.dead || a.hit.has(pr)) continue;
        if (sectorRect(cx, cy, reach, a.ang, a.span, pr.x - pr.w / 2, pr.y - pr.h, pr.w, pr.h)) {
          a.hit.add(pr);
          pr.hit(a.dmg, { kx: Math.cos(a.ang) * 200, ky: -120, heavy: big });
        }
      }
      for (const b of Game.projectiles) {
        // parry-only projectiles (blade waves) pass straight through a slash
        if (b.dead || !b.hostile || a.hit.has(b) || b.parryOnly || !(b.reflect || b.onSlash)) continue;
        const dx = b.x - cx, dy = b.y - cy;
        if (dx * dx + dy * dy < reach * reach && Math.abs(angDiff(a.ang, Math.atan2(dy, dx))) < a.span / 2) {
          a.hit.add(b);
          if (b.onSlash) { b.onSlash(this); continue; }
          b.reflect(this.aimAngle, 1.5, 22);
          Sound.play('reflect');
        }
      }
      if (any && !this.onGround) { this.vy = Math.min(this.vy, -75); this.airJumps = Math.max(this.airJumps, 0); }
    }
    if (a.quake && !a.quaked && a.swept && a.t >= a.act0 + 0.04) {
      a.quaked = true;
      if (this.onGround) this.slamQuake();
    }
    const cancelT = a.heavy ? a.act1 + 0.05 : 0.13;
    if (this.attackQueued && a.t >= cancelT && !a.finisher) { const k = this.attackQueued; this.attackQueued = null; this.startString(k, true); return; }
    if (a.t >= a.dur) {
      this.attack = null;
      this.comboTimer = a.finisher ? 0 : a.heavy ? 0.5 : 0.42;
      if (a.finisher) { this.strN = 0; this.strLights = 0; this.attackCD = a.heavy ? 0.16 : 0.1; }
    }
  }
  // The heavy finisher hits the street hard enough to send a wave each way.
  slamQuake() {
    const f = this.facing, x = this.x + f * 14;
    for (const d of [-1, 1]) Game.hazards.push(new FriendlyWave(this.x + d * 12, this.y, d, 300, 16, { cause: 'heavy' }));
    FX.ring(x, this.y - 1, 4, 58, 0.35, { sy: 0.3, w: 2 });
    FX.dust(x, this.y, 12, { smin: 40, smax: 140, rise: 6, r1: 5 });
    FX.debris(x, this.y - 1, 14, ['#4a4252', '#5c5464', '#3a3442', '#6e6678'], 220);
    FX.decal('crack', x, this.y, { len: 18, n: 6, dur: 6 });
    FX.light(x, this.y - 6, 100, '#ff3048', 1, 0.3);
    FX.flash('#ff3048', 0.14);
    Sound.play('slam');
    Game.shake(0.3);
  }

  // ---------- kickflip (grenade rebound) ----------
  updateKick(dt) {
    const K = this.kickAnim;
    if (!K) return;
    K.t += dt;
    this.ghostT -= dt;
    if (this.ghostT <= 0) { this.ghostT = 0.03; this.makeGhost('#ffd070', 0.25, 0.45); }
    if (K.t >= K.dur) this.kickAnim = null;
  }

  // ---------- plunge ----------
  startPlunge() {
    this.attack = null; this.attackQueued = null; this.atkPend = null; this.sliding = false; this.kickAnim = null;
    if (this.tether) this.releaseTether();
    if (this.sheathe) this.cancelSheathe();
    this.plunge = { startY: this.y, t: 0, hit: new Set() };
    this.vx *= 0.2; this.vy = 280;
    this.iframes = Math.max(this.iframes, 0.12);
    Sound.play('plungeStart');
    FX.ring(this.x, this.y - 10, 2, 14, 0.2, { w: 1 });
  }
  movePlunge(dt, mx) {
    const P = this.plunge;
    P.t += dt;
    this.vy = Math.min(this.vy + 2800 * dt, 760);
    this.vx = approach(this.vx, mx * 45, 600 * dt);
    this.ghostT -= dt;
    for (const e of Game.enemies) {
      if (e.dead || e.spawning || P.hit.has(e)) continue;
      if (aabb(this.x - 5, this.y - this.h, 10, this.h + 12, e.x - e.w / 2, e.y - e.h, e.w, e.h)) {
        P.hit.add(e);
        hurtEnemy(e, 16, { kx: sign(e.x - this.x) * 60, ky: 200, cause: 'plunge', angle: Math.PI / 2, stagger: 0.4, hitstop: 0.02 });
      }
    }
    if (Math.random() < 0.8) FX.sparks(this.x, this.y + 6, 1, -Math.PI / 2, 0.5, 60, 140, { g: -200, life: 0.6 });
  }
  plungeImpact() {
    const P = this.plunge;
    this.plunge = null;
    const fall = Math.max(0, this.y - P.startY);
    const power = clamp(fall / 220, 0.15, 1);
    const R = 46 + power * 62, dmg = (22 + power * 42) * (Game.has('aftershock') ? 0.8 : 1);
    if (Game.has('aftershock')) for (const d of [-1, 1]) Game.hazards.push(new FriendlyWave(this.x + d * 10, this.y, d, 280, 18 + power * 22));
    for (const e of Game.enemies) {
      if (e.dead || e.spawning) continue;
      const dx = e.x - this.x, dy = e.y - this.y;
      if (Math.abs(dx) < R + e.w / 2 && dy > -40 - e.h && dy < 24) {
        const fall2 = 1 - clamp(Math.abs(dx) / (R + e.w / 2), 0, 1) * 0.45;
        hurtEnemy(e, dmg * fall2, {
          kx: sign(dx || 1) * (160 + power * 140), ky: -(240 + power * 160), heavy: true, cause: 'plunge',
          angle: Math.atan2(dy - 10, dx), stagger: 0.7, hitstop: 0.02, shake: 0,
        });
      }
    }
    for (const pr of Game.props) {
      if (!pr.dead && Math.abs(pr.x - this.x) < R && Math.abs(pr.y - this.y) < 40) pr.hit(30, { kx: sign(pr.x - this.x) * 200, ky: -260, heavy: true });
    }
    FX.ring(this.x, this.y - 1, 4, R, 0.35, { sy: 0.28, w: 2 });
    FX.ring(this.x, this.y - 1, 2, R * 0.7, 0.28, { sy: 0.28, w: 1, c: '#ff7a3a' });
    FX.ring(this.x, this.y - 10, 2, 22 + power * 14, 0.22, { w: 1 });
    FX.dust(this.x, this.y, 14 + power * 10, { ang: Math.PI, spread: 0.5, smin: 40, smax: 160, rise: 6, r1: 5 });
    FX.dust(this.x, this.y, 14 + power * 10, { ang: 0, spread: 0.5, smin: 40, smax: 160, rise: 6, r1: 5 });
    FX.debris(this.x, this.y - 1, 16 + power * 12, ['#4a4252', '#5c5464', '#3a3442', '#6e6678'], 180 + power * 80);
    FX.sparks(this.x, this.y - 2, 20, -Math.PI / 2, 2.4, 80, 260);
    FX.elec(this.x, this.y - 2, 26, 6);
    FX.decal('crack', this.x, this.y, { len: 14 + power * 18, n: 7, dur: 6 });
    FX.light(this.x, this.y - 8, R * 1.6, '#ff3048', 1, 0.35);
    FX.flash('#ff3048', 0.18 + power * 0.12);
    Sound.play('shockwave', { power });
    Game.shake(0.32 + power * 0.32);
    Game.hitstop(0.06);
    this.landLag = 0.14; this.airJumps = 1;
  }

  // ---------- parry stance / iaido ----------
  // E opens a parry stance that costs shield. It only attacks after a successful parry.
  updateSheathe(dt) {
    if (Input.wasPressed('sheathe')) {
      if (this.parryCD > PC.INPUT_BUF && !this.sheathe) { Sound.play('denied'); this.parryFlash = 0.35; }
      else this.parryBuf = PC.INPUT_BUF;
    }
    if (this.parryBuf > 0 && !this.sheathe && !this.iaido && this.dashT <= 0 && !this.plunge && this.ultHold <= 0 && this.parryCD <= 0) {
      this.parryBuf = 0;
      this.tryStance();
    }
    const s = this.sheathe;
    if (!s) return;
    s.t += dt;
    const sx = this.x - this.facing * 5, sy = this.y - 7;
    if (s.empowered) {
      if (Math.random() < 0.8) FX.elec(sx, sy, 14, 1, { outer: '#ffb040', core: '#ffffff' });
      if (Math.random() < 0.4) FX.sparks(sx + rand(-6, 6), sy + rand(-6, 4), 1, -Math.PI / 2, 1.5, 20, 60, { g: -60, life: 0.8, c1: '#ffd070' });
    } else if (s.t <= s.parryUntil && Math.random() < 0.5) FX.elec(sx, sy, 7, 1);
    const maxT = s.empowered ? s.parriedAt + 1.0 : PC.STANCE_MAX;
    if (!Input.isDown('sheathe') || s.releaseQueued || s.t >= maxT) this.releaseSheathe();
  }
  tryStance() {
    if (this.parryCD > 0) { Sound.play('denied'); this.parryFlash = 0.35; return; }
    if (!S.gameplay.invincible && this.shield < PC.PARRY_COST) {
      Sound.play('noShield');
      this.shieldFlash = 0.5;
      FX.text('NO SHIELD', this.x, this.y - 30, { c: '#5ad8ff', always: true, dur: 0.6, vy: -20 });
      return;
    }
    this.shield = Math.max(0, this.shield - PC.PARRY_COST);
    this.shieldDelay = Math.max(this.shieldDelay, 1.4); this.regenOn = false;
    this.attack = null; this.attackQueued = null; this.atkPend = null; this.kickAnim = null;
    if (this.sliding) { this.sliding = false; if (!this.setHeight(PC.H)) { this.crouching = true; this.setHeight(PC.CROUCH_H); } }
    // pressing again right after a stance shrinks the window, so mashing is worse than timing
    const win = S.gameplay.parryWindow * (Game.has('openGuard') ? 1.6 : 1) * (1 - 0.25 * Math.min(2, Math.ceil(this.parrySpam - 0.01)));
    this.parrySpam = Math.min(3, this.parrySpam + 1);
    this.sheathe = { t: 0, charge: 0, empowered: false, parryUntil: win, hover: this.hoverAvail ? 1.0 : 0, parried: 0, parriedAt: 0, refunded: false, releaseQueued: false };
    if (!this.onGround) this.hoverAvail = false;
    Sound.play('sheathe');
    this.eyeGlint('#ffe0a0', 0.6);
  }
  // Parry tells are a quick glint from the eye, never a ring around the body (rings read as shields).
  eyeGlint(c, size) {
    const v = () => this._visor || [this.x + this.facing * 2, this.y - 19];
    const [x, y] = v();
    FX.glint(x, y, { c, size, dur: 0.22, follow: v });
  }
  parryActive() { return !!this.sheathe && this.sheathe.t <= this.sheathe.parryUntil; }
  cancelSheathe() {
    this.stopLoop('charge');
    this.sheathe = null;
    this.parryCD = Math.max(this.parryCD, PC.PARRY_CD);
  }
  releaseSheathe() {
    const s = this.sheathe;
    // A tap still holds the stance through the parry window, so tap-parrying works.
    if (s.t < s.parryUntil && !s.parried) { s.releaseQueued = true; return; }
    this.stopLoop('charge');
    this.sheathe = null;
    if (s.empowered) { this.parryCD = PC.PARRY_CD_HIT; this.startIaido(IAIDO.counter); }
    else { this.parryCD = s.parried ? PC.PARRY_CD_HIT : PC.PARRY_CD; Sound.play('unsheathe'); }
  }
  doParry(h) {
    const s = this.sheathe;
    s.parried++;
    this.parrySpam = 0;
    // some foes meet a parry blade to blade: no counter, they guard instead
    const clash = !!(h.source && h.source.clashes && h.source.clashes(h));
    if (!s.empowered && !clash) {
      s.empowered = true; s.parriedAt = s.t; s.charge = 1;
      this.loops.charge = Sound.loop('charge');
      this.loops.charge.set(1);
    }
    s.parryUntil = s.t + 0.32;
    if (!s.refunded && this.shieldOffT <= 0 && !Game.has('openGuard')) {
      s.refunded = true;
      this.shield = Math.min(PC.MAX_SHIELD, this.shield + PC.PARRY_COST);
    }
    Sound.play('parry');
    Game.slowmo(0.22, 0.42);
    Game.hitstop(0.07);
    Game.shake(0.28);
    FX.flash('#ffffff', 0.3);
    const [cx, cy] = this.chest();
    const ang = Math.atan2((h.y !== undefined ? h.y : cy) - cy, (h.x !== undefined ? h.x : cx + this.facing) - cx);
    this.eyeGlint('#ffd070', 1.6);
    FX.sparks(cx + Math.cos(ang) * 8, cy + Math.sin(ang) * 8, 22, ang, 1.6, 80, 300, { c0: '#ffffff', c1: '#ffe080', c2: '#ff5a3a' });
    FX.elec(cx, cy, 22, 6, { outer: '#ffb040', core: '#ffffff' });
    FX.light(cx, cy, 90, '#ffe0a0', 1, 0.4);
    if (h.proj) h.proj.reflect(this.aimAngle, 1.9, 40);
    else if (h.source && h.source.stagger) h.source.stagger(1.3, sign(h.source.x - this.x) * 220);
    this.iframes = Math.max(this.iframes, 0.2);
    Game.stats.parries++;
  }
  startIaido(cfg) {
    let ang = this.aimAngle, len = cfg.len;
    const [sx, sy] = this.chest();
    // A tethered enemy pulls the draw straight to it.
    const T = this.tether;
    if (T && T.phase === 'attached' && T.target && T.target.isEnemy && !T.target.dead) {
      const tx = T.target.x, ty = T.target.cy;
      ang = Math.atan2(ty - sy, tx - sx);
      len = Math.max(len, Math.min(260, dist(sx, sy, tx, ty) + 24));
      FX.bolt(sx, sy, tx, ty, 0.15, { jag: 5 });
    }
    if (this.tether) this.releaseTether();
    const dx = Math.cos(ang), dy = Math.sin(ang);
    const t = Level.raycast(sx, sy, sx + dx * (len + 8), sy + dy * (len + 8));
    len = Math.max(0, (len + 8) * t - 8);
    this.facing = dx >= 0 ? 1 : -1;
    this.iaido = { t: 0, dur: 0.09, ang, cfg, len, sx, sy, hit: new Set(), vx: (dx * len) / 0.09, vy: (dy * len) / 0.09 };
    this.iframes = Math.max(this.iframes, cfg.empowered ? 0.5 : 0.3);
    if (this.crouching && this.canStand()) { this.crouching = false; this.setHeight(PC.H); }
    const pal = cfg.empowered ? PALETTES.gold : PALETTES.red;
    FX.slashLine(sx, sy, sx + dx * len, sy + dy * len, { w: cfg.lineW, dur: cfg.empowered ? 0.45 : 0.3, pal });
    if (cfg.empowered) Sound.play('iaido', { power: 1, empowered: true });
    else Sound.play('quickdraw');
    if (cfg.heavy) Sound.play('heavySwing');
    Game.shake(cfg.shake);
    FX.flash(cfg.empowered ? '#fff4d0' : '#ff3048', cfg.flash);
    Game.hitstop(cfg.empowered ? 0.045 : 0.02);
    FX.light(sx, sy, cfg.empowered ? 90 : 50, cfg.empowered ? '#ffe0a0' : '#ff3048', 1, 0.3);
    if (cfg.empowered) Game.slowmo(0.3, 0.3);
  }
  moveIaido(dt) {
    const I = this.iaido;
    I.t += dt;
    this.vx = I.vx; this.vy = I.vy;
    this.ghostT -= dt;
    if (this.ghostT <= 0) { this.ghostT = 0.012; this.makeGhost(I.cfg.empowered ? '#ffd070' : '#ff2a48', 0.3, 0.7); }
    const [cx, cy] = this.chest();
    for (const e of Game.enemies) {
      if (e.dead || e.spawning || I.hit.has(e)) continue;
      if (segRect(I.sx, I.sy, cx, cy, 14, e.x - e.w / 2, e.y - e.h, e.w, e.h)) {
        if (e.deflectIaido && e.deflectIaido(this)) { for (const o of I.hit) o.cutMark = 0; return; }
        I.hit.add(e); this.iaidoMark(e);
      }
    }
    if (I.t >= I.dur) this.finishIaido();
  }
  finishIaido() {
    const I = this.iaido, cfg = I.cfg;
    this.iaido = null;
    this.vx *= 0.15; this.vy = Math.min(this.vy * 0.15, 0);
    const [cx, cy] = this.chest();
    const dir = Math.cos(I.ang) >= 0 ? 1 : -1;
    FX.swoosh({ x: cx, y: cy, r: cfg.arcR, span: cfg.span, ang: I.ang, dir, sweep: 0.08, dur: cfg.empowered ? 0.38 : 0.26, thick: cfg.thick, pal: cfg.empowered ? PALETTES.gold : PALETTES.red, trail: 1 });
    for (const e of Game.enemies) {
      if (e.dead || e.spawning || I.hit.has(e)) continue;
      if (sectorRect(cx, cy, cfg.arcR, I.ang, cfg.span, e.x - e.w / 2, e.y - e.h, e.w, e.h)) {
        if (e.deflectIaido && e.deflectIaido(this)) { for (const o of I.hit) o.cutMark = 0; return; }
        I.hit.add(e); this.iaidoMark(e);
      }
    }
    for (const pr of Game.props) {
      if (!pr.dead && sectorRect(cx, cy, cfg.arcR, I.ang, cfg.span, pr.x - pr.w / 2, pr.y - pr.h, pr.w, pr.h)) pr.hit(60, { kx: Math.cos(I.ang) * 260, ky: -150, heavy: true });
    }
    for (const b of Game.projectiles) {
      if (b.dead || !b.hostile || b.parryOnly || dist(b.x, b.y, cx, cy) >= cfg.arcR) continue;
      if (b.onSlash) b.onSlash(this);
      else if (b.reflect) b.reflect(I.ang, 1.6, 30);
    }
    if (cfg.delayed && I.hit.size) {
      Game.slowmo(cfg.empowered ? 0.35 : 0.6, cfg.empowered ? 0.36 : 0.18);
      Game.queueCut(cfg.empowered ? 0.34 : 0.18, () => this.resolveIaido(I));
    } else this.resolveIaido(I);
    if (cfg.chain) this.chainLightning(cx, cy, I);
    this.postPose = cfg.post;
    // a dash slash opens a string: follow it with lights or heavies
    if (I.kind) { this.strN = 1; this.strLights = I.kind === 'L' ? 1 : 0; this.lastDir = dir; this.comboTimer = 0.45; }
    else { this.strN = 0; this.strLights = 0; }
  }
  iaidoMark(e) {
    if (e.isEnemy) e.cutMark = 1;
    FX.sparks(e.x, e.y - e.h / 2, 6, rand(0, TAU), TAU, 40, 140);
  }
  resolveIaido(I) {
    const cfg = I.cfg;
    let n = 0, kills = 0;
    for (const e of I.hit) {
      if (e.dead) continue;
      e.cutMark = 0;
      const a = rand(-0.8, 0.8) + (Math.random() < 0.5 ? 0 : Math.PI);
      if (cfg.delayed) {
        const cx = e.x, cy = e.y - e.h / 2, L = Math.max(e.w, e.h) * 0.9 + 6;
        FX.slashLine(cx - Math.cos(a) * L, cy - Math.sin(a) * L, cx + Math.cos(a) * L, cy + Math.sin(a) * L, { w: 3, dur: 0.25, grow: 0.03, pal: cfg.empowered ? PALETTES.gold : PALETTES.red });
      }
      hurtEnemy(e, cfg.dmg, { kx: Math.cos(I.ang) * (cfg.heavy ? 360 : 280), ky: cfg.heavy ? -260 : -180, heavy: true, cause: 'iaido', angle: a, stagger: cfg.empowered ? 0.9 : cfg.heavy ? 0.7 : 0.45, hitstop: 0, shake: 0, crit: cfg.empowered, guardBreak: cfg.heavy, heavyAtk: cfg.heavy && !cfg.empowered });
      if (cfg.empowered && (e.dead || e.dying)) kills++;
      n++;
    }
    if (kills) this.counterHeal(kills);
    if (n && cfg.delayed) {
      Sound.play('cut');
      Game.shake(0.25 + n * 0.05);
      Game.hitstop(0.06);
      FX.flash(cfg.empowered ? '#fff6e0' : '#ffffff', 0.2);
    } else if (n) Game.hitstop(0.04);
  }
  // kills from a parry counter (and its chain lightning) patch you up a little
  counterHeal(kills) {
    if (this.dead) return;
    const n = Math.min(12, kills * 4);
    this.heal(n);
    FX.text('+' + n + ' HP', this.x, this.y - 44, { c: '#7dff8a', always: true, dur: 0.8, vy: -20 });
  }
  chainLightning(cx, cy, I) {
    const arc = Game.has('arc'), range = arc ? 300 : 200, chainDmg = arc ? 40 : 55;
    const targets = Game.enemies.filter((e) => !e.dead && !e.spawning && !I.hit.has(e) && dist(e.x, e.y - e.h / 2, cx, cy) < range)
      .sort((a, b) => dist(a.x, a.y, cx, cy) - dist(b.x, b.y, cx, cy)).slice(0, arc ? 8 : 5);
    let px = cx, py = cy;
    targets.forEach((e, i) => {
      const ex = e.x, ey = e.y - e.h / 2;
      FX.bolt(px, py, ex, ey, 0.25, { outer: '#ffb040', core: '#ffffff', jag: 6, w: 1 });
      Game.queueCut(0.12 + i * 0.06, () => {
        if (e.dead) return;
        hurtEnemy(e, chainDmg, { kx: sign(ex - cx) * 150, ky: -120, cause: 'chain', stagger: 1.2, hitstop: 0.01, angle: rand(0, TAU) });
        if (e.dead || e.dying) this.counterHeal(1);
        FX.elec(ex, ey, 14, 5, { outer: '#ffb040', core: '#ffffff' });
      });
      px = ex; py = ey;
    });
  }

  // ---------- tether ----------
  // Tap: fling yourself at the target. Hold: zip to it. Objects (barrels, pulse grenades) are grabbed,
  // towed while held, and thrown toward the cursor on release. Enemies are never pulled.
  updateTetherInput() {
    if (!Input.wasPressed('tether')) return;
    if (this.tether) {
      if (this.tether.phase === 'attached' && this.tether.mode !== 'tow' && this.tether.mode !== 'rebound') this.releaseTether();
      return;
    }
    if (this.sheathe || this.iaido || this.ultHold > 0) return;
    this.fireTether();
  }
  fireTether() {
    // the rival's grenade is the fight's key, so tethering one is always free
    const grenade = this.grenadeNearAim(!!this.ult);
    const free = !!this.ult || !!grenade;
    if (!free && !S.gameplay.invincible && this.shield < PC.TETHER_COST) {
      Sound.play('noShield');
      this.shieldFlash = 0.5;
      FX.text('NO SHIELD', this.x, this.y - 30, { c: '#5ad8ff', always: true, dur: 0.6, vy: -20 });
      return;
    }
    if (!free) { this.shield = Math.max(0, this.shield - PC.TETHER_COST); this.shieldDelay = Math.max(this.shieldDelay, 1.4); this.regenOn = false; }
    const [hx, hy] = this.hand();
    const a = this.aimAngle, spd = free ? 2400 : PC.TETHER_SPEED;
    this.tether = {
      phase: 'fly', x: hx, y: hy, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, dist: 0, max: free ? 4000 : PC.TETHER_RANGE,
      target: null, kind: null, ox: 0, oy: 0, mode: null, firedAt: Game.time, t: 0, spd: 0,
      // a grenade near the cursor pulls the line onto it, since it moves while the line travels
      homing: grenade, paid: !free,
    };
    this.facing = Math.cos(a) >= 0 ? 1 : -1;
    Sound.play('tetherFire');
    FX.sparks(hx, hy, 4, a, 0.8, 60, 180);
  }
  grenadeNearAim(free) {
    const [hx, hy] = this.hand();
    let best = null, bd = 34;
    for (const o of Game.projectiles) {
      if (!o.rebound || !o.tetherable) continue;
      const d = dist(o.x, o.y, this.aimX, this.aimY);
      if (d < bd && (free || dist(o.x, o.y, hx, hy) < PC.TETHER_RANGE + 30)) { bd = d; best = o; }
    }
    return best;
  }
  releaseTether() {
    const T = this.tether;
    if (!T) return;
    if (T.mode === 'rebound' && T.phase === 'attached') Game.endBulletTime();
    this.stopLoop('reel');
    if (T.target && T.target.tethered) T.target.tethered = false;
    T.phase = 'retract'; T.t = 0;
  }
  zipping() { return !!this.tether && this.tether.phase === 'attached' && this.tether.mode === 'zip'; }
  grinding() { return !!this.tether && this.tether.phase === 'attached' && this.tether.mode === 'grind'; }
  rebounding() { return !!this.tether && this.tether.phase === 'attached' && this.tether.mode === 'rebound'; }
  attachTether(target, kind) {
    const T = this.tether;
    T.phase = 'attached'; T.t = 0; T.target = target; T.kind = kind;
    if (target) { T.ox = T.x - target.x; T.oy = T.y - target.y; target.tethered = true; }
    Sound.play('tetherAttach');
    FX.sparks(T.x, T.y, 8, rand(0, TAU), TAU, 40, 150);
    FX.elec(T.x, T.y, 10, 3);
    FX.light(T.x, T.y, 30, '#ff3048', 0.9, 0.2);
    if (kind === 'grenade') { this.beginRebound(target); return; }
    if (kind === 'object') {
      T.mode = 'tow';
      if (target.grab) target.grab(this);
      if (!Input.isDown('tether')) this.throwTowed();
      return;
    }
    if (kind === 'enemy') hurtEnemy(target, 4, { cause: 'tether', stagger: 0.25, noKnock: true, hitstop: 0.02, angle: 0 });
  }
  tetherHit(T) {
    for (const e of Game.enemies) {
      if (e.dead || e.spawning) continue;
      if (T.x > e.x - e.w / 2 - 3 && T.x < e.x + e.w / 2 + 3 && T.y > e.y - e.h - 3 && T.y < e.y + 3) { this.attachTether(e, 'enemy'); return true; }
    }
    const grab = (o) => !o.dead && o.tetherable !== false && o.grabR && dist(T.x, T.y, o.cx, o.cy) < o.grabR + 3;
    for (const o of Game.props) if (grab(o)) { this.attachTether(o, 'object'); return true; }
    for (const o of Game.projectiles) if (o.tetherable && grab(o)) { this.attachTether(o, o.rebound ? 'grenade' : 'object'); return true; }
    return false;
  }
  updateTether(dt) {
    const T = this.tether;
    if (!T) return;
    T.t += dt;
    const [hx, hy] = this.hand();
    if (T.phase === 'fly') {
      const h = T.homing;
      if (h && !h.dead && h.tetherable) {
        const sp0 = Math.hypot(T.vx, T.vy), ha = Math.atan2(h.y - T.y, h.x - T.x);
        T.vx = Math.cos(ha) * sp0; T.vy = Math.sin(ha) * sp0;
      }
      const sp = Math.hypot(T.vx, T.vy), steps = Math.max(1, Math.ceil((sp * dt) / 4));
      for (let i = 0; i < steps; i++) {
        T.x += (T.vx * dt) / steps; T.y += (T.vy * dt) / steps; T.dist += (sp * dt) / steps;
        if (this.tetherHit(T)) return;
        let hitWorld = Level.pointSolid(T.x, T.y, undefined, true);
        if (!hitWorld && !(h && !h.dead)) for (const p of Level.platforms) if (T.x >= p.x && T.x < p.x + p.w && T.y >= p.y && T.y < p.y + 5) { hitWorld = true; break; }
        if (hitWorld) {
          T.x -= (T.vx * dt) / steps; T.y -= (T.vy * dt) / steps;
          this.attachTether(null, 'world');
          return;
        }
        if (T.dist > T.max || T.x < -50 || T.x > Level.W + 50 || T.y < -400 || T.y > Level.H + 40) {
          T.phase = 'retract'; T.t = 0; Sound.play('tetherMiss');
          return;
        }
      }
    } else if (T.phase === 'attached') {
      if (T.target) {
        if (T.target.dead) { this.releaseTether(); return; }
        if (T.kind === 'object' || T.kind === 'grenade') { T.x = T.target.cx; T.y = T.target.cy; }
        else { T.x = T.target.x + T.ox; T.y = T.target.y + T.oy; }
        if (T.target.isEnemy && Math.random() < 0.35) FX.elec(T.x, T.y, 9, 1);
      }
      if (T.mode === 'tow') {
        T.target.towTo(hx, hy, dt, this);
        if (!Input.isDown('tether') || T.t > 5) this.throwTowed();
        return;
      }
      if (T.mode === 'rebound') return;
      if (!T.mode) {
        const held = Input.isDown('tether'), since = Game.time - T.firedAt;
        if (!held) T.mode = 'fling';
        else if (since >= 0.16) T.mode = 'zip';
        if (T.mode) this.beginTetherMode();
      }
      if (T.mode === 'fling') {
        if (T.t > 0.06) this.releaseTether();
      } else if (T.mode === 'zip') {
        if (this.loops.reel) this.loops.reel.set(clamp(T.spd / 600, 0, 1));
        if (!this.ult && T.t > 2.2) this.releaseTether();
      }
    } else if (T.phase === 'retract') {
      const dx = hx - T.x, dy = hy - T.y, d = Math.hypot(dx, dy);
      const step = 1800 * dt;
      if (d <= step || T.t > 0.25) { this.tether = null; return; }
      T.x += (dx / d) * step; T.y += (dy / d) * step;
    }
  }
  throwTowed() {
    const T = this.tether, o = T.target;
    if (o && !o.dead) o.throwAt(this.aimAngle, this);
    Sound.play('throw');
    const [hx, hy] = this.hand();
    FX.ring(hx, hy, 2, 14, 0.18, { w: 1 });
    Game.shake(0.1);
    this.releaseTether();
  }
  beginTetherMode() {
    const T = this.tether;
    if (T.mode === 'fling') {
      const [cx, cy] = this.chest();
      const dx = T.x - cx, dy = T.y - cy, d = Math.hypot(dx, dy) || 1;
      const sp = this.ult ? 760 : 420;
      this.vx = (dx / d) * sp; this.vy = (dy / d) * sp - 70;
      this.onGround = false; this.airJumps = 1;
      if (this.sliding || this.crouching) { this.sliding = false; this.crouching = false; this.setHeight(PC.H) || this.setHeight(PC.SLIDE_H); }
      Sound.play('zip');
    } else if (T.mode === 'zip') {
      Sound.play('zip');
      this.loops.reel = Sound.loop('reel');
      this.sliding = false;
      if (this.crouching && this.setHeight(PC.H)) this.crouching = false;
      this.onGround = false;
      T.spd = Math.max(150, Math.hypot(this.vx, this.vy));
    }
  }
  moveZip(dt) {
    const T = this.tether;
    const [cx, cy] = this.chest();
    const dx = T.x - cx, dy = T.y - cy, d = Math.hypot(dx, dy) || 1;
    const max = this.ult ? 980 : PC.ZIP_SPEED;
    T.spd = Math.min(max, T.spd + 2800 * dt);
    this.vx = (dx / d) * T.spd; this.vy = (dy / d) * T.spd;
    this.facing = dx >= 0 ? 1 : -1;
    this.ghostT -= dt;
    if (this.ghostT <= 0) { this.ghostT = 0.03; this.makeGhost('#ff2a48', 0.2, 0.4); }
    if (!Input.isDown('tether')) { this.releaseTether(); this.vx *= 1.05; this.vy *= 1.05; return; }
    if (d < (T.kind === 'enemy' ? 15 : 10)) this.arriveZip();
  }
  arriveZip() {
    const T = this.tether;
    if (T.kind === 'enemy' && T.target && !T.target.dead) {
      const e = T.target;
      if (this.ult) {
        // The sawblade latches on and keeps grinding while the button is held.
        T.mode = 'grind'; T.grindT = 0; T.grindN = 0;
        Sound.play('sawHit');
        return;
      }
      const dealt = hurtEnemy(e, 22, { kx: this.facing * 160, ky: -120, cause: 'tether', angle: this.aimAngle, stagger: 0.7, hitstop: 0.05, shake: 0.15, heavy: true });
      // a tether strike that connects pays for itself
      if (Game.has('voltHook')) {
        for (const o of Game.enemies) {
          if (o === e || o.dead || o.spawning || dist(o.x, o.cy, e.x, e.cy) > 40) continue;
          hurtEnemy(o, 30, { kx: sign(o.x - e.x) * 200, ky: -150, cause: 'tether', angle: Math.atan2(o.cy - e.cy, o.x - e.x), stagger: 0.6 });
        }
        if (!e.dead) hurtEnemy(e, 30, { cause: 'tether', noKnock: true, angle: -Math.PI / 2 });
        FX.ring(e.x, e.cy, 3, 40, 0.3, { c: '#ff3048', core: '#ffd0d8', w: 2 });
        FX.elec(e.x, e.cy, 30, 8);
        Sound.play('pulse');
      } else if (dealt > 0 && T.paid && this.shieldOffT <= 0) {
        this.shield = Math.min(PC.MAX_SHIELD, this.shield + PC.TETHER_COST);
        FX.text('+' + PC.TETHER_COST + ' SHIELD', this.x, this.y - 36, { c: '#5ad8ff', always: true, dur: 0.7, vy: -18 });
      }
      FX.swoosh({ x: this.x, y: this.cy, r: 30, span: 3.2, ang: Math.atan2(e.y - e.h / 2 - this.cy, e.x - this.x), dir: this.facing, sweep: 0.06, dur: 0.2, thick: 10 });
      Sound.play('swing', { stage: 1 });
      this.vy = -230; this.vx *= 0.25;
    } else {
      this.vx *= 0.3;
      this.vy = Math.min(this.vy * 0.3, -150);
    }
    this.airJumps = 1;
    this.releaseTether();
  }

  // Tethering a pulse grenade in flight: time slows, you reel yourself to it and kick it toward the cursor.
  beginRebound(g) {
    const T = this.tether;
    T.mode = 'rebound'; T.spd = Math.max(260, Math.hypot(this.vx, this.vy));
    g.catch(this);
    if (this.sheathe) this.cancelSheathe();
    this.attack = null; this.attackQueued = null; this.atkPend = null; this.plunge = null; this.dashT = 0;
    if (this.sliding || this.crouching) { this.sliding = false; this.crouching = false; this.setHeight(PC.H) || this.setHeight(PC.SLIDE_H); }
    this.onGround = false;
    this.iframes = Math.max(this.iframes, 0.6);
    Game.bulletTime(1.6, { kind: 'rebound' });
    Sound.play('timeSlow');
    FX.ring(g.x, g.y, 2, 34, 0.35, { c: '#4af0ff', core: '#ffffff', w: 1 });
    FX.ring(g.x, g.y, 40, 8, 0.3, { c: '#ffd070', core: '#ffffff', w: 1 });
    FX.elec(g.x, g.y, 18, 6, { outer: '#2ab8d8', core: '#ffffff' });
  }
  moveRebound(dt) {
    const T = this.tether, g = T.target;
    const [cx, cy] = this.chest();
    const dx = T.x - cx, dy = T.y - cy, d = Math.hypot(dx, dy) || 1;
    T.spd = Math.min(this.ult ? 1100 : 820, T.spd + 3600 * dt);
    this.vx = (dx / d) * T.spd; this.vy = (dy / d) * T.spd;
    this.facing = dx >= 0 ? 1 : -1;
    this.ghostT -= dt;
    if (this.ghostT <= 0) { this.ghostT = 0.02; this.makeGhost('#ffd070', 0.3, 0.5); }
    if (d < 18) this.reboundKick();
    else if (T.t > 0.6) { if (d < 40) this.reboundKick(); else this.releaseTether(); }
    else if (!g || g.dead) this.releaseTether();
  }
  // The blade never touches the grenade (a slash sets it off): you kick it toward the cursor and backflip off it.
  reboundKick() {
    const T = this.tether, g = T.target, ang = this.aimAngle, ca = Math.cos(ang), sa = Math.sin(ang);
    g.kick(ang, this);
    this.releaseTether();
    Game.endBulletTime();
    if (this.ult) {
      FX.swoosh({ x: this.x, y: this.cy, r: 30, span: 3.6, ang, dir: this.facing, sweep: 0.06, dur: 0.24, thick: 12, pal: PALETTES.gold, trail: 1 });
      this.vx = ca * 60; this.vy = -150;
    } else {
      this.attack = null; this.attackQueued = null; this.atkPend = null;
      this.facing = ca >= 0 ? 1 : -1;
      this.kickAnim = { t: 0, dur: 0.5, ang };
      // pushing off the grenade sends you back and up
      this.vx = -ca * 150; this.vy = -230 - Math.max(0, sa) * 90;
      const fx = g.x - ca * 6, fy = g.y - sa * 6;
      FX.swoosh({ x: fx, y: fy, r: 12, span: 2.2, ang, dir: -this.facing, sweep: 0.05, dur: 0.18, thick: 5, pal: PALETTES.gold, trail: 1, bolts: false });
    }
    this.airJumps = 1; this.hoverAvail = true;
    this.iframes = Math.max(this.iframes, 0.35);
    FX.slashLine(g.x, g.y, g.x + ca * 44, g.y + sa * 44, { w: 2, dur: 0.22, pal: PALETTES.gold });
    FX.ring(g.x, g.y, 3, 26, 0.25, { c: '#ffd070', core: '#ffffff', w: 2 });
    FX.ring(g.x, g.y, 2, 12, 0.16, { c: '#ffffff', core: '#ffd070', w: 1 });
    FX.sparks(g.x, g.y, 24, ang, 0.9, 120, 380, { c0: '#ffffff', c1: '#ffe080', c2: '#ff5a3a' });
    FX.flash('#ffffff', 0.22);
    Sound.play('kick');
    Sound.play('rebound');
    Game.hitstop(0.07);
    Game.shake(0.35);
  }
  // The rival's phase change throws you clear. Pure knockback, no damage.
  blastAway(x, power = 1) {
    if (this.dead) return;
    if (this.tether) this.releaseTether();
    if (this.sheathe) this.cancelSheathe();
    this.attack = null; this.attackQueued = null; this.atkPend = null; this.plunge = null; this.iaido = null; this.dashT = 0; this.sliding = false; this.kickAnim = null;
    if (this.crouching && this.setHeight(PC.H)) this.crouching = false;
    const dir = sign(this.x - x) || -this.facing;
    this.vx = dir * 430 * power; this.vy = -260 * power; this.onGround = false;
    this.hurtT = 0.45; this.facing = -dir;
    FX.sparks(this.x, this.cy, 12, dir > 0 ? 0 : Math.PI, 1.2, 60, 220, { c0: '#ffffff', c1: '#ff6a7a', c2: '#145e6a' });
  }

  // ---------- utility (F) ----------
  // Each character has one utility on a cooldown; CHARACTERS names it and js/utilities.js defines it.
  utility() { const c = CHARACTERS[this.charId]; return c && c.utility ? getUtility(c.utility) : null; }
  tryUtility() {
    const def = this.utility();
    if (!def || this.dead) return;
    if (this.utilCD > 0 || (def.canUse && !def.canUse(this))) { Sound.play('denied'); this.utilFlash = 0.35; return; }
    def.use(this);
    this.utilCD = def.cooldown;
  }

  // ---------- ultimate ----------
  updateUltHold(dt) {
    const ready = this.ultCharge >= 1;
    if (ready && Input.isDown('ultimate') && !this.sheathe && !this.iaido && !this.plunge) {
      if (this.ultHold === 0) this.loops.ult = Sound.loop('ultHold');
      this.ultHold += dt;
      if (this.loops.ult) this.loops.ult.set(clamp(this.ultHold, 0, 1));
      const [cx, cy] = this.chest();
      if (Math.random() < 0.6) {
        const a = rand(0, TAU), r = 34 * (1 - this.ultHold) + 6;
        FX.bolt(cx + Math.cos(a) * r, cy + Math.sin(a) * r, cx, cy, 0.05, { jag: 3 });
      }
      if (this.ultHold >= 1) {
        this.stopLoop('ult');
        this.ultHold = 0;
        this.activateUlt();
      }
    } else if (this.ultHold > 0) {
      this.ultHold = 0;
      this.stopLoop('ult');
    }
  }
  activateUlt() {
    const id = S.gameplay.ultimate;
    const def = getUltimate(id);
    this.attack = null; this.attackQueued = null; this.atkPend = null; this.plunge = null; this.iaido = null; this.sliding = false; this.crouching = false; this.kickAnim = null;
    if (this.sheathe) this.cancelSheathe();
    if (this.tether) { this.releaseTether(); this.tether = null; }
    this.ult = { id: def.id, t: 0, dur: def.duration };
    this.ultCharge = 0; this.ultReadyPlayed = false;
    def.start(this);
    Game.stats.ults++;
  }

  // ---------- damage ----------
  takeHit(h) {
    if (this.dead || Game.cineActive()) return 'ignored';
    if (this.ult) return 'immune';
    // unparryable: a parry does nothing. through: i-frames don't help either (the red flash)
    if (this.parryActive() && !h.unparryable) { this.doParry(h); return 'parried'; }
    if ((this.iframes > 0 || this.iaido) && !h.through) return 'ignored';
    if (h.through) { this.iaido = null; this.dashT = 0; }
    let dmg = h.dmg * (Game.has('glass') ? 1.25 : 1);
    if (S.gameplay.invincible) dmg = 0;
    if (this.sheathe) this.cancelSheathe();
    if (this.tether && this.zipping()) this.releaseTether();
    this.attack = null; this.attackQueued = null; this.atkPend = null; this.plunge = null; this.postPose = 0; this.kickAnim = null;
    const hadShield = this.shield > 0, shield0 = this.shield;
    // pierce: goes straight to health
    if (this.shield > 0 && !h.pierce) {
      const absorbed = Math.min(this.shield, dmg);
      this.shield -= absorbed; dmg -= absorbed;
      if (this.shield <= 0.01) {
        // a healthy shield eats the whole hit when it breaks; a sliver doesn't
        this.shield = 0;
        if (shield0 >= PC.SHIELD_OVERFLOW_AT) dmg = 0;
        Sound.play('shieldBreak');
        FX.sparks(this.x, this.cy, 16, rand(0, TAU), TAU, 60, 200, { c0: '#ffffff', c1: '#5ad8ff', c2: '#1a6aa0' });
        FX.text('SHIELD BROKEN', this.x, this.y - 30, { c: '#5ad8ff', always: true, dur: 0.8 });
        this.iframes = dmg > 0 ? 0.6 : 0.9;
      } else Sound.play('shieldHit');
      FX.ring(this.x, this.cy, 6, 16, 0.18, { c: '#2a8ad0', core: '#a0e8ff', w: 1 });
    }
    if (Game.mode === 'training') dmg = Math.min(dmg, Math.max(0, this.hp - 1));
    if (dmg > 0) {
      this.hp -= dmg;
      Sound.play('hurt');
      FX.oil(this.x, this.cy, 6, -Math.PI / 2, 100);
      FX.sparks(this.x, this.cy, 8, rand(0, TAU), TAU, 60, 180);
      FX.flash('#ff1030', 0.25);
    }
    this.shieldDelay = PC.SHIELD_DELAY + (Game.has('bloodline') ? 1 : 0); this.regenOn = false;
    this.iframes = Math.max(this.iframes, hadShield && this.shield > 0 ? 0.35 : 0.6);
    this.hurtT = 0.22;
    this.blinkT = this.iframes;
    Game.combo = 0; Game.comboT = 0; Game.styleHit();
    const dir = sign(this.x - (h.x !== undefined ? h.x : this.x - this.facing)) || -this.facing;
    this.vx = dir * (h.knock || 160); this.vy = Math.min(this.vy, -140);
    this.onGround = false;
    Game.shake(0.3);
    Game.hitstop(0.05);
    Game.stats.damageTaken += h.dmg;
    if (this.hp <= 0) this.die();
    return 'hit';
  }
  // Got behind the red flash: a burst of afterimage and a beat of slow motion.
  perilDodge(src) {
    const [cx, cy] = this.chest();
    this.makeGhost('#ffffff', 0.5, 0.8);
    FX.sparks(cx, cy, 14, Math.atan2(cy - src.cy, cx - src.x), 1.4, 60, 220, { c0: '#ffffff', c1: '#ff8a9a', c2: '#781e2a' });
    FX.light(cx, cy, 70, '#ffffff', 1, 0.3);
    Sound.play('perilDodge');
    Game.slowmo(0.3, 0.4, true);
    this.iframes = Math.max(this.iframes, 0.3);
  }
  onShieldFull() {
    if (this.shieldWasFull) return;
    this.shieldWasFull = true; this.regenOn = false;
    this.shieldFullFlash = 0.45;
    Sound.play('shieldFull');
    FX.ring(this.x, this.cy, 6, 20, 0.3, { c: '#3ad0ff', core: '#e0f8ff', w: 1 });
    FX.sparks(this.x, this.cy, 6, -Math.PI / 2, TAU, 30, 90, { c0: '#ffffff', c1: '#5ad8ff', c2: '#1a6aa0', g: -40 });
  }
  // A pulse hit knocks the shield out: it drops to zero and can't recharge for a while.
  disableShield(dur) {
    this.shield = 0; this.shieldOffT = dur;
    this.shieldDelay = Math.max(this.shieldDelay, dur); this.regenOn = false;
    Sound.play('shieldBreak');
    FX.text('SHIELD DISABLED', this.x, this.y - 34, { c: '#5ad8ff', always: true, dur: 1.2, vy: -16 });
    FX.elec(this.x, this.cy, 14, 6, { outer: '#2ab8d8', core: '#ffffff' });
  }
  heal(n) {
    this.hp = Math.min(PC.MAX_HP, this.hp + n);
  }
  die() {
    this.hp = 0; this.dead = true; this.deadT = 0;
    this.stopAllLoops();
    this.attack = null; this.sheathe = null; this.tether = null; this.plunge = null; this.iaido = null; this.atkPend = null; this.kickAnim = null;
    FX.sparks(this.x, this.cy, 30, rand(0, TAU), TAU, 60, 260);
    FX.oil(this.x, this.cy, 14, -Math.PI / 2, 160);
    FX.debris(this.x, this.cy, 14, ['#454d63', '#7a849c', '#262a38', '#ff2a48'], 180);
    FX.flash('#ff1030', 0.5);
    Sound.play('explode', { big: true });
    Game.slowmo(0.3, 1.2, true);
    Game.shake(0.6);
    Game.onPlayerDeath();
  }
  updateDead(dt) {
    this.deadT += dt;
    this.vy = Math.min(this.vy + PC.GRAV * dt, PC.MAX_FALL);
    if (this.onGround) this.vx = approach(this.vx, 0, 600 * dt);
    Level.moveBody(this, dt);
    if (Math.random() < 0.15) FX.elec(this.x, this.y - 4, 8, 1);
    this.updateScarf(dt);
  }

  // ---------- cosmetics ----------
  updateGhosts(dt) {
    if (this.dashT > 0 || this.bulletT > 0 || (this.plunge && this.plunge.t > 0.05)) {
      this.ghostT -= dt;
      if (this.ghostT <= 0) { this.ghostT = this.dashT > 0 ? 0.018 : 0.035; this.makeGhost('#ff2a48', 0.24, 0.55); }
    }
  }
  makeGhost(color, dur, alpha) {
    if (!this.spriteCopy) return;
    FX.ghost(this.spriteCopy, Math.round(this.x) - Sprite.OX, Math.round(this.y) - Sprite.OY, color, dur, alpha);
  }
  updateScarf(dt) {
    const pts = this.scarf;
    const ax = this.x - this.facing * 1, ay = this.y - this.h + 5;
    pts[0].x = ax; pts[0].y = ay; pts[0].px = ax; pts[0].py = ay;
    const wind = Math.sin(this.animT * 7) * 4;
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i];
      const vx = (p.x - p.px) * 0.88, vy = (p.y - p.py) * 0.88;
      p.px = p.x; p.py = p.y;
      p.x += vx - this.facing * 14 * dt * (1 + i * 0.25);
      p.y += vy + (40 + wind * i) * dt * dt * 60;
    }
    for (let it = 0; it < 3; it++) {
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.001, L = 2.1;
        const k = (d - L) / d;
        if (i === 1) { b.x -= dx * k; b.y -= dy * k; }
        else { a.x += dx * k * 0.5; a.y += dy * k * 0.5; b.x -= dx * k * 0.5; b.y -= dy * k * 0.5; }
      }
    }
  }

  // ================= drawing =================
  pose() {
    const t = this.animT, f = this.facing;
    const o = { hipX: 0, hipY: -10, lean: 0.08, fF: [2.5, -1], fB: [-2.5, -1], hF: null, hB: null, sword: 'hand', swordAng: 2.35, rot: 0, sheathAng: 2.9, tremble: 0 };
    const la = localAngle(this.aimAngle, f);
    if (this.customPose && this.customPose(o, la)) return o;
    if (this.dead) {
      const k = clamp(this.deadT / 0.35, 0, 1);
      o.rot = -1.45 * k; o.hipY = -10 + 4 * k; o.fF = [4, -1]; o.fB = [-1, -1]; o.lean = -0.2;
      o.hF = [5, -4]; o.hB = [-4, -2]; o.swordAng = 0.2;
      return o;
    }
    if (this.iaido) {
      o.lean = 0.7; o.hipY = -8; o.fF = [5, -2]; o.fB = [-7, -2];
      o.swordAng = localAngle(this.iaido.ang, f); o.hF = 'sword'; o.hB = [-6, -9];
      return o;
    }
    if (this.postPose > 0) {
      const k = this.postPose / 0.32;
      o.lean = 0.55; o.hipY = -6 - (1 - k) * 2; o.fF = [7, -1]; o.fB = [-6, -1];
      o.swordAng = Math.PI - 0.35; o.hF = [-8, -12]; o.hB = [3, -6];
      return o;
    }
    if (this.sheathe) {
      const ch = this.sheathe.empowered ? 1 : 0;
      o.lean = 0.5 + ch * 0.1; o.hipY = -7 + ch; o.fF = [6, -1]; o.fB = [-5, -1];
      if (!this.onGround) { o.fF = [4, -4]; o.fB = [-3, -2]; }
      o.sword = 'sheathed'; o.sheathAng = Math.PI - 0.15; o.hF = [3, -9 + ch]; o.hB = [-2, -8 + ch];
      o.tremble = ch > 0.6 ? 1 : 0;
      return o;
    }
    if (this.plunge) {
      o.lean = 0.05; o.fF = [3, -6]; o.fB = [-2, -5]; o.hipY = -11;
      o.swordAng = Math.PI / 2; o.hF = [1, -9]; o.hB = [-1, -9];
      return o;
    }
    if (this.attack && this.attack.groundCut) {
      const a = this.attack;
      // the part of the blade below the street is buried, so it isn't drawn
      o.bladeClip = this.onGround ? 0 : undefined;
      if (a.heavy) {
        if (a.t < a.rip) {
          const k = easeOutCubic(clamp(a.t / 0.05, 0, 1));
          o.lean = 0.2; o.hipY = -4; o.fF = [7, -1]; o.fB = [-4, -1]; o.hB = [3, -6];
          o.hF = [6, -8]; o.swordAng = lerp(-0.8, 1.25, k); o.tremble = k >= 1 ? 1 : 0;
        } else {
          const k = easeOutCubic(clamp((a.t - a.rip) / 0.08, 0, 1));
          o.lean = lerp(0.2, -0.25, k); o.hipY = -9; o.fF = [3, -4]; o.fB = [-3, -2]; o.hB = [-5, -12];
          o.hF = 'sword'; o.swordAng = lerp(1.25, -1.9, k);
        }
        return o;
      }
      const dig = easeOutCubic(clamp(a.t / 0.05, 0, 1)), rip = easeOutCubic(clamp((a.t - 0.27) / 0.07, 0, 1));
      o.lean = -0.4; o.hipY = -4; o.fF = [8, -1]; o.fB = [1, -1]; o.hB = [-6, -1];
      o.hF = [7, -6]; o.swordAng = lerp(-0.5, 0.75, dig) - 1.6 * rip;
      return o;
    }
    if (this.attack) {
      const a = this.attack, ld = a.dir * f, half = a.span / 2, base = localAngle(a.ang, f);
      const big = a.stage === 3 || a.heavy;
      o.hF = 'sword';
      if (a.wind && a.t < a.wind) {
        // heavy wind-up: the blade draws back past the start of its arc
        const k = easeOutCubic(a.t / a.wind);
        o.swordAng = base + (ld > 0 ? -half - 0.5 * k : half + 0.5 * k);
        o.hB = [-4, -8]; o.lean = 0.05; o.tremble = 1;
      } else {
        const u = easeOutCubic(clamp((a.t - (a.wind || 0)) / a.sweep, 0, 1));
        o.swordAng = base + (ld > 0 ? -half + a.span * u : half - a.span * u);
        o.hB = [-3, -6];
        o.lean = a.type === 'slam' ? 0.15 + 0.5 * u : 0.25 + (big ? 0.25 * Math.sin(u * Math.PI) : 0);
        if (big && !this.onGround) o.rot = (ld > 0 ? 1 : -1) * u * 0.8;
      }
      if (this.onGround) { o.fF = [5, -1]; o.fB = [-4, -1]; o.hipY = a.heavy ? -8 : -9; }
      else { o.fF = [3, -4]; o.fB = [-3, -2]; }
      return o;
    }
    if (this.dashT > 0) {
      o.lean = 0.85; o.hipY = -9; o.fF = [-1, -3]; o.fB = [-7, -4]; o.swordAng = Math.PI - 0.2; o.hF = [-7, -10]; o.hB = [-5, -12];
      o.rot = Math.atan2(this.dashVY, Math.abs(this.dashVX) + 1) * 0.7;
      return o;
    }
    if (this.kickAnim) {
      const K = this.kickAnim, k = K.t / K.dur, la = localAngle(K.ang, f);
      o.sword = 'sheathed'; o.sheathAng = 2.75; o.hipY = -11;
      if (k < 0.28) {
        // the kick: front leg snaps out along the aim, arms thrown wide for balance
        o.lean = -0.3; o.fF = [Math.cos(la) * 9.5, -11 + Math.sin(la) * 9.5]; o.fB = [-3, -5]; o.hF = [4, -17]; o.hB = [-6, -15];
      } else {
        // then a tucked backflip off the grenade
        o.rot = -easeOutQuad((k - 0.28) / 0.72) * TAU; o.lean = 0.3; o.fF = [3, -7]; o.fB = [-1, -6]; o.hF = [3, -10]; o.hB = [0, -11];
      }
      return o;
    }
    const P = this.atkPend;
    if (P && !P.dash && P.t > 0.05 && !this.sliding && Input.isDown('attack')) {
      // holding for a heavy: the blade draws back over the shoulder
      const k = clamp((P.t - 0.05) / (PC.HEAVY_HOLD - 0.05), 0, 1);
      o.lean = -0.1 * k; o.hF = [-2 - 3 * k, -15 - 2 * k]; o.hB = [2, -11]; o.swordAng = lerp(2.4, -2.6, easeOutCubic(k)); o.tremble = k >= 1 ? 1 : 0;
      if (this.onGround) { o.fF = [5, -1]; o.fB = [-5, -1]; o.hipY = -9; } else { o.fF = [3, -4]; o.fB = [-3, -2]; }
      return o;
    }
    if (this.rebounding && this.rebounding()) {
      // reeling in feet first, kick chambered, blade left in its sheath
      o.lean = -0.25; o.fF = [6, -8]; o.fB = [-2, -5]; o.hF = [-4, -15]; o.hB = [-6, -12]; o.sword = 'sheathed'; o.sheathAng = 2.75;
      return o;
    }
    const towing = this.tether && this.tether.mode === 'tow' && this.tether.phase === 'attached';
    if (this.zipping() || towing || (this.tether && this.tether.phase === 'fly')) {
      const T = this.tether;
      const [cx, cy] = this.chest();
      const ta = localAngle(Math.atan2(T.y - cy, T.x - cx), f);
      o.hB = [Math.cos(ta) * 8, -12 + Math.sin(ta) * 8];
      if (this.zipping()) { o.lean = 0.5; o.fF = [-1, -4]; o.fB = [-6, -3]; o.swordAng = Math.PI - 0.3; o.hF = [-5, -9]; }
      else if (!this.onGround) { o.fF = [3, -4]; o.fB = [-3, -2]; }
      if (this.tether.phase === 'fly' || this.zipping() || towing) return o;
    }
    if (this.utilT > 0) {
      o.lean = -0.25; o.hF = [7, -17]; o.hB = [-7, -16]; o.swordAng = -0.9; o.tremble = 1;
      if (this.onGround) { o.fF = [5, -1]; o.fB = [-5, -1]; } else { o.fF = [3, -4]; o.fB = [-3, -2]; }
      return o;
    }
    if (this.hurtT > 0) {
      o.lean = -0.35; o.hF = [4, -16]; o.hB = [-5, -15]; o.fF = [3, -2]; o.fB = [-3, -1]; o.swordAng = -1;
      return o;
    }
    if (this.sliding) {
      o.lean = -0.45; o.hipY = -4; o.fF = [8, -1]; o.fB = [1, -1]; o.hB = [-6, -1]; o.swordAng = -2.4; o.hF = [3, -11];
      return o;
    }
    if (this.wallSliding) {
      o.lean = -0.1; o.fF = [3, -3]; o.fB = [-3, -1]; o.hB = [-5, -14]; o.hF = [4, -9]; o.swordAng = 2.6;
      return o;
    }
    if (this.ultHold > 0) {
      const k = this.ultHold;
      o.lean = 0.15; o.fF = [4, -1]; o.fB = [-4, -1]; o.hipY = -9 + k; o.hF = [3, -18 - k * 2]; o.hB = [-3, -17 - k * 2]; o.swordAng = -Math.PI / 2;
      o.tremble = k > 0.4 ? 1 : 0;
      return o;
    }
    if (!this.onGround) {
      if (this.spinT > 0) {
        const k = 1 - this.spinT / this.spinDur;
        o.rot = k * TAU; o.fF = [3, -7]; o.fB = [-1, -6]; o.hipY = -11; o.hF = [3, -9]; o.hB = [1, -10]; o.swordAng = 2.6; o.lean = 0.3;
        return o;
      }
      if (this.vy < 0) { o.fF = [3, -5]; o.fB = [-2, -2]; o.lean = 0.12; o.hF = [4, -12]; o.hB = [-4, -14]; o.swordAng = 2.6; }
      else { o.fF = [2, 0]; o.fB = [-3, -1]; o.lean = 0.05; o.hF = [5, -15]; o.hB = [-5, -16]; o.swordAng = 2.2; o.hipY = -10.5; }
      return o;
    }
    if (this.crouching) {
      o.hipY = -6; o.fF = [4, -1]; o.fB = [-4, -1]; o.lean = 0.4; o.hF = [5, -7]; o.hB = [-1, -6]; o.swordAng = 2.8;
      return o;
    }
    const sp = Math.abs(this.vx);
    if (sp > 15) {
      const ph = this.runPhase, stride = clamp(sp / 150, 0.3, 1.2);
      o.lean = 0.28 * stride;
      o.hipY = -10 + Math.abs(Math.cos(ph)) * 1.1 - 0.5;
      o.fF = [Math.sin(ph) * 5 * stride + 1, -1 - Math.max(0, Math.cos(ph)) * 3.5 * stride];
      o.fB = [Math.sin(ph + Math.PI) * 5 * stride + 1, -1 - Math.max(0, Math.cos(ph + Math.PI)) * 3.5 * stride];
      o.hF = [-5, -9]; o.swordAng = Math.PI - 0.15;
      o.hB = [Math.sin(ph) * 3 + 1, -9];
      return o;
    }
    // idle with breathing
    const br = Math.sin(t * 3) > 0 ? 0 : 1;
    o.hipY = -10 + br * 0.6; o.hF = [5, -8 + br * 0.5]; o.hB = [-2, -8 + br * 0.5]; o.swordAng = 2.45;
    return o;
  }
  draw(ctx, camX, camY) {
    if (this.ult) { getUltimate(this.ult.id).draw(this, ctx, camX, camY); return; }
    const o = this.pose();
    const C = this.pal || PCOL;
    const g = Sprite.begin(this.facing);
    const tr = o.tremble ? (Math.random() < 0.5 ? -1 : 1) * (Math.random() < 0.5 ? 1 : 0) : 0;
    if (this.landSquash > 0) o.hipY += 1.5;
    const pivotY = o.pivotY !== undefined ? o.pivotY : -10;
    const R = (x, y) => rotPt(x, y, 0, pivotY, o.rot);
    const hip = [o.hipX + tr, o.hipY];
    const neck = [hip[0] + Math.sin(o.lean) * 7, hip[1] - Math.cos(o.lean) * 7];
    const head = [neck[0] + Math.sin(o.lean * 0.6) * 3.3, neck[1] - Math.cos(o.lean * 0.6) * 3.3];
    const sh = [neck[0] - Math.sin(o.lean) * 1, neck[1] + Math.cos(o.lean) * 1];
    const [kFx, kFy, fFx, fFy] = ik2(hip[0], hip[1], o.fF[0], o.fF[1], 5, 5.2, 1);
    const [kBx, kBy, fBx, fBy] = ik2(hip[0], hip[1], o.fB[0], o.fB[1], 5, 5.2, 1);
    let hF = o.hF;
    if (hF === 'sword') hF = [sh[0] + Math.cos(o.swordAng) * 6, sh[1] + Math.sin(o.swordAng) * 6];
    else if (!hF) hF = [4, -8];
    const hB = o.hB || [-2, -8];
    const [eFx, eFy, hFx, hFy] = ik2(sh[0], sh[1], hF[0], hF[1], 4, 4.2, -1);
    const [eBx, eBy, hBx, hBy] = ik2(sh[0], sh[1], hB[0], hB[1], 4, 4.2, -1);
    const P = (p) => R(p[0], p[1]);
    const [Hip, Neck, Head, Sh] = [P(hip), P(neck), P(head), P(sh)];
    const [KF, FF, KB, FB] = [R(kFx, kFy), R(fFx, fFy), R(kBx, kBy), R(fBx, fBy)];
    const [EF, HF, EB, HB] = [R(eFx, eFy), R(hFx, hFy), R(eBx, eBy), R(hBx, hBy)];
    const sAng = o.swordAng + o.rot;

    // scarf (world -> local)
    const sc = [];
    for (const p of this.scarf) sc.push((p.x - this.x) * this.facing, p.y - this.y);
    sc[0] = Neck[0] - 1; sc[1] = Neck[1] + 1;
    g.fillStyle = C.scarfD; polyline(g, sc.slice(0, 6), 2);
    g.fillStyle = C.scarf; polyline(g, sc, 1);
    // back limbs
    limb(g, Sh[0], Sh[1], EB[0], EB[1], HB[0], HB[1], C.dark, 2);
    limb(g, Hip[0], Hip[1], KB[0], KB[1], FB[0], FB[1], C.dark, 2);
    g.fillStyle = C.boot; g.fillRect(Math.round(FB[0]) - 1, Math.round(FB[1]), 3, 1);
    // sheath on the hip
    const sa = o.sword === 'sheathed' ? o.sheathAng + o.rot : 2.75 + o.rot - o.lean * 0.5;
    const s0 = [Hip[0] - 1, Hip[1] + 1], s1 = [s0[0] + Math.cos(sa) * 11, s0[1] + Math.sin(sa) * 11];
    const charge = this.sheathe ? this.sheathe.charge : 0;
    g.fillStyle = charge > 0.95 ? (this.sheathe.empowered ? '#ffd070' : '#ff5a70') : C.sheath;
    pline(g, s0[0], s0[1], s1[0], s1[1], 2);
    g.fillStyle = C.tsuba; g.fillRect(Math.round(s1[0]), Math.round(s1[1]), 1, 1);
    g.fillStyle = C.sheathD; pline(g, s0[0] + Math.cos(sa) * 2, s0[1] + Math.sin(sa) * 2 - 1, s1[0], s1[1] - 1, 1);
    if (o.sword === 'sheathed') {
      const ha = sa + Math.PI;
      g.fillStyle = C.tsuba; g.fillRect(Math.round(s0[0] + Math.cos(ha)), Math.round(s0[1] + Math.sin(ha)), 1, 1);
      g.fillStyle = C.handle; pline(g, s0[0] + Math.cos(ha) * 2, s0[1] + Math.sin(ha) * 2, s0[0] + Math.cos(ha) * 5, s0[1] + Math.sin(ha) * 5, 1);
    }
    // torso
    g.fillStyle = C.mid; pline(g, Hip[0], Hip[1], Neck[0], Neck[1], 4);
    g.fillStyle = C.dark; pline(g, Hip[0] - 1, Hip[1] + 1, Hip[0] + 1, Hip[1] + 1, 2);
    const ca = o.lean + o.rot;
    const fx = Math.cos(ca), fy = Math.sin(ca);
    g.fillStyle = C.light;
    pline(g, Hip[0] + fx * 1.2 + Math.sin(ca) * -2, Hip[1] + fy * 1.2 - Math.cos(ca) * 2, Neck[0] + fx * 1.2, Neck[1] + fy * 1.2, 1);
    g.fillStyle = C.core; g.fillRect(Math.round((Hip[0] + Neck[0]) / 2 + fx), Math.round((Hip[1] + Neck[1]) / 2 - 1), 1, 1);
    // head
    g.fillStyle = C.mid; pdisc(g, Head[0], Head[1], 3.1);
    g.fillStyle = C.light; g.fillRect(Math.round(Head[0] - 1), Math.round(Head[1] - 3), 3, 1);
    g.fillStyle = C.dark; g.fillRect(Math.round(Head[0] - 2), Math.round(Head[1] + 2), 4, 1);
    const ha = o.lean * 0.4 + o.rot;
    const hx = Math.cos(ha), hy = Math.sin(ha);
    g.fillStyle = C.dark; pline(g, Head[0] - hx * 0.5, Head[1] - hy * 0.5, Head[0] + hx * 3, Head[1] + hy * 3, 2);
    g.fillStyle = C.visor; pline(g, Head[0] + hx * 0.5, Head[1] + hy * 0.5, Head[0] + hx * 2.6, Head[1] + hy * 2.6, 1);
    g.fillStyle = '#ffd0d8'; g.fillRect(Math.round(Head[0] + hx * 2.6), Math.round(Head[1] + hy * 2.6), 1, 1);
    // front leg
    limb(g, Hip[0], Hip[1], KF[0], KF[1], FF[0], FF[1], C.light, 2);
    g.fillStyle = C.hi; g.fillRect(Math.round(KF[0]), Math.round(KF[1]) - 1, 1, 1);
    g.fillStyle = C.boot; g.fillRect(Math.round(FF[0]) - 1, Math.round(FF[1]), 3, 1);
    // front arm + katana
    limb(g, Sh[0], Sh[1], EF[0], EF[1], HF[0], HF[1], C.light, 2);
    g.fillStyle = C.hi; g.fillRect(Math.round(Sh[0]) - 1, Math.round(Sh[1]) - 1, 2, 2);
    if (o.sword === 'hand') {
      const clip = o.bladeClip !== undefined;
      if (clip) { g.save(); g.beginPath(); g.rect(-Sprite.OX, -Sprite.OY, Sprite.SIZE, Sprite.OY + o.bladeClip); g.clip(); }
      this.drawKatana(g, HF[0], HF[1], sAng, 13, !!this.attack || !!this.iaido, C);
      if (clip) g.restore();
    }
    this._swordTip = [this.x + (HF[0] + Math.cos(sAng) * 13) * this.facing, this.y + HF[1] + Math.sin(sAng) * 13];
    this._visor = [this.x + (Head[0] + hx * 2) * this.facing, this.y + Head[1]];

    if (this.drawExtras) this.drawExtras(g, { Sh, Neck, Head, Hip, HB, HF }, C);
    const flash = this.drawFlash ? this.drawFlash() : this.hurtT > 0.12 ? '#ffffff' : null;
    const blink = this.blinkT > 0 && this.hurtT <= 0 && ((this.animT * 30) | 0) % 2 === 0;
    if (!this.spriteCopy) this.spriteCopy = makeCanvas(Sprite.SIZE, Sprite.SIZE);
    const cc = this.spriteCopy.ctx;
    cc.clearRect(0, 0, Sprite.SIZE, Sprite.SIZE);
    cc.drawImage(Sprite.scratch, 0, 0);
    Sprite.end(ctx, this.x - camX, this.y - camY, { flash, alpha: blink ? 0.55 : 1 });
  }
  drawKatana(g, hx, hy, ang, len, hot, C = PCOL) {
    const c = Math.cos(ang), s = Math.sin(ang);
    g.fillStyle = C.handle; pline(g, hx - c * 3, hy - s * 3, hx, hy, 1);
    g.fillStyle = C.tsuba;
    g.fillRect(Math.round(hx + c - s), Math.round(hy + s + c), 1, 1);
    g.fillRect(Math.round(hx + c + s), Math.round(hy + s - c), 1, 1);
    g.fillStyle = hot ? '#ffffff' : C.blade;
    pline(g, hx + c * 2, hy + s * 2, hx + c * len, hy + s * len, 1);
    g.fillStyle = C.edge;
    pline(g, hx + c * 3 - s, hy + s * 3 + c, hx + c * (len - 2) - s, hy + s * (len - 2) + c, 1);
  }
  drawEmissive(ctx, camX, camY) {
    const T = this.tether;
    if (T) {
      const [hx, hy] = this.hand();
      const x0 = hx - camX, y0 = hy - camY, x1 = T.x - camX, y1 = T.y - camY;
      const jag = T.phase === 'attached' ? 3.5 : 2;
      drawBolt(ctx, x0, y0, x1, y1, '#d01838', '#ffd0dc', jag, 1);
      if (Math.random() < 0.5) drawBolt(ctx, x0, y0, x1, y1, '#ff2a48', '#ff8aa0', jag * 1.6, 0);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(x1) - 1, Math.round(y1) - 1, 3, 3);
      ctx.fillStyle = '#ff3a52';
      ctx.fillRect(Math.round(x1), Math.round(y1) - 2, 1, 1); ctx.fillRect(Math.round(x1), Math.round(y1) + 2, 1, 1);
      ctx.fillRect(Math.round(x1) - 2, Math.round(y1), 1, 1); ctx.fillRect(Math.round(x1) + 2, Math.round(y1), 1, 1);
    }
    if (this.ult) { getUltimate(this.ult.id).drawEmissive(this, ctx, camX, camY); return; }
    const [cx, cy] = this.chest();
    if (this.sheathe) {
      const s = this.sheathe, r = 14;
      // ring drains as the parry window closes; gold once a parry lands
      const ch = s.empowered ? 1 : clamp(1 - s.t / Math.max(0.01, s.parryUntil), 0, 1);
      const col = s.empowered ? '#ffd070' : '#ffe8a0';
      const n = 24;
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (i / n) * TAU;
        const lit = i / n < ch;
        ctx.fillStyle = lit ? col : '#3a0a14';
        ctx.fillRect(Math.round(cx - camX + Math.cos(a) * r), Math.round(cy - camY + Math.sin(a) * r), 1, 1);
      }
      if (this.parryActive()) {
        ctx.fillStyle = '#ffe8a0';
        pring(ctx, cx - camX, cy - camY, 9 + Math.sin(this.animT * 40) * 0.5, 1, 1);
      }
    }
    if (this.ultHold > 0) {
      const n = 30, r = 17;
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (i / n) * TAU;
        ctx.fillStyle = i / n < this.ultHold ? '#ff3a52' : '#3a0a14';
        ctx.fillRect(Math.round(cx - camX + Math.cos(a) * r), Math.round(cy - camY + Math.sin(a) * r), 1, 1);
      }
    }
  }
  addLights() {
    if (this.dead) return;
    const [cx, cy] = this.chest();
    FX.frameLight(cx, cy, 46, '#c8a0b8', 0.35);
    if (Game.mod('blackout')) FX.frameLight(cx, cy, 80, '#c8a0b8', 0.5);
    if (this._visor) FX.frameLight(this._visor[0], this._visor[1], 14, '#ff2a48', 0.9);
    if (this.sheathe) FX.frameLight(this.x - this.facing * 5, this.y - 7, 20 + this.sheathe.charge * 40, this.sheathe.empowered ? '#ffd070' : '#ff2a48', 0.6 + this.sheathe.charge * 0.4);
    if (this.attack && this._swordTip) FX.frameLight(this._swordTip[0], this._swordTip[1], 30, '#ff3048', 0.8);
    if (this.tether) FX.frameLight(this.tether.x, this.tether.y, 26, '#ff3048', 0.8);
    if (this.ult) FX.frameLight(this.x, this.cy, 80, '#ff2a48', 1);
  }
}

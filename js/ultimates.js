'use strict';
// Ultimate abilities. Each one is a self-contained definition registered here, so future unlockable
// ultimates only need a new registerUltimate({...}) block and a way to select S.gameplay.ultimate.

const ULTIMATES = {};
function registerUltimate(def) { ULTIMATES[def.id] = def; }
function getUltimate(id) { return ULTIMATES[id] || ULTIMATES.sawblade; }

registerUltimate({
  id: 'sawblade',
  name: 'Red Sawblade',
  desc: 'Become a spinning electric saw. Invulnerable, free tether with unlimited range.',
  duration: 7,

  start(p) {
    const u = p.ult;
    u.spin = 0; u.hitCD = new Map(); u.lungeCD = 0; u.jumpCD = 0; u.lungeT = 0; u.ghostT = 0;
    p.h = 16;
    p.vx *= 0.5; p.vy = -140;
    p.loops.saw = Sound.loop('saw');
    Sound.play('ultActivate');
    Game.slowmo(0.25, 0.35);
    Game.shake(0.6);
    Game.hitstop(0.08);
    FX.flash('#ff2040', 0.5);
    FX.ring(p.x, p.cy, 4, 95, 0.45, { w: 2 });
    FX.ring(p.x, p.cy, 2, 60, 0.35, { w: 1, c: '#ffd0d8', core: '#ffffff' });
    FX.elec(p.x, p.cy, 34, 12);
    FX.sparks(p.x, p.cy, 40, 0, TAU, 80, 320);
    FX.light(p.x, p.cy, 160, '#ff2a48', 1, 0.5);
    for (const e of Game.enemies) {
      if (e.dead || e.spawning) continue;
      const dx = e.x - p.x, dy = e.y - e.h / 2 - p.cy, d = Math.hypot(dx, dy);
      if (d < 95) hurtEnemy(e, 40, { kx: (dx / (d || 1)) * 300, ky: -220, heavy: true, cause: 'saw', angle: Math.atan2(dy, dx), stagger: 0.9 });
    }
    Game.announce('SAWBLADE', 'UNLIMITED TETHER · INVULNERABLE', '#ff3a52', 1.6);
  },

  update(p, dt) {
    const u = p.ult;
    if (!Game.cineActive()) u.t += dt;
    u.lungeCD -= dt; u.jumpCD -= dt; u.lungeT -= dt;
    const mx = (Input.isDown('right') ? 1 : 0) - (Input.isDown('left') ? 1 : 0);
    const up = Input.isDown('jump'), down = Input.isDown('crouch');
    if (Input.wasPressed('dash')) p.tryDash(mx, up, down);
    p.updateTetherInput();
    p.updateTether(dt);
    if (Input.wasPressed('jump')) p.jumpBuf = PC.JUMP_BUF;
    if (Input.wasPressed('attack') && u.lungeCD <= 0) {
      const a = p.aimAngle;
      if (p.tether) p.releaseTether();
      p.vx = Math.cos(a) * 660; p.vy = Math.sin(a) * 660;
      u.lungeT = 0.16; u.lungeCD = 0.26;
      Sound.play('dash'); Sound.play('swing', { stage: 3 });
      FX.ring(p.x, p.cy, 3, 20, 0.2, { w: 1 });
    }

    // Latched on with the tether: grind the target with damage that compounds every tick.
    if (p.grinding()) {
      const T = p.tether, e = T.target;
      if (!e || e.dead || !Input.isDown('tether')) p.releaseTether();
      else {
        p.x = e.x; p.y = e.cy + p.h * 0.55; p.vx = 0; p.vy = 0; p.onGround = false;
        p.facing = Math.cos(p.aimAngle) >= 0 ? 1 : -1;
        T.grindT -= dt;
        if (T.grindT <= 0) {
          T.grindT = 0.1;
          const shielded = e.shielded && e.shielded();
          if (!shielded) T.grindN++;
          const dmg = Math.min(150, 5 * Math.pow(1.16, T.grindN));
          hurtEnemy(e, dmg, { cause: 'saw', noKnock: true, stagger: 0.3, hitstop: 0, angle: rand(0, TAU), crit: dmg >= 60 });
          Sound.play('sawHit');
          FX.sparks(p.x, p.cy, 6 + Math.min(10, T.grindN / 2), rand(0, TAU), TAU, 80, 260);
          if (T.grindN > 8) FX.elec(p.x, p.cy, 16, 2);
          Game.shake(Math.min(0.12, 0.02 + T.grindN * 0.004));
        }
        u.spin += 40 * dt * p.facing;
        if (p.loops.saw) p.loops.saw.set(700, true);
        if (u.t >= u.dur) this.end(p);
        return;
      }
    }
    const wasGround = p.onGround;
    if (p.dashT > 0) p.moveDash(dt);
    else if (p.rebounding()) p.moveRebound(dt);
    else if (p.zipping()) p.moveZip(dt);
    else if (u.lungeT > 0) p.vy += 300 * dt;
    else {
      const max = 300, acc = p.onGround ? 2400 : 1500;
      if (mx) {
        if (Math.abs(p.vx) > max && sign(p.vx) === mx) p.vx = approach(p.vx, mx * max, 300 * dt);
        else p.vx = approach(p.vx, mx * max, acc * dt);
      } else p.vx = approach(p.vx, 0, (p.onGround ? 900 : 220) * dt);
      p.vy = Math.min(p.vy + (900 + (down ? 1600 : 0)) * dt, 640);
      if (p.jumpBuf > 0 && u.jumpCD <= 0) {
        p.vy = -350; u.jumpCD = 0.16; p.jumpBuf = 0;
        Sound.play('djump');
        FX.ring(p.x, p.y, 2, 14, 0.2, { sy: 0.35, w: 1 });
      }
    }
    const pvx = p.vx, pvy = p.vy;
    const col = Level.moveBody(p, dt, { step: 11, ghostCover: p.dashT > 0 || p.zipping() || p.rebounding() });
    if ((col.wallL || col.wallR) && Math.abs(pvx) > 160 && !p.zipping()) {
      p.vx = -pvx * 0.45;
      FX.sparks(p.x + (col.wallR ? 6 : -6), p.cy, 10, col.wallR ? Math.PI : 0, 1.6, 60, 220);
      Game.shake(0.06);
    }
    if (col.ceil && pvy < -150) p.vy = -pvy * 0.3;
    if (p.zipping() && (col.wallL || col.wallR || col.ceil || col.ground)) {
      const T = p.tether;
      if (Math.hypot(T.x - p.x, T.y - p.cy) < 32) p.arriveZip();
    }
    if (col.ground && !wasGround && pvy > 260) {
      FX.dust(p.x, p.y, 8, { smax: 80 });
      Sound.play('land', { v: 1 });
      Game.shake(0.08);
    }
    const spd = Math.hypot(p.vx, p.vy);
    if (p.vx > 20) p.facing = 1; else if (p.vx < -20) p.facing = -1;
    u.spin += (spd * 0.07 + 16) * dt * p.facing;

    // contact damage
    const R = 14, cx = p.x, cy = p.cy;
    for (const e of Game.enemies) {
      if (e.dead || e.spawning) continue;
      if (!circleRect(cx, cy, R, e.x - e.w / 2, e.y - e.h, e.w, e.h)) continue;
      const next = u.hitCD.get(e) || 0;
      if (Game.time < next) continue;
      u.hitCD.set(e, Game.time + 0.09);
      const a = Math.atan2(e.y - e.h / 2 - cy, e.x - cx);
      hurtEnemy(e, 11, { kx: Math.cos(a) * 160 + p.vx * 0.3, ky: -110, cause: 'saw', angle: a + Math.PI / 2, stagger: 0.3, hitstop: 0.012 });
      Sound.play('sawHit');
      FX.sparks(cx + Math.cos(a) * 10, cy + Math.sin(a) * 10, 6, a + Math.PI / 2 * p.facing, 1.2, 80, 260);
    }
    for (const pr of Game.props) {
      if (!pr.dead && circleRect(cx, cy, R, pr.x - pr.w / 2, pr.y - pr.h, pr.w, pr.h)) pr.hit(30, { kx: p.vx * 0.5, ky: -150, heavy: true });
    }
    for (const b of Game.projectiles) {
      if (!b.dead && b.hostile && !b.rebound && dist(b.x, b.y, cx, cy) < R + 3) { b.dead = true; FX.sparks(b.x, b.y, 6, 0, TAU, 40, 140); }
    }
    // grinding sparks on surfaces
    const wallL = Level.touchingWall(p, -1), wallR = Level.touchingWall(p, 1);
    const grinding = (p.onGround || wallL || wallR) && spd > 40;
    if (grinding) {
      const gx = wallR ? p.x + 7 : wallL ? p.x - 7 : p.x, gy = p.onGround ? p.y - 1 : p.cy;
      const back = p.onGround ? (p.vx > 0 ? Math.PI + 0.4 : -0.4) : (p.vy > 0 ? -Math.PI / 2 : Math.PI / 2);
      FX.sparks(gx, gy, 2 + spd / 150, back, 0.8, 80, 260, { life: 0.7 });
      if (Math.random() < 0.15) FX.decal('scorch', gx, p.onGround ? p.y : gy, { r: 3, dur: 2 });
    }
    if (p.loops.saw) p.loops.saw.set(spd, grinding);
    u.ghostT -= dt;
    if (u.ghostT <= 0 && spd > 120) { u.ghostT = 0.025; p.makeGhost('#ff2a48', 0.22, 0.5); }
    if (u.t >= u.dur) this.end(p);
  },

  end(p) {
    Sound.play('ultEnd');
    p.stopLoop('saw');
    p.ult = null;
    if (p.tether) p.releaseTether();
    if (!p.setHeight(PC.H)) { p.crouching = true; p.setHeight(PC.CROUCH_H); }
    p.iframes = 0.7;
    FX.ring(p.x, p.cy, 3, 30, 0.3, { w: 1 });
    FX.elec(p.x, p.cy, 18, 5);
    FX.sparks(p.x, p.cy, 14, 0, TAU, 60, 200);
  },

  render(p, g) {
    const s = p.ult.spin, cy = -8;
    g.fillStyle = '#9a1024';
    for (let i = 0; i < 12; i++) {
      const a = s + (i / 12) * TAU;
      pline(g, Math.cos(a) * 7.5, cy + Math.sin(a) * 7.5, Math.cos(a + 0.32) * 11.5, cy + Math.sin(a + 0.32) * 11.5, 2);
    }
    g.fillStyle = '#ff8a9a';
    for (let i = 0; i < 12; i++) {
      const a = s + 0.32 + (i / 12) * TAU;
      g.fillRect(Math.round(Math.cos(a) * 11.5), Math.round(cy + Math.sin(a) * 11.5), 1, 1);
    }
    g.fillStyle = '#6a0a1a'; pdisc(g, 0, cy, 8.5);
    g.fillStyle = '#b8142a'; pdisc(g, 0, cy, 7);
    g.fillStyle = '#ff4a64';
    for (let i = 0; i < 3; i++) {
      const a = -s * 0.5 + (i / 3) * TAU;
      pline(g, Math.cos(a) * 2, cy + Math.sin(a) * 2, Math.cos(a) * 6, cy + Math.sin(a) * 6, 1);
    }
    g.fillStyle = '#262a38'; pdisc(g, 0, cy, 2.6);
    g.fillStyle = '#ff2a48'; g.fillRect(0, cy - 1, 2, 1);
    g.fillStyle = '#ffffff'; g.fillRect(1, cy - 1, 1, 1);
  },
  draw(p, ctx, camX, camY) {
    const g = Sprite.begin(1);
    this.render(p, g);
    if (!p.spriteCopy) p.spriteCopy = makeCanvas(Sprite.SIZE, Sprite.SIZE);
    p.spriteCopy.ctx.clearRect(0, 0, Sprite.SIZE, Sprite.SIZE);
    p.spriteCopy.ctx.drawImage(Sprite.scratch, 0, 0);
    Sprite.end(ctx, p.x - camX, p.y - camY, { outline: '#1a0208' });
    p._visor = [p.x, p.cy];
  },
  drawEmissive(p, ctx, camX, camY) {
    const cx = p.x - camX, cy = p.cy - camY;
    for (let i = 0; i < 3; i++) {
      if (Math.random() < 0.6) {
        const a = rand(0, TAU), r = rand(13, 20);
        drawBolt(ctx, cx + Math.cos(a) * 8, cy + Math.sin(a) * 8, cx + Math.cos(a + rand(-0.4, 0.4)) * r, cy + Math.sin(a + rand(-0.4, 0.4)) * r, '#ff2a48', '#ffe0e6', 2, 1);
      }
    }
    const left = 1 - p.ult.t / p.ult.dur, n = 28;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i / n) * TAU;
      ctx.fillStyle = i / n < left ? '#ff3a52' : '#3a0a14';
      ctx.fillRect(Math.round(cx + Math.cos(a) * 17), Math.round(cy + Math.sin(a) * 17), 1, 1);
    }
  },
});

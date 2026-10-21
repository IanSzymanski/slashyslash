'use strict';
// Character utilities, bound to F: one ability per character on a cooldown. CHARACTERS (rival.js) names
// which one each character uses; a character without one simply has nothing on F.

const UTILITIES = {};
function registerUtility(def) { UTILITIES[def.id] = def; }
function getUtility(id) { return UTILITIES[id] || null; }

// RONIN: vents the core in a red shock ring. Everything close is interrupted and thrown back, and hostile
// bolts are burned out of the air. Bosses shrug it off and pulse grenades are untouched, so it never
// replaces the answers a fight asks for; it buys space when you are swarmed.
registerUtility({
  id: 'overload',
  name: 'Overload',
  hud: 'OVERLOAD',
  desc: 'A red shock ring: interrupts and knocks back everything close, burns bolts out of the air.',
  cooldown: 10,
  radius: 80,

  use(p) {
    const R = this.radius, [cx, cy] = p.chest();
    p.utilT = 0.24;
    p.iframes = Math.max(p.iframes, 0.15);
    if (!p.onGround && p.vy > -40) p.vy = -60;
    for (const e of Game.enemies) {
      if (e.dead || e.spawning || e.dying) continue;
      const ex = e.x, ey = e.cy, d = dist(ex, ey, cx, cy);
      if (d > R + Math.max(e.w, e.h) / 2) continue;
      const ang = Math.atan2(ey - cy, ex - cx), kx = Math.cos(ang) * 220;
      FX.bolt(cx, cy, ex, ey, 0.2, { jag: 6 });
      if (e.isBoss) {
        FX.sparks(ex, ey, 8, ang + Math.PI, 1.2, 60, 180, { c0: '#ffffff', c1: '#7af0ff', c2: '#145e6a' });
        FX.text('RESISTED', ex, e.y - e.h - 8, { c: '#7af0ff', always: true, dur: 0.6, vy: -20 });
        continue;
      }
      // shields and armour stop the damage, but not the interrupt
      if (e.shielded && e.shielded({ cause: 'overload', kx })) e.stagger(1.0, kx);
      else {
        hurtEnemy(e, 10, { kx, ky: -160, cause: 'overload', angle: ang, stagger: 1.0, hitstop: 0 });
        if (e.heavy && !e.dead) e.stagger(0.8, 0);
      }
      FX.elec(ex, ey, 12, 3);
    }
    for (const b of Game.projectiles) {
      if (b.dead || !b.hostile || b.rebound || dist(b.x, b.y, cx, cy) > R + 10) continue;
      b.dead = true;
      FX.sparks(b.x, b.y, 6, 0, TAU, 40, 140);
      FX.bolt(cx, cy, b.x, b.y, 0.12, { jag: 4 });
    }
    FX.ring(cx, cy, 6, R, 0.32, { w: 2 });
    FX.ring(cx, cy, 3, R * 0.6, 0.24, { w: 1, c: '#ffd0d8', core: '#ffffff' });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU + rand(-0.2, 0.2);
      FX.bolt(cx, cy, cx + Math.cos(a) * R * 0.85, cy + Math.sin(a) * R * 0.85, 0.16, { jag: 5 });
    }
    FX.sparks(cx, cy, 30, 0, TAU, 80, 280);
    FX.light(cx, cy, R * 2, '#ff2a48', 1, 0.35);
    FX.flash('#ff3048', 0.2);
    Sound.play('overload');
    Game.shake(0.35);
    Game.hitstop(0.05);
  },
});

'use strict';
// Character sprites are drawn procedurally into a scratch canvas (pixel lines + discs on a skeleton),
// then composited into the scene with a 1px dark outline, which is what gives them the pixel-art finish.

const Sprite = {
  SIZE: 96, OX: 48, OY: 66,
  scratch: null, sil: null, facing: 1,

  init() {
    this.scratch = makeCanvas(this.SIZE, this.SIZE);
    this.sil = makeCanvas(this.SIZE, this.SIZE);
  },
  begin(facing) {
    const g = this.scratch.ctx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.SIZE, this.SIZE);
    this.facing = facing >= 0 ? 1 : -1;
    if (this.facing > 0) g.setTransform(1, 0, 0, 1, this.OX, this.OY);
    else g.setTransform(-1, 0, 0, 1, this.OX, this.OY);
    return g;
  },
  // Composite the scratch sprite into ctx with feet at (sx, sy) in screen space.
  end(ctx, sx, sy, opt = {}) {
    const g = this.scratch.ctx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    const dx = Math.round(sx) - this.OX, dy = Math.round(sy) - this.OY;
    const s = this.sil, sg = s.ctx;
    sg.globalCompositeOperation = 'source-over';
    sg.clearRect(0, 0, this.SIZE, this.SIZE);
    sg.drawImage(this.scratch, 0, 0);
    sg.globalCompositeOperation = 'source-in';
    sg.fillStyle = opt.outline || '#0b0910';
    sg.fillRect(0, 0, this.SIZE, this.SIZE);
    sg.globalCompositeOperation = 'source-over';
    if (opt.alpha !== undefined) ctx.globalAlpha = opt.alpha;
    ctx.drawImage(s, dx - 1, dy); ctx.drawImage(s, dx + 1, dy);
    ctx.drawImage(s, dx, dy - 1); ctx.drawImage(s, dx, dy + 1);
    if (opt.flash) {
      sg.globalCompositeOperation = 'source-in';
      sg.fillStyle = opt.flash;
      sg.fillRect(0, 0, this.SIZE, this.SIZE);
      sg.globalCompositeOperation = 'source-over';
      ctx.drawImage(s, dx, dy);
    } else ctx.drawImage(this.scratch, dx, dy);
    ctx.globalAlpha = 1;
    return { dx, dy };
  },
  // Copy of the current scratch with outline baked in (for gibs).
  snapshot() {
    const c = makeCanvas(this.SIZE, this.SIZE), g = c.ctx;
    const s = this.sil, sg = s.ctx;
    sg.globalCompositeOperation = 'source-over';
    sg.clearRect(0, 0, this.SIZE, this.SIZE);
    sg.drawImage(this.scratch, 0, 0);
    sg.globalCompositeOperation = 'source-in';
    sg.fillStyle = '#0b0910';
    sg.fillRect(0, 0, this.SIZE, this.SIZE);
    sg.globalCompositeOperation = 'source-over';
    g.drawImage(s, -1, 0); g.drawImage(s, 1, 0); g.drawImage(s, 0, -1); g.drawImage(s, 0, 1);
    g.drawImage(this.scratch, 0, 0);
    return c;
  },
};

// Two-bone IK. bend = +1 bends the middle joint "forward" for a downward limb.
function ik2(hx, hy, tx, ty, l1, l2, bend) {
  let dx = tx - hx, dy = ty - hy;
  let d = Math.hypot(dx, dy);
  const maxd = l1 + l2 - 0.01;
  if (d > maxd) { dx *= maxd / d; dy *= maxd / d; d = maxd; }
  if (d < 0.01) d = 0.01;
  const a = Math.atan2(dy, dx);
  const c = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
  const a1 = a - bend * Math.acos(c);
  return [hx + Math.cos(a1) * l1, hy + Math.sin(a1) * l1, hx + dx, hy + dy];
}
function rotPt(x, y, px, py, a) {
  if (!a) return [x, y];
  const c = Math.cos(a), s = Math.sin(a), dx = x - px, dy = y - py;
  return [px + dx * c - dy * s, py + dx * s + dy * c];
}
// Limb from joint a through b to c.
function limb(g, ax, ay, bx, by, cx, cy, col, w = 2) {
  g.fillStyle = col;
  pline(g, ax, ay, bx, by, w);
  pline(g, bx, by, cx, cy, w);
}
// Convert a world-space angle to the sprite's local (unmirrored) space.
function localAngle(a, facing) { return facing > 0 ? a : Math.PI - a; }

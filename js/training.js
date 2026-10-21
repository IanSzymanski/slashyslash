'use strict';
// Training mode: an anchored dummy with a damage readout (it can swing at you for parry practice),
// and a panel (opened with pause) to spawn any enemy or the rival, toggle upgrades and modifiers.

ENEMY_DEFS.dummy = { hp: 3000, w: 12, h: 22, speed: 0, score: 0, mass: 99, dmg: 10, heavy: true, debris: ['#7a5a3a', '#5a3e28', '#c8a070', '#ff3048'] };
ENEMY_BASE_STATE.dummy = 'idle';

const DUMMY_MODES = { off: 'Dummy: still', slow: 'Dummy: swings every 2s', fast: 'Dummy: swings fast' };
const TRAIN_TYPES = [
  ['scrapper', 'Scrapper'], ['gunner', 'Gunner'], ['drone', 'Drone'], ['brute', 'Brute'],
  ['shielder', 'Shield scrapper'], ['crawler', 'Armoured crawler'], ['grenadier', 'Grenadier'], ['sniper', 'Rooftop sniper'],
];

Enemy.prototype.dummy = function (dt) {
  const p = Game.player, mode = Game.training ? Game.training.dummy : 'off';
  if (this.homeX === undefined) { this.homeX = this.x; this.lastHp = this.hp; this.dmgLog = []; }
  this.x = this.homeX; this.vx = 0;
  if (this.hp < this.lastHp) this.dmgLog.push({ t: Game.time, d: this.lastHp - this.hp });
  this.lastHp = this.hp;
  while (this.dmgLog.length && Game.time - this.dmgLog[0].t > 3) this.dmgLog.shift();
  this.dps = Math.round(this.dmgLog.reduce((a, b) => a + b.d, 0) / 3);
  switch (this.state) {
    case 'idle':
      this.facing = sign(p.x - this.x) || this.facing;
      if (mode !== 'off' && this.cd <= 0 && Math.abs(p.x - this.x) < 60 && Math.abs(p.y - this.y) < 30 && !p.dead) {
        this.setState('windup'); Sound.play('enemyWindup');
      }
      break;
    case 'windup':
      if (this.st >= this.tele(0.6)) { this.setState('strike'); this.struck = false; Sound.play('enemyMelee'); }
      break;
    case 'strike':
      this.meleeCheck(this.x, this.x + this.facing * 26, this.y - 20, this.y - 4, 10, 160);
      if (this.st > 0.15) this.setState('recover');
      break;
    case 'recover':
      if (this.st > 0.5) { this.setState('idle'); this.cd = mode === 'fast' ? 0.5 : 2; }
      break;
  }
};
// The dummy never dies; it patches itself up.
Enemy.prototype.onDeathDummy = function () {
  this.hp = this.maxHp; this.lastHp = this.hp;
  FX.ring(this.x, this.cy, 3, 24, 0.3, { c: '#ffd070', core: '#ffffff', w: 1 });
  FX.text('RESET', this.x, this.y - 34, { c: '#ffd070', always: true, dur: 0.8 });
};
Enemy.prototype.renderDummy = function (g) {
  const swing = this.state === 'windup' ? -1 : this.state === 'strike' ? 1 : 0;
  g.fillStyle = '#5a3e28'; g.fillRect(-1, -22, 3, 22);
  g.fillStyle = '#3a2818'; g.fillRect(-4, -1, 9, 1);
  g.fillStyle = '#7a5a3a'; pline(g, -6, -15, 6, -15, 2);
  g.fillStyle = '#c8a070'; pdisc(g, 0, -10, 4.5);
  g.fillStyle = '#ff3048'; pdisc(g, 0, -10, 3);
  g.fillStyle = '#ffffff'; pdisc(g, 0, -10, 1.5);
  g.fillStyle = '#ff3048'; g.fillRect(0, -10, 1, 1);
  g.fillStyle = '#7a5a3a'; pdisc(g, 0, -20, 2.5);
  // practice blade on its arm
  const ang = swing < 0 ? -2.2 : swing > 0 ? 0.3 : 1.2;
  g.fillStyle = '#b8b8c0'; pline(g, 6, -15, 6 + Math.cos(ang) * 10, -15 + Math.sin(ang) * 10, 1);
};

const Training = {
  start() { Game.training = { dummy: 'off' }; },
  reset() {
    for (const e of Game.enemies) if (e.stopLoops) e.stopLoops();
    Game.enemies = []; Game.projectiles = []; Game.hazards = [];
    const p = Game.player;
    const d = new Enemy('dummy', Level.freeGroundX(p.x + 90, 14), Level.GROUND);
    d.spawning = false;
    Game.enemies.push(d);
  },
  spawnPoint(type) {
    const p = Game.player, f = p.facing || 1;
    if (type === 'sniper') {
      const near = Level.perches.slice().sort((a, b) => Math.abs(a.x - p.x - f * 160) - Math.abs(b.x - p.x - f * 160));
      return near[0];
    }
    const x = Level.freeGroundX(clamp(p.x + f * 150, 60, Level.W - 60), 14);
    return { x, y: type === 'drone' ? Level.GROUND - 70 : Level.GROUND };
  },
  spawn(type) {
    const q = this.spawnPoint(type);
    const e = new Enemy(type, q.x, q.y, { hp: 1, dmg: 1 });
    Game.enemies.push(e);
    Sound.play('spawn');
  },
  spawnRival(phase2) {
    const p = Game.player;
    const r = new Rival(Level.freeGroundX(clamp(p.x + (p.facing || 1) * 200, 120, Level.W - 120), 12), Level.GROUND, { hp: 1, dmg: 1 });
    r.trainP2 = phase2;
    Game.enemies.push(r);
    Sound.play('spawn');
  },
  clear() {
    for (const e of Game.enemies) { if (e.type === 'dummy') continue; if (e.stopLoops) e.stopLoops(); e.dead = true; }
    Game.projectiles = []; Game.hazards = [];
  },
  refill() {
    const p = Game.player;
    p.hp = PC.MAX_HP; p.shield = PC.MAX_SHIELD; p.shieldOffT = 0; p.dashCharges = PC.DASH_CHARGES; p.parryCD = 0;
  },
  cycleDummy() {
    const keys = Object.keys(DUMMY_MODES), t = Game.training;
    t.dummy = keys[(keys.indexOf(t.dummy) + 1) % keys.length];
  },
  cycleModifier() {
    const keys = [null].concat(Object.keys(WAVE_MODIFIERS));
    Director.modifier = keys[(keys.indexOf(Director.modifier) + 1) % keys.length];
  },
  // the panel is rebuilt every time it opens so labels show the current state
  render() {
    const el = document.getElementById('train-body');
    const btn = (act, label, extra = '', data = '') => `<button type="button" data-act="${act}" ${data}>${label}${extra ? ` <small>${extra}</small>` : ''}</button>`;
    let h = '<h3>Spawn</h3><div class="grid2">';
    for (const [t, name] of TRAIN_TYPES) h += btn('train-spawn', name, '', `data-type="${t}"`);
    h += btn('train-rival', 'AEGIS-07', 'phase 1', 'data-p2="0"') + btn('train-rival', 'AEGIS-07', 'blade phase', 'data-p2="1"');
    h += '</div><h3>Practice</h3><div class="grid2">';
    h += btn('train-dummy', DUMMY_MODES[Game.training.dummy]);
    h += btn('train-mod', 'Modifier', Director.modifier ? WAVE_MODIFIERS[Director.modifier].name.toLowerCase() : 'none');
    h += btn('train-refill', 'Refill health and shield') + btn('train-ult', 'Charge ultimate');
    h += btn('train-clear', 'Clear enemies');
    h += '</div><h3>Upgrades</h3><div class="grid2">';
    for (const id in UPGRADES) h += btn('train-upgrade', UPGRADES[id].name, Game.has(id) ? 'on' : 'off', `data-id="${id}"`);
    h += '</div>';
    el.innerHTML = h;
  },
  act(a, el) {
    switch (a) {
      case 'train-spawn': this.spawn(el.dataset.type); Game.resume(); return;
      case 'train-rival': this.spawnRival(el.dataset.p2 === '1'); Game.resume(); return;
      case 'train-clear': this.clear(); Game.resume(); return;
      case 'train-refill': this.refill(); break;
      case 'train-ult': Game.player.ultCharge = 1; break;
      case 'train-dummy': this.cycleDummy(); break;
      case 'train-mod': this.cycleModifier(); break;
      case 'train-upgrade': { const id = el.dataset.id; if (Game.upgrades.has(id)) Game.upgrades.delete(id); else Game.upgrades.add(id); break; }
    }
    this.render();
  },
};

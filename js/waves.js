'use strict';
// Wave director for the scripted demo, endless survival, the rival fight and the melee duel test mode.

const DEMO_WAVES = [
  { name: 'SCRAP SWARM', list: ['scrapper', 'scrapper', 'scrapper', 'scrapper'] },
  { name: 'CROSSFIRE', list: ['scrapper', 'gunner', 'scrapper', 'gunner', 'scrapper'] },
  { name: 'WINGS', list: ['drone', 'drone', 'scrapper', 'drone', 'scrapper', 'drone'] },
  { name: 'GAUNTLET', list: ['gunner', 'scrapper', 'drone', 'scrapper', 'gunner', 'drone', 'scrapper', 'scrapper'] },
  { name: 'HEAVY METAL', list: ['brute', 'scrapper', 'scrapper', 'gunner', 'scrapper', 'drone'] },
  { name: 'LAST STAND', list: ['brute', 'scrapper', 'gunner', 'drone', 'scrapper', 'brute', 'drone', 'gunner', 'scrapper', 'scrapper'] },
  { name: 'RIVAL', boss: true, list: [] },
];
const BOSS_EVERY = 8;
const ENDLESS_TYPES = [
  { type: 'scrapper', cost: 1, minWave: 1, weight: 4 },
  { type: 'gunner', cost: 1.4, minWave: 2, weight: 2.4 },
  { type: 'drone', cost: 1.1, minWave: 3, weight: 2.4 },
  { type: 'brute', cost: 5, minWave: 5, weight: 0.6 },
];
const ENDLESS_NAMES = ['STREET SWEEP', 'RUST TIDE', 'NIGHT SHIFT', 'SCRAPYARD', 'BLACKOUT', 'NEON RIOT', 'DEAD GRID', 'RED HOUR'];

const Director = {
  mode: 'demo', wave: 0, state: 'idle', queue: [], spawnT: 0, breakT: 0, waveName: '', total: 0, scale: { hp: 1, dmg: 1 }, bossWave: false,

  start(mode) {
    this.mode = mode; this.wave = 0; this.state = 'intro'; this.breakT = 1.4; this.queue = [];
  },
  enabledTypes() { return ['scrapper', 'gunner', 'drone', 'brute'].filter((t) => S.enemies[t]); },
  soloRival() { return this.mode === 'boss' || this.mode === 'duel'; },
  lastWave() { return this.soloRival() ? 1 : this.mode === 'demo' ? DEMO_WAVES.length : Infinity; },
  buildDemo(n) {
    const def = DEMO_WAVES[n - 1];
    this.bossWave = !!def.boss;
    this.waveName = def.name;
    this.scale = { hp: 1, dmg: 1 };
    const en = this.enabledTypes(), fallback = en.length ? en : ['scrapper'];
    const list = def.list.map((t) => (S.enemies[t] ? t : pick(fallback)));
    if (!list.length) return [];
    const target = Math.max(1, Math.round(list.length * S.enemies.count));
    const out = [];
    for (let i = 0; i < target; i++) out.push(list[i % list.length]);
    return out;
  },
  buildEndless(n) {
    this.bossWave = S.enemies.bossEndless && n % BOSS_EVERY === 0;
    if (this.bossWave) {
      this.scale = { hp: 1 + (n - 1) * 0.06, dmg: 1 + (n - 1) * 0.03 };
      this.waveName = 'RIVAL';
      return [];
    }
    let budget = (4 + n * 1.7) * S.enemies.count;
    const avail = ENDLESS_TYPES.filter((d) => S.enemies[d.type] && d.minWave <= n);
    const pool = avail.length ? avail : [ENDLESS_TYPES[0]];
    const out = [];
    if (n % 5 === 0 && S.enemies.brute) for (let i = 0; i < Math.floor(n / 5); i++) { out.push('brute'); budget -= 4; }
    for (let guard = 0; budget > 0.5 && guard < 300; guard++) {
      const opts = pool.filter((d) => d.cost <= budget + 0.6);
      if (!opts.length) break;
      const ws = opts.map((d) => d.weight * (d.type === 'brute' ? 1 + n * 0.05 : 1));
      let r = Math.random() * ws.reduce((a, b) => a + b, 0), k = 0;
      while (r > ws[k]) { r -= ws[k]; k++; }
      out.push(opts[k].type);
      budget -= opts[k].cost;
    }
    for (let i = out.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [out[i], out[j]] = [out[j], out[i]]; }
    this.scale = { hp: 1 + (n - 1) * 0.07, dmg: 1 + (n - 1) * 0.035 };
    this.waveName = n % 5 === 0 ? 'HEAVY WAVE' : ENDLESS_NAMES[(n - 1) % ENDLESS_NAMES.length];
    return out.length ? out : ['scrapper'];
  },
  nextWave() {
    this.wave++;
    if (this.soloRival()) { this.bossWave = true; this.scale = { hp: 1, dmg: 1 }; this.waveName = this.mode === 'duel' ? 'LIMITERS OFF, FULL HEALTH' : 'RIVAL'; this.queue = []; }
    else this.queue = this.mode === 'demo' ? this.buildDemo(this.wave) : this.buildEndless(this.wave);
    this.total = this.queue.length;
    this.spawnT = this.bossWave ? 4 : 0.8;
    this.state = 'fight';
    if (this.bossWave) this.spawnRival();
    const title = this.mode === 'duel' ? 'MELEE DUEL' : this.mode === 'boss' ? 'RIVAL FIGHT' : 'WAVE ' + this.wave + (this.mode === 'demo' ? ' / ' + DEMO_WAVES.length : '');
    Game.announce(title, this.waveName, this.mode === 'duel' ? '#ff6a7a' : this.bossWave ? '#4af0ff' : '#ff3a52', 2.2);
    Sound.play('waveStart');
    Sound.setIntensity(1);
    Game.resetProps();
  },
  alive() {
    let n = 0;
    for (const e of Game.enemies) if (!e.dead) n++;
    return n;
  },
  remaining() { return this.queue.length + this.alive(); },
  update(dt) {
    if (this.state === 'intro' || this.state === 'break') {
      this.breakT -= dt;
      if (this.breakT <= 0) {
        if (this.wave >= this.lastWave()) { this.state = 'done'; Game.victory(); return; }
        this.nextWave();
      }
    } else if (this.state === 'fight') {
      this.spawnT -= dt;
      const alive = this.alive();
      if (this.queue.length && alive < S.enemies.maxAlive && this.spawnT <= 0) {
        this.spawn(this.queue.shift());
        this.spawnT = rand(0.35, 0.95) / Math.sqrt(S.enemies.aggression);
      }
      if (!this.queue.length && alive === 0) this.clear();
    }
  },
  clear() {
    Sound.play('waveClear');
    Sound.setIntensity(0.35);
    const bonus = 250 * this.wave;
    Game.addScore(bonus);
    Game.stats.wave = this.wave;
    Game.player.heal(15);
    if (this.mode === 'endless' && this.wave > SaveData.bestWave) { SaveData.bestWave = this.wave; saveProgress(); }
    const last = this.wave >= this.lastWave();
    const done = this.mode === 'duel' ? 'DUEL WON' : this.mode === 'boss' ? 'RIVAL DEFEATED' : 'DEMO CLEAR';
    Game.announce(last ? done : 'WAVE CLEAR', '+' + bonus + ' PTS', '#7dff8a', 1.8);
    this.state = 'break';
    this.breakT = last ? 2 : S.enemies.waveBreak;
  },
  spawnRival() {
    const p = Game.player;
    const x = Level.freeGroundX(clamp(p.x < Level.W / 2 ? p.x + 300 : p.x - 300, 120, Level.W - 120), 12);
    const r = new Rival(x, Level.GROUND, this.scale);
    if (this.mode === 'duel') r.startDuel();
    Game.enemies.push(r);
    Sound.play('spawn');
  },
  spawn(type) {
    const p = Game.player;
    let pts;
    if (type === 'drone') {
      pts = [];
      for (let i = 0; i < 12; i++) {
        const x = clamp(p.x + (chance(0.5) ? -1 : 1) * rand(150, 320), 70, Level.W - 70);
        pts.push({ x, y: Math.min(rand(140, 250), Level.groundBelow(x, 0) - 30) });
      }
    } else if (type === 'brute') pts = Level.spawnGround.slice();
    else pts = Level.spawnGround.concat(Level.spawnHigh);
    let ok = pts.filter((q) => { const d = Math.abs(q.x - p.x); return d > 130 && d < 480; });
    if (!ok.length) ok = pts.filter((q) => dist(q.x, q.y, p.x, p.y) > 90);
    if (!ok.length) ok = pts;
    const q = pick(ok);
    const e = new Enemy(type, q.x + rand(-6, 6), q.y, this.scale);
    Game.enemies.push(e);
    if (Math.abs(q.x - p.x) < 320) Sound.play('spawn');
  },
};

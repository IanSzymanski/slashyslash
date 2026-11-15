'use strict';
// Read-only logic probes for the November 2026 combat audit.
// Run from any directory with: node <repo>/docs/audit-combat-probes.cjs
// Presentation hooks are no-ops; combat methods are the repository implementations.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const repo = path.resolve(__dirname, '..');
const noop = () => {};
const context = vm.createContext({
  console,
  setTimeout,
  clearTimeout,
  FX: new Proxy({}, { get: () => noop }),
  Sound: new Proxy({}, { get: () => noop }),
  Game: {
    player: { x: 0 },
    mode: 'demo',
    has: () => false,
    cineActive: () => false,
    shake: noop,
    hitstop: noop,
    styleHit: noop,
    stats: { damageTaken: 0 },
  },
  Input: { wasPressed: (action) => action === 'sheathe', isDown: () => true },
});
for (const file of ['util.js', 'settings.js', 'enemies.js', 'player.js']) {
  vm.runInContext(fs.readFileSync(path.join(repo, 'js', file), 'utf8'), context, { filename: file });
}
const results = vm.runInContext(`(() => {
  const damageSlider = [0, 1, 3].map(value => {
    S.enemies.damage = value;
    const p = new Player(0, 100);
    Game.player = p;
    const enemy = new Enemy('scrapper', 20, 100);
    const computedDamage = enemy.dmg();
    const outcome = p.takeHit({ dmg: computedDamage, x: 20, y: 90, kind: 'melee' });
    return { setting: value, computedDamage, outcome, remainingShield: p.shield, remainingHP: p.hp };
  });
  const p = new Player(0, 100);
  Game.player = p;
  p.onGround = true;
  p.attack = { heavy: true, t: 0, act1: 0.21 };
  const committedBeforeParry = p.committed();
  p.updateSheathe(1 / 120);
  const cancelCommitment = { committedBeforeParry, attackAfterParry: p.attack,
    stanceActive: Boolean(p.sheathe), remainingShield: p.shield };
  const healer = new Player(0, 100);
  healer.hp = 10;
  healer.counterHeal(3);
  for (let i = 0; i < 5; i++) healer.counterHeal(1);
  const counterHeal = { startingHP: 10, directKills: 3, chainKills: 5,
    finalHP: healer.hp, restoredHP: healer.hp - 10 };
  return { damageSlider, cancelCommitment, counterHeal };
})()`, context);
process.stdout.write(JSON.stringify(results, null, 2) + '\n');

#!/usr/bin/env node
// Headless smoke test: boots the game, plays both modes with random input, and fails on any page error.
// Needs Playwright with Chromium:  npm i -D playwright && npx playwright install chromium
// Usage: node tools/smoke-test.js [seconds-of-simulated-play]
'use strict';
const path = require('path');
const { chromium } = require('playwright');

const seconds = Number(process.argv[2] || 90);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.stack || e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await page.waitForTimeout(500);

  for (const mode of ['demo', 'endless', 'boss']) {
    await page.click({ demo: '#btn-demo', endless: '#btn-endless', boss: '#btn-boss' }[mode]);
    const res = await page.evaluate(([frames, mode]) => {
      const problems = [];
      S.gameplay.invincible = true;
      S.enemies.waveBreak = 1;
      const codes = ['KeyA', 'KeyD', 'KeyW', 'KeyS', 'ShiftLeft', 'Mouse0', 'KeyE', 'Mouse2', 'KeyR'];
      for (let f = 0; f < frames; f++) {
        for (const c of codes) {
          const held = Input.down.has(c);
          if (!held && Math.random() < (c === 'Mouse0' ? 0.12 : 0.04)) { Input.down.add(c); Input.pressed.add(c); }
          else if (held && Math.random() < 0.12) { Input.down.delete(c); Input.released.add(c); }
        }
        if (Math.random() < 0.05) { Input.mx = Math.random() * 480; Input.my = Math.random() * 270; }
        if (f % 1800 === 0) Game.player.ultCharge = 1;
        // in the rival fight, force the phase change and the knockout so both cutscenes run under random input
        const rival = Game.enemies.find((e) => e.isBoss && !e.dying);
        if (mode === 'boss' && rival && !rival.spawning) {
          if (f === Math.floor(frames / 3)) rival.hp = Math.floor(rival.maxHp / 2);
          if (f === Math.floor((frames * 2) / 3) && rival.phase === 2 && !Game.cine) {
            rival.transT = 0; rival.guardT = 0; rival.parryInvulnT = 0; rival.dashT = 0; rival.dodgeT = 0; rival.hp = 1;
            hurtEnemy(rival, 5, { cause: 'slash' });
          }
        }
        // aim at grenades now and then so grabbing and throwing them gets exercised
        const m = Game.projectiles.find((q) => q.tetherable && !q.dead);
        if (m && Math.random() < 0.3) { Input.mx = m.x - Game.cam.x; Input.my = m.y - Game.cam.y; }
        Game.realTime += 1 / 60;
        Game.step(1 / 60);
        if (f % 3 === 0) Render.draw(1 / 60);
        const p = Game.player;
        if (!isFinite(p.x) || !isFinite(p.y) || p.x < 0 || p.x > Level.W || p.y > Level.H + 50) problems.push(`player out of bounds at frame ${f}: ${p.x},${p.y}`);
        if (problems.length) break;
      }
      const boss = Game.enemies.find((e) => e.isBoss);
      const husk = Game.props.some((q) => q instanceof RivalHusk);
      return { problems, wave: Director.wave, kills: Game.stats.kills, boss: boss ? `${boss.hp}/${boss.maxHp} phase ${boss.phase} shield ${boss.shield}` : husk ? 'knocked out' : 'none' };
    }, [seconds * 60, mode]);
    console.log(`${mode}: wave ${res.wave}, ${res.kills} kills, rival ${res.boss}`);
    errors.push(...res.problems);
    await page.evaluate(() => Game.toMenu());
  }
  await browser.close();
  if (errors.length) {
    console.error('FAILED\n' + errors.join('\n'));
    process.exit(1);
  }
  console.log('OK');
})();

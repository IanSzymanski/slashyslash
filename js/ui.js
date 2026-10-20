'use strict';
// DOM overlays: main menu, pause, results, how-to-play and the settings panel.

const UI = {
  tab: 'enemies',
  returnTo: 'menu',

  init() {
    this.root = document.getElementById('ui');
    this.panels = {};
    for (const el of this.root.querySelectorAll('.overlay')) this.panels[el.id] = el;
    this.root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      Sound.init();
      Sound.play('ui');
      this.act(b.dataset.act, b);
    });
    this.root.addEventListener('mouseover', (e) => {
      const b = e.target.closest('button');
      if (b && b !== this._hover) { this._hover = b; Sound.play('uiHover'); }
    });
    for (const b of document.querySelectorAll('#settings .tabs button')) {
      b.addEventListener('click', () => { this.tab = b.dataset.tab; this.renderSettings(); });
    }
    try { const t = safeStorageGet('slashyslash.tab'); if (t && SETTINGS_SCHEMA[t]) this.tab = t; } catch (e) { /* ignore */ }
    this.refreshBest();
  },
  show(id) {
    if (!id && document.activeElement && document.activeElement.blur) document.activeElement.blur();
    for (const k in this.panels) this.panels[k].hidden = k !== id;
    document.body.classList.toggle('in-menu', !!id);
    if (id === 'howto') this.renderHowTo();
    if (id === 'settings') this.renderSettings();
    const first = id && this.panels[id].querySelector('button');
    if (first) first.focus({ preventScroll: true });
  },
  hideAll() { this.show(null); },
  openPanel() { return Object.keys(this.panels).find((k) => !this.panels[k].hidden) || null; },
  act(a, el) {
    switch (a) {
      case 'demo': Game.newRun('demo'); break;
      case 'endless': Game.newRun('endless'); break;
      case 'boss': Game.newRun('boss'); break;
      case 'resume': Game.resume(); break;
      case 'restart': Game.newRun(Game.mode); break;
      case 'continue-endless': Game.newRun('endless'); break;
      case 'quit': Game.toMenu(); break;
      case 'settings': this.returnTo = Game.state === 'menu' ? 'menu' : Game.state === 'over' ? 'over' : 'pause'; this.show('settings'); break;
      case 'howto': this.returnTo = Game.state === 'menu' ? 'menu' : 'pause'; this.show('howto'); break;
      case 'back': this.show(this.returnTo); break;
      case 'reset-tab':
        if (this.tab === 'enemies') { resetSettings('enemies'); resetSettings('gameplay'); }
        else resetSettings(this.tab === 'audio' ? 'audio' : this.tab);
        Sound.applyVolumes(); Render.resize(); this.applyVisualToggles();
        this.renderSettings();
        break;
    }
  },
  refreshBest() {
    const el = document.getElementById('best');
    if (el) el.textContent = `Best endless: wave ${SaveData.bestWave} · ${SaveData.bestScore.toLocaleString()} pts${SaveData.demoCleared ? ' · Demo cleared' : ''}${SaveData.unlocks.aegis ? ' · AEGIS-07 unlocked' : ''}`;
  },
  applyVisualToggles() {
    document.getElementById('scanlines').hidden = !S.visuals.scanlines;
  },

  // ---------- results ----------
  showOver(victory) {
    const st = Game.stats;
    const boss = Game.mode === 'boss';
    document.getElementById('over-title').textContent = victory ? (boss ? 'Rival defeated' : 'Demo complete') : 'Signal lost';
    let sub;
    if (victory) sub = boss ? 'AEGIS-07 is down and unlocked for a future character roster.' : 'All demo waves cleared, rival included. AEGIS-07 is unlocked for a future character roster.';
    else if (boss) sub = 'AEGIS-07 holds the street. Break its shield with its own pulse grenade.';
    else if (Game.mode === 'endless') sub = `You held the street until wave ${Director.wave}.`;
    else sub = Director.wave === 0 ? 'Down before the first wave.' : `Down on wave ${Director.wave} of ${DEMO_WAVES.length}.`;
    document.getElementById('over-sub').textContent = sub;
    const mm = Math.floor(st.time / 60), ss = Math.floor(st.time % 60).toString().padStart(2, '0');
    const rows = [
      ['Wave', Director.wave], ['Kills', st.kills], ['Score', st.score.toLocaleString()],
      ['Best combo', st.maxCombo], ['Parries', st.parries], ['Time', `${mm}:${ss}`],
    ];
    document.getElementById('over-stats').innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    document.getElementById('over-continue').hidden = !victory;
    this.refreshBest();
    this.show('over');
  },

  // ---------- how to play ----------
  renderHowTo() {
    const rows = [
      ['Move', `${actionLabel('left')} · ${actionLabel('right')}`],
      ['Jump / double jump / wall jump', actionLabel('jump')],
      ['Crouch · slide while running', actionLabel('crouch')],
      ['Bullet jump (toward cursor)', `${actionLabel('crouch')} + ${actionLabel('jump')}`],
      ['Drop through platform', `Hold ${actionLabel('crouch')}`],
      ['Dash (2 charges, invulnerable)', `${actionLabel('dash')} + direction`],
      ['Dash slash', `${actionLabel('attack')} during a dash`],
      ['Slash combo (3 hits, aim with mouse)', actionLabel('attack')],
      ['Ground cut with rubble spray', `${actionLabel('attack')} while sliding`],
      ['Plunge + shockwave (in the air)', `Hold ${actionLabel('crouch')} + ${actionLabel('attack')}`],
      ['Parry stance (15 shield, refunded on parry)', actionLabel('sheathe')],
      ['Counter after a parry', `Release ${actionLabel('sheathe')}`],
      ['Tether: tap fling, hold zip', actionLabel('tether')],
      ['Grab, swing and throw barrels or grenades', `Hold ${actionLabel('tether')}, release`],
      ['Sawblade ultimate (when charged)', `Hold ${actionLabel('ultimate')} 1s`],
      ['Pause', actionLabel('pause')],
    ];
    document.getElementById('howto-table').innerHTML = rows.map(([a, k]) => `<tr><td>${a}</td><td><kbd>${k}</kbd></td></tr>`).join('');
  },

  // ---------- settings ----------
  fmt(v, f) {
    if (f === 'x') return v.toFixed(2) + 'x';
    if (f === '%') return Math.round(v * 100) + '%';
    if (f === 's') return v.toFixed(1) + 's';
    if (f === 'ms') return Math.round(v * 1000) + ' ms';
    return String(Math.round(v));
  },
  renderSettings() {
    for (const b of document.querySelectorAll('#settings .tabs button')) b.classList.toggle('on', b.dataset.tab === this.tab);
    safeStorageSet('slashyslash.tab', this.tab);
    const body = document.getElementById('settings-body');
    body.innerHTML = '';
    for (const item of SETTINGS_SCHEMA[this.tab]) body.appendChild(this.renderItem(item));
  },
  renderItem(item) {
    const id = item.key ? 'set-' + item.key.replace(/\./g, '-') : '';
    if (item.type === 'heading') {
      const h = document.createElement('h3'); h.textContent = item.label; return h;
    }
    if (item.type === 'range') {
      const row = document.createElement('div'); row.className = 'row';
      const v = getPath(S, item.key);
      row.innerHTML = `<label for="${id}">${item.label}</label><input type="range" id="${id}" min="${item.min}" max="${item.max}" step="${item.step}" value="${v}"><output>${this.fmt(v, item.fmt)}</output>`;
      const input = row.querySelector('input'), out = row.querySelector('output');
      input.addEventListener('input', () => {
        const val = parseFloat(input.value);
        setPath(S, item.key, val);
        out.textContent = this.fmt(val, item.fmt);
        if (item.custom && S.enemies.preset !== 'custom') { S.enemies.preset = 'custom'; this.syncPreset(); }
        if (item.key.startsWith('audio.')) Sound.applyVolumes();
        saveSettings();
      });
      return row;
    }
    if (item.type === 'toggle') {
      const row = document.createElement('div'); row.className = 'row toggle';
      const v = getPath(S, item.key);
      row.innerHTML = `<label for="${id}">${item.label}</label><input type="checkbox" class="switch" id="${id}" ${v ? 'checked' : ''}>`;
      const input = row.querySelector('input');
      input.addEventListener('change', () => {
        setPath(S, item.key, input.checked);
        if (item.key === 'visuals.integerScale') Render.resize();
        if (item.key === 'visuals.scanlines') this.applyVisualToggles();
        if (item.key === 'audio.muteOnBlur') Sound.setFocus(document.hasFocus());
        saveSettings();
      });
      return row;
    }
    if (item.type === 'preset') {
      const row = document.createElement('div'); row.className = 'row preset';
      row.innerHTML = `<label>${item.label}</label><div class="seg" role="group"></div>`;
      const seg = row.querySelector('.seg');
      for (const o of item.options) {
        const b = document.createElement('button');
        b.type = 'button'; b.textContent = o; b.dataset.preset = o; b.id = 'preset-' + o;
        if (o === 'custom') b.disabled = true;
        b.addEventListener('click', () => { Sound.play('ui'); applyPreset(o); this.renderSettings(); });
        seg.appendChild(b);
      }
      setTimeout(() => this.syncPreset(), 0);
      return row;
    }
    if (item.type === 'bindings') {
      const wrap = document.createElement('div'); wrap.className = 'binds';
      wrap.innerHTML = '<p class="hint">Click a slot, then press a key or mouse button. Esc cancels, Backspace clears.</p>';
      const table = document.createElement('table');
      for (const a of ACTIONS) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${a.label}</td>`;
        for (let i = 0; i < 2; i++) {
          const td = document.createElement('td');
          const b = document.createElement('button');
          b.type = 'button'; b.className = 'key'; b.id = `bind-${a.id}-${i}`;
          b.textContent = codeLabel(S.controls.bindings[a.id][i]);
          b.addEventListener('click', (ev) => {
            ev.stopPropagation();
            b.textContent = 'Press…'; b.classList.add('listening');
            setTimeout(() => Input.capture((code) => {
              b.classList.remove('listening');
              if (code !== 'Escape' || a.id === 'pause') {
                if (code) for (const other of ACTIONS) {
                  const arr = S.controls.bindings[other.id];
                  for (let j = 0; j < 2; j++) if (arr[j] === code && !(other.id === a.id && j === i)) arr[j] = '';
                }
                S.controls.bindings[a.id][i] = code;
                saveSettings();
              }
              this.renderSettings();
            }), 0);
          });
          td.appendChild(b); tr.appendChild(td);
        }
        table.appendChild(tr);
      }
      wrap.appendChild(table);
      return wrap;
    }
    if (item.type === 'test-sound') {
      const row = document.createElement('div'); row.className = 'row';
      row.innerHTML = '<label>Preview</label><div class="seg"><button type="button" id="test-slash">Slash</button><button type="button" id="test-parry">Parry</button><button type="button" id="test-boom">Shockwave</button></div>';
      row.querySelector('#test-slash').addEventListener('click', () => { Sound.init(); Sound.play('swing', { stage: 3 }); });
      row.querySelector('#test-parry').addEventListener('click', () => { Sound.init(); Sound.play('parry'); });
      row.querySelector('#test-boom').addEventListener('click', () => { Sound.init(); Sound.play('shockwave', { power: 1 }); });
      return row;
    }
    return document.createElement('div');
  },
  syncPreset() {
    for (const b of document.querySelectorAll('[data-preset]')) b.classList.toggle('on', b.dataset.preset === S.enemies.preset);
  },
};

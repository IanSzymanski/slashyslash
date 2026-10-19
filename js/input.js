'use strict';
// Keyboard + mouse state with rebindable actions. Codes are KeyboardEvent.code or "Mouse<n>".

const Input = {
  down: new Set(),
  pressed: new Set(),
  released: new Set(),
  mx: VIEW_W / 2,
  my: VIEW_H / 2,
  onCanvas: false,
  captureCb: null,
  canvas: null,
  gameKeysActive: () => false,

  init(canvas) {
    this.canvas = canvas;
    const press = (code) => {
      if (!this.down.has(code)) this.pressed.add(code);
      this.down.add(code);
    };
    const release = (code) => {
      if (this.down.has(code)) this.released.add(code);
      this.down.delete(code);
    };
    window.addEventListener('keydown', (e) => {
      if (this.captureCb) {
        e.preventDefault();
        e.stopImmediatePropagation();
        const cb = this.captureCb; this.captureCb = null;
        cb(e.code === 'Backspace' || e.code === 'Delete' ? '' : e.code);
        return;
      }
      if (e.repeat) { if (this.gameKeysActive() && this.isGameCode(e.code)) e.preventDefault(); return; }
      press(e.code);
      if (this.gameKeysActive() && this.isGameCode(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => release(e.code));
    window.addEventListener('blur', () => this.clear());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.clear(); });

    const updatePos = (e) => {
      const r = canvas.getBoundingClientRect();
      this.mx = ((e.clientX - r.left) / r.width) * VIEW_W;
      this.my = ((e.clientY - r.top) / r.height) * VIEW_H;
    };
    window.addEventListener('mousemove', updatePos);
    canvas.addEventListener('mouseenter', () => (this.onCanvas = true));
    canvas.addEventListener('mouseleave', () => (this.onCanvas = false));
    window.addEventListener('mousedown', (e) => {
      if (this.captureCb) {
        e.preventDefault();
        e.stopImmediatePropagation();
        const cb = this.captureCb; this.captureCb = null;
        cb('Mouse' + e.button);
        return;
      }
      if (e.target !== canvas) return;
      updatePos(e);
      press('Mouse' + e.button);
      e.preventDefault();
    });
    window.addEventListener('mouseup', (e) => release('Mouse' + e.button));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('contextmenu', (e) => { if (this.captureCb || this.gameKeysActive()) e.preventDefault(); });
  },

  isGameCode(code) {
    const b = S.controls.bindings;
    for (const k in b) if (b[k].includes(code)) return true;
    return code === 'Space' || code.startsWith('Arrow');
  },
  codes(action) { return S.controls.bindings[action] || []; },
  isDown(action) { for (const c of this.codes(action)) if (c && this.down.has(c)) return true; return false; },
  wasPressed(action) { for (const c of this.codes(action)) if (c && this.pressed.has(c)) return true; return false; },
  wasReleased(action) { for (const c of this.codes(action)) if (c && this.released.has(c)) return true; return false; },
  consume() { this.pressed.clear(); this.released.clear(); },
  clear() {
    for (const c of this.down) this.released.add(c);
    this.down.clear();
  },
  capture(cb) { this.captureCb = cb; },
};

function codeLabel(code) {
  if (!code) return '—';
  if (code === 'Mouse0') return 'LMB';
  if (code === 'Mouse1') return 'MMB';
  if (code === 'Mouse2') return 'RMB';
  if (code.startsWith('Mouse')) return 'M' + code.slice(5);
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Arrow')) return { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓' }[code];
  const map = { ShiftLeft: 'L-Shift', ShiftRight: 'R-Shift', ControlLeft: 'L-Ctrl', ControlRight: 'R-Ctrl', AltLeft: 'L-Alt', AltRight: 'R-Alt', Space: 'Space', Escape: 'Esc', Tab: 'Tab', Enter: 'Enter', CapsLock: 'Caps' };
  return map[code] || code;
}
// Primary binding in a form the 3x5 HUD font can draw.
function hudKey(action) {
  const c = (S.controls.bindings[action] || [])[0];
  if (!c) return '-';
  const arrows = { ArrowLeft: 'LEFT', ArrowRight: 'RIGHT', ArrowUp: 'UP', ArrowDown: 'DOWN' };
  return (arrows[c] || codeLabel(c)).toUpperCase();
}
function actionLabel(action) {
  const b = S.controls.bindings[action] || [];
  return b.filter(Boolean).map(codeLabel).join(' / ') || '—';
}

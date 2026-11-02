const KEY_MAP = {
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  KeyW: 'jump',
  ArrowUp: 'jump',
  Space: 'jump',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyN: 'nextZone',
  KeyP: 'prevZone',
  ShiftLeft: 'dash',
  ShiftRight: 'dash',
  KeyJ: 'attack',
  KeyK: 'heavy',
  KeyL: 'special',
  KeyE: 'interact',
  Escape: 'pause',
  F3: 'debug',
  Digit1: 'card1',
  Digit2: 'card2',
  Digit3: 'card3',
  Enter: 'confirm',
};

const PREVENT_DEFAULT = new Set([
  'Space',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'F3',
]);

export class Input {
  constructor(target = window) {
    this.target = target;
    this.down = new Set();
    this.pressed = new Set();
    this.released = new Set();
    this.enabled = true;
    this.onFirstGesture = null;
    this._firstGestureFired = false;

    this._keydown = (event) => this.handleKeyDown(event);
    this._keyup = (event) => this.handleKeyUp(event);
    this._blur = () => this.clear();
    this._gesture = () => {
      if (this._firstGestureFired) return;
      this._firstGestureFired = true;
      this.onFirstGesture?.();
    };

    target.addEventListener('keydown', this._keydown);
    target.addEventListener('keyup', this._keyup);
    target.addEventListener('blur', this._blur);
    target.addEventListener('pointerdown', this._gesture);
    target.addEventListener('keydown', this._gesture, { once: false });
  }

  handleKeyDown(event) {
    const el = event.target;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
    if (PREVENT_DEFAULT.has(event.code)) event.preventDefault();
    const action = KEY_MAP[event.code];
    if (!action) return;
    if (!this.down.has(action)) this.pressed.add(action);
    this.down.add(action);
    this.onFirstGesture?.();
  }

  handleKeyUp(event) {
    const action = KEY_MAP[event.code];
    if (!action) return;
    this.down.delete(action);
    this.released.add(action);
  }

  isDown(action) {
    return this.enabled && this.down.has(action);
  }

  wasPressed(action) {
    return this.enabled && this.pressed.has(action);
  }

  wasReleased(action) {
    return this.enabled && this.released.has(action);
  }

  getAxis() {
    let axis = 0;
    if (this.isDown('left')) axis -= 1;
    if (this.isDown('right')) axis += 1;
    return axis;
  }

  consume(action) {
    this.pressed.delete(action);
  }

  clearPressed() {
    this.pressed.clear();
    this.released.clear();
  }

  clear() {
    this.down.clear();
    this.pressed.clear();
    this.released.clear();
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) this.clear();
  }

  destroy() {
    this.target.removeEventListener('keydown', this._keydown);
    this.target.removeEventListener('keyup', this._keyup);
    this.target.removeEventListener('blur', this._blur);
    this.target.removeEventListener('pointerdown', this._gesture);
  }
}

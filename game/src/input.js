// Keyboard and mouse input. WASD or arrows move, Shift sneaks, P pauses,
// M mutes, R restarts, Enter confirms. Clicking the floor sets a move target
// the player walks to (pathfinding lives in world.js).

import { TILE } from './config.js';

export const ACTION_CONFIRM = 'confirm';
export const ACTION_PAUSE = 'pause';
export const ACTION_RESTART = 'restart';
export const ACTION_MUTE = 'mute';
export const ACTION_SNEAK = 'sneak';

const KEY_ACTIONS = {
  Enter: ACTION_CONFIRM,
  ' ': ACTION_CONFIRM,
  p: ACTION_PAUSE,
  P: ACTION_PAUSE,
  Escape: ACTION_PAUSE,
  r: ACTION_RESTART,
  R: ACTION_RESTART,
  m: ACTION_MUTE,
  M: ACTION_MUTE,
};

const MOVE_KEYS = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  w: [0, -1],
  s: [0, 1],
  a: [-1, 0],
  d: [1, 0],
  W: [0, -1],
  S: [0, 1],
  A: [-1, 0],
  D: [1, 0],
};

export function createInput(canvas, onClickMove) {
  const pressed = new Set();
  const queuedActions = [];
  let clickTarget = null;

  function keyDown(event) {
    if (MOVE_KEYS[event.key] || KEY_ACTIONS[event.key] || event.key === 'Shift') {
      event.preventDefault();
    }
    if (event.repeat) return;
    pressed.add(event.key);
    const action = KEY_ACTIONS[event.key];
    if (action) queuedActions.push(action);
  }

  function keyUp(event) {
    pressed.delete(event.key);
  }

  function blur() {
    pressed.clear();
  }

  function mouseDown(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    clickTarget = { x, y };
    if (onClickMove) onClickMove({ x, y });
  }

  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  window.addEventListener('blur', blur);
  canvas.addEventListener('mousedown', mouseDown);

  return {
    /** Normalised movement direction from held keys, or null. */
    moveDirection() {
      let x = 0;
      let y = 0;
      for (const key of pressed) {
        const dir = MOVE_KEYS[key];
        if (dir) {
          x += dir[0];
          y += dir[1];
        }
      }
      if (x === 0 && y === 0) return null;
      const length = Math.hypot(x, y);
      return { x: x / length, y: y / length };
    },
    sneaking() {
      return pressed.has('Shift');
    },
    /** Actions pressed since the last poll, in order. */
    takeActions() {
      const actions = queuedActions.slice();
      queuedActions.length = 0;
      return actions;
    },
    /** The last clicked floor point, in canvas pixels, or null. */
    takeClickTarget() {
      const target = clickTarget;
      clickTarget = null;
      return target;
    },
    /** Convert a canvas pixel point to tile coordinates. */
    tileOf(point) {
      return { x: Math.floor(point.x / TILE), y: Math.floor(point.y / TILE) };
    },
  };
}

// The screenshot scenes behind ?shot=start|play|end. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a
// simple autopilot, so the frame is what a short game really looks like and
// the same seed always gives the same frame.

import { SHOT_END_LIMIT_SECONDS, SHOT_PLAY_SECONDS, SHOT_START_SECONDS, STEP, TILE } from './config.js';
import { findPath, loadLevel, STATUS_CAUGHT, STATUS_CLEAR, STATUS_WIN, step } from './world.js';
import { SCREEN_CAUGHT, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const SAMPLE = STEP;

/** Find the nearest bush tile to a pixel point. */
function nearestBush(world, x, y) {
  let best = null;
  let bestDist = Infinity;
  for (const key of world.level.bushes) {
    const [tx, ty] = key.split(',').map(Number);
    const bx = (tx + 0.5) * TILE;
    const by = (ty + 0.5) * TILE;
    const dist = Math.hypot(bx - x, by - y);
    if (dist < bestDist) {
      bestDist = dist;
      best = { x: tx, y: ty };
    }
  }
  return best;
}

/**
 * An input stub that steers the player: careful mode sneaks to the nearest
 * bush when a guard grows suspicious and otherwise walks to the exit;
 * reckless mode always walks straight for the exit.
 */
function makeAutopilot(world, mode) {
  let path = null;
  let pathIndex = 0;
  let repathTimer = 0;

  function threatened() {
    return world.guards.some((guard) => guard.meter > 0.25 || guard.state === 'alert');
  }

  function targetTile() {
    if (mode === 'careful' && threatened()) {
      const bush = nearestBush(world, world.player.x, world.player.y);
      if (bush) return bush;
    }
    return world.level.exit;
  }

  return {
    moveDirection() {
      repathTimer -= SAMPLE;
      const target = targetTile();
      if (repathTimer <= 0 || !path) {
        repathTimer = 0.5;
        path = findPath(world, world.player, target);
        pathIndex = 0;
      }
      if (!path || pathIndex >= path.length) return null;
      const node = path[pathIndex];
      const tx = (node.x + 0.5) * TILE;
      const ty = (node.y + 0.5) * TILE;
      const dx = tx - world.player.x;
      const dy = ty - world.player.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 6) {
        pathIndex += 1;
        return null;
      }
      return { x: dx / dist, y: dy / dist };
    },
    sneaking() {
      return mode === 'careful' && threatened();
    },
    takeClickTarget() {
      return null;
    },
    takeActions() {
      return [];
    },
  };
}

/** An input stub that stands still: the title-screen scene. */
const IDLE_INPUT = {
  moveDirection: () => null,
  sneaking: () => false,
  takeClickTarget: () => null,
  takeActions: () => [],
};

/**
 * Set `world` to the named scene (start, play or end; any other name is start)
 * and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  if (name !== 'play' && name !== 'end') {
    loadLevel(world, 0);
    for (let index = 0; index < SHOT_START_SECONDS / SAMPLE; index += 1) {
      step(world, SAMPLE, IDLE_INPUT);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }

  if (name === 'play') {
    loadLevel(world, 0);
    const pilot = makeAutopilot(world, 'careful');
    for (let index = 0; index < SHOT_PLAY_SECONDS / SAMPLE; index += 1) {
      if (world.status !== 'playing') break;
      step(world, SAMPLE, pilot);
    }
    if (world.status === STATUS_CLEAR) loadLevel(world, 1);
    return { screen: SCREEN_PLAY, best: world.score };
  }

  // end: a reckless run straight for the exit until a guard catches the thief.
  loadLevel(world, 0);
  const reckless = makeAutopilot(world, 'reckless');
  let caught = false;
  for (let index = 0; index < SHOT_END_LIMIT_SECONDS / SAMPLE; index += 1) {
    if (world.status === STATUS_CAUGHT) {
      caught = true;
      break;
    }
    if (world.status === STATUS_CLEAR) {
      loadLevel(world, world.levelIndex + 1);
      continue;
    }
    if (world.status === STATUS_WIN) break;
    step(world, SAMPLE, reckless);
  }
  if (!caught) {
    // Force the caught screen: drop the thief in front of an alerted guard
    // and stand still while it closes in.
    const guard = world.guards[0];
    world.player.x = guard.x + 30;
    world.player.y = guard.y;
    world.player.path = null;
    guard.meter = 1;
    guard.state = 'alert';
    guard.lastSeen = { x: world.player.x, y: world.player.y };
    for (let index = 0; index < 600; index += 1) {
      step(world, SAMPLE, IDLE_INPUT);
      if (world.status === STATUS_CAUGHT) break;
    }
  }
  return { screen: SCREEN_CAUGHT, best: world.score };
}

// The world: level state, fixed-step simulation, wall collision, line of
// sight, grid pathfinding, loot and the exit. The player and guard modules
// drive their own updates; this file owns the shared rules between them.

import {
  COLS,
  LEVEL_SCORE,
  LOOT_SCORE,
  PAR_TIME_SECONDS,
  ROWS,
  STEP,
  TILE,
  TIME_BONUS_PER_SECOND,
  WALK_NOISE_RADIUS,
} from './config.js';
import { LEVELS } from './levels.js';
import { createGuard, GUARD_PATROL, GUARD_RETURN, GUARD_SUSPICIOUS, updateGuard } from './guards.js';
import { createPlayer, noiseRadius, updatePlayer } from './player.js';
import { playAlarm, playCaught, playLevelClear, playPickup, playWin } from './audio.js';

export const EVENT_PICKUP = 1;
export const EVENT_ALARM = 2;
export const EVENT_CAUGHT = 4;
export const EVENT_CLEAR = 8;
export const EVENT_WIN = 16;

export const STATUS_PLAYING = 'playing';
export const STATUS_CAUGHT = 'caught';
export const STATUS_CLEAR = 'clear';
export const STATUS_WIN = 'win';

export function createWorld(random) {
  const world = {
    random,
    levelIndex: 0,
    level: null,
    player: null,
    guards: [],
    loot: [],
    score: 0,
    levelTime: 0,
    status: STATUS_PLAYING,
    statusTimer: 0,
  };
  loadLevel(world, 0);
  return world;
}

/** (Re)build the world for a level: fresh player, guards, loot and timer. */
export function loadLevel(world, index) {
  world.levelIndex = index;
  world.level = LEVELS[index];
  world.player = createPlayer(world.level.playerStart);
  world.guards = world.level.guards.map((def) => createGuard(def.waypoints));
  world.loot = world.level.loot.map((item) => ({ ...item, taken: false }));
  world.levelTime = 0;
  world.status = STATUS_PLAYING;
  world.statusTimer = 0;
}

export function isWallTile(world, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return true;
  return world.level.walls.has(`${tx},${ty}`);
}

export function isBushTile(world, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return false;
  return world.level.bushes.has(`${tx},${ty}`);
}

export function tileOfPoint(point) {
  return { x: Math.floor(point.x / TILE), y: Math.floor(point.y / TILE) };
}

/** True when no wall stands between two pixel points. */
export function lineOfSight(world, x0, y0, x1, y1) {
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.ceil(dist / 4));
  for (let i = 1; i < steps; i += 1) {
    const x = x0 + ((x1 - x0) * i) / steps;
    const y = y0 + ((y1 - y0) * i) / steps;
    if (isWallTile(world, Math.floor(x / TILE), Math.floor(y / TILE))) return false;
  }
  return true;
}

/** Move a circle, sliding along walls: x first, then y. */
export function moveCircle(world, entity, dx, dy, radius) {
  const blocked = (x, y) => {
    const minTx = Math.floor((x - radius) / TILE);
    const maxTx = Math.floor((x + radius) / TILE);
    const minTy = Math.floor((y - radius) / TILE);
    const maxTy = Math.floor((y + radius) / TILE);
    for (let ty = minTy; ty <= maxTy; ty += 1) {
      for (let tx = minTx; tx <= maxTx; tx += 1) {
        if (!isWallTile(world, tx, ty)) continue;
        const closestX = Math.max(tx * TILE, Math.min(x, (tx + 1) * TILE));
        const closestY = Math.max(ty * TILE, Math.min(y, (ty + 1) * TILE));
        if (Math.hypot(x - closestX, y - closestY) < radius) return true;
      }
    }
    return false;
  };
  if (dx !== 0 && !blocked(entity.x + dx, entity.y)) entity.x += dx;
  if (dy !== 0 && !blocked(entity.x, entity.y + dy)) entity.y += dy;
}

/** Breadth-first path over floor tiles; null when the target cannot be reached. */
export function findPath(world, from, toTile) {
  const start = tileOfPoint(from);
  if (start.x === toTile.x && start.y === toTile.y) return [];
  if (isWallTile(world, toTile.x, toTile.y)) return null;
  const key = (x, y) => `${x},${y}`;
  const cameFrom = new Map();
  const queue = [start];
  cameFrom.set(key(start.x, start.y), null);
  while (queue.length > 0) {
    const current = queue.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      if (isWallTile(world, nx, ny) || cameFrom.has(key(nx, ny))) continue;
      cameFrom.set(key(nx, ny), current);
      if (nx === toTile.x && ny === toTile.y) {
        const path = [{ x: nx, y: ny }];
        let node = current;
        while (node && !(node.x === start.x && node.y === start.y)) {
          path.unshift(node);
          node = cameFrom.get(key(node.x, node.y));
        }
        return path;
      }
      queue.push({ x: nx, y: ny });
    }
  }
  return null;
}

/** A helper object the player and guard modules call back into. */
function worldApi(world) {
  return {
    level: world.level,
    player: world.player,
    guards: world.guards,
    isWallTile: (tx, ty) => isWallTile(world, tx, ty),
    isBushTile: (tx, ty) => isBushTile(world, tx, ty),
    tileOf: (point) => tileOfPoint(point),
    lineOfSight: (x0, y0, x1, y1) => lineOfSight(world, x0, y0, x1, y1),
    findPath: (from, toTile) => findPath(world, from, toTile),
    moveCircle: (entity, dx, dy, radius) => moveCircle(world, entity, dx, dy, radius),
  };
}

/** Advance the world one fixed step. Returns a bitmask of events. */
export function step(world, dt, input) {
  if (world.status !== STATUS_PLAYING) return 0;
  let events = 0;
  const api = worldApi(world);
  world.levelTime += dt;

  const madeNoise = updatePlayer(world.player, dt, input, api);
  if (madeNoise) {
    const radius = noiseRadius(world.player);
    for (const guard of world.guards) {
      const dist = Math.hypot(guard.x - world.player.x, guard.y - world.player.y);
      if (dist < radius + WALK_NOISE_RADIUS * 0.4) {
        guard.lastSeen = { x: world.player.x, y: world.player.y };
        if (guard.state === GUARD_PATROL || guard.state === GUARD_RETURN) {
          guard.state = GUARD_SUSPICIOUS;
          guard.stateTimer = 0;
          guard.meter = Math.max(guard.meter, 0.5);
        }
      }
    }
  }

  for (const guard of world.guards) {
    const result = updateGuard(guard, dt, api);
    if (result === 'alarm') {
      events |= EVENT_ALARM;
      playAlarm();
    }
    if (result === 'caught') {
      events |= EVENT_CAUGHT;
      world.status = STATUS_CAUGHT;
      world.statusTimer = 0;
      playCaught();
      return events;
    }
  }

  for (const item of world.loot) {
    if (item.taken) continue;
    const dx = (item.x + 0.5) * TILE - world.player.x;
    const dy = (item.y + 0.5) * TILE - world.player.y;
    if (Math.hypot(dx, dy) < 28) {
      item.taken = true;
      world.score += LOOT_SCORE;
      events |= EVENT_PICKUP;
      playPickup();
    }
  }

  const playerTile = tileOfPoint(world.player);
  if (playerTile.x === world.level.exit.x && playerTile.y === world.level.exit.y) {
    const timeBonus = Math.max(0, Math.round((PAR_TIME_SECONDS - world.levelTime) * TIME_BONUS_PER_SECOND));
    world.score += LEVEL_SCORE + timeBonus;
    if (world.levelIndex + 1 >= LEVELS.length) {
      world.status = STATUS_WIN;
      events |= EVENT_WIN;
      playWin();
    } else {
      world.status = STATUS_CLEAR;
      events |= EVENT_CLEAR;
      playLevelClear();
    }
    world.statusTimer = 0;
  }
  return events;
}

/** How much loot this level holds, and how much the player has taken. */
export function lootProgress(world) {
  const taken = world.loot.filter((item) => item.taken).length;
  return { taken, total: world.loot.length };
}

/** The highest guard alert level right now: 0 calm, 1 suspicious, 2 alarm. */
export function highestAlert(world) {
  let level = 0;
  for (const guard of world.guards) {
    if (guard.state === 'alert') return 2;
    if (guard.state === 'suspicious' || guard.state === 'search' || guard.meter >= 0.4) level = 1;
  }
  return level;
}

export { STEP };

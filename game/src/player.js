// The player: a thief in a teal coat. Walks with WASD/arrows or toward a
// clicked floor point (pathfinding), sneaks with Shift (slow, silent, harder
// to spot), and makes noise while walking that nearby guards can hear.

import { PLAYER_RADIUS, PLAYER_SNEAK_SPEED, PLAYER_WALK_SPEED, TILE, WALK_NOISE_RADIUS } from './config.js';
import { playFootstep } from './audio.js';

const STEP_INTERVAL = 0.34;

export function createPlayer(startTile) {
  return {
    x: (startTile.x + 0.5) * TILE,
    y: (startTile.y + 0.5) * TILE,
    angle: -Math.PI / 2,
    sneaking: false,
    moving: false,
    path: null,
    pathIndex: 0,
    stepTimer: 0,
    noiseTimer: 0,
  };
}

/**
 * Move the player one step. Returns true when a walking footstep made noise
 * this step, so the world can let nearby guards hear it.
 */
export function updatePlayer(player, dt, input, world) {
  const keys = input.moveDirection();
  player.sneaking = input.sneaking();
  let dir = keys;

  // A click sets a path; any key press cancels it.
  const click = input.takeClickTarget();
  if (click) {
    const tile = input.tileOf(click);
    if (!world.isWallTile(tile.x, tile.y)) {
      player.path = world.findPath(player, tile);
      player.pathIndex = 0;
    }
  }
  if (keys) player.path = null;

  if (!dir && player.path) {
    const node = player.path[player.pathIndex];
    if (!node) {
      player.path = null;
    } else {
      const targetX = (node.x + 0.5) * TILE;
      const targetY = (node.y + 0.5) * TILE;
      const dx = targetX - player.x;
      const dy = targetY - player.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 6) {
        player.pathIndex += 1;
      } else {
        dir = { x: dx / dist, y: dy / dist };
      }
    }
  }

  player.moving = dir !== null;
  if (!dir) return false;

  const speed = player.sneaking ? PLAYER_SNEAK_SPEED : PLAYER_WALK_SPEED;
  player.angle = Math.atan2(dir.y, dir.x);
  world.moveCircle(player, dir.x * speed * dt, dir.y * speed * dt, PLAYER_RADIUS);

  // Footsteps: a soft tick, and a noise pulse guards can hear while walking.
  player.stepTimer -= dt;
  if (player.stepTimer <= 0) {
    player.stepTimer = STEP_INTERVAL;
    const nearGuard = world.guards.some(
      (guard) => Math.hypot(guard.x - player.x, guard.y - player.y) < 220,
    );
    playFootstep(nearGuard);
  }
  if (player.sneaking) return false;
  player.noiseTimer -= dt;
  if (player.noiseTimer <= 0) {
    player.noiseTimer = 0.5;
    return true;
  }
  return false;
}

/** Distance from the player to the nearest guard, for the footstep volume. */
export function nearestGuardDistance(player, guards) {
  let best = Infinity;
  for (const guard of guards) {
    best = Math.min(best, Math.hypot(guard.x - player.x, guard.y - player.y));
  }
  return best;
}

/** Whether the player stands inside a bush (hidden unless a guard is close). */
export function playerHidden(player, world) {
  return world.isBushTile(Math.floor(player.x / TILE), Math.floor(player.y / TILE));
}

/** Whether the player stands in a lamp's light (easier to spot). */
export function playerLit(player, world) {
  for (const lamp of world.level.lamps) {
    const lx = (lamp.x + 0.5) * TILE;
    const ly = (lamp.y + 0.5) * TILE;
    if (Math.hypot(lx - player.x, ly - player.y) < 3.2 * TILE) return true;
  }
  return false;
}

/** Walking noise radius right now: zero while sneaking. */
export function noiseRadius(player) {
  return player.sneaking ? 0 : WALK_NOISE_RADIUS;
}

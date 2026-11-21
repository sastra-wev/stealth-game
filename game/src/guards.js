// Guards: night watchmen with vision cones. Each one patrols a loop of
// waypoints, and its state machine runs patrol -> suspicious -> alert (chase)
// -> search -> return. A guard sees the player only inside its cone, inside
// its range, with a clear line of sight; bushes, darkness and sneaking slow
// its detection meter, and a full meter raises the alarm.

import {
  CHASE_LOST_SECONDS,
  DETECT_BASE_RATE,
  DETECT_BUSH_CLOSE_RANGE,
  DETECT_BUSH_FACTOR,
  DETECT_DECAY_RATE,
  DETECT_FAR_RATE,
  DETECT_LAMP_FACTOR,
  DETECT_SNEAK_FACTOR,
  GUARD_CHASE_SPEED,
  GUARD_PATROL_SPEED,
  GUARD_RADIUS,
  GUARD_SUSPICIOUS_SPEED,
  GUARD_VIEW_HALF_ANGLE,
  GUARD_VIEW_RANGE,
  SEARCH_SECONDS,
  SUSPICIOUS_THRESHOLD,
  TILE,
} from './config.js';
import { playerHidden, playerLit } from './player.js';

export const GUARD_PATROL = 'patrol';
export const GUARD_SUSPICIOUS = 'suspicious';
export const GUARD_ALERT = 'alert';
export const GUARD_SEARCH = 'search';
export const GUARD_RETURN = 'return';

const SUSPICIOUS_PAUSE = 1.2;
const REPATH_INTERVAL = 0.4;

export function createGuard(rawWaypoints) {
  // Waypoints arrive as [x, y] tile pairs; normalise them to {x, y} objects.
  const waypoints = rawWaypoints.map(([x, y]) => ({ x, y }));
  const start = waypoints[0];
  return {
    x: (start.x + 0.5) * TILE,
    y: (start.y + 0.5) * TILE,
    angle: 0,
    waypointIndex: 1 % waypoints.length,
    waypoints,
    state: GUARD_PATROL,
    meter: 0,
    lastSeen: null,
    lostTimer: 0,
    stateTimer: 0,
    path: null,
    pathIndex: 0,
    repathTimer: 0,
    alarmed: false,
  };
}

/** Angle difference wrapped to [-PI, PI]. */
function angleDelta(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** How fast this guard's detection meter fills right now (0 when it cannot see). */
function detectionRate(guard, player, world) {
  const dx = player.x - guard.x;
  const dy = player.y - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist > GUARD_VIEW_RANGE) return 0;
  const toPlayer = Math.atan2(dy, dx);
  if (Math.abs(angleDelta(toPlayer, guard.angle)) > GUARD_VIEW_HALF_ANGLE) return 0;
  if (!world.lineOfSight(guard.x, guard.y, player.x, player.y)) return 0;
  const hidden = playerHidden(player, world);
  if (hidden && dist > DETECT_BUSH_CLOSE_RANGE) return 0;
  const closeness = 1 - dist / GUARD_VIEW_RANGE;
  let rate = DETECT_FAR_RATE + (DETECT_BASE_RATE - DETECT_FAR_RATE) * closeness;
  if (player.sneaking) rate *= DETECT_SNEAK_FACTOR;
  if (hidden) rate *= DETECT_BUSH_FACTOR;
  if (playerLit(player, world)) rate *= DETECT_LAMP_FACTOR;
  return rate;
}

/** Walk along the guard's current path at `speed`; true when the path is done. */
function followPath(guard, dt, speed, world) {
  const node = guard.path ? guard.path[guard.pathIndex] : null;
  if (!node) return true;
  const targetX = (node.x + 0.5) * TILE;
  const targetY = (node.y + 0.5) * TILE;
  const dx = targetX - guard.x;
  const dy = targetY - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 6) {
    guard.pathIndex += 1;
    return guard.pathIndex >= guard.path.length;
  }
  const step = Math.min(dist, speed * dt);
  const nx = guard.x + (dx / dist) * step;
  const ny = guard.y + (dy / dist) * step;
  guard.angle = Math.atan2(dy, dx);
  world.moveCircle(guard, nx - guard.x, ny - guard.y, GUARD_RADIUS);
  return false;
}

/** Set a fresh path to a tile, or null when it cannot be reached. */
function setPathTo(guard, tile, world) {
  guard.path = world.findPath(guard, tile);
  guard.pathIndex = 0;
  return guard.path !== null;
}

/**
 * One guard, one step. Returns 'alarm' the moment this guard's meter fills,
 * 'caught' when it touches the player, or null.
 */
export function updateGuard(guard, dt, world) {
  const player = world.player;
  const rate = detectionRate(guard, player, world);
  const seesPlayer = rate > 0;
  if (seesPlayer) {
    guard.meter = Math.min(1, guard.meter + rate * dt);
    guard.lastSeen = { x: player.x, y: player.y };
    guard.lostTimer = 0;
  } else {
    guard.meter = Math.max(0, guard.meter - DETECT_DECAY_RATE * dt);
    guard.lostTimer += dt;
  }

  if (guard.meter >= 1 && guard.state !== GUARD_ALERT) {
    guard.state = GUARD_ALERT;
    guard.stateTimer = 0;
    guard.path = null;
    if (!guard.alarmed) {
      guard.alarmed = true;
      return 'alarm';
    }
  }

  switch (guard.state) {
    case GUARD_PATROL: {
      if (guard.meter >= SUSPICIOUS_THRESHOLD) {
        guard.state = GUARD_SUSPICIOUS;
        guard.stateTimer = 0;
        break;
      }
      if (!guard.path) {
        const target = guard.waypoints[guard.waypointIndex];
        setPathTo(guard, target, world);
      }
      if (followPath(guard, dt, GUARD_PATROL_SPEED, world)) {
        guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
        guard.path = null;
      }
      break;
    }
    case GUARD_SUSPICIOUS: {
      // Stop, turn toward the player, and stare for a moment.
      if (guard.lastSeen) {
        const want = Math.atan2(guard.lastSeen.y - guard.y, guard.lastSeen.x - guard.x);
        guard.angle += Math.max(-3 * dt, Math.min(3 * dt, angleDelta(want, guard.angle)));
      }
      guard.stateTimer += dt;
      if (guard.meter < 0.15) {
        guard.state = GUARD_PATROL;
        guard.path = null;
      } else if (guard.stateTimer >= SUSPICIOUS_PAUSE) {
        guard.state = GUARD_SEARCH;
        guard.stateTimer = 0;
        setPathTo(guard, world.tileOf(guard.lastSeen), world);
      }
      break;
    }
    case GUARD_ALERT: {
      guard.repathTimer -= dt;
      if (guard.repathTimer <= 0) {
        guard.repathTimer = REPATH_INTERVAL;
        setPathTo(guard, world.tileOf(player), world);
      }
      followPath(guard, dt, GUARD_CHASE_SPEED, world);
      const dist = Math.hypot(player.x - guard.x, player.y - guard.y);
      if (dist < GUARD_RADIUS + 13) return 'caught';
      if (!seesPlayer && guard.lostTimer >= CHASE_LOST_SECONDS) {
        guard.state = GUARD_SEARCH;
        guard.stateTimer = 0;
        guard.alarmed = false;
        setPathTo(guard, world.tileOf(guard.lastSeen), world);
      }
      break;
    }
    case GUARD_SEARCH: {
      if (guard.meter >= SUSPICIOUS_THRESHOLD && seesPlayer) {
        guard.state = GUARD_SUSPICIOUS;
        guard.stateTimer = 0;
        break;
      }
      if (!guard.path) {
        guard.stateTimer += dt;
        // Look around at the last seen spot before giving up.
        guard.angle += dt * 1.6;
        if (guard.stateTimer >= SEARCH_SECONDS) {
          guard.state = GUARD_RETURN;
          guard.path = null;
        }
      } else if (followPath(guard, dt, GUARD_SUSPICIOUS_SPEED, world)) {
        guard.path = null;
        guard.stateTimer = 0;
      }
      break;
    }
    case GUARD_RETURN: {
      if (guard.meter >= SUSPICIOUS_THRESHOLD) {
        guard.state = GUARD_SUSPICIOUS;
        guard.stateTimer = 0;
        break;
      }
      if (!guard.path) {
        // Head for the nearest waypoint, then resume the patrol.
        let best = 0;
        let bestDist = Infinity;
        guard.waypoints.forEach((point, index) => {
          const d = Math.hypot((point.x + 0.5) * TILE - guard.x, (point.y + 0.5) * TILE - guard.y);
          if (d < bestDist) {
            bestDist = d;
            best = index;
          }
        });
        guard.waypointIndex = best;
        setPathTo(guard, guard.waypoints[best], world);
      }
      if (followPath(guard, dt, GUARD_PATROL_SPEED, world)) {
        guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
        guard.state = GUARD_PATROL;
        guard.path = null;
      }
      break;
    }
    default:
      break;
  }
  return null;
}

/** The guard's current alert level, for the HUD: 0 calm, 1 suspicious, 2 alarm. */
export function guardAlertLevel(guard) {
  if (guard.state === GUARD_ALERT) return 2;
  if (guard.state === GUARD_SUSPICIOUS || guard.state === GUARD_SEARCH) return 1;
  if (guard.meter >= SUSPICIOUS_THRESHOLD) return 1;
  return 0;
}

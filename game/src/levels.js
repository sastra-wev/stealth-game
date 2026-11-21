// The three levels of Silent Vault. Each level is a small museum wing drawn on a
// 32 x 18 tile grid: wall blocks, bush patches to hide in, lamps that make you
// easier to spot, loot to grab, guard patrol loops, a player start and an exit.
// Coordinates are tiles; the border walls are always solid.

import { COLS, ROWS } from './config.js';

/** Fill a rectangle of tiles into a set of "x,y" keys. */
function paintRect(into, x, y, w, h) {
  for (let ty = y; ty < y + h; ty += 1) {
    for (let tx = x; tx < x + w; tx += 1) into.add(`${tx},${ty}`);
  }
}

function buildLevel(def) {
  const walls = new Set();
  const bushes = new Set();
  for (let x = 0; x < COLS; x += 1) {
    walls.add(`${x},0`);
    walls.add(`${x},${ROWS - 1}`);
  }
  for (let y = 0; y < ROWS; y += 1) {
    walls.add(`0,${y}`);
    walls.add(`${COLS - 1},${y}`);
  }
  for (const rect of def.walls) paintRect(walls, ...rect);
  for (const rect of def.bushes) paintRect(bushes, ...rect);
  return {
    name: def.name,
    intro: def.intro,
    walls,
    bushes,
    lamps: def.lamps.map(([x, y]) => ({ x, y })),
    loot: def.loot.map(([x, y]) => ({ x, y, taken: false })),
    guards: def.guards.map((waypoints) => ({ waypoints })),
    playerStart: { x: def.player[0], y: def.player[1] },
    exit: { x: def.exit[0], y: def.exit[1] },
  };
}

export const LEVELS = [
  buildLevel({
    name: 'Level 1 — The Gallery',
    intro: 'Slip past the night guards. Grab the relics, reach the green exit.',
    walls: [[8, 3, 2, 5], [15, 9, 2, 5], [22, 3, 2, 5], [24, 11, 5, 1]],
    bushes: [[4, 8, 3, 2], [18, 4, 2, 2], [27, 13, 3, 2], [12, 14, 2, 2]],
    lamps: [[6, 2], [16, 6], [26, 8], [10, 15]],
    loot: [[5, 3], [28, 6], [12, 15], [20, 15]],
    guards: [
      [[5, 4], [13, 4], [13, 10], [5, 10]],
      [[24, 4], [29, 4], [29, 14], [24, 14]],
    ],
    player: [2, 15],
    exit: [29, 2],
  }),
  buildLevel({
    name: 'Level 2 — The Vault Hall',
    intro: 'Three guards now, and the hall is brighter. Bushes are your friends.',
    walls: [[6, 2, 2, 6], [12, 10, 2, 5], [19, 2, 2, 6], [25, 10, 2, 5], [10, 5, 8, 1]],
    bushes: [[3, 12, 3, 2], [16, 13, 3, 2], [28, 3, 2, 2], [21, 7, 2, 2]],
    lamps: [[4, 4], [14, 8], [24, 4], [28, 14], [9, 15]],
    loot: [[3, 3], [15, 3], [29, 8], [8, 15], [22, 15]],
    guards: [
      [[4, 6], [10, 6], [10, 14], [4, 14]],
      [[15, 4], [23, 4], [23, 12], [15, 12]],
      [[26, 6], [30, 6], [30, 15], [26, 15]],
    ],
    player: [2, 15],
    exit: [29, 2],
  }),
  buildLevel({
    name: 'Level 3 — The Director’s Wing',
    intro: 'Four guards, tight patrols, one way out. Stay in the dark, move slow.',
    walls: [[5, 3, 2, 4], [11, 11, 2, 5], [17, 3, 2, 4], [23, 11, 2, 5], [8, 7, 4, 1], [20, 7, 4, 1], [14, 13, 4, 1]],
    bushes: [[3, 8, 2, 2], [15, 8, 2, 2], [27, 5, 2, 2], [9, 14, 2, 2], [24, 15, 2, 2]],
    lamps: [[4, 3], [12, 5], [20, 4], [28, 9], [7, 15], [16, 15]],
    loot: [[3, 3], [10, 3], [21, 3], [29, 7], [6, 15], [26, 15]],
    guards: [
      [[3, 5], [9, 5], [9, 12], [3, 12]],
      [[13, 4], [19, 4], [19, 10], [13, 10]],
      [[22, 4], [29, 4], [29, 12], [22, 12]],
      [[12, 14], [18, 14], [18, 16], [12, 16]],
    ],
    player: [2, 15],
    exit: [29, 2],
  }),
];

// The renderer: everything the player sees, painted on one canvas. A dark
// museum at night — warm floor tiles, lamp pools, green bushes to hide in,
// guards in red with raycast vision cones that hug the walls, a teal thief,
// a glowing green exit, and a HUD bar on top. Screens: title, play, paused,
// caught, level clear and win.

import {
  COLS,
  GUARD_VIEW_HALF_ANGLE,
  GUARD_VIEW_RANGE,
  ROWS,
  TILE,
  VIEW_H,
  VIEW_W,
} from './config.js';
import { guardAlertLevel } from './guards.js';
import { lootProgress } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_CLEAR = 'clear';
export const SCREEN_WIN = 'win';

const CONE_RAYS = 26;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  /** Deterministic shade variation for a floor tile. */
  function tileShade(x, y) {
    const hash = (x * 73856093) ^ (y * 19349663);
    return (hash >>> 0) % 3;
  }

  function drawFloor(world) {
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        const shade = tileShade(x, y);
        ctx.fillStyle = shade === 0 ? '#232838' : shade === 1 ? '#252b3d' : '#20242f';
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      }
    }
  }

  function drawLamps(world) {
    for (const lamp of world.level.lamps) {
      const cx = (lamp.x + 0.5) * TILE;
      const cy = (lamp.y + 0.5) * TILE;
      const gradient = ctx.createRadialGradient(cx, cy, 8, cx, cy, 3.2 * TILE);
      gradient.addColorStop(0, 'rgba(255, 196, 110, 0.20)');
      gradient.addColorStop(1, 'rgba(255, 196, 110, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(cx - 3.2 * TILE, cy - 3.2 * TILE, 6.4 * TILE, 6.4 * TILE);
      ctx.fillStyle = '#ffd98a';
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawBushes(world) {
    for (const key of world.level.bushes) {
      const [x, y] = key.split(',').map(Number);
      const cx = x * TILE;
      const cy = y * TILE;
      ctx.fillStyle = '#1d4023';
      ctx.fillRect(cx, cy, TILE, TILE);
      ctx.fillStyle = '#2a5a30';
      for (let i = 0; i < 5; i += 1) {
        const ox = ((x * 31 + y * 17 + i * 13) % 28) + 6;
        const oy = ((x * 11 + y * 29 + i * 7) % 28) + 6;
        ctx.beginPath();
        ctx.arc(cx + ox, cy + oy, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawWalls(world) {
    for (const key of world.level.walls) {
      const [x, y] = key.split(',').map(Number);
      ctx.fillStyle = '#3a4157';
      ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      ctx.fillStyle = '#4a5470';
      ctx.fillRect(x * TILE, y * TILE, TILE, 5);
      ctx.fillStyle = '#2c3247';
      ctx.fillRect(x * TILE, y * TILE + TILE - 4, TILE, 4);
    }
  }

  function drawExit(world, time) {
    const ex = world.level.exit;
    const cx = (ex.x + 0.5) * TILE;
    const cy = (ex.y + 0.5) * TILE;
    const pulse = 0.5 + 0.5 * Math.sin(time * 3);
    ctx.fillStyle = `rgba(64, 224, 130, ${0.16 + 0.1 * pulse})`;
    ctx.fillRect(ex.x * TILE, ex.y * TILE, TILE, TILE);
    ctx.strokeStyle = '#40e082';
    ctx.lineWidth = 3;
    ctx.strokeRect(ex.x * TILE + 3, ex.y * TILE + 3, TILE - 6, TILE - 6);
    ctx.fillStyle = '#40e082';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('EXIT', cx, cy + 5);
  }

  function drawLoot(world, time) {
    for (const item of world.loot) {
      if (item.taken) continue;
      const cx = (item.x + 0.5) * TILE;
      const cy = (item.y + 0.5) * TILE + Math.sin(time * 2 + item.x) * 3;
      ctx.fillStyle = '#ffd34d';
      ctx.beginPath();
      ctx.moveTo(cx, cy - 9);
      ctx.lineTo(cx + 7, cy);
      ctx.lineTo(cx, cy + 9);
      ctx.lineTo(cx - 7, cy);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fff3c4';
      ctx.beginPath();
      ctx.moveTo(cx, cy - 9);
      ctx.lineTo(cx + 7, cy);
      ctx.lineTo(cx, cy);
      ctx.closePath();
      ctx.fill();
    }
  }

  /** A vision cone clipped by walls: rays march out until they hit one. */
  function conePolygon(guard) {
    const points = [{ x: guard.x, y: guard.y }];
    for (let i = 0; i <= CONE_RAYS; i += 1) {
      const angle = guard.angle - GUARD_VIEW_HALF_ANGLE + (2 * GUARD_VIEW_HALF_ANGLE * i) / CONE_RAYS;
      let range = GUARD_VIEW_RANGE;
      for (let d = 8; d <= GUARD_VIEW_RANGE; d += 8) {
        const x = guard.x + Math.cos(angle) * d;
        const y = guard.y + Math.sin(angle) * d;
        if (world_isWall(x, y)) {
          range = d;
          break;
        }
      }
      points.push({ x: guard.x + Math.cos(angle) * range, y: guard.y + Math.sin(angle) * range });
    }
    return points;
  }

  // Set by draw() before cones are painted.
  let world_isWall = () => false;

  function drawCones(world) {
    for (const guard of world.guards) {
      const level = guardAlertLevel(guard);
      const polygon = conePolygon(guard);
      ctx.beginPath();
      ctx.moveTo(polygon[0].x, polygon[0].y);
      for (let i = 1; i < polygon.length; i += 1) ctx.lineTo(polygon[i].x, polygon[i].y);
      ctx.closePath();
      ctx.fillStyle =
        level === 2
          ? 'rgba(255, 70, 70, 0.30)'
          : level === 1
            ? 'rgba(255, 190, 80, 0.30)'
            : 'rgba(255, 214, 110, 0.20)';
      ctx.fill();
    }
  }

  function drawGuards(world) {
    for (const guard of world.guards) {
      const level = guardAlertLevel(guard);
      ctx.fillStyle = level === 2 ? '#c0392b' : '#a93226';
      ctx.beginPath();
      ctx.arc(guard.x, guard.y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e8b4a0';
      ctx.beginPath();
      ctx.arc(guard.x, guard.y, 7, 0, Math.PI * 2);
      ctx.fill();
      // A small torch dot showing which way the guard faces.
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath();
      ctx.arc(guard.x + Math.cos(guard.angle) * 17, guard.y + Math.sin(guard.angle) * 17, 3, 0, Math.PI * 2);
      ctx.fill();
      // Detection meter and state mark above the head.
      if (guard.meter > 0.05) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(guard.x - 16, guard.y - 30, 32, 6);
        ctx.fillStyle = guard.meter >= 1 ? '#ff4646' : '#ffbe50';
        ctx.fillRect(guard.x - 15, guard.y - 29, 30 * guard.meter, 4);
      }
      if (level === 2) {
        ctx.fillStyle = '#ff4646';
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('!', guard.x, guard.y - 34);
      } else if (level === 1) {
        ctx.fillStyle = '#ffbe50';
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('?', guard.x, guard.y - 34);
      }
    }
  }

  function drawPlayer(world, time) {
    const player = world.player;
    if (player.sneaking) {
      ctx.strokeStyle = 'rgba(120, 220, 255, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(player.x, player.y, 20, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Walking noise ring, fading with each step.
    if (player.moving && !player.sneaking) {
      const phase = 1 - player.stepTimer / 0.34;
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.25 * (1 - phase)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(player.x, player.y, 18 + phase * 60, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = '#2ec4b6';
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.sneaking ? 11 : 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e6fffa';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#0f2a28';
    ctx.beginPath();
    ctx.arc(player.x + Math.cos(player.angle) * 6, player.y + Math.sin(player.angle) * 6, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawHud(world, screen, best, time) {
    const progress = lootProgress(world);
    ctx.fillStyle = 'rgba(8, 10, 18, 0.78)';
    ctx.fillRect(0, 0, VIEW_W, 34);
    ctx.fillStyle = '#e8ecf4';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(world.level.name, 12, 22);
    ctx.textAlign = 'center';
    ctx.fillText(`Relics ${progress.taken}/${progress.total}`, VIEW_W / 2 - 90, 22);
    ctx.fillText(`Score ${world.score}`, VIEW_W / 2 + 60, 22);
    ctx.fillText(`Time ${Math.floor(world.levelTime)}s`, VIEW_W / 2 + 190, 22);
    ctx.textAlign = 'right';
    ctx.fillText(`Best ${best}`, VIEW_W - 12, 22);
    // Alert word: calm, suspicious or alarm.
    let alert = 'CALM';
    let color = '#7fd8a4';
    for (const guard of world.guards) {
      if (guardAlertLevel(guard) === 2) {
        alert = 'ALARM!';
        color = '#ff5a5a';
        break;
      }
      if (guardAlertLevel(guard) === 1) {
        alert = 'SUSPICIOUS';
        color = '#ffbe50';
      }
    }
    ctx.fillStyle = color;
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(alert, VIEW_W - 190, 22);
  }

  function dimOverlay(alpha) {
    ctx.fillStyle = `rgba(5, 6, 12, ${alpha})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  function centerPanel(title, lines, accent) {
    ctx.fillStyle = 'rgba(10, 12, 22, 0.88)';
    const width = 640;
    const height = 120 + lines.length * 30;
    ctx.fillRect((VIEW_W - width) / 2, (VIEW_H - height) / 2, width, height);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.strokeRect((VIEW_W - width) / 2, (VIEW_H - height) / 2, width, height);
    ctx.fillStyle = accent;
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, VIEW_W / 2, (VIEW_H - height) / 2 + 58);
    ctx.fillStyle = '#e8ecf4';
    ctx.font = '16px sans-serif';
    lines.forEach((line, index) => {
      ctx.fillText(line, VIEW_W / 2, (VIEW_H - height) / 2 + 100 + index * 30);
    });
  }

  function draw(world, screen, best, time) {
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    world_isWall = (x, y) =>
      world.level.walls.has(`${Math.floor(x / TILE)},${Math.floor(y / TILE)}`);
    drawFloor(world);
    drawLamps(world);
    drawBushes(world);
    drawWalls(world);
    drawExit(world, time);
    drawLoot(world, time);
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawCones(world);
    drawGuards(world);
    if (screen !== SCREEN_TITLE) drawPlayer(world, time);
    drawHud(world, screen, best, time);

    if (screen === SCREEN_TITLE) {
      dimOverlay(0.55);
      centerPanel('SILENT VAULT', [
        'A top-down stealth game. Steal the relics, reach the green exit unseen.',
        'Move: WASD / arrows or click a floor tile — Shift: sneak — P: pause — M: mute',
        'Guards see inside their cones. Bushes hide you. Lamps give you away.',
        world.level.intro,
        'Press Enter or click to start',
      ], '#2ec4b6');
    } else if (screen === SCREEN_PAUSED) {
      dimOverlay(0.5);
      centerPanel('PAUSED', ['Press P or Enter to keep sneaking.'], '#ffbe50');
    } else if (screen === SCREEN_CAUGHT) {
      dimOverlay(0.55);
      centerPanel('CAUGHT!', [
        `The guards caught you on ${world.level.name}.`,
        `Score ${world.score} — Best ${best}`,
        'Press R or Enter to try again',
      ], '#ff5a5a');
    } else if (screen === SCREEN_CLEAR) {
      dimOverlay(0.45);
      centerPanel('LEVEL CLEAR', [
        `${world.level.name} cleared. The vault door opens to the next wing.`,
        `Score ${world.score} — Best ${best}`,
        'Press Enter for the next level',
      ], '#40e082');
    } else if (screen === SCREEN_WIN) {
      dimOverlay(0.5);
      centerPanel('THE VAULT IS YOURS', [
        'Every wing cleared, every guard outwitted. A clean getaway.',
        `Final score ${world.score} — Best ${best}`,
        'Press R or Enter to play again',
      ], '#ffd34d');
    }
  }

  return { draw };
}

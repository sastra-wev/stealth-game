# Silent Vault

[![Make the best stealth game](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)
[![Rank](https://make.fun/badge/best-stealth-game-20261121-1759/sastra-wev/stealth-game/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)
[![Reward](https://make.fun/badge/best-stealth-game-20261121-1759/sastra-wev/stealth-game/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)

A top-down stealth game for the [make.fun best stealth game bounty](https://make.fun/bounty/best-stealth-game-20261121-1759). You are a thief in the night museum: slip past the guards, steal the golden relics, and reach the green exit unseen.

## How to play

- **Move:** WASD / arrow keys, or click a floor tile to walk there
- **Sneak:** hold Shift — slower, silent, and much harder for guards to spot
- **Pause:** P — **Mute:** M — **Restart:** R — **Start / confirm:** Enter or click

Guards patrol with vision cones. Step inside a cone and their detection meter fills — close, lit, or walking fills it fast; far, sneaking, or hidden in a bush fills it slowly. A full meter raises the alarm and the guard chases you. Break line of sight and they search your last seen spot, then return to patrol. Walking makes noise nearby guards can hear; sneaking is silent.

Three wings to clear — The Gallery, The Vault Hall, and The Director's Wing — with more guards, tighter patrols, and more relics each time. Loot is optional but scores; finishing a wing fast scores a time bonus.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

The game is plain static files under `game/` with no build step and no network requests. All graphics are drawn in code on a canvas; all sound is synthesised with WebAudio.

## Layout

- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`
- `game/index.html` — the page that loads the game
- `game/src/config.js` — every tuned number in one place
- `game/src/levels.js` — the three wings: walls, bushes, lamps, loot, patrols
- `game/src/world.js` — simulation, collision, line of sight, pathfinding, loot and exit
- `game/src/guards.js` — guard vision and the patrol / suspicious / alert / search / return state machine
- `game/src/player.js` — movement, sneaking, noise and hiding
- `game/src/render.js` — canvas drawing: floor, cones, guards, HUD and screens
- `game/src/input.js` — keyboard and mouse
- `game/src/audio.js` — synthesised footsteps, pickups, alarms and fanfares
- `game/src/shots.js` — the staged screenshot scenes (`?shot=start|play|end`)
- `game/src/random.js` — seeded random generator
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged
- `screenshots/` — real renders of the game's own code

## License

MIT — see `LICENSE`.

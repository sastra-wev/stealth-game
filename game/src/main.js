// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between six screens: title,
// play, paused, caught, level clear and win.
//
// ?seed=N fixes the random seed. ?shot=start|play|end (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  createWorld,
  EVENT_ALARM,
  EVENT_CAUGHT,
  EVENT_CLEAR,
  EVENT_PICKUP,
  EVENT_WIN,
  loadLevel,
  lootProgress,
  STATUS_CAUGHT,
  STATUS_CLEAR,
  STATUS_PLAYING,
  STATUS_WIN,
  step,
} from './world.js';
import {
  ACTION_CONFIRM,
  ACTION_MUTE,
  ACTION_PAUSE,
  ACTION_RESTART,
  createInput,
} from './input.js';
import { setMuted } from './audio.js';
import {
  createRenderer,
  SCREEN_CAUGHT,
  SCREEN_CLEAR,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  SCREEN_WIN,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen, scene.best, world.levelTime);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let muted = false;

  // Screen readers (and anyone watching the page's text) hear the screen
  // changes, the alarm and each relic.
  function announce(message) {
    status.textContent = message;
  }

  function startLevel(index) {
    loadLevel(world, index);
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`Playing. ${world.level.name}. ${world.level.intro}`);
  }

  function startGame() {
    startLevel(0);
  }

  function handleActions() {
    for (const action of input.takeActions()) {
      if (action === ACTION_MUTE) {
        muted = !muted;
        setMuted(muted);
        announce(muted ? 'Sound off.' : 'Sound on.');
      } else if (action === ACTION_PAUSE) {
        if (screen === SCREEN_PLAY) {
          screen = SCREEN_PAUSED;
          announce('Paused.');
        } else if (screen === SCREEN_PAUSED) {
          screen = SCREEN_PLAY;
          announce('Playing.');
        }
      } else if (action === ACTION_RESTART) {
        if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED || screen === SCREEN_CAUGHT || screen === SCREEN_WIN) {
          startLevel(screen === SCREEN_WIN ? 0 : world.levelIndex);
        }
      } else if (action === ACTION_CONFIRM) {
        if (screen === SCREEN_TITLE || screen === SCREEN_WIN) startGame();
        else if (screen === SCREEN_CAUGHT) startLevel(world.levelIndex);
        else if (screen === SCREEN_CLEAR) startLevel(world.levelIndex + 1);
        else if (screen === SCREEN_PAUSED) screen = SCREEN_PLAY;
      }
    }
    // A click anywhere confirms on the menu screens.
    const clicked = input.takeClickTarget();
    if (clicked) {
      if (screen === SCREEN_TITLE || screen === SCREEN_WIN) startGame();
      else if (screen === SCREEN_CAUGHT) startLevel(world.levelIndex);
      else if (screen === SCREEN_CLEAR) startLevel(world.levelIndex + 1);
      else if (screen === SCREEN_PAUSED) screen = SCREEN_PLAY;
    }
  }

  function handleEvents(events) {
    if (events & EVENT_PICKUP) {
      const progress = lootProgress(world);
      announce(`Relic taken. ${progress.taken} of ${progress.total}. Score ${world.score}.`);
    }
    if (events & EVENT_ALARM) announce('Spotted! A guard is chasing you!');
    if (events & EVENT_CAUGHT) announce('Caught! Press Enter to try again.');
    if (events & EVENT_CLEAR) announce(`Level clear. Score ${world.score}. Press Enter for the next level.`);
    if (events & EVENT_WIN) announce(`You cleared the whole vault! Final score ${world.score}.`);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    handleActions();
    const elapsed = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    if (screen === SCREEN_PLAY) {
      accumulator += elapsed;
      while (accumulator >= STEP) {
        accumulator -= STEP;
        const events = step(world, STEP, input);
        handleEvents(events);
        if (world.status === STATUS_CAUGHT) {
          screen = SCREEN_CAUGHT;
          best = Math.max(best, world.score);
          saveBest(best);
          break;
        }
        if (world.status === STATUS_CLEAR) {
          screen = SCREEN_CLEAR;
          best = Math.max(best, world.score);
          saveBest(best);
          break;
        }
        if (world.status === STATUS_WIN) {
          screen = SCREEN_WIN;
          best = Math.max(best, world.score);
          saveBest(best);
          break;
        }
      }
    }
    renderer.draw(world, screen, best, world.levelTime);
  }

  announce('Silent Vault. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();

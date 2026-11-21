// Shared constants for Silent Vault: tile size, speeds, vision and scoring.
// One job: every number the rest of the game tunes against lives here.

export const TILE = 40;
export const COLS = 32;
export const ROWS = 18;
export const VIEW_W = COLS * TILE;
export const VIEW_H = ROWS * TILE;
export const STEP = 1 / 60;

export const BEST_KEY = 'silent-vault-best';

// Player movement (pixels per second).
export const PLAYER_WALK_SPEED = 150;
export const PLAYER_SNEAK_SPEED = 88;
export const PLAYER_RADIUS = 13;

// Noise: walking is heard this far away; sneaking is silent.
export const WALK_NOISE_RADIUS = 95;

// Guard vision: cone range, half-angle, and speeds per state.
export const GUARD_VIEW_RANGE = 225;
export const GUARD_VIEW_HALF_ANGLE = Math.PI / 5.2;
export const GUARD_PATROL_SPEED = 72;
export const GUARD_SUSPICIOUS_SPEED = 95;
export const GUARD_CHASE_SPEED = 142;
export const GUARD_RADIUS = 14;

// Detection: how fast a guard's meter fills when the player is seen.
// Close and lit fills fast; far, sneaking or dark fills slowly.
export const DETECT_BASE_RATE = 1.35;
export const DETECT_FAR_RATE = 0.3;
export const DETECT_SNEAK_FACTOR = 0.45;
export const DETECT_BUSH_FACTOR = 0.12;
export const DETECT_BUSH_CLOSE_RANGE = 78;
export const DETECT_LAMP_FACTOR = 1.35;
export const DETECT_DECAY_RATE = 0.5;
export const SUSPICIOUS_THRESHOLD = 0.4;

// Alert behaviour: how long a guard chases unseen, searches, then gives up.
export const CHASE_LOST_SECONDS = 3.0;
export const SEARCH_SECONDS = 4.5;

// Scoring.
export const LOOT_SCORE = 100;
export const LEVEL_SCORE = 500;
export const TIME_BONUS_PER_SECOND = 8;
export const PAR_TIME_SECONDS = 90;

// Screenshot staging.
export const SHOT_START_SECONDS = 5;
export const SHOT_PLAY_SECONDS = 8;
export const SHOT_END_LIMIT_SECONDS = 90;

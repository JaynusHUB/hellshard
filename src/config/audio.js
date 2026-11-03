// Packaged demo audio. All paths are relative to public/ and resolved against
// document.baseURI. The music entry is intentionally a single line so it can be
// replaced without touching AudioManager.
export const AUDIO = {
  samples: {
    attack: 'assets/cemetery/demo/assets/sounds/attack.ogg',
    hurt: 'assets/cemetery/demo/assets/sounds/hurt.ogg',
    jump: 'assets/cemetery/demo/assets/sounds/jump.ogg',
    kill: 'assets/cemetery/demo/assets/sounds/kill.ogg',
    rise: 'assets/cemetery/demo/assets/sounds/rise.ogg',
  },
  music: {
    cemetery: 'assets/cemetery/demo/assets/sounds/sci_fi_platformer04_main_loop.ogg',
  },
  bindings: {
    swing: { sample: 'attack', fallback: 'swing' },
    swingHeavy: { sample: 'attack', fallback: 'swingHeavy', pitch: 0.86 },
    playerHurt: { sample: 'hurt', fallback: 'playerHurt' },
    jump: { sample: 'jump', fallback: 'jump' },
    enemyDeath: { sample: 'kill', fallback: 'death' },
    rise: { sample: 'rise', fallback: 'ability', pitch: 0.72, volume: 0.8 },
  },
  pitchJitter: 0.05,
  gainJitter: 0.08,
};

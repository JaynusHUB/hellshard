// Zone-specific enemy death effects. The cemetery demo map's own phaser demo
// plays its 5-frame burst at 16 fps; church and swamp use their pack sheets.
export const DEATH_EFFECTS = {
  cemetery: { sprite: 'cemetery_death', animation: 'burst', fps: 16 },
  dungeon: { sprite: 'cemetery_death', animation: 'burst', fps: 16 },
  church: { sprite: 'death_burst', animation: 'burst', fps: 14 },
  swamp: { sprite: 'swamp_death', animation: 'burst', fps: 14 },
  forest: { sprite: 'cemetery_death', animation: 'burst', fps: 16, tint: [0.58, 0.9, 0.68] },
};

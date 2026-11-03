export const ANIMATION = {
  enemy: {
    idle: { fps: 0, loop: true },
    walk: { fps: 10, loop: true },
    attack: { fps: 14, loop: false },
    hurt: { fps: 10, loop: false, duration: 0.2 },
    death: { duration: 0.45 },
    spawn: { fps: 7, loop: false },
    windup: { scaleX: 0.94, scaleY: 1.08 },
    strike: { scaleX: 1.16, scaleY: 0.86 },
    hurtPose: { scaleX: 1.12, scaleY: 0.86 },
  },
  boss: {
    idleFps: 7,
    attackFps: 8,
    hurtFps: 10,
  },
};

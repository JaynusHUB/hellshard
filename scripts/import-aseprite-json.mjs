import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Imports the Aseprite frameTags in the church pack into ASSET_MANIFEST.json.
// Aseprite stores timing per frame, so each generated clip carries both the
// frame list and the per-frame durations in milliseconds. The runtime Animator
// consumes these durations for player clips; enemy clips keep their tuned fps.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST_PATH = path.join(ROOT, 'ASSET_MANIFEST.json');
const PROGRESS_PATH = path.join(ROOT, 'PROGRESS.md');
const CHECK_ONLY = process.argv.includes('--check');
const PROGRESS_START = '<!-- aseprite-import:start -->';
const PROGRESS_END = '<!-- aseprite-import:end -->';

const IMPORTS = [
  {
    sprite: 'brakk',
    json: 'assets/church/SPRITES/player/spritesheet/player.json',
    sheet: 'assets/church/SPRITES/player/spritesheet/player.png',
    clips: {
      idle: { tag: 'Idle', loop: true },
      run: { tag: 'Walk', loop: true },
      jump: { tag: 'jump', loop: false },
      fall: { tag: 'fall', loop: false },
      flyingKick: { tag: 'Flying Kick', loop: false },
      crouch: { tag: 'chrouch', loop: true },
      crouchKick: { tag: 'crouch-kick', loop: false },
      kick: { tag: 'Kick', loop: false },
      hurt: { tag: 'Hurt', loop: false },
      punch: { tag: 'Punch', loop: false },
    },
    aliases: { attack: 'punch', heavy: 'kick' },
  },
  {
    sprite: 'blight_cultist',
    json: 'assets/church/SPRITES/wizard/spritesheet/wizard.json',
    sheet: 'assets/church/SPRITES/wizard/spritesheet/wizard.png',
    clips: {
      idle: { tag: 'Idle', loop: true },
      walk: { tag: 'Idle', loop: true },
      cast: { tag: 'Fire', loop: false },
      hurt: { frames: [0], loop: false },
    },
  },
  {
    sprite: 'angel',
    json: 'assets/church/SPRITES/angel/spritesheet/angel.json',
    sheet: 'assets/church/SPRITES/angel/spritesheet/angel.png',
    clips: {
      attack: { tag: 'attack', loop: false },
      idle: { tag: 'idle', loop: true },
    },
  },
  {
    sprite: 'burning_ghoul',
    json: 'assets/church/SPRITES/burning-ghoul/spritesheet/v2/burning-ghoul.json',
    sheet: 'assets/church/SPRITES/burning-ghoul/spritesheet/v2/burning-ghoul.png',
    clips: {
      walk: { tag: 'run 1', loop: true },
      walk2: { tag: 'run 2', loop: true },
      attack: { frames: [4, 5], loop: false },
      hurt: { frames: [2], loop: false },
    },
  },
  {
    sprite: 'death_burst',
    json: 'assets/church/SPRITES/fx/enemy-death/enemy-death-spritesheet/enemy-death.json',
    sheet: 'assets/church/SPRITES/fx/enemy-death/enemy-death-spritesheet/enemy-death.png',
    clips: {
      burst: { allFrames: true, loop: false },
    },
  },
  {
    sprite: 'fireball',
    json: 'assets/church/SPRITES/fx/fireball/fireball-spritesheet/fireball.json',
    sheet: 'assets/church/SPRITES/fx/fireball/fireball-spritesheet/fireball.png',
    clips: {
      fly: { allFrames: true, loop: true },
    },
  },
];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'public', relativePath), 'utf8'));
}

function frameEntries(json) {
  return Array.isArray(json.frames) ? json.frames : Object.values(json.frames);
}

function averageFps(durations) {
  const average = durations.reduce((sum, value) => sum + value, 0) / durations.length;
  return Math.round((1000 / average) * 100) / 100;
}

function buildClip(json, spec, sheet) {
  const entries = frameEntries(json);
  let frames;
  if (spec.allFrames) frames = entries.map((_, index) => index);
  else if (spec.tag) {
    const tag = (json.meta.frameTags ?? []).find((candidate) => candidate.name === spec.tag);
    if (!tag) throw new Error(`Missing Aseprite tag ${spec.tag}`);
    frames = [];
    for (let index = tag.from; index <= tag.to; index++) frames.push(index);
  } else {
    frames = [...(spec.frames ?? [])];
  }
  const durations = frames.map((index) => Number(entries[index]?.duration ?? 100));
  const first = entries[frames[0]]?.frame;
  if (!first) throw new Error('Aseprite clip has no frames');
  return {
    sheet,
    fw: first.w,
    fh: first.h,
    frames,
    durations,
    fps: averageFps(durations),
    loop: spec.loop ?? true,
  };
}

function clipSignature(clip) {
  if (!clip) return null;
  return JSON.stringify({
    sheet: clip.sheet,
    fw: clip.fw,
    fh: clip.fh,
    frames: clip.frames,
    durations: clip.durations ?? null,
    fps: clip.fps ?? null,
    loop: clip.loop ?? null,
  });
}

function formatList(values) {
  if (!values?.length) return '—';
  if (values.length <= 8) return values.join(',');
  return `${values[0]}-${values[values.length - 1]} (${values.length})`;
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
const differences = [];
const imported = [];

for (const definition of IMPORTS) {
  const json = readJson(definition.json);
  const entries = frameEntries(json);
  const sizes = new Set(entries.map((entry) => `${entry.frame.w}x${entry.frame.h}`));
  if (sizes.size !== 1) {
    throw new Error(`${definition.json} has mixed frame sizes: ${[...sizes].join(', ')}`);
  }
  if (entries.some((entry) => entry.rotated || entry.trimmed)) {
    throw new Error(`${definition.json} contains rotated/trimmed frames; importer needs full rects`);
  }
  const sprite = manifest.sprites[definition.sprite];
  if (!sprite) throw new Error(`Manifest is missing sprite ${definition.sprite}`);
  const previous = sprite.animations ?? {};
  const next = {};
  for (const [name, spec] of Object.entries(definition.clips)) {
    next[name] = buildClip(json, spec, definition.sheet);
  }
  for (const [alias, target] of Object.entries(definition.aliases ?? {})) {
    next[alias] = { ...next[target] };
  }
  const names = new Set([...Object.keys(previous), ...Object.keys(next)]);
  for (const name of names) {
    if (clipSignature(previous[name]) === clipSignature(next[name])) continue;
    differences.push({
      sprite: definition.sprite,
      clip: name,
      oldFrames: formatList(previous[name]?.frames),
      newFrames: formatList(next[name]?.frames),
      oldFps: previous[name]?.fps ?? '—',
      newFps: next[name]?.fps ?? '—',
      oldSheet: previous[name]?.sheet?.split('/').pop() ?? '—',
      newSheet: next[name]?.sheet?.split('/').pop() ?? '—',
    });
  }
  sprite.animations = next;
  imported.push({
    sprite: definition.sprite,
    file: definition.json.split('/').pop(),
    clips: Object.keys(next).length,
  });
}

// The cemetery demo atlas is TexturePacker JSON, not Aseprite. Its frames are
// packed rectangles, and the individual PNGs used by the manifest already give
// us the same frames, so it is reported but not converted.
const atlasPath = path.join(ROOT, 'public/assets/cemetery/demo/assets/atlas/atlas.json');
let atlasNote = 'missing';
if (fs.existsSync(atlasPath)) {
  const atlas = JSON.parse(fs.readFileSync(atlasPath, 'utf8'));
  const packer = /texturepacker/i.test(atlas.meta?.app ?? '');
  atlasNote = packer
    ? `TexturePacker ${atlas.frames.length} frames (skipped: individual PNGs are already imported)`
    : 'not TexturePacker';
}

console.log('Aseprite import');
console.log('sprite          file                         clips');
for (const row of imported) {
  console.log(`${row.sprite.padEnd(16)}${row.file.padEnd(29)}${row.clips}`);
}
console.log(`cemetery atlas: ${atlasNote}`);
console.log('skipped legacy: burning-ghoul/spritesheet/v1/burning-ghoul.json');

if (differences.length) {
  console.log(`\n${differences.length} animation clip(s) differ from the hand-written manifest:`);
  console.log('sprite          clip         old frames        new frames        old fps  new fps  old sheet            new sheet');
  for (const row of differences) {
    console.log([
      row.sprite.padEnd(16),
      row.clip.padEnd(13),
      row.oldFrames.padEnd(18),
      row.newFrames.padEnd(18),
      String(row.oldFps).padEnd(9),
      String(row.newFps).padEnd(9),
      row.oldSheet.padEnd(21),
      row.newSheet,
    ].join(''));
  }
} else {
  console.log('\nNo frame/timing differences; manifest already matches the Aseprite tags.');
}

if (!CHECK_ONLY) {
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);

  if (fs.existsSync(PROGRESS_PATH)) {
    const table = [
      '| Sprite | Clip | Old frames | New frames | Old fps | New fps |',
      '| --- | --- | --- | --- | --- | --- |',
      ...differences.map((row) => (
        `| ${row.sprite} | ${row.clip} | ${row.oldFrames} | ${row.newFrames} | ${row.oldFps} | ${row.newFps} |`
      )),
    ].join('\n');
    const section = [
      PROGRESS_START,
      '### Aseprite import diff',
      '',
      'Generated by `npm run import:animations`. Frame lists and timings now come from the',
      'Aseprite `frameTags`; only differing clips are listed.',
      '',
      differences.length ? table : '_No differences._',
      PROGRESS_END,
    ].join('\n');
    let progress = fs.readFileSync(PROGRESS_PATH, 'utf8');
    if (progress.includes(PROGRESS_START) && progress.includes(PROGRESS_END)) {
      const start = progress.indexOf(PROGRESS_START);
      const end = progress.indexOf(PROGRESS_END) + PROGRESS_END.length;
      progress = `${progress.slice(0, start)}${section}${progress.slice(end)}`;
    } else {
      progress = `${progress.trimEnd()}\n\n${section}\n`;
    }
    fs.writeFileSync(PROGRESS_PATH, progress);
  }
}

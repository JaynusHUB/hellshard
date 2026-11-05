import { GAME, PHYSICS_BOUNDS } from '../src/config/game.js';
import { GENERATED_ZONE_ORDER, ZONES } from '../src/data/zones.js';
import { generateWorld, buildZoneRoute } from '../src/world/WorldGen.js';

const args = process.argv.slice(2);
const startSeed = Number(args[0] ?? 1);
const endSeed = Number(args[1] ?? 100);

if (!Number.isInteger(startSeed) || !Number.isInteger(endSeed) || startSeed < 1 || endSeed < startSeed) {
  console.error('Usage: npm run validate:world -- <startSeed> <endSeed>');
  process.exit(2);
}

const failures = [];
let zonesChecked = 0;
const start = performance.now();

for (let seed = startSeed; seed <= endSeed; seed++) {
  let world;
  try {
    world = generateWorld(seed);
  } catch (error) {
    failures.push(`seed ${seed}: generation threw ${error.message}`);
    continue;
  }
  for (const zoneId of GENERATED_ZONE_ORDER) {
    const zone = world[zoneId];
    const zoneDef = ZONES[zoneId];
    zonesChecked++;
    const reach = zone.reachability;
    if (!reach.ok) {
      failures.push(
        `seed ${seed} ${zoneId}: unreachable=${reach.unreachable.join(',') || 'none'} badGaps=${reach.badGaps.map((gap) => gap.length).join(',') || 'none'}`,
      );
    }
    if (zone.map.width !== GAME.world.roomWidth * GAME.world.roomsPerZone) {
      failures.push(`seed ${seed} ${zoneId}: unexpected width ${zone.map.width}`);
    }
    if (zone.width * GAME.tile > worldWidthLimit()) {
      failures.push(`seed ${seed} ${zoneId}: map exceeds configured limit`);
    }
    if (zone.surface <= 0 || zone.surface >= zone.height * GAME.tile) {
      failures.push(`seed ${seed} ${zoneId}: invalid surface ${zone.surface}`);
    }
    if (zone.transitions.some((transition) => transition.target === zoneId)) {
      failures.push(`seed ${seed} ${zoneId}: self transition generated`);
    }
    for (const transition of zone.transitions) {
      if (!ZONES[transition.target]) {
        failures.push(`seed ${seed} ${zoneId}: transition to unknown ${transition.target}`);
      }
    }
    if (zoneDef.boss && !zone.arena) {
      failures.push(`seed ${seed} ${zoneId}: boss zone has no arena`);
    }
    if (zoneId !== 'dungeon') {
      const route = buildZoneRoute(seed);
      const routeIndex = route.indexOf(zoneId);
      const expectedNext = route[routeIndex + 1];
      const right = zone.transitions.find((transition) => transition.id === `right-${zoneId}`);
      if (expectedNext) {
        if (!right) failures.push(`seed ${seed} ${zoneId}: missing route exit`);
        else if (right.target !== expectedNext) {
          failures.push(`seed ${seed} ${zoneId}: route exit targets ${right.target}, expected ${expectedNext}`);
        }
      } else if (right) {
        failures.push(`seed ${seed} ${zoneId}: unexpected exit after final route zone`);
      }
    }
    if (!zone.interactions.some((interaction) => interaction.type === 'chest')) {
      failures.push(`seed ${seed} ${zoneId}: no chest generated`);
    }
    for (const checkpoint of zone.checkpoints) {
      const tileX = Math.floor(checkpoint.x / GAME.tile);
      const tileY = Math.ceil(checkpoint.y / GAME.tile);
      if (!zone.map.isStandableTile(tileX, tileY)) {
        failures.push(`seed ${seed} ${zoneId}: invalid checkpoint at ${checkpoint.x},${checkpoint.y}`);
      }
    }
    if (PHYSICS_BOUNDS.maxGapTiles < 3) {
      failures.push('physics envelope no longer supports generated gaps');
    }
  }
}

function worldWidthLimit() {
  return GAME.world.roomWidth * GAME.world.roomsPerZone * GAME.tile;
}

const elapsed = performance.now() - start;
if (failures.length) {
  console.error(`✗ World validation failed with ${failures.length} issue(s):`);
  for (const failure of failures.slice(0, 60)) console.error(`  - ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`✓ World validation passed: seeds ${startSeed}..${endSeed} (${endSeed - startSeed + 1} worlds, ${zonesChecked} zones)`);
  console.log(`  max gap ${PHYSICS_BOUNDS.maxGapTiles} tiles, max jump ${PHYSICS_BOUNDS.maxJumpHeight.toFixed(1)}px, max distance ${PHYSICS_BOUNDS.maxJumpDistance.toFixed(1)}px`);
  console.log(`  ${elapsed.toFixed(0)} ms`);
}

import * as THREE from 'three';
import { SpriteBatch } from '../render/SpriteBatch.js';
import { CHARACTERS } from '../data/characters.js';
import { ENEMIES } from '../data/enemies.js';
import { BOSSES } from '../data/bosses.js';

const CARD_SIZE = 160;

const STYLE = `
  html, body { margin: 0; background: #0b0910; color: #ded3c2; }
  body { font-family: "Pixelify Sans", monospace; }
  #facing-debug {
    height: 100vh; overflow-y: auto; padding: 24px; box-sizing: border-box;
    background: radial-gradient(ellipse at 50% 0%, #221522 0%, #0b0910 60%);
  }
  .facing-header { max-width: 1220px; margin: 0 auto 20px; }
  .facing-header h1 { margin: 0 0 6px; font-size: 24px; color: #f0d89b; font-weight: normal; }
  .facing-header p { margin: 4px 0; color: #9d8f9f; font-size: 13px; max-width: 900px; line-height: 1.5; }
  .facing-legend { display: flex; gap: 16px; margin-top: 10px; font-size: 12px; color: #c9b7d1; flex-wrap: wrap; }
  .facing-legend b { color: #f0d89b; font-weight: normal; }
  .facing-grid { max-width: 1220px; margin: 0 auto; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
  .facing-card { border: 1px solid #3e2a40; background: rgba(20, 14, 24, 0.9); padding: 10px 12px 12px; }
  .facing-title { display: flex; justify-content: space-between; gap: 10px; align-items: baseline; color: #f0d89b; font-size: 16px; }
  .facing-used { color: #806d85; font-size: 10px; text-align: right; }
  .facing-meta { color: #958297; font-size: 10px; margin: 3px 0 8px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .facing-meta b { color: #e9d29b; font-weight: normal; }
  .facing-flip { background: #2a182c; border: 1px solid #8c5a91; color: #f2d6a0; font: inherit; font-size: 10px; padding: 2px 7px; cursor: pointer; }
  .facing-flip:hover { background: #452047; }
  .facing-states { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .facing-state { margin: 0; }
  .facing-state canvas { display: block; width: 100%; image-rendering: pixelated; border: 1px solid #3b2b3e; background-color: #17111d; background-image: linear-gradient(45deg, #201728 25%, transparent 25%), linear-gradient(-45deg, #201728 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #201728 75%), linear-gradient(-45deg, transparent 75%, #201728 75%); background-size: 8px 8px; background-position: 0 0, 0 4px, 4px -4px, -4px 0; }
  .facing-state figcaption { margin-top: 4px; color: #9d8f9f; font-size: 9px; line-height: 1.35; }
  .facing-state figcaption b { color: #e9d29b; font-weight: normal; }
  .facing-json-wrap { max-width: 1220px; margin: 18px auto 0; border-top: 1px solid #3e2a40; padding-top: 14px; }
  .facing-json-wrap h2 { margin: 0 0 8px; color: #f0d89b; font-size: 15px; font-weight: normal; }
  .facing-json-wrap p { color: #9d8f9f; font-size: 11px; margin: 0 0 8px; }
  .facing-json { margin: 0; padding: 12px; border: 1px solid #3e2a40; background: #100c14; color: #d8c7a5; font-size: 12px; line-height: 1.45; max-height: 260px; overflow: auto; user-select: text; }
  .facing-copy { margin-top: 8px; background: #2a182c; border: 1px solid #8c5a91; color: #f2d6a0; font: inherit; font-size: 11px; padding: 4px 10px; cursor: pointer; }
  @media (max-width: 900px) {
    .facing-grid { grid-template-columns: 1fr; }
    #facing-debug { padding: 12px; }
  }
`;

function spriteUsage() {
  const usage = new Map();
  const add = (sprite, label) => {
    if (!usage.has(sprite)) usage.set(sprite, []);
    usage.get(sprite).push(label);
  };
  for (const character of CHARACTERS) add(character.sprite, character.id);
  for (const enemy of ENEMIES) add(enemy.sprite, enemy.id);
  for (const boss of Object.values(BOSSES)) add(boss.sprite, boss.id);
  return usage;
}

function chooseClip(sprite) {
  const clips = Object.keys(sprite.animations);
  const preferred = ['walk', 'run', 'float', 'bounce', 'idle', 'cast'];
  return preferred.find((clip) => clips.includes(clip)) ?? clips[0];
}

function drawRaw(canvas, assets, sprite, frame) {
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const atlas = assets.atlases[sprite.atlas];
  if (!atlas) return;
  const scale = Math.max(1, Math.min(3, Math.floor(120 / Math.max(1, frame.w, frame.h))));
  const w = frame.w * scale;
  const h = frame.h * scale;
  const x = Math.floor((canvas.width - w) / 2);
  const y = Math.floor((canvas.height - h) / 2);
  ctx.drawImage(atlas.canvas, frame.sx, frame.sy, frame.w, frame.h, x, y, w, h);
}

function drawGameState(canvas, renderer, scene, batches, assets, spriteId, spriteAtlas, frame, direction, facing) {
  for (const batch of batches.values()) batch.mesh.visible = false;
  const batch = batches.get(spriteAtlas);
  if (!batch) return;
  const flip = assets.shouldFlipSprite(spriteId, direction, facing);
  batch.begin();
  batch.draw(frame, 0, -frame.h / 2, {
    anchorY: frame.anchorY ?? 1,
    flip,
  });
  batch.end();
  batch.mesh.visible = true;
  renderer.render(scene, renderer.userData.camera);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(renderer.domElement, 0, 0);
}

export function mountFacingDebug(assets) {
  document.getElementById('stage')?.style.setProperty('display', 'none');
  const app = document.getElementById('app') ?? document.body;
  const page = document.createElement('main');
  page.id = 'facing-debug';
  const usage = spriteUsage();
  const atlases = Object.values(assets.atlases);

  page.innerHTML = `
    <header class="facing-header">
      <h1>HELLSHARD · sprite facing audit</h1>
      <p>Raw source frame vs the game's own atlas + SpriteBatch path. LEFT/RIGHT are produced by the
      same <b>shouldFlipSprite</b> helper used by EntityRenderer, with the target direction passed
      directly. Use <b>TERS</b> on any card, then copy the JSON at the bottom and send it back.
      Nothing on this page changes the game manifest or a running run.</p>
      <div class="facing-legend">
        <span><b>RAW</b> source crop + current facing</span>
        <span><b>LEFT</b> target on the left</span>
        <span><b>RIGHT</b> target on the right</span>
        <span><b>TERS</b> toggles this sprite's facing</span>
      </div>
    </header>
    <section class="facing-grid" data-facing-grid></section>
    <section class="facing-json-wrap">
      <h2>Current facing JSON</h2>
      <p>This is the state after your TERS clicks. Copy it and paste it into the chat.</p>
      <pre class="facing-json" data-facing-json></pre>
      <button class="facing-copy" data-copy-faces type="button">Copy JSON</button>
    </section>
  `;
  app.appendChild(page);

  const grid = page.querySelector('[data-facing-grid]');
  const json = page.querySelector('[data-facing-json]');
  const copy = page.querySelector('[data-copy-faces]');
  const style = document.createElement('style');
  style.textContent = STYLE;
  document.head.appendChild(style);

  const gl = new THREE.WebGLRenderer({
    alpha: true,
    antialias: false,
    preserveDrawingBuffer: true,
    powerPreference: 'low-power',
  });
  gl.setPixelRatio(1);
  gl.setSize(CARD_SIZE, CARD_SIZE, false);
  gl.setClearColor(0x000000, 0);
  gl.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-80, 80, 80, -80, 0.1, 10);
  camera.position.z = 5;
  gl.userData.camera = camera;
  const batches = new Map();
  for (const atlas of atlases) {
    const batch = new SpriteBatch(atlas.texture, 4);
    batch.mesh.visible = false;
    scene.add(batch.mesh);
    batches.set(atlas.family, batch);
  }

  const spriteEntries = Object.entries(assets.manifest.sprites)
    .filter(([id]) => id !== 'fireball' && id !== 'death_burst');
  const cards = [];

  for (const [spriteId, sprite] of spriteEntries) {
    const clipName = chooseClip(sprite);
    const animation = assets.getAnimation(spriteId, clipName);
    const frame = animation?.frames?.[0];
    if (!frame) continue;
    const usedBy = usage.get(spriteId) ?? [];
    const card = document.createElement('article');
    card.className = 'facing-card';
    card.dataset.sprite = spriteId;
    card.innerHTML = `
      <div class="facing-title"><span>${spriteId}</span><span class="facing-used">${usedBy.length ? `used by: ${usedBy.join(', ')}` : ''}</span></div>
      <div class="facing-meta">
        <span>frame ${frame.w}×${frame.h} · clip <b>${clipName}</b> · facing: <b data-facing-label>${sprite.facing ?? 'right'}</b></span>
        <button class="facing-flip" data-flip type="button">TERS</button>
      </div>
      <div class="facing-states">
        <figure class="facing-state"><canvas width="${CARD_SIZE}" height="${CARD_SIZE}"></canvas><figcaption><b>RAW</b><br>source frame · <span data-raw-facing>${sprite.facing ?? 'right'}</span></figcaption></figure>
        <figure class="facing-state"><canvas width="${CARD_SIZE}" height="${CARD_SIZE}"></canvas><figcaption><b>LEFT</b><br>target left · flip <span data-left-flip>${assets.shouldFlipSprite(spriteId, -1, sprite.facing)}</span></figcaption></figure>
        <figure class="facing-state"><canvas width="${CARD_SIZE}" height="${CARD_SIZE}"></canvas><figcaption><b>RIGHT</b><br>target right · flip <span data-right-flip>${assets.shouldFlipSprite(spriteId, 1, sprite.facing)}</span></figcaption></figure>
      </div>
    `;
    grid.appendChild(card);
    const canvases = card.querySelectorAll('canvas');
    const state = { spriteId, sprite, frame, clipName, facing: sprite.facing === 'left' ? 'left' : 'right' };
    const renderCard = () => {
      card.querySelector('[data-facing-label]').textContent = state.facing;
      card.querySelector('[data-raw-facing]').textContent = state.facing;
      card.querySelector('[data-left-flip]').textContent = String(
        assets.shouldFlipSprite(state.spriteId, -1, state.facing),
      );
      card.querySelector('[data-right-flip]').textContent = String(
        assets.shouldFlipSprite(state.spriteId, 1, state.facing),
      );
      drawGameState(
        canvases[1], gl, scene, batches, assets,
        state.spriteId, state.sprite.atlas, state.frame, -1, state.facing,
      );
      drawGameState(
        canvases[2], gl, scene, batches, assets,
        state.spriteId, state.sprite.atlas, state.frame, 1, state.facing,
      );
    };
    drawRaw(canvases[0], assets, state.sprite, state.frame);
    renderCard();
    card.querySelector('[data-flip]').addEventListener('click', () => {
      state.facing = state.facing === 'left' ? 'right' : 'left';
      renderCard();
      updateJson();
    });
    cards.push({ state, renderCard });
  }

  function updateJson() {
    const data = {};
    for (const { state } of cards) data[state.spriteId] = state.facing;
    json.textContent = JSON.stringify(data, null, 2);
  }
  updateJson();

  copy.addEventListener('click', async () => {
    const text = json.textContent;
    try {
      await navigator.clipboard.writeText(text);
      copy.textContent = 'Copied';
      window.setTimeout(() => { copy.textContent = 'Copy JSON'; }, 1200);
    } catch {
      const range = document.createRange();
      range.selectNodeContents(json);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      copy.textContent = 'Selected — press Ctrl+C';
    }
  });

  gl.domElement.style.display = 'none';
  return { page, renderer: gl, camera, batches, cards };
}

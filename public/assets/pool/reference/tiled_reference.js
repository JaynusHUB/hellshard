// tiled_reference.js
// HELLSHARD - Tiled harita referans uygulamasi (framework bagimsiz, bagimlilik yok).
// Amac: motorun (Three.js) yukleyicisinin BIREBIR uygulamasi gereken kurallar.
// Tarayicida ve Node'da calisir. Canvas2D cizimi sadece dogrulama oynaticisi icindir;
// asil kural fonksiyonlari (parallaxPosition, animatedLocalId, tileSourceRect ...) saf fonksiyonlardir.

export const GID_MASK = 0x1fffffff;
export const FLIP_H = 0x80000000;
export const FLIP_V = 0x40000000;
export const FLIP_D = 0x20000000;

/** Ozel ozellikleri (properties dizisi) duz nesneye cevirir. */
export function propsOf(obj) {
  const out = {};
  for (const p of obj.properties || []) out[p.name] = p.value;
  return out;
}

/** Tilesetleri indeksler. firstgid'e gore BUYUKTEN KUCUGE sirali dondurur (gid aramasi icin). */
export function indexTilesets(map) {
  return map.tilesets
    .map((ts) => {
      const anim = new Map();
      const tprops = new Map();
      for (const t of ts.tiles || []) {
        if (t.animation) {
          let total = 0;
          for (const f of t.animation) total += f.duration;
          anim.set(t.id, { frames: t.animation, total });
        }
        if (t.properties) tprops.set(t.id, propsOf(t));
      }
      return {
        firstgid: ts.firstgid,
        name: ts.name,
        image: ts.image,
        columns: ts.columns,
        tilecount: ts.tilecount,
        tw: ts.tilewidth,
        th: ts.tileheight,
        anim,
        tprops,
      };
    })
    .sort((a, b) => b.firstgid - a.firstgid);
}

export function findTileset(sets, gid) {
  for (const s of sets) if (gid >= s.firstgid) return s;
  return null;
}

/**
 * Animasyonlu tile'in o andaki YEREL id'si. tMs = oyun/duvar saati (milisaniye).
 * Tiled kurali: kare sureleri toplami kadar modulo, kareler sirayla gezilir.
 * NOT: layer verisindeki gid animasyonun ILK karesini gosterir; cizilen kare buradan gelir.
 */
export function animatedLocalId(ts, local, tMs) {
  const a = ts.anim.get(local);
  if (!a) return local;
  let t = ((tMs % a.total) + a.total) % a.total;
  for (const f of a.frames) {
    if (t < f.duration) return f.tileid;
    t -= f.duration;
  }
  return a.frames[a.frames.length - 1].tileid;
}

/** Tileset gorselindeki kaynak dikdortgen (piksel). */
export function tileSourceRect(ts, local) {
  return {
    sx: (local % ts.columns) * ts.tw,
    sy: Math.floor(local / ts.columns) * ts.th,
    sw: ts.tw,
    sh: ts.th,
  };
}

/**
 * Image layer parallax konumu (dunya koordinati, piksel). Tiled kurali:
 *   konum = offset + (kameraMerkezi - parallaxOrigin) * (1 - parallaxFactor)
 * autoscroll_x (ozel ozellik, px/sn) zamanla eklenir.
 */
export function parallaxPosition(layer, map, camCenterX, camCenterY, tSeconds = 0) {
  const px = layer.parallaxx ?? 1;
  const py = layer.parallaxy ?? 1;
  const ox = map.parallaxoriginx ?? 0;
  const oy = map.parallaxoriginy ?? 0;
  const auto = propsOf(layer).autoscroll_x || 0;
  return {
    x: (layer.offsetx || 0) + (camCenterX - ox) * (1 - px) + auto * tSeconds,
    y: (layer.offsety || 0) + (camCenterY - oy) * (1 - py),
  };
}

/** Katmanin cizim rolu (isimden/ozelliklerden). Motor bu eslemeyi config'te tutmali. */
export function layerRole(layer) {
  const p = propsOf(layer);
  if (layer.type === 'imagelayer') return p.draw_above_player ? 'fog' : 'bg';
  if (layer.type === 'tilelayer') {
    if (layer.name === 'Collisions Layer') return 'collision';
    if (p.draw_above_player) return 'front';
    return 'tiles';
  }
  if (layer.type === 'objectgroup') return 'objects:' + layer.name;
  return 'other';
}

/** Cizim sirasi: bg -> tiles(Back, Back Decor, Main) -> [entity'ler] -> front -> fog. Dosya sirasi korunur. */
export function drawPlan(map) {
  const plan = { bg: [], tiles: [], front: [], fog: [], collision: null, objects: {} };
  for (const l of map.layers) {
    const r = layerRole(l);
    if (r === 'bg') plan.bg.push(l);
    else if (r === 'tiles') plan.tiles.push(l);
    else if (r === 'front') plan.front.push(l);
    else if (r === 'fog') plan.fog.push(l);
    else if (r === 'collision') plan.collision = l;
    else if (r.startsWith('objects:')) plan.objects[l.name] = l;
  }
  return plan;
}

/** Collisions Layer'dan sutun bazli ilk zemin (solid=1 veya one-way=2) y'si; yoksa null. */
export function groundTopY(map, collisionLayer, tileX) {
  const W = map.width;
  const H = map.height;
  const cx = Math.max(0, Math.min(W - 1, tileX));
  for (let y = 0; y < H; y++) {
    const v = collisionLayer.data[y * W + cx] & GID_MASK;
    if (v === 1 || v === 2) return y * map.tileheight;
  }
  return null;
}

/**
 * Kamera: harita 192 px, goruntu 180 px ise zemin gorunsun diye kamera ALT hizali olmalidir.
 * camTop = harita yuksekligi - goruntu yuksekligi (oyuncu zeminde iken).
 */
export function cameraRect(map, viewW, viewH, camCenterX, camTopOverride = null) {
  const mapW = map.width * map.tilewidth;
  const mapH = map.height * map.tileheight;
  const cx = Math.max(viewW / 2, Math.min(mapW - viewW / 2, camCenterX));
  const top = camTopOverride ?? Math.max(0, mapH - viewH);
  return { centerX: cx, centerY: top + viewH / 2, left: cx - viewW / 2, top };
}

/**
 * Ambient: ambient_color bir CARPAN DEGIL, hafif bir RENK TONUDUR.
 * Carpan olarak uygulanirsa (#1a1420 ~ %10 parlaklik) sahne siyaha doner.
 * Kural: multiply, alfa = ambientStrength (varsayilan 0.25). Isiklar additive ustune eklenir.
 */
export const AMBIENT_STRENGTH = 0.25;

/** Isik titresimi carpani (0..1). flicker: 0..1, seed: nesne basina sabit sayi. */
export function lightFlicker(flicker, tSeconds, seed) {
  const n = 0.5 + 0.5 * Math.sin(tSeconds * 17.0 + seed * 12.9898) * Math.sin(tSeconds * 7.3 + seed * 4.1);
  return 1 - flicker * (1 - n);
}

/**
 * Canvas2D ile tam kare cizimi (dogrulama oynaticisi).
 * images: { tilesets: {isim: HTMLImageElement|ImageBitmap}, layers: {layerId: image} }
 * opts: { viewW, viewH, camCenterX, tMs, showLights, showObjects, hidden:Set<layerName>, ambientStrength }
 */
export function drawFrame(ctx, map, sets, images, plan, opts) {
  const { viewW, viewH, camCenterX, tMs } = opts;
  const hidden = opts.hidden || new Set();
  const cam = cameraRect(map, viewW, viewH, camCenterX, opts.camTop ?? null);
  const tS = tMs / 1000;
  const TW = map.tilewidth;
  ctx.imageSmoothingEnabled = false;
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = map.backgroundcolor || '#000';
  ctx.fillRect(0, 0, viewW, viewH);

  const drawImageLayer = (l) => {
    if (hidden.has(l.name) || l.visible === false) return;
    const img = images.layers[l.id];
    if (!img) return;
    const pos = parallaxPosition(l, map, cam.centerX, cam.centerY, tS);
    const y = Math.round(pos.y - cam.top);
    ctx.globalAlpha = l.opacity ?? 1;
    if (l.repeatx) {
      const w = img.width;
      let x0 = ((Math.round(pos.x - cam.left) % w) + w) % w - w;
      for (let x = x0; x < viewW; x += w) ctx.drawImage(img, x, y);
    } else {
      ctx.drawImage(img, Math.round(pos.x - cam.left), y);
    }
    ctx.globalAlpha = 1;
  };

  const drawTileLayer = (l) => {
    if (hidden.has(l.name) || l.visible === false) return;
    const c0 = Math.max(0, Math.floor(cam.left / TW));
    const c1 = Math.min(map.width - 1, Math.floor((cam.left + viewW) / TW));
    const r0 = Math.max(0, Math.floor(cam.top / TW));
    const r1 = Math.min(map.height - 1, Math.floor((cam.top + viewH) / TW));
    ctx.globalAlpha = l.opacity ?? 1;
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const raw = l.data[r * map.width + c];
        const gid = raw & GID_MASK;
        if (!gid) continue;
        const ts = findTileset(sets, gid);
        if (!ts) continue;
        const local = animatedLocalId(ts, gid - ts.firstgid, tMs);
        const s = tileSourceRect(ts, local);
        ctx.drawImage(images.tilesets[ts.name], s.sx, s.sy, s.sw, s.sh, Math.round(c * TW - cam.left), Math.round(r * TW - cam.top), TW, TW);
      }
    }
    ctx.globalAlpha = 1;
  };

  plan.bg.forEach(drawImageLayer);
  plan.tiles.forEach(drawTileLayer);
  if (opts.drawEntities) opts.drawEntities(ctx, cam);
  plan.front.forEach(drawTileLayer);
  plan.fog.forEach(drawImageLayer);

  // ambient renk tonu (carpan degil)
  const amb = propsOf(map).ambient_color;
  const strength = opts.ambientStrength ?? AMBIENT_STRENGTH;
  if (amb && strength > 0 && !hidden.has('ambient')) {
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = strength;
    ctx.fillStyle = amb;
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // isiklar (additive)
  if (opts.showLights !== false && plan.objects.Lights && !hidden.has('Lights')) {
    ctx.globalCompositeOperation = 'lighter';
    plan.objects.Lights.objects.forEach((o, i) => {
      const p = propsOf(o);
      const sx = o.x - cam.left;
      const sy = o.y - cam.top;
      if (sx < -p.radius || sx > viewW + p.radius) return;
      const k = (p.intensity ?? 1) * lightFlicker(p.flicker ?? 0, tS, i + 1);
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, p.radius);
      const col = p.color || '#ffffff';
      g.addColorStop(0, hexA(col, 0.38 * k));
      g.addColorStop(0.45, hexA(col, 0.14 * k));
      g.addColorStop(1, hexA(col, 0));
      ctx.fillStyle = g;
      ctx.fillRect(sx - p.radius, sy - p.radius, p.radius * 2, p.radius * 2);
    });
    ctx.globalCompositeOperation = 'source-over';
  }

  if (opts.showObjects) drawObjectMarkers(ctx, plan, cam);
  return cam;
}

function hexA(hex, a) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}

const MARK = {
  Enemy: '#ff4d4d', Boss: '#ff00aa', Pickup: '#ffd23f', Chest: '#ff9f1c', Checkpoint: '#3ddc97',
  PlayerStart: '#4dabf7', Sign: '#adb5bd', MovingPlatform: '#845ef7', LevelExit: '#ffffff',
  CameraLock: '#ff6b6b', Hint: '#74c0fc', MusicZone: '#63e6be', KillZone: '#c92a2a', Secret: '#f783ac',
};

export function drawObjectMarkers(ctx, plan, cam) {
  ctx.lineWidth = 1;
  for (const name of ['Objects', 'Triggers']) {
    const g = plan.objects[name];
    if (!g) continue;
    for (const o of g.objects) {
      const c = MARK[o.type] || '#fff';
      const x = Math.round(o.x - cam.left) + 0.5;
      const y = Math.round(o.y - cam.top) + 0.5;
      if (x > 330 || x + (o.width || 0) < -10) continue;
      ctx.strokeStyle = c;
      ctx.globalAlpha = name === 'Triggers' ? 0.45 : 0.9;
      ctx.strokeRect(x, y, o.width || 4, o.height || 4);
    }
  }
  ctx.globalAlpha = 1;
}

import * as THREE from 'three';
import manifest from '../../ASSET_MANIFEST.json';

const UV_INSET = 0.02;

export function loadImage(path) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${path}`));
    img.src = new URL(path, document.baseURI).href;
  });
}

function imageCacheKey(path) {
  return new URL(path, document.baseURI).href;
}

function nextPowerOfTwo(value) {
  let v = 1;
  while (v < value) v *= 2;
  return v;
}

function packFrames(frameSpecs, maxWidth, padding) {
  const sorted = [...frameSpecs].sort((a, b) => {
    if (b.w !== a.w) return b.w - a.w;
    return b.h - a.h;
  });
  let x = padding;
  let y = padding;
  let rowHeight = 0;
  const maxUsedWidth = maxWidth - padding;
  for (const frame of sorted) {
    if (x + frame.w + padding > maxUsedWidth) {
      x = padding;
      y += rowHeight + padding;
      rowHeight = 0;
    }
    frame.packX = x;
    frame.packY = y;
    x += frame.w + padding;
    if (frame.h > rowHeight) rowHeight = frame.h;
  }
  const usedHeight = y + rowHeight + padding;
  return { width: maxWidth, height: nextPowerOfTwo(usedHeight), sorted };
}

function expandFramesForSprites(spriteId, animation, imageSizes) {
  const output = [];
  if (animation.images) {
    animation.images.forEach((imagePath, index) => {
      const size = imageSizes.get(imagePath);
      output.push({
        id: `spr:${spriteId}:${animation.id ?? ''}:${index}`,
        imagePath,
        x: 0,
        y: 0,
        w: animation.w ?? size.width,
        h: animation.h ?? size.height,
      });
    });
    return output;
  }
  const size = imageSizes.get(animation.sheet);
  const columns = Math.max(1, Math.floor(size.width / animation.fw));
  animation.frames.forEach((frameIndex, index) => {
    const x = (frameIndex % columns) * animation.fw;
    const y = Math.floor(frameIndex / columns) * animation.fh;
    output.push({
      id: `spr:${spriteId}:${animation.id ?? ''}:${index}`,
      imagePath: animation.sheet,
      x,
      y,
      w: animation.fw,
      h: animation.fh,
    });
  });
  return output;
}

function expandProps(propsGroup) {
  const output = [];
  for (const [name, def] of Object.entries(propsGroup.frames)) {
    output.push({
      id: `prop:${name}`,
      imagePath: def.image,
      x: def.rect ? def.rect[0] : 0,
      y: def.rect ? def.rect[1] : 0,
      w: def.rect ? def.rect[2] : null,
      h: def.rect ? def.rect[3] : null,
      alias: name,
    });
  }
  return output;
}

function expandTiles(zoneId, tileGroup) {
  const output = [];
  for (const [kind, def] of Object.entries(tileGroup.frames)) {
    if (Array.isArray(def)) {
      def.forEach((frame, index) => {
        output.push({
          id: `tile:${zoneId}:${kind}:${index}`,
          imagePath: frame.image,
          x: frame.rect[0],
          y: frame.rect[1],
          w: frame.rect[2],
          h: frame.rect[3],
        });
      });
    } else {
      output.push({
        id: `tile:${zoneId}:${kind}`,
        imagePath: def.image,
        x: def.rect[0],
        y: def.rect[1],
        w: def.rect[2],
        h: def.rect[3],
      });
    }
  }
  return output;
}

export class AssetLibrary {
  constructor() {
    this.manifest = manifest;
    this.atlases = {};
    this.images = new Map();
    this.backgrounds = new Map();
    this.animations = {};
    this.tileGroupWidths = {};
    this.progress = 0;
    this.totalTasks = 0;
    this.completedTasks = 0;
  }

  async loadAll(onProgress) {
    this.onProgress = onProgress;
    const families = Object.keys(this.manifest.atlases);
    for (const family of families) {
      await this.buildFamilyAtlas(family);
    }
    this.progress = 1;
    this.onProgress?.(1);
  }

  async loadFamilies(families) {
    for (const family of families) {
      await this.buildFamilyAtlas(family);
    }
  }

  collectImagePath(path) {
    if (!this.images.has(path)) this.images.set(path, null);
  }

  async ensureImagesLoaded() {
    const entries = [...this.images.entries()].filter(([, img]) => !img);
    if (entries.length === 0) return;
    const concurrency = 12;
    let cursor = 0;
    this.totalTasks = entries.length;
    this.completedTasks = 0;
    const worker = async () => {
      while (cursor < entries.length) {
        const idx = cursor++;
        const [path] = entries[idx];
        const img = await loadImage(path);
        this.images.set(path, img);
        this.completedTasks++;
        this.onProgress?.(Math.min(0.95, this.completedTasks / this.totalTasks) * 0.95);
      }
    };
    await Promise.all(Array.from({ length: concurrency }, worker));
  }

  async loadBackgroundImages(paths) {
    const unique = [...new Set(paths)];
    await Promise.all(
      unique.map(async (path) => {
        if (this.backgrounds.has(path)) return;
        const img = await loadImage(path);
        const texture = new THREE.Texture(img);
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        texture.generateMipmaps = false;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.needsUpdate = true;
        this.backgrounds.set(path, { img, texture });
      }),
    );
  }

  async buildFamilyAtlas(family) {
    // Ensure all image paths for this family exist in the image cache before loading.
    for (const [spriteId, sprite] of Object.entries(this.manifest.sprites)) {
      if (sprite.atlas !== family) continue;
      for (const animation of Object.values(sprite.animations)) {
        if (animation.images) animation.images.forEach((p) => this.collectImagePath(p));
        else this.collectImagePath(animation.sheet);
      }
    }
    for (const propGroup of Object.values(this.manifest.props)) {
      if (propGroup.atlas !== family) continue;
      for (const def of Object.values(propGroup.frames)) this.collectImagePath(def.image);
    }
    for (const tileGroup of Object.values(this.manifest.tiles)) {
      if (tileGroup.atlas !== family) continue;
      for (const def of Object.values(tileGroup.frames)) {
        if (Array.isArray(def)) def.forEach((frame) => this.collectImagePath(frame.image));
        else this.collectImagePath(def.image);
      }
    }
    await this.ensureImagesLoaded();

    const imageSizes = new Map();
    for (const [path, img] of this.images) imageSizes.set(path, { width: img.width, height: img.height });

    const frameSpecs = [];
    for (const [spriteId, sprite] of Object.entries(this.manifest.sprites)) {
      if (sprite.atlas !== family) continue;
      this.animations[spriteId] = {};
      for (const [animName, animation] of Object.entries(sprite.animations)) {
        const frames = expandFramesForSprites(spriteId, { ...animation, id: animName }, imageSizes);
        this.animations[spriteId][animName] = {
          frames,
          fps: animation.fps ?? 8,
          loop: animation.loop ?? true,
          durations: Array.isArray(animation.durations)
            && animation.durations.length === frames.length
            ? animation.durations.map((ms) => Number(ms) / 1000)
            : null,
        };
        frameSpecs.push(...frames);
      }
    }
    for (const [propGroupName, propGroup] of Object.entries(this.manifest.props)) {
      if (propGroup.atlas !== family) continue;
      const frames = expandProps(propGroup);
      for (const frame of frames) {
        const size = imageSizes.get(frame.imagePath);
        frame.w = frame.w ?? size.width;
        frame.h = frame.h ?? size.height;
        frame.id = `prop:${propGroupName}:${frame.alias}`;
      }
      frameSpecs.push(...frames);
    }
    for (const [zoneId, tileGroup] of Object.entries(this.manifest.tiles)) {
      if (tileGroup.atlas !== family) continue;
      this.tileGroupWidths[zoneId] = tileGroup.groupWidth;
      frameSpecs.push(...expandTiles(zoneId, tileGroup));
    }

    // Pack identical source regions once, then point every logical frame id at that region.
    const uniqueRegions = new Map();
    for (const frame of frameSpecs) {
      const key = `${frame.imagePath}|${frame.x}|${frame.y}|${frame.w}|${frame.h}`;
      if (!uniqueRegions.has(key)) uniqueRegions.set(key, key);
    }
    const regionFrames = [...uniqueRegions.keys()].map((key) => {
      const spec = frameSpecs.find(
        (frame) => `${frame.imagePath}|${frame.x}|${frame.y}|${frame.w}|${frame.h}` === key,
      );
      return spec;
    });
    const padding = this.manifest.rendering?.atlasPadding ?? 2;
    const packed = packFrames(
      regionFrames,
      this.manifest.rendering?.atlasMaxWidth ?? 2048,
      padding,
    );
    const canvas = document.createElement('canvas');
    canvas.width = packed.width;
    canvas.height = packed.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = false;
    const frames = new Map();
    const regionMap = new Map();
    for (const frame of packed.sorted) {
      const img = this.images.get(frame.imagePath);
      ctx.drawImage(img, frame.x, frame.y, frame.w, frame.h, frame.packX, frame.packY, frame.w, frame.h);
      const key = `${frame.imagePath}|${frame.x}|${frame.y}|${frame.w}|${frame.h}`;
      const region = {
        u0: (frame.packX + UV_INSET) / canvas.width,
        v0: 1 - (frame.packY + frame.h - UV_INSET) / canvas.height,
        u1: (frame.packX + frame.w - UV_INSET) / canvas.width,
        v1: 1 - (frame.packY + UV_INSET) / canvas.height,
        w: frame.w,
        h: frame.h,
        sx: frame.packX,
        sy: frame.packY,
        imagePath: frame.imagePath,
        srcX: frame.x,
        srcY: frame.y,
      };
      regionMap.set(key, region);
    }
    const pixelData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const measureOpaqueAnchor = (region) => {
      let minX = region.w;
      let minY = region.h;
      let maxX = -1;
      let maxY = -1;
      for (let y = 0; y < region.h; y++) {
        for (let x = 0; x < region.w; x++) {
          const alpha = pixelData[((region.sy + y) * canvas.width + region.sx + x) * 4 + 3];
          if (alpha < 8) continue;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
      if (maxY < 0) return { anchorX: 0.5, anchorY: 1 };
      return {
        anchorX: 0.5,
        anchorY: (maxY + 1) / region.h,
        opaqueBox: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 },
      };
    };
    const anchors = new Map();
    for (const region of regionMap.values()) {
      const key = `${region.sx}|${region.sy}|${region.w}|${region.h}`;
      anchors.set(key, measureOpaqueAnchor(region));
    }
    for (const spec of frameSpecs) {
      const key = `${spec.imagePath}|${spec.x}|${spec.y}|${spec.w}|${spec.h}`;
      const region = regionMap.get(key);
      if (!region) continue;
      const anchor = anchors.get(`${region.sx}|${region.sy}|${region.w}|${region.h}`) ?? {
        anchorX: 0.5,
        anchorY: 1,
      };
      frames.set(spec.id, { id: spec.id, ...region, ...anchor });
    }
    // Re-key every animation frame to the atlas frame with the same logical id.
    for (const [spriteId, sprite] of Object.entries(this.manifest.sprites)) {
      if (sprite.atlas !== family) continue;
      for (const [animName, animation] of Object.entries(sprite.animations)) {
        const built = this.animations[spriteId]?.[animName];
        if (!built) continue;
        built.frames = built.frames.map((frame) => frames.get(frame.id) ?? null);
      }
      // Use one foot anchor for the whole sprite. Per-frame opaque bottoms can
      // differ when a cloak, weapon or trailing limb dips below the feet; sharing
      // the lowest opaque row keeps every animation planted on the same ground line.
      let footAnchor = 0;
      for (const animation of Object.values(this.animations[spriteId] ?? {})) {
        for (const frame of animation.frames) {
          if (frame) footAnchor = Math.max(footAnchor, frame.anchorY ?? 1);
        }
      }
      if (footAnchor > 0) {
        for (const animation of Object.values(this.animations[spriteId] ?? {})) {
          animation.frames = animation.frames.map((frame) => (
            frame ? { ...frame, anchorY: footAnchor } : frame
          ));
        }
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = true;
    texture.needsUpdate = true;
    this.atlases[family] = {
      family,
      canvas,
      ctx,
      texture,
      frames,
      padding,
      width: canvas.width,
      height: canvas.height,
    };
  }

  getAtlas(family) {
    return this.atlases[family];
  }

  getFrame(family, id) {
    return this.atlases[family]?.frames.get(id) ?? null;
  }

  getAnimation(spriteId, animName) {
    return this.animations[spriteId]?.[animName] ?? null;
  }

  getSpriteFacing(spriteId) {
    return this.manifest.sprites[spriteId]?.facing === 'left' ? 'left' : 'right';
  }

  shouldFlipSprite(spriteId, direction, facingOverride = null) {
    const base = facingOverride === 'left' || facingOverride === 'right'
      ? facingOverride
      : this.getSpriteFacing(spriteId);
    return (direction < 0) !== (base === 'left');
  }

  getTileFrame(zoneId, kind, index = 0) {
    const family = this.manifest.tiles[zoneId]?.atlas;
    if (!family) return null;
    const candidates = [
      `tile:${zoneId}:${kind}:${index}`,
      `tile:${zoneId}:${kind}:0`,
      `tile:${zoneId}:${kind}`,
    ];
    for (const id of candidates) {
      const frame = this.getFrame(family, id);
      if (frame) return frame;
    }
    return null;
  }

  getPropFrame(group, name) {
    const atlas = this.manifest.props[group]?.atlas;
    if (!atlas) return null;
    return this.getFrame(atlas, `prop:${group}:${name}`);
  }

  getGroupWidth(zoneId) {
    return this.tileGroupWidths[zoneId] ?? 4;
  }

  getPalette(family, frame, maxColors = 10) {
    if (!frame) return [[220, 210, 190]];
    this.paletteCache ??= new Map();
    const key = `${family}:${frame.id}`;
    if (this.paletteCache.has(key)) return this.paletteCache.get(key);
    const atlas = this.atlases[family];
    if (!atlas) return [[220, 210, 190]];
    const ctx = atlas.ctx;
    atlas.pixelData ??= ctx.getImageData(0, 0, atlas.canvas.width, atlas.canvas.height).data;
    const image = atlas.pixelData;
    const counts = new Map();
    const stride = atlas.canvas.width;
    const step = 2;
    for (let y = 0; y < frame.h; y += step) {
      for (let x = 0; x < frame.w; x += step) {
        const i = ((frame.sy + y) * stride + frame.sx + x) * 4;
        const alpha = image[i + 3];
        if (alpha < 40) continue;
        const r = image[i] & 0xf8;
        const g = image[i + 1] & 0xf8;
        const b = image[i + 2] & 0xf8;
        if (r + g + b < 30) continue;
        const colorKey = (r << 16) | (g << 8) | b;
        counts.set(colorKey, (counts.get(colorKey) ?? 0) + 1);
      }
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, maxColors);
    const palette = sorted.map(([value]) => [
      (value >> 16) & 0xff,
      (value >> 8) & 0xff,
      value & 0xff,
    ]);
    if (!palette.length) palette.push([210, 196, 170]);
    this.paletteCache.set(key, palette);
    return palette;
  }

  get backgroundManifest() {
    return this.manifest.backgrounds;
  }

  getSpriteManifest(spriteId) {
    return this.manifest.sprites[spriteId];
  }

  getSpriteAtlas(spriteId) {
    return this.manifest.sprites[spriteId]?.atlas ?? 'gothic';
  }

  getPresentation() {
    return this.manifest.presentation;
  }

  async loadZoneBackgrounds(zoneId) {
    const entries = this.manifest.backgrounds[zoneId] ?? [];
    await this.loadBackgroundImages(entries.map((entry) => entry.image));
    return entries.map((entry) => ({
      ...entry,
      texture: this.backgrounds.get(entry.image)?.texture,
      image: this.backgrounds.get(entry.image)?.img,
    }));
  }

  dispose() {
    for (const atlas of Object.values(this.atlases)) {
      atlas.texture.dispose();
    }
    for (const entry of this.backgrounds.values()) {
      entry.texture.dispose();
    }
    this.atlases = {};
    this.backgrounds.clear();
  }
}

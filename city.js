// Original pixel artwork. All shapes are rasterized to a fixed integer grid.
const ReclaimCity = (() => {
  'use strict';
  const WIDTH = 480,
    HEIGHT = 360,
    DEFAULT_PITCH = 30,
    MIN_PITCH = 16,
    MAX_PITCH = 53;
  const clamp = (x) => Math.max(0, Math.min(1, x));
  const ease = (a, b, x) => {
    const t = clamp((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  };
  function random(seed) {
    return () => {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function createCity(canvas) {
    const display = canvas.getContext('2d', { alpha: false });
    display.imageSmoothingEnabled = false;
    const buffer = document.createElement('canvas');
    buffer.width = WIDTH;
    buffer.height = HEIGHT;
    let ctx = buffer.getContext('2d', { alpha: false });
    ctx.imageSmoothingEnabled = false;
    const camera = { angle: 0, pitch: DEFAULT_PITCH, zoom: 1, offsetX: 0, offsetY: 0 };
    let cosine = 1,
      sine = 0,
      screenX = 9,
      screenZ = 4.5,
      screenH = 9,
      originY = 202,
      projectionKey = '';
    function projectCamera() {
      cosine = Math.cos(camera.angle);
      sine = Math.sin(camera.angle);
      if (Math.abs(cosine) < 1e-10) cosine = 0;
      if (Math.abs(sine) < 1e-10) sine = 0;
      const radians = (camera.pitch * Math.PI) / 180,
        ground = 9 * Math.sin(radians),
        height = (9 * Math.cos(radians)) / Math.cos(Math.PI / 6);
      // Fit the whole island at steep elevations even when the tower is on the far edge.
      const fit = Math.min(1, 335 / (44.4 * ground + 13.5 * height));
      screenX = 9 * fit;
      screenZ = ground * fit;
      screenH = height * fit;
      originY = Math.min(202, 345 - 24 * screenZ - 2.2 * screenH);
      projectionKey = camera.angle.toFixed(6) + ':' + camera.pitch.toFixed(5);
    }
    const depth = (x, z) => (cosine + sine) * (x - 12) + (cosine - sine) * (z - 12);
    const P = (x, z, h = 0) => {
      const a = x - 12,
        b = z - 12,
        rx = a * cosine - b * sine,
        rz = a * sine + b * cosine;
      return [
        Math.round(240 + (rx - rz) * screenX),
        Math.round(originY + (rx + rz) * screenZ - h * screenH),
      ];
    };
    const dot = (x, y, c, w = 1, h = w) => {
      ctx.fillStyle = c;
      ctx.fillRect(
        Math.round(x),
        Math.round(y),
        Math.max(1, Math.round(w)),
        Math.max(1, Math.round(h)),
      );
    };
    function line(a, b, c) {
      let x = Math.round(a[0]),
        y = Math.round(a[1]);
      const x2 = Math.round(b[0]),
        y2 = Math.round(b[1]),
        dx = Math.abs(x2 - x),
        dy = -Math.abs(y2 - y),
        sx = x < x2 ? 1 : -1,
        sy = y < y2 ? 1 : -1;
      let err = dx + dy;
      ctx.fillStyle = c;
      for (;;) {
        ctx.fillRect(x, y, 1, 1);
        if (x === x2 && y === y2) break;
        const e2 = 2 * err;
        if (e2 >= dy) {
          err += dy;
          x += sx;
        }
        if (e2 <= dx) {
          err += dx;
          y += sy;
        }
      }
    }
    function poly(points, color) {
      const minY = Math.ceil(Math.min(...points.map((p) => p[1]))),
        maxY = Math.floor(Math.max(...points.map((p) => p[1])));
      ctx.fillStyle = color;
      for (let y = minY; y <= maxY; y++) {
        const cuts = [];
        for (let i = 0; i < points.length; i++) {
          const a = points[i],
            b = points[(i + 1) % points.length];
          if ((a[1] <= y + 0.5 && b[1] > y + 0.5) || (b[1] <= y + 0.5 && a[1] > y + 0.5))
            cuts.push(a[0] + ((y + 0.5 - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
        }
        cuts.sort((a, b) => a - b);
        for (let i = 0; i + 1 < cuts.length; i += 2) {
          const x = Math.round(cuts[i]);
          ctx.fillRect(x, y, Math.max(1, Math.round(cuts[i + 1]) - x), 1);
        }
      }
    }
    function outline(points, c) {
      for (let i = 0; i < points.length; i++) line(points[i], points[(i + 1) % points.length], c);
    }
    function ellipse(cx, cy, rx, ry, color) {
      ctx.fillStyle = color;
      for (let y = -Math.ceil(ry); y <= Math.ceil(ry); y++) {
        const f = 1 - (y * y) / (ry * ry);
        if (f < 0) continue;
        const w = Math.round(rx * Math.sqrt(f));
        ctx.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1);
      }
    }
    const top = (x, z, w, d, h, c) =>
      poly([P(x, z, h), P(x + w, z, h), P(x + w, z + d, h), P(x, z + d, h)], c);
    const floorLine = (a, b, c) => line(P(...a), P(...b), c);
    function cube(x, z, w, d, h, colors, base = 0, edge = true) {
      const A = P(x, z, base + h),
        B = P(x + w, z, base + h),
        C = P(x + w, z + d, base + h),
        D = P(x, z + d, base + h),
        ab = P(x, z, base),
        bb = P(x + w, z, base),
        cb = P(x + w, z + d, base),
        db = P(x, z + d, base);
      const faces = [
        cosine - sine >= 0 ? [D, C, cb, db] : [A, B, bb, ab],
        cosine + sine >= 0 ? [B, C, cb, bb] : [A, D, db, ab],
      ];
      faces.forEach((f, i) => {
        poly(f, colors[i + 1]);
        if (edge) {
          line(f[0], f[3], colors[3] || '#626658');
          line(f[1], f[2], colors[3] || '#626658');
        }
      });
      poly([A, B, C, D], colors[0]);
      if (edge) outline([A, B, C, D], colors[3] || '#626658');
    }
    function wall(side, x, z, h, w, hh, c) {
      poly(
        side === 0
          ? [P(x, z, h), P(x + w, z, h), P(x + w, z, h + hh), P(x, z, h + hh)]
          : [P(x, z, h), P(x, z + w, h), P(x, z + w, h + hh), P(x, z, h + hh)],
        c,
      );
    }
    const palette = {
      concrete: ['#b1b2a2', '#8f958e', '#a4a99c', '#666b64'],
      plaster: ['#ccc7ad', '#acae97', '#c0c1aa', '#737967'],
      brick: ['#a58468', '#967761', '#b18b6c', '#695b4c'],
      roof: ['#8c8c7d', '#606755', '#737966', '#4d594a'],
    };
    const objects = [],
      buildings = [],
      foliage = [],
      ground = [];
    let nextID = 1;
    const object = (kind, x, z, data = {}) => {
      const o = { kind, x, z, id: nextID++, ...data };
      objects.push(o);
      return o;
    };
    function building(x, z, w, d, h, type, options = {}) {
      const b = object('building', x, z, { w, d, h, type, ...options });
      buildings.push(b);
      return b;
    }
    building(1.8, 1.6, 4.5, 4.7, 10, 'concrete', {
      floors: 11,
      columns: 6,
      tower: true,
      fragile: true,
    });
    building(10.1, 1.8, 4.2, 3.8, 4.5, 'plaster', { floors: 4, columns: 4, waterTank: true });
    building(16.8, 2.4, 2.8, 3.8, 3.1, 'brick', {
      floors: 3,
      columns: 3,
      gable: true,
      fragile: true,
    });
    building(20.7, 5.6, 1.2, 1.3, 5.7, 'concrete', { floors: 3, columns: 1, clock: true });
    building(19.3, 9, 3.9, 4.6, 3.7, 'plaster', { floors: 3, columns: 3, fragile: true });
    building(1.1, 9.2, 3.8, 3.3, 2.1, 'plaster', { floors: 2, columns: 3, shop: true });
    building(1.3, 18, 2.9, 3.8, 2.7, 'plaster', { floors: 2, columns: 3, gable: true });
    building(4.6, 18.5, 2.2, 3.3, 2.5, 'plaster', { floors: 2, columns: 2, gable: true });
    object('tank', 20, 17.8, { height: 4.6, r: 1.15 });
    object('station', 19, 22, { w: 3.9, d: 2.0 });
    object('fountain', 12.3, 12.2);
    for (const [x, z, direction, color, bus] of [
      [4.4, 7.6, 0, '#7f9da2', false],
      [8.2, 4.3, 1, '#879e9a', false],
      [20, 15.7, 0, '#d4cfac', true],
      [15.8, 20.8, 1, '#79959b', false],
      [8.4, 18.1, 1, '#9c9c7e', false],
    ])
      object('car', x, z, { direction, color, bus });
    for (const [x, z, color] of [
      [10.2, 10.3, '#7f9875'],
      [14.3, 11.1, '#b77f57'],
      [10.6, 14.2, '#7f9875'],
      [14.5, 14.2, '#a96d4f'],
      [3.6, 13.2, '#a68e66'],
    ])
      object('stall', x, z, { color });
    for (const [x, z] of [
      [6.8, 5.5],
      [16.2, 6.3],
      [18.1, 14.8],
      [8.5, 15.1],
    ])
      object('pole', x, z);
    for (const [x, z] of [
      [9.7, 17.5],
      [15, 21.9],
      [0.8, 16],
      [18, 8],
    ])
      object('lamp', x, z);
    for (const [x, z, direction] of [
      [10.6, 21.8, 0],
      [14.6, 18.5, 1],
      [11, 9.6, 0],
      [16, 13.5, 1],
    ])
      object('bench', x, z, { direction });
    const structures = buildings
      .filter((b) => b.fragile)
      .map((b) => ReclaimFracture.build(b, buildings, random));
    const structuresById = new Map(structures.map((s) => [s.b.id, s]));
    const occupied = (x, z, margin = 0) =>
      buildings.some(
        (b) =>
          x > b.x - margin && x < b.x + b.w + margin && z > b.z - margin && z < b.z + b.d + margin,
      );
    const road = (x, z) =>
      Math.abs(x - 8) < 1.3 ||
      Math.abs(x - 16.7) < 1.1 ||
      Math.abs(z - 7.7) < 1.2 ||
      Math.abs(z - 16) < 1.2;
    const R = random(212604);
    for (let i = 0; i < 2500; i++) {
      const x = R() * 23.7 + 0.15,
        z = R() * 23.7 + 0.15;
      if (occupied(x, z, 0.04)) continue;
      ground.push({
        x,
        z,
        birth: road(x, z) ? R() * 0.55 + 0.2 : R() * 0.36 - 0.08,
        size: 0.06 + R() * 0.26,
        id: i,
      });
    }
    function tree(x, z, h, w, birth) {
      if (occupied(x, z, 0.2)) return;
      const o = object('tree', x, z, { h, w, birth, base: 0 });
      foliage.push(o);
    }
    tree(11.3, 19.8, 3.8, 2.2, -0.45);
    tree(14.1, 20.8, 3, 1.7, -0.25);
    tree(9.7, 21.3, 2.5, 1.6, -0.2);
    tree(10.1, 13.3, 3.2, 1.5, 0.38);
    for (const [x, z, h, w, birth] of [
      [6.3, 20.3, 3.5, 2, 0.1],
      [6, 14.2, 3.3, 2, 0.08],
      [1.5, 15.5, 3.1, 1.8, 0.15],
      [7, 10, 4.1, 2.2, 0.21],
      [9.3, 5.4, 3.9, 2, 0.12],
      [18.3, 11.2, 3.6, 1.8, 0.21],
      [18.4, 19.4, 4.2, 2.1, 0.18],
      [22.5, 15.7, 3.9, 1.9, 0.25],
      [13.7, 22.8, 3.2, 2, 0.2],
      [10.4, 17.5, 3.6, 1.6, 0.27],
    ])
      tree(x, z, h, w, birth);
    for (let i = 0; i < 27; i++) {
      const x = 0.6 + R() * 22.8,
        z = 0.6 + R() * 22.8;
      if (occupied(x, z, 0.35) || Math.hypot(x - 12.3, z - 12.2) < 2.2) continue;
      tree(x, z, 2 + R() * 2.1, 1 + R() * 1.2, 0.32 + R() * 0.3);
    }
    const poles = objects.filter((o) => o.kind === 'pole');
    for (let i = 0; i < poles.length - 1; i++)
      for (const offset of [-0.12, 0.12])
        for (let j = 0; j < 20; j++) {
          const a = poles[i],
            b = poles[i + 1],
            f = j / 20,
            g = (j + 1) / 20;
          object('wire', a.x + ((b.x - a.x) * (f + g)) / 2, a.z + ((b.z - a.z) * (f + g)) / 2, {
            a: [
              a.x + (b.x - a.x) * f + offset,
              a.z + (b.z - a.z) * f,
              4.55 - Math.sin(f * Math.PI) * 0.4,
            ],
            b: [
              a.x + (b.x - a.x) * g + offset,
              a.z + (b.z - a.z) * g,
              4.55 - Math.sin(g * Math.PI) * 0.4,
            ],
            sag: Math.sin(((f + g) / 2) * Math.PI),
            wire: i,
          });
        }

    function drawBase() {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      cube(0, 0, 24, 24, 1.55, ['#a3a591', '#554a3e', '#635648', '#737764'], -1.55);
      const faceZ = cosine - sine >= 0 ? 24 : 0,
        faceX = cosine + sine >= 0 ? 24 : 0;
      const ZA = P(0, faceZ),
        ZB = P(24, faceZ),
        XA = P(faceX, 0),
        XB = P(faceX, 24);
      const r = random(887);
      for (let i = 0; i < 1000; i++) {
        const front = r() < 0.5,
          t = r(),
          a = front ? ZA : XA,
          b = front ? ZB : XB,
          x = a[0] + (b[0] - a[0]) * t,
          y = a[1] + (b[1] - a[1]) * t + 2 + r() * 11;
        dot(
          x,
          y,
          ['#8e7c61', '#786b53', '#a69a7c', '#463f34'][Math.floor(r() * 4)],
          r() < 0.2 ? 2 : 1,
          1,
        );
      }
      for (let i = 0; i < 34; i++) {
        const side = r() < 0.5,
          p = side ? P(faceX, r() * 24) : P(r() * 24, faceZ),
          length = 3 + r() * 13;
        line([p[0], p[1] + 10], [p[0] + 1, p[1] + length + 10], '#5d5e4e');
        line([p[0] + 1, p[1] + length + 8], [p[0] - 1, p[1] + length + 10], '#5d5e4e');
      }
      for (let x = 0.3; x < 24; x += 0.65)
        for (let z = 0.3; z < 24; z += 0.65) {
          if (!road(x, z)) top(x, z, 0.6, 0.6, 0.01, r() < 0.25 ? '#adb09e' : '#b9bcac');
        }
      for (const x of [6.7, 15.6]) top(x, 0, 2.6, 24, 0.02, '#656a62');
      for (const z of [6.5, 14.7]) top(0, z, 24, 2.5, 0.03, '#656a62');
      for (let i = 0.5; i < 24; i += 1.5) {
        for (const x of [8, 16.8])
          if (![6.5, 14.7].some((z) => Math.abs(i - z) < 2.6))
            top(x, i, 0.08, 0.55, 0.04, '#c5c4a4');
        for (const z of [7.7, 16])
          if (![6.7, 15.6].some((x) => Math.abs(i - x) < 2.7))
            top(i, z, 0.55, 0.08, 0.04, '#c5c4a4');
      }
      for (let i = 0; i < 6; i++) {
        top(6.9 + i * 0.35, 10, 0.18, 0.7, 0.05, '#c5c8ad');
        top(10, 6.8 + i * 0.32, 0.75, 0.17, 0.05, '#c5c8ad');
        top(15.9 + i * 0.34, 18, 0.19, 0.7, 0.05, '#c5c8ad');
        top(18, 15 + i * 0.34, 0.7, 0.18, 0.05, '#c5c8ad');
      }
      for (let i = 0; i < 320; i++) {
        const x = r() * 24,
          z = r() * 24;
        if (road(x, z)) {
          const p = P(x, z, 0.06);
          dot(p[0], p[1], r() < 0.5 ? '#777b6c' : '#565e55', r() < 0.3 ? 2 : 1);
        }
      }
      // The small green square becomes the source of the new forest.
      top(9.5, 18, 5.6, 4.5, 0.06, '#7e9154');
      top(9.65, 18.2, 5.3, 0.5, 0.07, '#a6a791');
      top(9.65, 21.8, 5.3, 0.5, 0.07, '#b8b59d');
      top(11.9, 18.2, 0.5, 4, 0.08, '#aaa992');
      for (let i = 0; i < 6; i++) {
        cube(10 + i * 0.8, 22.3, 0.12, 0.12, 0.5, ['#b9b5a0', '#8e917e', '#b2b39b']);
      }
      floorLine([10, 22.3, 0.4], [14.3, 22.3, 0.4], '#c4c0a9');
    }
    const baseCanvas = document.createElement('canvas');
    baseCanvas.width = WIDTH;
    baseCanvas.height = HEIGHT;
    const baseContext = baseCanvas.getContext('2d');
    let baseProjection = null;
    function rebuildBase() {
      drawBase();
      baseContext.clearRect(0, 0, WIDTH, HEIGHT);
      baseContext.drawImage(buffer, 0, 0);
      baseProjection = projectionKey;
    }
    projectCamera();
    rebuildBase();

    function roofMoss(b, age, r) {
      for (let i = 0; i < 190; i++) {
        const x = b.x + r() * b.w,
          z = b.z + r() * b.d,
          threshold = r() * 0.8,
          extent = 0.08 + r() * 0.36;
        if (age < threshold) continue;
        const s = extent * ease(threshold, threshold + 0.15, age);
        top(x, z, s, s * 0.8, b.h + 0.31, ['#81974d', '#657e43', '#9ca964', '#6d874a'][i % 4]);
      }
    }
    function drawBuilding(b, age, night) {
      const r = random(b.id * 7919),
        col = palette[b.type],
        base = 0.13;
      cube(
        b.x - 0.12,
        b.z - 0.12,
        b.w + 0.24,
        b.d + 0.24,
        0.16,
        ['#c6c5b2', '#9ea58e', '#a5ac95'],
        0,
      );
      if (b.fragile) {
        ReclaimMasonry.draw(structuresById.get(b.id), age, night, {
          P,
          dot,
          line,
          poly,
          faceX: cosine + sine,
          faceZ: cosine - sine,
          distance: (p) =>
            depth(p[0], p[1]) + p[2] * 1.1547 * Math.tan((camera.pitch * Math.PI) / 180),
        });
        if (b.tower) {
          const x = b.x + 0.54,
            z = b.z + 0.6,
            h = b.h + 0.28;
          cube(x - 0.17, z - 0.16, 0.43, 0.42, 0.28, ['#a9af9e', '#798477', '#929c8b'], h);
          floorLine([x, z, h + 0.24], [x, z, h + 1.65], '#646f62');
          floorLine([x - 0.33, z, h + 1.29], [x + 0.35, z, h + 1.29], '#788674');
        }
        return;
      }
      cube(b.x, b.z, b.w, b.d, b.h, col, base);
      for (const side of [0, 1]) {
        const facing = side === 0 ? Math.sign(cosine - sine) || 1 : Math.sign(cosine + sine) || 1;
        const length = side === 0 ? b.w : b.d,
          count = side === 0 ? b.columns : Math.max(2, b.columns - 1),
          fixed =
            side === 0
              ? b.z + (facing > 0 ? b.d + 0.005 : -0.005)
              : b.x + (facing > 0 ? b.w + 0.005 : -0.005);
        for (let floor = 0; floor < b.floors; floor++) {
          const hh = b.h / b.floors,
            yy = base + floor * hh + 0.22;
          if (floor > 0)
            wall(
              side,
              side === 0 ? b.x : fixed,
              side === 0 ? fixed : b.z,
              base + floor * hh - 0.04,
              length,
              0.06,
              side === 0 ? '#a6ad9a' : '#b8beaa',
            );
          for (let j = 0; j < count; j++) {
            const offset = (length * (j + 0.25)) / count,
              ww = (length / count) * 0.5,
              wh = hh * 0.49;
            const x = side === 0 ? b.x + offset : fixed,
              z = side === 0 ? fixed : b.z + offset,
              chance = r();
            const broken = chance < age * 0.32;
            const color = broken
              ? '#3b443c'
              : night > 0.3 && age < 0.09 && chance > 0.48
                ? '#d7ba70'
                : side === 0
                  ? '#667c7b'
                  : '#819492';
            wall(
              side,
              x - 0.035,
              z - 0.035,
              yy - 0.055,
              ww + 0.12,
              wh + 0.1,
              side === 0 ? '#afb8a7' : '#bec5b1',
            );
            wall(side, x, z, yy, ww, wh, color);
            if (!broken) wall(side, x, z, yy + wh * 0.55, ww, 0.04, '#acb7aa');
            if (chance < age * 0.12) wall(side, x, z, yy + wh * 0.25, ww, 0.09, '#7d7357');
          }
        }
        for (let i = 0; i < 45; i++) {
          const along = r() * length,
            yy = r() * b.h;
          const p = side === 0 ? P(b.x + along, fixed, yy) : P(fixed, b.z + along, yy);
          if (r() < 0.15 + age * 0.25)
            dot(
              p[0],
              p[1],
              ['#777e6b', '#b1b49c', '#888e7c', '#717865'][i % 4],
              r() < 0.4 ? 2 : 1,
              1,
            );
        }
        // Cracks branch down the same facade as the timeline progresses.
        for (let c = 0; c < 3; c++) {
          const along = length * (0.22 + c * 0.3),
            height = b.h * (0.7 - c * 0.12),
            g = ease(0.12, 0.78, age);
          let last = side === 0 ? P(b.x + along, fixed, height) : P(fixed, b.z + along, height);
          for (let i = 1; i < 9; i++) {
            const a = along + Math.sin(i * 1.8 + c) * 0.08,
              h = height - i * 0.16 * g;
            const point = side === 0 ? P(b.x + a, fixed, h) : P(fixed, b.z + a, h);
            if (g > 0) line(last, point, '#69725f');
            last = point;
          }
        }
      }
      if (b.gable) {
        const h = b.h + base,
          ridge = h + 1.1,
          A = P(b.x - 0.1, b.z - 0.12, h),
          B = P(b.x + b.w + 0.1, b.z - 0.12, h),
          C = P(b.x + b.w + 0.1, b.z + b.d + 0.12, h),
          D = P(b.x - 0.1, b.z + b.d + 0.12, h),
          R1 = P(b.x + b.w / 2, b.z - 0.12, ridge),
          R2 = P(b.x + b.w / 2, b.z + b.d + 0.12, ridge);
        const roofFaces = [
          { p: [A, R1, R2, D], c: '#716555', d: depth(b.x, b.z + b.d / 2) },
          { p: [R1, B, C, R2], c: '#645c50', d: depth(b.x + b.w, b.z + b.d / 2) },
        ];
        roofFaces.sort((a, b) => a.d - b.d);
        roofFaces.forEach((f) => poly(f.p, f.c));
        poly(cosine - sine >= 0 ? [D, C, R2] : [A, B, R1], '#b1ac8e');
        outline([A, R1, B, C, R2, D], '#58574a');
        line(R1, R2, '#8c7d65');
        for (let i = 0; i < 15; i++) {
          const zz = b.z + (i * b.d) / 14;
          line(P(b.x - 0.05, zz, h + 0.02), P(b.x + b.w / 2, zz, ridge), '#625a4c');
        }
        cube(
          b.x + 0.25,
          b.z + 0.65,
          0.35,
          0.35,
          1.05,
          ['#a38365', '#785946', '#9b7656'],
          b.h + 0.5,
        );
      } else {
        cube(
          b.x - 0.05,
          b.z - 0.05,
          b.w + 0.1,
          b.d + 0.1,
          0.18,
          ['#c0c0ab', '#9fa38e', '#adb39c'],
          b.h + 0.1,
        );
        top(b.x + 0.14, b.z + 0.14, b.w - 0.28, b.d - 0.28, b.h + 0.29, '#888e7d');
        for (const [x, z, w, d] of [
          [b.x, b.z, b.w, 0.1],
          [b.x, b.z, 0.1, b.d],
          [b.x, b.z + b.d - 0.1, b.w, 0.1],
          [b.x + b.w - 0.1, b.z, 0.1, b.d],
        ])
          cube(x, z, w, d, 0.25, ['#c4c6b0', '#929b83', '#b7bda5'], b.h + 0.22);
        if (!b.waterTank && !b.clock) {
          cube(
            b.x + 0.6,
            b.z + 0.5,
            0.65,
            0.8,
            0.32,
            ['#adb3a0', '#778671', '#98a38f'],
            b.h + 0.31,
          );
          top(b.x + 0.69, b.z + 0.6, 0.47, 0.58, b.h + 0.64, '#6e7d70');
        }
        roofMoss(b, age, random(b.id * 119));
      }
      if (b.waterTank)
        drawTank(
          { x: b.x + 2.1, z: b.z + 1.8, height: 2.0, r: 0.66, base: b.h + 0.35, id: b.id },
          age,
        );
      if (b.shop) {
        if (cosine - sine >= 0) {
          const a = P(b.x + 0.1, b.z + b.d + 0.1, 1.5),
            c = P(b.x + b.w - 0.1, b.z + b.d + 0.1, 1.5),
            d = P(b.x + b.w - 0.1, b.z + b.d + 0.9, 1.2),
            e = P(b.x + 0.1, b.z + b.d + 0.9, 1.2);
          poly([a, c, d, e], '#d5d0ab');
          outline([a, c, d, e], '#828e70');
          for (let i = 0; i < 7; i++)
            poly(
              [
                P(b.x + 0.2 + i * 0.5, b.z + b.d + 0.1, 1.51),
                P(b.x + 0.43 + i * 0.5, b.z + b.d + 0.1, 1.51),
                P(b.x + 0.43 + i * 0.5, b.z + b.d + 0.9, 1.21),
                P(b.x + 0.2 + i * 0.5, b.z + b.d + 0.9, 1.21),
              ],
              '#719582',
            );
        }
        cube(b.x + 0.7, b.z + 0.4, 2.5, 0.17, 1.1, ['#92a296', '#798f85', '#829a8f'], b.h + 0.33);
        for (let i = 0; i < 11; i++) {
          const p = P(b.x + 0.85 + i * 0.18, b.z + 0.58, b.h + 0.8);
          dot(p[0], p[1], '#c8c69f', 1, 2);
        }
      }
      if (b.clock) {
        const p = P(b.x + b.w * 0.55, b.z + (cosine - sine >= 0 ? b.d + 0.02 : -0.02), b.h - 0.75);
        ellipse(p[0], p[1], 4, 4, '#4e584c');
        ellipse(p[0], p[1], 3, 3, '#c9c6a7');
        line(p, [p[0], p[1] - 2], '#5e604e');
        line(p, [p[0] + 2, p[1] + 1], '#5e604e');
        cube(
          b.x - 0.15,
          b.z - 0.15,
          b.w + 0.3,
          b.d + 0.3,
          0.23,
          ['#898979', '#697263', '#7d8571'],
          b.h + 0.5,
        );
        const a = P(b.x - 0.12, b.z - 0.12, b.h + 0.73),
          c = P(b.x + b.w + 0.12, b.z + b.d + 0.12, b.h + 0.73),
          peak = P(b.x + b.w / 2, b.z + b.d / 2, b.h + 1.6);
        poly([a, P(b.x + b.w + 0.12, b.z - 0.12, b.h + 0.73), c, peak], '#6f7767');
        poly([a, peak, c, P(b.x - 0.12, b.z + b.d + 0.12, b.h + 0.73)], '#5b6859');
        floorLine([b.x + 0.6, b.z + 0.6, b.h + 1.4], [b.x + 0.6, b.z + 0.6, b.h + 2.1], '#665c48');
        floorLine(
          [b.x + 0.35, b.z + 0.6, b.h + 1.85],
          [b.x + 0.85, b.z + 0.6, b.h + 1.85],
          '#665c48',
        );
      }
      // Ivy is painted on each visible face, growing upward from fixed roots.
      for (const side of [0, 1]) {
        const r = random(b.id * 123 + side),
          count = Math.floor((side ? b.d : b.w) * 2.2),
          face = side === 0 ? cosine - sine >= 0 : cosine + sine >= 0;
        for (let v = 0; v < count; v++) {
          const offset = r() * (side ? b.d : b.w),
            length = Math.min(b.h * (0.5 + r() * 0.65), b.h + 0.15),
            g = ease(0.08 + r() * 0.28, 0.85, age);
          for (let i = 0; i < length * 9 * g; i++) {
            const yy = i / 9 + 0.15,
              o = offset + Math.sin(i * 0.65 + v) * 0.08;
            const p =
              side === 0
                ? P(b.x + o, b.z + (face ? b.d + 0.03 : -0.03), yy)
                : P(b.x + (face ? b.w + 0.03 : -0.03), b.z + o, yy);
            dot(p[0], p[1], side ? '#536d39' : '#52683b');
            if (i % 2 === 0)
              dot(p[0] + (i % 4 ? -1 : 1), p[1], ['#7e984a', '#97a85b', '#6b8741'][i % 3], 2, 1);
          }
        }
      }
    }
    const buildingCache = new Map();
    function cachedBuilding(b, age, night) {
      const key = projectionKey + ':' + age.toFixed(5) + ':' + night.toFixed(3);
      let cached = buildingCache.get(b.id);
      if (!cached || cached.key !== key) {
        const margin = b.fragile ? 3.95 : 1.6,
          corners = [];
        for (const x of [b.x - margin, b.x + b.w + margin])
          for (const z of [b.z - margin, b.z + b.d + margin])
            for (const h of [-0.2, b.h + 3.5]) corners.push(P(x, z, h));
        const left = Math.min(...corners.map((p) => p[0])) - 3,
          topY = Math.min(...corners.map((p) => p[1])) - 3,
          right = Math.max(...corners.map((p) => p[0])) + 3,
          bottom = Math.max(...corners.map((p) => p[1])) + 3;
        const sprite = cached?.sprite || document.createElement('canvas');
        sprite.width = right - left;
        sprite.height = bottom - topY;
        const original = ctx;
        ctx = sprite.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.translate(-left, -topY);
        drawBuilding(b, age, night);
        ctx = original;
        cached = { key, sprite, left, top: topY };
        buildingCache.set(b.id, cached);
      }
      ctx.drawImage(cached.sprite, cached.left, cached.top);
    }

    function drawTank(o, age) {
      const base = o.base || 0.1,
        h = o.height,
        radius = o.r,
        center = P(o.x, o.z, base + h),
        rx = radius * screenX,
        ry = radius * screenZ;
      for (const [dx, dz] of [
        [-0.65, -0.65],
        [0.65, -0.65],
        [-0.65, 0.65],
        [0.65, 0.65],
      ])
        floorLine(
          [o.x + dx, o.z + dz, base],
          [o.x + dx * 0.7, o.z + dz * 0.7, base + h - 0.55],
          '#5f6558',
        );
      for (let i = 0; i < 4; i++) {
        const a = base + (i * (h - 0.4)) / 4,
          b = base + ((i + 1) * (h - 0.4)) / 4;
        floorLine([o.x - 0.65, o.z + 0.65, a], [o.x + 0.65, o.z + 0.65, b], '#757b65');
        floorLine([o.x + 0.65, o.z + 0.65, a], [o.x - 0.65, o.z + 0.65, b], '#757b65');
      }
      ellipse(center[0], center[1] + 10, rx, ry, '#586c68');
      ctx.fillStyle = '#758e8c';
      ctx.fillRect(center[0] - Math.round(rx), center[1] - 2, Math.round(rx) * 2 + 1, 12);
      ellipse(center[0], center[1] - 2, rx, ry, '#aec0ae');
      for (let j = -Math.floor(rx); j < rx; j += 3)
        line([center[0] + j, center[1] + 1], [center[0] + j, center[1] + 11], '#617b79');
      ellipse(center[0], center[1] + 9, rx, ry, '#687c75');
      const r = random(o.id * 821);
      for (let i = 0; i < 80; i++) {
        const xx = (r() - 0.5) * rx * 1.8,
          yy = r() * 14 - 5;
        if (r() < 0.15 + age * 0.8)
          dot(
            center[0] + xx,
            center[1] + yy,
            ['#9f7651', '#ad875c', '#6c7c62'][i % 3],
            r() < 0.3 ? 2 : 1,
            1,
          );
      }
      if (radius < 0.8) {
        ctx.fillStyle = '#8c7458';
        ctx.fillRect(center[0] - Math.round(rx), center[1] - 2, Math.round(rx) * 2, 12);
        ellipse(center[0], center[1] - 2, rx, ry, '#ac9370');
        for (let i = -rx; i < rx; i += 3)
          line([center[0] + i, center[1]], [center[0] + i, center[1] + 11], '#655a43');
      }
    }
    function drawTree(o, age, time) {
      const g =
        o.birth < 0
          ? 0.48 + 0.52 * ease(0, 0.65, age)
          : ease(o.birth, Math.min(1, o.birth + 0.35), age);
      if (g < 0.025) return;
      const pos = P(o.x, o.z, o.base),
        height = o.h * screenH * g,
        width = o.w * screenX * g,
        r = random(o.id * 613),
        sway = Math.round(Math.sin(time * 0.7 + o.id) * g * 0.65),
        cx = pos[0] + sway,
        cy = pos[1] - height;
      const trunk = Math.max(1, Math.round(g * 2));
      dot(pos[0] - trunk / 2, pos[1] - height * 0.68, '#5f563b', trunk, height * 0.7);
      dot(pos[0], pos[1] - height * 0.6, '#958458', 1, height * 0.59);
      line([pos[0], pos[1] - height * 0.35], [cx - width * 0.5, cy + height * 0.15], '#685b3b');
      line([pos[0], pos[1] - height * 0.45], [cx + width * 0.5, cy + height * 0.12], '#7e7048');
      const rx = width * 0.83,
        ry = width * (o.id % 4 === 0 ? 0.94 : 0.78);
      ellipse(cx, cy + 2, rx + 1, ry + 1, '#3f5a33');
      ellipse(cx, cy, rx, ry, '#62813c');
      ellipse(cx - rx * 0.32, cy - ry * 0.25, rx * 0.7, ry * 0.73, '#86a44a');
      ellipse(cx + rx * 0.45, cy + ry * 0.26, rx * 0.55, ry * 0.68, '#4d7037');
      ellipse(cx - rx * 0.26, cy - ry * 0.57, rx * 0.5, ry * 0.45, '#94ac53');
      ellipse(cx + rx * 0.32, cy - ry * 0.48, rx * 0.5, ry * 0.54, '#719342');
      for (let i = 0; i < 370; i++) {
        const xx = (r() * 2 - 1) * rx,
          yy = (r() * 2 - 1) * ry;
        if ((xx * xx) / (rx * rx) + (yy * yy) / (ry * ry) > 0.91) continue;
        const shade = (xx / rx) * 0.23 + (yy / ry) * 0.5 + r() * 0.24;
        const color =
          shade > 0.3
            ? ['#456632', '#557738', '#63813c'][i % 3]
            : shade < -0.18
              ? ['#a6b96a', '#96ad55', '#b1be71'][i % 3]
              : ['#6c8b3f', '#809b48', '#8ba44d'][i % 3];
        dot(cx + xx, cy + yy, color, i % 7 === 0 ? 2 : 1, i % 11 === 0 ? 2 : 1);
      }
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        dot(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, '#7b9844');
      }
      for (let i = 0; i < 3; i++)
        line([pos[0], pos[1]], [pos[0] - 3 + i * 3, pos[1] + 2], '#6b6545');
    }
    const walkRoutes = [
      [
        [0.7, 6.1],
        [6.3, 6.1],
        [6.3, 0.7],
        [0.7, 0.7],
      ],
      [
        [9.7, 9.4],
        [15.1, 9.4],
        [15.1, 14.3],
        [9.7, 14.3],
      ],
      [
        [9.7, 17.8],
        [15.1, 17.8],
        [15.1, 22.5],
        [9.7, 22.5],
      ],
      [
        [18.4, 8.6],
        [23.5, 8.6],
        [23.5, 14.2],
        [18.4, 14.2],
      ],
    ];
    function alongRoute(points, distance) {
      const lengths = points.map((p, i) =>
        Math.hypot(
          points[(i + 1) % points.length][0] - p[0],
          points[(i + 1) % points.length][1] - p[1],
        ),
      );
      let remaining = distance % lengths.reduce((a, b) => a + b, 0);
      for (let i = 0; i < points.length; i++) {
        if (remaining <= lengths[i]) {
          const a = points[i],
            b = points[(i + 1) % points.length],
            t = remaining / lengths[i];
          return {
            x: a[0] + (b[0] - a[0]) * t,
            z: a[1] + (b[1] - a[1]) * t,
            dx: b[0] - a[0],
            dz: b[1] - a[1],
          };
        }
        remaining -= lengths[i];
      }
      return { x: points[0][0], z: points[0][1], dx: 1, dz: 0 };
    }
    function actors(age, time) {
      const count = Math.round(22 * (1 - ease(0.12, 0.66, age))),
        result = [];
      for (let i = 0; i < count; i++) {
        const route = walkRoutes[i % walkRoutes.length],
          p = alongRoute(route, i * 4.31 + time * (0.42 + (i % 4) * 0.08));
        result.push({ kind: 'person', ...p, id: 1000 + i, phase: time * 5 + i });
      }
      for (let i = 0; i < (age > 0.45 ? 3 : 1); i++) {
        const p = alongRoute(walkRoutes[2], i * 7.1 + time * 0.28);
        result.push({ kind: 'animal', ...p, id: 2000 + i, phase: time * 6 + i });
      }
      if (age < 0.42) {
        for (let i = 0; i < 2; i++) {
          const p = alongRoute(
            [
              [8, 2],
              [8, 16],
              [16.8, 16],
              [16.8, 7.7],
              [8, 7.7],
            ],
            i * 19 + time * 1.1,
          );
          result.push({
            kind: 'car',
            ...p,
            id: 3000 + i,
            direction: Math.abs(p.dx) > Math.abs(p.dz) ? 0 : 1,
            color: i ? '#9e8061' : '#748e90',
            bus: false,
          });
        }
      }
      return result;
    }
    function drawPerson(o) {
      const p = P(o.x, o.z, 0.1),
        swing = Math.floor(o.phase) % 4 < 2 ? 1 : -1,
        facing = o.dx - o.dz >= 0 ? 1 : -1;
      ellipse(p[0] + 1, p[1] + 1, 2, 1, '#8c947f');
      dot(
        p[0] - 1,
        p[1] - 6,
        ['#567b92', '#a36f51', '#b09a5a', '#527c61', '#966759', '#717586'][o.id % 6],
        3,
        4,
      );
      dot(p[0], p[1] - 8, '#d0ac85', 2, 2);
      dot(p[0] - 1, p[1] - 9, '#62533f', 3, 1);
      dot(p[0] - 1, p[1] - 2, '#454f48', 1, 3);
      dot(p[0] + 1 + swing, p[1] - 1, '#45534b', 1, 2);
      dot(p[0] + facing * 2, p[1] - 4, '#c1a17d');
      if (o.id % 4 === 0) dot(p[0] - facing * 2, p[1] - 4, '#856747', 1, 3);
    }
    function drawAnimal(o) {
      const p = P(o.x, o.z, 0.1),
        facing = o.dx - o.dz >= 0 ? 1 : -1,
        body = o.id % 2 ? '#ac8453' : '#59634d';
      ellipse(p[0], p[1] + 1, 3, 1, '#879374');
      dot(p[0] - 2, p[1] - 2, body, 4, 2);
      dot(p[0] + facing * 2, p[1] - 3, body, 2, 2);
      dot(p[0] + facing * 3, p[1] - 4, body);
      dot(p[0] - facing * 3, p[1] - 3, body, 2, 1);
      dot(p[0] - 1, p[1], '#586248');
      dot(p[0] + (Math.floor(o.phase) % 2 ? 2 : 1), p[1], '#586248');
    }
    function drawCar(o, age) {
      const w = o.direction === 0 ? (o.bus ? 3.3 : 1.5) : 0.75,
        d = o.direction === 0 ? 0.85 : o.bus ? 3.3 : 1.5,
        h = o.bus ? 0.95 : 0.42;
      cube(o.x, o.z, w, d, h, ['#b7c6b5', o.color, o.color, '#526359'], 0.22);
      cube(
        o.x + 0.13,
        o.z + 0.12,
        w - 0.27,
        d - 0.24,
        0.32,
        ['#c4cbbb', '#637e7c', '#8da5a1'],
        h + 0.21,
      );
      for (const [x, z] of [
        [o.x + 0.15, o.z + d],
        [o.x + w - 0.18, o.z + d],
        [o.x + w, o.z + 0.17],
        [o.x + w, o.z + d - 0.17],
      ]) {
        const p = P(x, z, 0.15);
        dot(p[0], p[1], '#454e45', 2, 2);
      }
      const r = random(o.id * 777);
      for (let i = 0; i < 15; i++) {
        if (r() < age * 0.8) {
          const p = P(o.x + r() * w, o.z + r() * d, h + 0.55);
          dot(p[0], p[1], i % 2 ? '#8b7752' : '#99a077', 2, 1);
        }
      }
    }
    function drawBench(o) {
      for (const offset of [0.08, 0.72])
        floorLine([o.x + offset, o.z, 0.1], [o.x + offset, o.z, 0.5], '#6c735e');
      for (let i = 0; i < 3; i++)
        floorLine([o.x, o.z + i * 0.13, 0.5], [o.x + 1.1, o.z + i * 0.13, 0.5], '#a3926c');
      floorLine([o.x, o.z, 0.88], [o.x + 1.1, o.z, 0.88], '#9d8c67');
      floorLine([o.x, o.z, 0.69], [o.x + 1.1, o.z, 0.69], '#9d8c67');
    }
    function drawStall(o, age) {
      cube(o.x, o.z, 1.15, 0.8, 0.6, ['#b1a68b', '#8c8c70', '#9fa38b'], 0.1);
      for (const [x, z] of [
        [o.x, o.z],
        [o.x + 1.15, o.z],
        [o.x, o.z + 0.8],
        [o.x + 1.15, o.z + 0.8],
      ])
        floorLine([x, z, 0.7], [x, z, 1.65], '#8b8a6e');
      top(o.x - 0.12, o.z - 0.12, 1.4, 1.04, 1.65, '#dbd3ae');
      for (let i = 0; i < 4; i++) top(o.x - 0.1 + i * 0.36, o.z - 0.12, 0.16, 1.04, 1.66, o.color);
      const p = P(o.x + 0.2, o.z + 0.4, 0.8);
      dot(p[0], p[1], age > 0.65 ? '#879e53' : '#a8814e', 2, 2);
    }
    function drawStation(o, age) {
      for (const [dx, dz] of [
        [0, 0],
        [o.w, 0],
        [0, o.d],
        [o.w, o.d],
      ])
        cube(o.x + dx, o.z + dz, 0.13, 0.13, 1.4, ['#c9c2a1', '#8d957a', '#b7ba9f'], 0.1);
      cube(
        o.x - 0.25,
        o.z - 0.2,
        o.w + 0.5,
        o.d + 0.4,
        0.18,
        ['#c7c8ab', '#9b6e4e', '#b08a66'],
        1.5,
      );
      for (let i = 0; i < 3; i++) {
        const x = o.x + 0.4 + i * 1.1;
        cube(x, o.z + 0.45, 0.4, 0.45, 0.75, ['#afbba6', '#627c71', '#8c9f88'], 0.1);
        wall(0, x + 0.06, o.z + 0.91, 0.45, 0.24, 0.23, '#d5ceab');
      }
      const r = random(676);
      for (let i = 0; i < 40; i++) {
        if (r() < age) {
          const x = o.x + r() * o.w,
            z = o.z + r() * o.d;
          top(x, z, 0.18, 0.18, 1.7, i % 3 ? '#87964e' : '#a0a65f');
        }
      }
    }
    function drawFountain(o, age, time) {
      const p = P(o.x, o.z, 0.08),
        flat = screenZ / 4.5;
      ellipse(p[0], p[1], 22, 11 * flat, '#7c8573');
      ellipse(p[0], p[1] - 1, 21, 10 * flat, '#c3bfa4');
      ellipse(p[0], p[1] - 2, 16, 7 * flat, '#a4ad99');
      ellipse(p[0], p[1] - 3, 14, 6 * flat, age > 0.55 ? '#798d6c' : '#7caaa9');
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI) / 6;
        dot(p[0] + Math.cos(a) * 18, p[1] - 2 + Math.sin(a) * 8 * flat, '#93947e', 2, 1);
      }
      cube(o.x - 0.25, o.z - 0.25, 0.5, 0.5, 0.5, ['#b6b5a0', '#89917d', '#a5ac94'], 0.15);
      if (age < 0.18) {
        const yy = p[1] - 9 + Math.sin(time * 4) * 0.5;
        line([p[0], p[1] - 6], [p[0], yy], '#b2d1c0');
        dot(p[0] - 2, yy + 2, '#c2d5bd');
        dot(p[0] + 2, yy + 2, '#c2d5bd');
      }
      for (let i = 0; i < 3; i++) {
        const phase = (time * 0.4 + i * 0.31) % 1;
        line(
          [p[0] - 8 + i * 6, p[1] - 3 + Math.round(phase * 3)],
          [p[0] - 5 + i * 6, p[1] - 3 + Math.round(phase * 3)],
          age > 0.6 ? '#a5b18a' : '#b4c8b7',
        );
      }
    }
    function drawPole(o, age) {
      floorLine([o.x, o.z, 0], [o.x, o.z, 4.9], '#74634a');
      floorLine([o.x + 0.1, o.z, 0], [o.x + 0.1, o.z, 4.9], '#aa9270');
      floorLine([o.x - 0.4, o.z, 4.55], [o.x + 0.4, o.z, 4.55], '#81765b');
      for (const dx of [-0.3, 0.3]) {
        const p = P(o.x + dx, o.z, 4.64);
        dot(p[0], p[1], '#9fada0', 2, 2);
      }
    }
    function drawLamp(o, night, age) {
      floorLine([o.x, o.z, 0.08], [o.x, o.z, 2.5], '#5b6d60');
      floorLine([o.x, o.z, 2.5], [o.x + 0.35, o.z, 2.5], '#5b6d60');
      const p = P(o.x + 0.35, o.z, 2.42);
      dot(p[0] - 1, p[1], night > 0.4 && age < 0.1 ? '#e0c77d' : '#b5b89a', 3, 2);
      dot(p[0] - 1, p[1] - 1, '#536756', 3, 1);
    }
    let previousDebrisAge = -1,
      lastAge = -1,
      lastNight = -1,
      lastFrame = -1,
      lastView = '';
    function render(age, night = 0, time = 0, motion = true) {
      age = clamp(age);
      night = clamp(night);
      const frame = Math.floor(time * 14),
        view = JSON.stringify(camera);
      if (
        Math.abs(age - lastAge) < 0.0001 &&
        Math.abs(night - lastNight) < 0.001 &&
        (!motion || frame === lastFrame) &&
        view === lastView
      )
        return false;
      projectCamera();
      if (baseProjection !== projectionKey) rebuildBase();
      lastAge = age;
      lastNight = night;
      lastFrame = frame;
      lastView = view;
      ctx.drawImage(baseCanvas, 0, 0);
      ctx.globalAlpha = 0.18;
      function shadow(x, z, w, d, h) {
        const dx = h * 0.32,
          dz = -h * 0.1;
        poly(
          [
            P(x, z + d),
            P(x + w, z + d),
            P(x + w + dx, z + d + dz),
            P(x + w + dx, z + dz),
            P(x + dx, z + dz),
          ],
          '#4e604c',
        );
      }
      for (const b of buildings) {
        const structure = structuresById.get(b.id);
        if (!structure || age < structure.start) {
          shadow(b.x, b.z, b.w, b.d, b.h);
          continue;
        }
        for (const p of structure.parts)
          if ((p.kind === 'floor' || p.kind === 'roof') && p.at > age) {
            const above = structure.cells.get([p.cell.x, p.cell.z, p.cell.f + 1].join('/'));
            if (above && above.at > age) continue;
            shadow(p.v[0][0], p.v[0][1], p.v[1][0] - p.v[0][0], p.v[3][1] - p.v[0][1], p.center[2]);
          }
      }
      ctx.globalAlpha = 1;
      for (const g of ground) {
        const growth = ease(g.birth, g.birth + 0.22, age);
        if (growth < 0.05) continue;
        const p = P(g.x, g.z, 0.07),
          color = ['#7d914b', '#94a05e', '#657c42', '#a1a66a'][g.id % 4];
        top(g.x, g.z, g.size * growth, g.size * 0.8 * growth, 0.07, color);
        if (g.id % 3 === 0) {
          dot(p[0], p[1] - growth * 2, color);
          dot(p[0] + 1, p[1] - growth * 3, '#9bab64');
        }
        if (g.id % 59 === 0 && age > 0.4) dot(p[0], p[1] - 2, '#c3b777');
      }
      for (const o of foliage) {
        if (o.base > 0) continue;
        const g =
          o.birth < 0
            ? 0.48 + 0.52 * ease(0, 0.65, age)
            : ease(o.birth, Math.min(1, o.birth + 0.35), age);
        if (g < 0.06) continue;
        const p = P(o.x, o.z, 0.08);
        ellipse(p[0] + 3, p[1] + 1, o.w * 8 * g, o.w * 3.2 * g, '#828e6a');
        ellipse(p[0] + 2, p[1], o.w * 5 * g, o.w * 2 * g, '#77875b');
      }
      const moving = actors(age, motion ? time : 0),
        ordered = [...objects, ...moving];
      ordered.sort(
        (a, b) =>
          depth(a.x + (a.w || 0) / 2, a.z + (a.d || 0) / 2) -
            depth(b.x + (b.w || 0) / 2, b.z + (b.d || 0) / 2) || a.id - b.id,
      );
      for (const o of ordered) {
        switch (o.kind) {
          case 'building':
            cachedBuilding(o, age, night);
            break;
          case 'tree':
            drawTree(o, age, motion ? time : 0);
            break;
          case 'tank':
            drawTank(o, age);
            break;
          case 'car':
            drawCar(o, age);
            break;
          case 'bench':
            drawBench(o);
            break;
          case 'stall':
            drawStall(o, age);
            break;
          case 'station':
            drawStation(o, age);
            break;
          case 'fountain':
            drawFountain(o, age, time);
            break;
          case 'pole':
            drawPole(o, age);
            break;
          case 'lamp':
            drawLamp(o, night, age);
            break;
          case 'person':
            drawPerson(o);
            break;
          case 'animal':
            drawAnimal(o);
            break;
          case 'wire': {
            const drop = o.wire === 1 ? ease(0.63, 0.95, age) * o.sag * 2.4 : 0;
            floorLine([o.a[0], o.a[1], o.a[2] - drop], [o.b[0], o.b[1], o.b[2] - drop], '#596553');
            break;
          }
        }
      }
      // Butterflies and airborne leaves give the later forest its own motion.
      for (let i = 0; i < Math.floor(age * 17); i++) {
        const t = motion ? time : 0,
          x = 10 + Math.sin(t * 0.17 + i * 2.4) * 4.3,
          z = 17 + Math.cos(t * 0.12 + i * 1.9) * 5.1,
          h = 1 + Math.sin(t * 0.37 + i) * 0.7,
          p = P(x, z, h);
        if (i % 3 === 0) {
          dot(p[0] - 1, p[1], i % 2 ? '#d4be76' : '#b2b98a');
          dot(p[0] + 1, p[1] + (Math.floor(t * 5 + i) % 2), '#c1ab68');
        } else if (age > 0.65) dot(p[0], p[1], '#a3a668');
      }
      if (night > 0.005) {
        const pixels = ctx.getImageData(0, 0, WIDTH, HEIGHT),
          data = pixels.data;
        const bg = [23, 33, 39];
        for (let i = 0; i < data.length; i += 4) {
          const white = data[i] === 255 && data[i + 1] === 255 && data[i + 2] === 255;
          for (let c = 0; c < 3; c++) {
            const target = white ? bg[c] : data[i + c] * [0.37, 0.47, 0.58][c] + [1, 4, 5][c];
            data[i + c] = Math.round(data[i + c] * (1 - night) + target * night);
          }
        }
        ctx.putImageData(pixels, 0, 0);
        if (age > 0.2) {
          const r = random(1109);
          for (let i = 0; i < 40; i++) {
            const x = r() * 24,
              z = r() * 24;
            if (occupied(x, z, 0.3)) continue;
            const p = P(x, z, 0.2 + r() * 1.8);
            if (Math.sin(time * 1.2 + i) > -0.2) dot(p[0], p[1], i % 3 ? '#b9c581' : '#dbd3a0');
          }
        }
      }
      if (night < 0.4) {
        for (let i = 0; i < 5; i++) {
          const phase = motion ? time * 0.012 : 0,
            x = (0.18 + i * 0.13 + phase) % 1;
          const px = 100 + x * 260,
            py = 52 + Math.sin(x * 8 + i) * 11 + i * 4,
            flap = motion ? Math.floor(time * 4 + i) % 2 : 0;
          dot(px, py, '#747c6a');
          dot(px - 1, py - flap, '#747c6a');
          dot(px + 1, py - flap, '#747c6a');
        }
      }
      display.fillStyle = `rgb(${[23, 33, 39].map((v) => Math.round(255 * (1 - night) + v * night)).join(',')})`;
      display.fillRect(0, 0, WIDTH, HEIGHT);
      display.imageSmoothingEnabled = false;
      display.drawImage(
        buffer,
        (1 - camera.zoom) * 240 + camera.offsetX,
        (1 - camera.zoom) * 202 + camera.offsetY,
        WIDTH * camera.zoom,
        HEIGHT * camera.zoom,
      );
      canvas.dataset.people = moving.filter((o) => o.kind === 'person').length;
      canvas.dataset.animals = moving.filter((o) => o.kind === 'animal').length;
      canvas.dataset.angle = ((camera.angle * 180) / Math.PI).toFixed(1);
      canvas.dataset.zoom = camera.zoom.toFixed(2);
      canvas.dataset.pitch = camera.pitch.toFixed(1);
      if (age !== previousDebrisAge) {
        let fallen = 0,
          airborne = 0;
        for (const s of structures)
          for (const chip of s.chips) {
            if (age >= chip.land) fallen++;
            else if (age >= chip.launch) airborne++;
          }
        Object.assign(canvas.dataset, {
          damagedBuildings: structures.filter((s) => age >= s.start).length,
          settledFragments: fallen,
          airborneFragments: airborne,
          interiorPlants: structures.reduce(
            (n, s) => n + s.plants.filter((p) => age > p.birth).length,
            0,
          ),
        });
        previousDebrisAge = age;
      }
      return true;
    }
    render(0.3);
    function setCamera(next) {
      for (const key of ['angle', 'pitch', 'zoom', 'offsetX', 'offsetY'])
        if (Number.isFinite(next[key])) camera[key] = next[key];
      const fullTurn = Math.PI * 2;
      camera.angle = ((camera.angle % fullTurn) + fullTurn) % fullTurn;
      const quarter = Math.round(camera.angle / (Math.PI / 2)) * (Math.PI / 2);
      if (Math.abs(camera.angle - quarter) < 1e-10) camera.angle = quarter % fullTurn;
      camera.pitch = Math.max(MIN_PITCH, Math.min(MAX_PITCH, camera.pitch));
      camera.zoom = Math.max(0.8, Math.min(3, camera.zoom));
    }
    return {
      render,
      setCamera,
      getCamera: () => ({ ...camera }),
      project(x, z, h = 0) {
        projectCamera();
        return P(x, z, h);
      },
      structures,
      stats: {
        breakableBuildings: structures.length,
        possibleFragments: structures.reduce((n, s) => n + s.chips.length, 0),
        seed: 212604,
        buildings: buildings.length,
        trees: foliage.length,
        groundPatches: ground.length,
        width: WIDTH,
        height: HEIGHT,
        objects: objects.length,
        treesOnBuildings: foliage.filter((t) => t.base > 0 || occupied(t.x, t.z, 0.2)).length,
      },
    };
  }
  return { createCity, WIDTH, HEIGHT, DEFAULT_PITCH, MIN_PITCH, MAX_PITCH };
})();

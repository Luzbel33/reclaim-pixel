/* Pixel materials for the intact shell, exposed rooms and the same faces after fracture. */
const ReclaimMasonry = (() => {
  'use strict';
  const { surface, pose } = ReclaimFracture;
  const materials = {
    brick: {
      wall: ['#b89171', '#96745d'],
      edge: '#70594c',
      break: '#c79b74',
      core: '#805e48',
      dust: '#b19a7a',
    },
    plaster: {
      wall: ['#c2c1a8', '#a1a793'],
      edge: '#777b68',
      break: '#c7bca0',
      core: '#938a70',
      dust: '#bbb49c',
    },
    concrete: {
      wall: ['#a6ada2', '#8b9590'],
      edge: '#626e67',
      break: '#b9b8a3',
      core: '#858a78',
      dust: '#adb19f',
    },
  };
  function draw(model, age, night, g) {
    const { b } = model,
      m = materials[b.type],
      list = [],
      showBack = age >= model.start;
    const add = (center, type, part, detail, order = 0) =>
      list.push({ key: g.distance(center) + order, type, part, detail });
    for (const p of model.parts) {
      const facing = p.side < 0 ? 1 : p.normal[0] * g.faceX + p.normal[1] * g.faceZ;
      if (p.shards.length && age >= p.at) {
        for (let i = 0; i < p.shards.length; i++) {
          const s = p.shards[i],
            location = pose(s, age);
          add(location.center, 'chip', p, { ...location, s, i });
          const t = (age - s.land) / 0.018;
          if (i === 0 && t > 0 && t < 1)
            add([s.tx, s.tz, s.ground + 0.26 + t * 0.42], 'dust', p, { s, t }, 0.22);
        }
        continue;
      }
      if (p.side >= 0 && facing < -0.00001 && !showBack) continue;
      if (p.kind === 'room' && !showBack) continue;
      if (p.kind === 'floor' && !showBack) continue;
      add(p.center, 'face', p, { facing });
    }
    // The top of a surviving footing leaves a rough sill and exposed reinforcement.
    if (showBack)
      for (const p of model.parts) {
        if (p.kind !== 'wall' || age < p.at + 0.022) continue;
        const c = p.cell,
          below = model.cells.get([c.x, c.z, c.f - 1].join('/'));
        if (below && Number.isFinite(below.at) && age >= below.at) continue;
        const a = p.v[0],
          e = p.v[1],
          q = (u) => a.map((n, i) => n + (e[i] - n) * u);
        add(q(0.5), 'sill', p, { q }, 0.015);
      }
    for (const plant of model.plants)
      if (age > plant.birth) {
        const t = Math.min(1, (age - plant.birth) / plant.span),
          growth = t * t * (3 - 2 * t);
        add([plant.x, plant.z, plant.h + 0.18], 'growth', null, { plant, growth }, 0.21);
      }
    list.sort((a, b) => a.key - b.key);
    const screen = (v) => g.P(...v);
    for (const item of list) {
      const { part: p, detail: d } = item;
      if (item.type === 'growth') {
        const { plant: a, growth: growing } = d;
        const pt = (x, z, h) => screen([a.x + x, a.z + z, a.h + h]),
          base = pt(0, 0, 0),
          size = a.size * growing;
        const moss = [];
        for (let i = 0; i < 7; i++) {
          const ang = (i * Math.PI * 2) / 7 + a.seed * 6,
            rad = (i % 2 ? 0.34 : 0.43) * growing;
          moss.push(pt(Math.cos(ang) * rad, Math.sin(ang) * rad * 0.69, 0.018));
        }
        g.poly(moss, '#77884e');
        if (a.kind === 'ivy') {
          for (let vine = 0; vine < 3; vine++) {
            let last = base;
            const n = Math.max(1, Math.floor(size * (6 - vine * 0.7)));
            for (let j = 1; j <= n; j++) {
              const u = j / n,
                height = u * size * (1 - vine * 0.17),
                along =
                  (Math.sin(u * 6 + a.seed * 6 + vine) - Math.sin(a.seed * 6 + vine)) * 0.12 +
                  (vine - 1) * u * 0.3;
              const p = pt(along * a.normal[1], along * a.normal[0], height);
              g.line(last, p, vine ? '#57764b' : '#4d6842');
              g.dot(
                p[0] + (j % 2 ? 1 : -2),
                p[1],
                ['#859d57', '#9bab67', '#69894d'][(j + vine) % 3],
                2,
                1,
              );
              last = p;
            }
          }
        } else {
          for (let j = 0; j < 6; j++) {
            const ang = j * 2.4 + a.seed * 6,
              rad = (0.36 + 0.09 * (j % 3)) * size,
              ht = (a.kind === 'fern' ? 0.74 : 0.28) * size;
            const stem = (u) =>
              pt(Math.cos(ang) * rad * u, Math.sin(ang) * rad * u, Math.sin(u * 1.95) * ht);
            const mid = stem(0.51),
              end = stem(1);
            g.line(base, mid, '#506a40');
            g.line(mid, end, j % 2 ? '#81a15a' : '#91a65e');
            for (let k = 1; k < 4; k++) {
              const p = stem(0.22 * k);
              g.dot(p[0] + (k % 2 ? -1 : 1), p[1] - 1, j % 3 ? '#7e9950' : '#a9b66b', 2, 1);
            }
          }
        }
        continue;
      }
      if (item.type === 'sill') {
        const heights = [0.18, 0.4, 0.27, 0.48, 0.15, 0.24],
          v = [d.q(0), d.q(1)];
        for (let i = 5; i >= 0; i--) {
          const a = d.q(i / 5);
          a[2] += heights[(i + p.style) % 6];
          v.push(a);
        }
        g.poly(v.map(screen), m.core);
        for (const u of [0.19, 0.64]) {
          const a = d.q(u),
            e = [a[0] + 0.07, a[1] - 0.04, a[2] + 0.55 + (p.style % 3) * 0.08];
          g.line(screen(a), screen(e), b.gable ? '#82684d' : '#626d61');
        }
        continue;
      }
      if (item.type === 'dust') {
        const { s, t } = d;
        for (let i = 0; i < 9; i++) {
          const angle = i * 2.39 + s.spin * 8,
            d = (0.13 + 0.57 * t) * ((i % 3) + 1) * 0.55;
          if ((i % 4) * 0.14 + t > 0.99) continue;
          const at = screen([
            s.tx + Math.cos(angle) * d,
            s.tz + Math.sin(angle) * d,
            0.25 + t * (0.6 + 0.16 * (i % 4)),
          ]);
          g.dot(...at, i % 3 ? m.dust : '#d0c8ac', i % 3 ? 1 : 2, 1);
        }
        continue;
      }
      if (item.type === 'chip') {
        const v = d.v,
          pts = v.map(screen),
          roof = b.gable && p.kind === 'roof',
          plank = p.kind === 'floor' || p.kind === 'room';
        const face = roof
          ? ['#695c4f', '#80705b', '#917a60', '#746656'][d.i]
          : plank
            ? ['#938b74', '#a49a7e', '#807d6c', '#aba48b'][d.i]
            : [m.wall[0], m.break, m.wall[1], m.core][d.i];
        const lip = pts.map(([x, y]) => [x, y + 1]);
        g.poly(lip, roof ? '#594e40' : m.edge);
        g.poly(pts, face);
        g.line(pts[0], pts[1], d.i === 1 ? '#d3c5a6' : m.core);
        const at = screen(d.center);
        if (p.kind === 'wall' && d.i === 2)
          g.dot(at[0], at[1], b.type === 'brick' ? '#6f5849' : '#778a83', 2, 1);
        if (roof || ((p.kind === 'floor' || b.tower) && d.i === 0)) {
          const e = v[0],
            end = [
              e[0] + (v[1][0] - e[0]) * 0.58 + 0.09,
              e[1] + (v[1][1] - e[1]) * 0.58,
              e[2] + (v[1][2] - e[2]) * 0.58 + 0.1,
            ];
          g.line(pts[0], screen(end), roof ? '#a18b68' : '#74786a');
        }
        continue;
      }
      const front = d.facing >= 0,
        at = (u, t) => screen(surface(p.v, u, t));
      const ln = (u, t, u1, t1, c) => g.line(at(u, t), at(u1, t1), c);
      const rect = (u, t, u1, t1, c) => g.poly([at(u, t), at(u1, t), at(u1, t1), at(u, t1)], c);
      if (p.kind === 'floor' || p.kind === 'roof') {
        const pitched = b.gable && p.kind === 'roof',
          roof = p.kind === 'roof';
        const top = pitched
          ? p.cell.x
            ? '#736452'
            : '#897560'
          : roof
            ? ['#a2a490', '#969c89', '#a7a68f'][p.style % 3]
            : ['#928b75', '#787a6a', '#9e9277'][p.style % 3];
        const pts = p.v.map(screen);
        g.poly(
          pts.map(([x, y]) => [x, y + 1]),
          pitched ? '#554c40' : '#696e61',
        );
        g.poly(pts, top);
        if (pitched) {
          for (let j = 0; j < 6; j++) ln(0.02, j / 6, 0.98, j / 6, j % 2 ? '#74604d' : '#9b8568');
          ln(0, 0.05, 0, 0.97, '#675744');
        } else {
          ln(0.02, 0.02, 0.98, 0.02, roof ? '#b6baa6' : '#b2a689');
          ln(0.99, 0.03, 0.99, 0.96, '#757c68');
        }
        if (roof && !pitched && age > 0.09) {
          for (let i = 0; i < 13; i++) {
            const u = (p.salt + i * 0.371) % 1,
              t = (p.salt * 0.4 + i * 0.567) % 1;
            if ((i * 0.283) % 1 < age * 0.75)
              g.dot(...at(u, t), ['#869556', '#748949', '#a5aa69'][i % 3], 1 + (i % 2), 1);
          }
        }
      } else if (p.kind === 'room' || !front) {
        g.poly(p.v.map(screen), ['#827d68', '#777f71', '#9e917a', '#797566'][p.style % 4]);
        rect(0.08, 0.08, 0.32, 0.64, '#565d53');
        ln(0.03, 0.73, 0.98, 0.73, '#b0a383');
        ln(0, 0.05, 0.98, 0.05, '#645f51');
        if (p.style % 3 === 0) rect(0.56, 0.42, 0.77, 0.65, '#b5a78a');
      } else {
        const shade = p.side === 0 ? 1 : 0;
        g.poly(p.v.map(screen), m.wall[shade]);
        const windows = b.tower ? 2 : 1,
          glass =
            age > 0.25 && p.style % 6 < age * 4
              ? '#414d47'
              : night > 0.5 && age < 0.1 && p.style % 3 === 0
                ? '#ddc282'
                : shade
                  ? '#6d8180'
                  : '#859893';
        for (let i = 0; i < windows; i++) {
          const l = (i + 0.17) / windows,
            r = (i + 0.79) / windows;
          rect(l - 0.028, 0.18, r + 0.025, 0.74, shade ? '#aab29f' : '#c3c6ae');
          rect(l, 0.225, r, 0.72, glass);
          ln(l, 0.72, r, 0.72, '#58665f');
          if (p.style % 4 !== 1) ln(l, 0.47, r, 0.47, '#a9b5a6');
        }
        ln(0.01, 0.025, 0.99, 0.025, b.tower ? '#7d8980' : m.edge);
        if (b.type === 'brick') {
          ln(0.02, 0.83, 0.98, 0.83, '#a8876a');
          ln(0.08, 0.12, 0.43, 0.12, '#c29a78');
        }
        if ((p.style % 5) / 11 < age) {
          const u = 0.06 + (p.salt % 0.3);
          ln(u, 0.95, u + 0.06, 0.76, m.core);
          ln(u + 0.06, 0.76, u + 0.02, 0.6, m.core);
          if (p.style % 3 === 0) g.dot(...at(0.91, 0.18), m.break, 2, 1);
        }
        if (age > 0.24 && p.salt < age * 0.7) {
          for (let i = 0; i < Math.floor(7 * age); i++)
            g.dot(
              ...at(0.03 + (i % 2) * 0.055, 0.08 + i * 0.12),
              i % 2 ? '#91a15f' : '#627b48',
              1 + (i % 2),
              1,
            );
        }
      }
      if (Number.isFinite(p.at) && age > p.at - 0.057) {
        const length = Math.min(1, (age - p.at + 0.057) / 0.048);
        for (let i = 0; i < 3; i++) {
          const ring = p.uv[i],
            a = ring[1],
            end = ring[2],
            x = a[0] + (end[0] - a[0]) * length,
            t = a[1] + (end[1] - a[1]) * length;
          ln(a[0], a[1], x, t, i === 0 ? '#575a4d' : m.core);
        }
      }
    }
  }
  return { draw };
})();

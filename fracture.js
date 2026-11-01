/* Fixed-seed load paths and rigid fragments. Coordinates are [east, south, height]. */
const ReclaimFracture = (() => {
  'use strict';
  const clamp = (x) => Math.max(0, Math.min(1, x));
  const mix = (a, b, t) => a + (b - a) * t;
  const mean = (points) =>
    points.reduce((m, p) => m.map((x, i) => x + p[i] / points.length), [0, 0, 0]);
  function surface(v, u, t) {
    return v[0].map((_, i) => mix(mix(v[0][i], v[1][i], u), mix(v[3][i], v[2][i], u), t));
  }
  function rotate(p, ax, az, yaw) {
    const a = Math.cos(ax),
      b = Math.sin(ax),
      c = Math.cos(az),
      d = Math.sin(az),
      e = Math.cos(yaw),
      f = Math.sin(yaw);
    const z = p[1] * a - p[2] * b,
      h = p[1] * b + p[2] * a,
      x = p[0] * c - h * d;
    return [x * e - z * f, x * f + z * e, p[0] * d + h * c];
  }
  const idOf = (x, z, f) => [x, z, f].join('/');

  function build(b, buildings, rng) {
    const r = rng(212604 + b.id * 15401),
      tower = !!b.tower,
      brick = !!b.gable;
    const nx = tower ? 3 : 2,
      nz = tower ? 3 : 3,
      floors = b.floors,
      dx = b.w / nx,
      dz = b.d / nz,
      dh = b.h / floors,
      base = 0.16;
    // A salt-damaged corner, a washed-out footing and a failing upper transfer floor.
    const start = tower ? 0.64 : brick ? 0.295 : 0.475,
      weakX = nx - 1,
      weakZ = brick ? 0 : nz - 1;
    const firstFloor = tower ? 3 : 0,
      cells = new Map(),
      queue = [];
    for (let x = 0; x < nx; x++)
      for (let z = 0; z < nz; z++) {
        const distance = Math.abs(x - weakX) + Math.abs(z - weakZ);
        const exposed =
          distance <= 1 || (distance === 2 && (brick ? z === weakZ : tower ? x === weakX : false));
        const sill = firstFloor + (distance === 0 ? 0 : Math.floor(r() * (tower ? 3 : 2)));
        for (let f = 0; f < floors; f++)
          cells.set(idOf(x, z, f), {
            x,
            z,
            f,
            sill,
            exposed,
            at: Infinity,
            rough: r(),
            parent: null,
          });
      }
    const root = cells.get(idOf(weakX, weakZ, firstFloor));
    root.at = start;
    queue.push(root);
    // Each event is reached through an adjoining load path. An anchored bay is never scheduled.
    while (queue.length) {
      queue.sort((a, b) => a.at - b.at);
      const a = queue.shift();
      for (const [dx, dz, df] of [
        [0, 0, 1],
        [-1, 0, 0],
        [1, 0, 0],
        [0, -1, 0],
        [0, 1, 0],
      ]) {
        const n = cells.get(idOf(a.x + dx, a.z + dz, a.f + df));
        if (!n || !n.exposed || n.f < n.sill) continue;
        const next = a.at + (df ? 0.006 + n.rough * 0.009 : 0.033 + n.rough * 0.023);
        if (next < n.at) {
          n.at = next;
          n.parent = a;
          queue.push(n);
        }
      }
    }
    const parts = [],
      chips = [];
    function part(kind, v, cell, opts = {}) {
      const at = Number.isFinite(cell.at) ? cell.at + (opts.lag ?? 0) : Infinity;
      const p = {
        kind,
        v,
        center: mean(v),
        at,
        cell,
        side: opts.side ?? -1,
        normal: opts.normal || [0, 0],
        salt: r(),
        style: Math.floor(r() * 1000),
        shards: [],
        uv: [],
        ...opts,
      };
      parts.push(p);
      if (!Number.isFinite(at)) return;
      // One non-central junction splits the original face: the shards tile it exactly.
      const u = 0.32 + r() * 0.36,
        t = 0.33 + r() * 0.35,
        junction = [u, t];
      const border = [
        [0, 0],
        [0.32 + r() * 0.34, 0],
        [1, 0],
        [1, 0.34 + r() * 0.32],
        [1, 1],
        [0.32 + r() * 0.34, 1],
        [0, 1],
        [0, 0.32 + r() * 0.36],
      ];
      for (let i = 0; i < 4; i++) {
        const ring = [border[i * 2], border[(i * 2 + 1) % 8], junction, border[(i * 2 + 7) % 8]];
        const vertices = ring.map(([s, t]) => surface(v, s, t)),
          origin = mean(vertices);
        let vx = p.normal[0],
          vz = p.normal[1];
        if (!vx && !vz) {
          vx = (origin[0] - b.x) / b.w - 0.5;
          vz = (origin[1] - b.z) / b.d - 0.5;
        }
        const ang = Math.atan2(vz, vx) + (r() - 0.5) * (kind === 'floor' ? 1.2 : 0.74),
          out = [Math.cos(ang), Math.sin(ang)];
        const run =
          (kind === 'floor' ? 0.32 : 0.69) + r() * 1.32 + origin[2] * (0.035 + r() * 0.085);
        let tx = origin[0] + out[0] * run,
          tz = origin[1] + out[1] * run;
        const insideOther = (x, z) =>
          buildings.some(
            (other) =>
              other !== b &&
              x > other.x - 0.15 &&
              x < other.x + other.w + 0.15 &&
              z > other.z - 0.15 &&
              z < other.z + other.d + 0.15,
          );
        for (let j = 0; j < 9 && insideOther(tx, tz); j++) {
          tx = mix(tx, origin[0], 0.25);
          tz = mix(tz, origin[1], 0.25);
        }
        tx = Math.max(0.32, Math.min(23.68, tx));
        tz = Math.max(0.32, Math.min(23.68, tz));
        const tip = (1.23 + r() * 0.43) * (r() < 0.5 ? -1 : 1),
          flat = kind === 'floor' || kind === 'roof';
        const tiltX = flat ? (r() - 0.5) * 0.68 : p.side === 0 ? tip : (r() - 0.5) * 0.38;
        const tiltZ = flat ? (r() - 0.5) * 0.72 : p.side === 1 ? tip : (r() - 0.5) * 0.38;
        const local = vertices.map((v) => v.map((x, j) => x - origin[j]));
        const yaw = (r() - 0.5) * 2,
          resting = local.map((v) => rotate(v, tiltX, tiltZ, yaw));
        // Clamp the entire resting polygon, not just its center, to the ground tile.
        tx = Math.max(
          0.06 - Math.min(...resting.map((v) => v[0])),
          Math.min(23.94 - Math.max(...resting.map((v) => v[0])), tx),
        );
        tz = Math.max(
          0.06 - Math.min(...resting.map((v) => v[1])),
          Math.min(23.94 - Math.max(...resting.map((v) => v[1])), tz),
        );
        const launch = at + (kind === 'wall' ? 0.003 : 0) + r() * 0.006;
        const flight = 0.013 + Math.sqrt(Math.max(0.12, origin[2])) * 0.008 + r() * 0.006;
        const s = {
          part: p,
          origin,
          local,
          resting,
          tiltX,
          tiltZ,
          yaw,
          tx,
          tz,
          launch,
          flight,
          land: launch + flight,
          wobble: (r() - 0.5) * 0.38,
          spin: r(),
          ground: 0,
          rest: null,
        };
        p.uv.push(ring);
        p.shards.push(s);
        chips.push(s);
      }
    }
    const row = (x, z, f) => cells.get(idOf(x, z, f));
    const roofY = (x) =>
      base + b.h + 0.12 + (brick ? 1.05 * (1 - Math.abs(((x - b.x) / b.w) * 2 - 1)) : 0);
    for (const cell of cells.values()) {
      const { x, z, f } = cell,
        X = b.x + x * dx,
        Z = b.z + z * dz,
        Y = base + f * dh;
      const X1 = X + dx,
        Z1 = Z + dz,
        Y1 = Y + dh,
        roof = f === floors - 1;
      const tile = roof
        ? [
            [X, Z, roofY(X)],
            [X1, Z, roofY(X1)],
            [X1, Z1, roofY(X1)],
            [X, Z1, roofY(X)],
          ]
        : [
            [X, Z, Y1],
            [X1, Z, Y1],
            [X1, Z1, Y1],
            [X, Z1, Y1],
          ];
      part(roof ? 'roof' : 'floor', tile, cell, { lag: 0.013 });
      for (const [side, fixed, along, len, normal, isOuter, neighbor] of [
        [0, Z, X, dx, [0, -1], z === 0, row(x, z - 1, f)],
        [0, Z1, X, dx, [0, 1], z === nz - 1, row(x, z + 1, f)],
        [1, X, Z, dz, [-1, 0], x === 0, row(x - 1, z, f)],
        [1, X1, Z, dz, [1, 0], x === nx - 1, row(x + 1, z, f)],
      ]) {
        // The permanent party wall is the interior face seen when the wing opens.
        const interior = !isOuter && Number.isFinite(neighbor?.at) && !Number.isFinite(cell.at);
        if (!isOuter && !interior) continue;
        const pos = (u, h) => (side === 0 ? [along + u, fixed, h] : [fixed, along + u, h]);
        const h0 = roof && brick && side === 0 ? roofY(along) : Y1,
          h1 = roof && brick && side === 0 ? roofY(along + len) : Y1;
        part(interior ? 'room' : 'wall', [pos(0, Y), pos(len, Y), pos(len, h1), pos(0, h0)], cell, {
          side,
          normal,
          lag: r() * 0.003,
        });
      }
    }
    // Earlier impacts form a low berm for later ones. Positions are stored, never rerolled on rewind.
    const deposits = new Map();
    for (const s of chips.sort((a, b) => a.land - b.land)) {
      const k = Math.floor(s.tx / 0.69) + '/' + Math.floor(s.tz / 0.69),
        layer = deposits.get(k) || 0;
      s.ground = 0.19 + layer - Math.min(...s.resting.map((v) => v[2]));
      s.rest = s.resting.map((v) => [s.tx + v[0], s.tz + v[1], s.ground + v[2]]);
      s.restCenter = [s.tx, s.tz, s.ground];
      deposits.set(k, Math.min(tower ? 1.85 : 1.17, layer + 0.075 + s.spin * 0.075));
    }
    // Colonization follows the demolition, on the uppermost floor still held by
    // this stack (or its foundation). Sealed rooms never receive a plant.
    const plants = [],
      green = rng(79019 + b.id * 103);
    for (let x = 0; x < nx; x++)
      for (let z = 0; z < nz; z++) {
        const stack = [...cells.values()]
          .filter((c) => c.x === x && c.z === z && Number.isFinite(c.at))
          .sort((a, b) => a.f - b.f);
        if (!stack.length) continue;
        const low = stack[0],
          bottom = base + low.f * dh + 0.032;
        const clear = Math.max(
          ...chips.filter((s) => s.part.cell.x === x && s.part.cell.z === z).map((s) => s.land),
        );
        const add = (kind, px, pz, normal = [0, 0]) => {
          const seed = green(),
            birth = clear + 0.019 + green() * 0.034;
          plants.push({
            kind,
            x: px,
            z: pz,
            h: bottom,
            normal,
            cell: low,
            clear,
            birth,
            span: 0.062 + green() * 0.068,
            size:
              kind === 'ivy'
                ? Math.min(b.h - bottom - 0.1, 1.55 + green() * 2.9)
                : 0.45 + green() * 0.65,
            seed,
          });
        };
        for (let i = 0; i < 4; i++)
          add(
            i ? 'fern' : 'moss',
            b.x + (x + 0.17 + green() * 0.66) * dx,
            b.z + (z + 0.17 + green() * 0.66) * dz,
          );
        for (const [ax, az] of [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ]) {
          const next = row(x + ax, z + az, low.f);
          if (!next || Number.isFinite(next.at)) continue;
          const px = b.x + (x + (ax === 1 ? 0.983 : ax === -1 ? 0.017 : 0.25 + green() * 0.5)) * dx;
          const pz = b.z + (z + (az === 1 ? 0.983 : az === -1 ? 0.017 : 0.25 + green() * 0.5)) * dz;
          add('ivy', px, pz, [ax, az]);
        }
      }
    return { b, cells, parts, chips, plants, start };
  }

  function pose(s, age) {
    if (age >= s.land + 0.007) return { v: s.rest, center: s.restCenter };
    const t = clamp((age - s.launch) / s.flight),
      slide = 1 - (1 - t) ** 1.45;
    const bounce =
      age > s.land ? Math.sin(clamp((age - s.land) / 0.007) * Math.PI) * (0.05 + s.spin * 0.09) : 0;
    const cx = mix(s.origin[0], s.tx, slide),
      cz = mix(s.origin[1], s.tz, slide);
    const h = mix(s.origin[2], s.ground, t * t) + Math.sin(t * Math.PI) * 0.14 + bounce;
    const turn = t * (2 - t),
      v = s.local.map((p) => {
        const q = rotate(
          p,
          s.tiltX * turn,
          s.tiltZ * turn,
          s.yaw * turn + s.wobble * Math.sin(t * Math.PI),
        );
        return [cx + q[0], cz + q[1], h + q[2]];
      });
    return { v, center: [cx, cz, h] };
  }
  return { build, pose, surface };
})();

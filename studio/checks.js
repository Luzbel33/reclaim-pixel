(() => {
  'use strict';
  const byId = (id) => document.getElementById(id);
  function area(v) {
    const a = [0, 0, 0];
    for (let i = 0; i < v.length; i++) {
      const p = v[i],
        q = v[(i + 1) % v.length];
      a[0] += p[1] * q[2] - p[2] * q[1];
      a[1] += p[2] * q[0] - p[0] * q[2];
      a[2] += p[0] * q[1] - p[1] * q[0];
    }
    return Math.hypot(...a) / 2;
  }
  const dist = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
  function link(name, canvas, file) {
    const a = document.createElement('a');
    a.textContent = name;
    a.href = canvas.toDataURL('image/png');
    a.download = file;
    byId('exports').append(a);
  }
  byId('run').onclick = () => {
    const rows = byId('checks'),
      result = byId('result'),
      exports = byId('exports');
    rows.replaceChildren();
    exports.replaceChildren();
    result.textContent = 'Checking…';
    const native = document.createElement('canvas');
    native.width = 480;
    native.height = 360;
    const city = ReclaimCity.createCity(native),
      home = { angle: 0, pitch: 30, zoom: 1, offsetX: 0, offsetY: 0 };
    function check(test, label) {
      if (!test) throw new Error(label);
      const li = document.createElement('li');
      li.textContent = label;
      rows.append(li);
    }
    const frame = (a) => {
      city.render(a, 0, 0, false);
      return native.toDataURL();
    };
    try {
      const initial = frame(0);
      link('2026 still', native, 'city-2026.png');
      check(
        Number(native.dataset.people) === 22 &&
          city.stats.trees === 33 &&
          city.stats.treesOnBuildings === 0,
        '2026: 22 pedestrians; all 33 tree roots are on open ground.',
      );
      frame(0.4);
      link('2066 still', native, 'city-2066.png');
      const end = frame(1);
      link('2126 still', native, 'city-2126.png');
      const all = city.structures.flatMap((s) => s.chips),
        greens = city.structures.flatMap((s) => s.plants);
      check(
        initial !== end && frame(0) === initial,
        '2026 → 2126 → 2026 returns the exact starting PNG, with ambient motion frozen.',
      );
      const late = frame(1);
      for (let i = 1; i <= 4; i++) {
        city.setCamera({ angle: (i * Math.PI) / 2 });
        frame(1);
      }
      check(native.toDataURL() === late, 'A full orbit returns the exact same ruin.');
      city.setCamera({ pitch: 53 });
      const high = frame(1);
      city.setCamera({ pitch: 16 });
      const low = frame(1);
      city.setCamera(home);
      check(
        high !== low && frame(1) === late,
        'Elevation changes the rendering; Home recovers its exact pixels.',
      );
      check(
        city.structures.every((m) =>
          [...m.cells.values()].every((c) => !c.parent || c.parent.at < c.at),
        ),
        'Every propagated failure occurs after the support that triggered it.',
      );
      let mismatch = 0;
      for (const m of city.structures)
        for (const p of m.parts)
          if (p.shards.length) {
            const sum = p.shards.reduce((n, s) => n + area(s.local), 0);
            mismatch = Math.max(mismatch, Math.abs(sum - area(p.v)));
          }
      check(
        mismatch < 1e-8,
        'Each broken face is partitioned into fragments with the same total surface area.',
      );
      check(
        all.every((s) => {
          const p = ReclaimFracture.pose(s, s.launch + s.flight * 0.53).v;
          return s.local.every((a, i) =>
            s.local.every((b, j) => Math.abs(dist(a, b) - dist(p[i], p[j])) < 1e-8),
          );
        }),
        'All ' + all.length + ' moving pieces preserve their edge lengths in flight.',
      );
      check(
        all.every((s) =>
          s.rest.every(([x, z, h]) => x >= 0 && x <= 24 && z >= 0 && z <= 24 && h >= 0.18),
        ) && Number(native.dataset.settledFragments) === all.length,
        'Every fragment comes to rest above ground, inside the island.',
      );
      const supported = city.structures.every((model) =>
        model.plants.every((p) => {
          const level = 0.192 + (p.cell.f * model.b.h) / model.b.floors;
          return p.birth > p.clear && Number.isFinite(p.cell.at) && Math.abs(p.h - level) < 1e-7;
        }),
      );
      check(
        greens.length > 0 && supported,
        'All ' +
          greens.length +
          ' interior plant clusters start on an exposed floor or foundation after its last impact.',
      );
      check(
        Number(native.dataset.interiorPlants) === greens.length &&
          frame(0) === initial &&
          Number(native.dataset.interiorPlants) === 0,
        'Rewinding removes all interior growth and restores the closed rooms.',
      );
      // Freeze the same tower, from the same camera, before failure, in flight, and after colonization.
      const tower = city.structures.find((s) => s.b.tower);
      let peak = tower.start,
        max = -1;
      for (let i = 0; i <= 350; i++) {
        const a = tower.start + i * 0.0007,
          n = tower.chips.filter((s) => a >= s.launch && a < s.land).length;
        if (n > max) {
          max = n;
          peak = a;
        }
      }
      const plate = byId('plate'),
        c = plate.getContext('2d');
      plate.hidden = false;
      c.imageSmoothingEnabled = false;
      c.fillStyle = '#fbfbf6';
      c.fillRect(0, 0, 1260, 540);
      c.fillStyle = '#536049';
      c.font = '15px Arial';
      c.fillText('RECLAIM     /     THE TRANSFER FLOOR', 32, 33);
      c.textAlign = 'right';
      c.fillText('STRUCTURAL FIELD NOTES     ·     SEED 212604', 1228, 33);
      c.textAlign = 'left';
      const shots = [
        [tower.start - 0.025, 'I.  Load-bearing'],
        [peak, 'II.  Fracture'],
        [1, 'III.  Succession'],
      ];
      for (let i = 0; i < shots.length; i++) {
        const [age, title] = shots[i];
        city.setCamera({ ...home, angle: 0.06, pitch: 29, zoom: 1.85 });
        const [x, y] = city.project(4.6, 4.65, 4.75);
        city.setCamera({
          offsetX: Math.round(-(x - 240) * 1.85),
          offsetY: Math.round(178 - 202 - (y - 202) * 1.85),
        });
        city.render(age, 0, 0, false);
        const l = 30 + i * 405;
        c.drawImage(native, 142, 71, 196, 208, l, 49, 392, 416);
        c.fillStyle = '#414e3d';
        c.font = '25px Georgia';
        c.fillText(title, l, 504);
        c.textAlign = 'right';
        c.font = '17px Arial';
        c.fillStyle = '#76816a';
        c.fillText(String(2026 + Math.round(age * 100)), l + 386, 503);
        c.textAlign = 'left';
      }
      link('Download the field plate', plate, 'fracture-study.png');
      result.textContent = rows.children.length + ' checks passed.';
    } catch (e) {
      result.textContent = 'Check failed: ' + e.message;
    }
  };
})();

(() => {
  'use strict';
  const byId = (id) => document.getElementById(id),
    canvas = byId('city'),
    city = ReclaimCity.createCity(canvas);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const state = { year: 2056, target: 2056, night: 0, targetNight: 0, playing: false };
  let previous = performance.now(),
    time = 0,
    lastYear = -1;
  Object.assign(canvas.dataset, city.stats, { ready: 'true', renderer: 'Canvas 2D', version: '3' });
  function play(value) {
    state.playing = value;
    byId('play').setAttribute('aria-pressed', String(value));
    byId('play').setAttribute('aria-label', value ? 'Pause the timeline' : 'Play the timeline');
    byId('play-path').setAttribute('d', value ? 'M7 6h3v12H7Zm7 0h3v12h-3Z' : 'm9 6 9 6-9 6Z');
  }
  function label() {
    const y = Math.round(state.year);
    if (lastYear === y) return;
    lastYear = y;
    byId('date').value = y;
    byId('year').value = Math.round(state.target);
    byId('year').setAttribute('aria-valuetext', String(y));
    canvas.setAttribute('aria-label', 'Pixel-art city in ' + y + '.');
    canvas.dataset.year = y;
  }
  byId('year').addEventListener('input', () => {
    play(false);
    state.target = Number(byId('year').value);
    if (reduce.matches) state.year = state.target;
  });
  byId('play').addEventListener('click', () => {
    if (state.target >= 2125.99) {
      state.year = 2026;
      state.target = 2026;
    }
    play(!state.playing);
  });
  byId('night').addEventListener('click', () => {
    state.targetNight = 1 - state.targetNight;
    const n = Boolean(state.targetNight);
    document.body.classList.toggle('night', n);
    byId('night').setAttribute('aria-pressed', String(n));
    byId('night').setAttribute('aria-label', n ? 'Switch to day' : 'Switch to night');
  });
  byId('info').addEventListener('click', () => byId('about').showModal());
  byId('close').addEventListener('click', () => byId('about').close());
  byId('about').addEventListener('click', (e) => {
    if (e.target !== byId('about')) return;
    const r = e.target.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
      e.target.close();
  });

  const home = () =>
    city.setCamera({ angle: 0, pitch: ReclaimCity.DEFAULT_PITCH, zoom: 1, offsetX: 0, offsetY: 0 });
  function orbit(dx, dy) {
    const c = city.getCamera();
    city.setCamera({ angle: c.angle + dx, pitch: c.pitch + dy });
  }
  function zoom(factor, point = { x: 240, y: 202 }) {
    const c = city.getCamera(),
      next = Math.max(0.8, Math.min(3, c.zoom * factor)),
      ratio = next / c.zoom;
    city.setCamera({
      zoom: next,
      offsetX: point.x - 240 - (point.x - 240 - c.offsetX) * ratio,
      offsetY: point.y - 202 - (point.y - 202 - c.offsetY) * ratio,
    });
  }
  byId('turn-left').addEventListener('click', () => orbit(-Math.PI / 2, 0));
  byId('turn-right').addEventListener('click', () => orbit(Math.PI / 2, 0));
  byId('tilt-up').addEventListener('click', () => orbit(0, 6));
  byId('tilt-down').addEventListener('click', () => orbit(0, -6));
  byId('zoom-in').addEventListener('click', () => zoom(1.25));
  byId('zoom-out').addEventListener('click', () => zoom(0.8));
  byId('reset').addEventListener('click', home);
  const pointers = new Map();
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    const old = pointers.get(e.pointerId),
      next = { x: e.clientX, y: e.clientY },
      r = canvas.getBoundingClientRect(),
      dx = next.x - old.x,
      dy = next.y - old.y;
    if (pointers.size === 2) {
      const other = [...pointers.entries()].find(([id]) => id !== e.pointerId)[1],
        before = Math.hypot(old.x - other.x, old.y - other.y),
        after = Math.hypot(next.x - other.x, next.y - other.y);
      if (before > 5)
        zoom(after / before, {
          x: (((next.x + other.x) / 2 - r.left) * 480) / r.width,
          y: (((next.y + other.y) / 2 - r.top) * 360) / r.height,
        });
    } else if (e.shiftKey) {
      const c = city.getCamera();
      city.setCamera({
        offsetX: c.offsetX + (dx * 480) / r.width,
        offsetY: c.offsetY + (dy * 360) / r.height,
      });
    } else orbit((dx * 3.8) / r.width, (dy * 64) / r.height);
    pointers.set(e.pointerId, next);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
    canvas.addEventListener(type, (e) => pointers.delete(e.pointerId));
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      zoom(Math.exp(-e.deltaY * 0.0015), {
        x: ((e.clientX - r.left) * 480) / r.width,
        y: ((e.clientY - r.top) * 360) / r.height,
      });
    },
    { passive: false },
  );
  canvas.addEventListener('keydown', (e) => {
    const actions = {
      ArrowLeft: () => orbit(-Math.PI / 12, 0),
      ArrowRight: () => orbit(Math.PI / 12, 0),
      ArrowUp: () => orbit(0, 3),
      ArrowDown: () => orbit(0, -3),
      '+': () => zoom(1.25),
      '=': () => zoom(1.25),
      '-': () => zoom(0.8),
      Home: home,
    };
    if (actions[e.key]) {
      e.preventDefault();
      actions[e.key]();
    }
  });
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.max(0, Math.min(0.12, (now - previous) / 1000));
    previous = now;
    if (document.hidden) return;
    if (!reduce.matches || state.playing) time += dt;
    if (state.playing) {
      state.target = Math.min(2126, state.target + dt * 4.35);
      if (state.target === 2126) play(false);
    }
    const blend = reduce.matches ? 1 : 1 - Math.exp(-dt * 15);
    state.year += (state.target - state.year) * blend;
    state.night += (state.targetNight - state.night) * (reduce.matches ? 1 : 1 - Math.exp(-dt * 5));
    if (Math.abs(state.year - state.target) < 0.002) state.year = state.target;
    if (Math.abs(state.night - state.targetNight) < 0.002) state.night = state.targetNight;
    city.render((state.year - 2026) / 100, state.night, time, !reduce.matches || state.playing);
    label();
  }
  label();
  requestAnimationFrame(frame);
})();

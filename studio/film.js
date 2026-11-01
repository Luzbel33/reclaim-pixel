const ReclaimFilm = (() => {
  'use strict';
  const FPS = 24,
    FRAMES = 576,
    W = 1440,
    H = 1260;
  const clamp = (x) => Math.max(0, Math.min(1, x)),
    mix = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => t * t * (3 - 2 * t);
  const ages = [
    [0, 0],
    [2, 0.06],
    [4, 0.265],
    [5, 0.295],
    [8.8, 0.447],
    [10, 0.468],
    [13.7, 0.61],
    [14.45, 0.635],
    [19.9, 0.825],
    [22.4, 1],
    [24, 1],
  ];
  // Each cut advances the same clock. Camera targets are fixed points in the city.
  const shots = [
    {
      end: 3.85,
      name: 'Market square',
      target: [12, 12, 1.6],
      yaw: [-5, 1],
      pitch: [30, 31],
      zoom: [1, 1.04],
      center: 181,
    },
    {
      end: 9.25,
      name: 'The old brickworks',
      target: [18.4, 4.25, 1.7],
      yaw: [-17, -32],
      pitch: [28, 37],
      zoom: [2.18, 2.48],
      center: 179,
    },
    {
      end: 13.75,
      name: 'East apartments',
      target: [21.1, 11.2, 1.45],
      yaw: [7, 18],
      pitch: [30, 36],
      zoom: [2.04, 2.27],
      center: 181,
    },
    {
      end: 20.7,
      name: 'The transfer floor',
      target: [4.55, 4.5, 4.1],
      yaw: [-10, 13],
      pitch: [25, 35],
      zoom: [1.89, 2.15],
      center: 181,
    },
    {
      end: 24,
      name: 'What remains',
      target: [12, 12, 1.4],
      yaw: [12, 0],
      pitch: [39, 33],
      zoom: [1.03, 1],
      center: 184,
    },
  ];
  function atTime(t) {
    const k = ages.findIndex((a, i) => i > 0 && t <= a[0]),
      end = ages[k < 0 ? ages.length - 1 : k],
      start = ages[k < 0 ? ages.length - 2 : k - 1];
    return mix(start[1], end[1], clamp((t - start[0]) / (end[0] - start[0])));
  }
  function create() {
    const native = document.createElement('canvas');
    native.width = 480;
    native.height = 360;
    const city = ReclaimCity.createCity(native),
      film = document.createElement('canvas');
    film.width = W;
    film.height = H;
    const c = film.getContext('2d', { alpha: false });
    c.imageSmoothingEnabled = false;
    function frame(i) {
      const t = i / FPS,
        age = atTime(t),
        idx = shots.findIndex((s) => t < s.end),
        shot = shots[idx],
        start = idx ? shots[idx - 1].end : 0;
      const f = smooth(clamp((t - start) / (shot.end - start))),
        zoom = mix(...shot.zoom, f);
      city.setCamera({
        angle: (mix(...shot.yaw, f) * Math.PI) / 180,
        pitch: mix(...shot.pitch, f),
        zoom,
      });
      const [x, y] = city.project(...shot.target);
      city.setCamera({
        offsetX: Math.round(-(x - 240) * zoom),
        offsetY: Math.round(shot.center - 202 - (y - 202) * zoom),
      });
      city.render(age, 0, t, true);
      c.fillStyle = '#ffffff';
      c.fillRect(0, 0, W, H);
      c.drawImage(native, 0, 0, 1440, 1080);
      c.fillStyle = '#d2d5c7';
      c.fillRect(85, 1098, 1270, 2);
      c.fillStyle = '#737e64';
      c.font = '500 18px Arial';
      c.textAlign = 'left';
      c.fillText('RECLAIM     /     A CENTURY AFTER US', 85, 1147);
      c.font = '38px Georgia';
      c.fillStyle = '#3e4939';
      c.fillText(shot.name, 82, 1207);
      c.font = '18px Arial';
      c.fillStyle = '#858c78';
      c.textAlign = 'right';
      c.fillText('FIELD NOTE     0' + (idx + 1) + ' / 05', 1355, 1147);
      c.font = '40px Georgia';
      c.fillStyle = '#3e4939';
      c.fillText(String(2026 + Math.round(age * 100)), 1355, 1207);
      c.fillStyle = '#e1e3da';
      c.fillRect(845, 1189, 317, 3);
      c.fillStyle = '#84956b';
      c.fillRect(845, 1189, Math.max(2, 317 * age), 3);
      c.textAlign = 'left';
      return film;
    }
    return { frame };
  }
  async function encode(onProgress, cancelled) {
    if (!('VideoEncoder' in window))
      throw new Error(
        'This browser does not expose WebCodecs. The finished film is also included in the project.',
      );
    const cfg = {
      codec: 'avc1.42002a',
      width: W,
      height: H,
      bitrate: 10000000,
      framerate: FPS,
      latencyMode: 'realtime',
      avc: { format: 'avc' },
    };
    if (!(await VideoEncoder.isConfigSupported(cfg)).supported)
      throw new Error('This browser cannot encode H.264 at this resolution.');
    const samples = [];
    let description, error;
    const encoder = new VideoEncoder({
      output: (chunk, meta) => {
        if (meta.decoderConfig?.description)
          description = new Uint8Array(meta.decoderConfig.description);
        const bytes = new Uint8Array(chunk.byteLength);
        chunk.copyTo(bytes);
        samples.push({ bytes, timestamp: chunk.timestamp, key: chunk.type === 'key' });
      },
      error: (e) => {
        error = e;
      },
    });
    const render = create();
    try {
      encoder.configure(cfg);
      for (let i = 0; i < FRAMES; i++) {
        if (cancelled()) throw new Error('Render cancelled.');
        if (error) throw error;
        const vf = new VideoFrame(render.frame(i), {
          timestamp: Math.round((i * 1e6) / FPS),
          duration: Math.round(((i + 1) * 1e6) / FPS) - Math.round((i * 1e6) / FPS),
        });
        try {
          encoder.encode(vf, { keyFrame: i % (FPS * 2) === 0 });
        } finally {
          vf.close();
        }
        if ((i + 1) % 8 === 0) {
          await encoder.flush();
          onProgress(i + 1);
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
      await encoder.flush();
      if (error) throw error;
      if (samples.length !== FRAMES) throw new Error('Frame count mismatch: ' + samples.length);
      return ReclaimMP4.mux(samples, description, W, H, FPS);
    } finally {
      if (encoder.state !== 'closed') encoder.close();
    }
  }
  return { create, encode, FRAMES, FPS };
})();

const ReclaimFilm = (() => {
  'use strict';
  const FPS = 24,
    FRAMES = 432,
    W = 1080,
    H = 1350;
  const ink = '#26352c',
    muted = '#53634e',
    rule = '#c9d0c2';
  // Both views sample one render. The detail can never drift from the main clock.
  const ageAt = (frame) => Math.max(0, Math.min(1, (frame - 20) / 375));
  const notes = [
    [0, 'Market day', 'Buses cross the square.'],
    [0.17, 'Sidewalk gardens', 'Tree crowns fill the streets.'],
    [0.3, 'The brickworks', 'The roof gives way on the right.'],
    [0.48, 'East apartments', 'One corner falls into the street.'],
    [0.64, 'The tower opens', 'Slabs fall from the front corner.'],
    [0.84, 'An indoor forest', 'Ferns take root in the open rooms.'],
  ];
  function create() {
    const native = document.createElement('canvas');
    native.width = 480;
    native.height = 360;
    const city = ReclaimCity.createCity(native);
    const film = document.createElement('canvas');
    film.width = W;
    film.height = H;
    const c = film.getContext('2d', { alpha: false });
    c.imageSmoothingEnabled = false;
    function type(s, x, y, font, color = ink, align = 'left') {
      c.font = font;
      c.fillStyle = color;
      c.textAlign = align;
      c.fillText(s, x, y);
    }
    function frame(i) {
      const age = ageAt(i),
        year = 2026 + Math.round(age * 100);
      const [, title, caption] = notes.filter(([start]) => age >= start).at(-1);
      city.render(age, 0, i / FPS, true);
      c.fillStyle = '#ffffff';
      c.fillRect(0, 0, W, H);
      type('RECLAIM', 45, 55, 'bold 31px Arial');
      type('A CENTURY AFTER US', W - 45, 55, '25px Arial', muted, 'right');
      c.fillStyle = rule;
      c.fillRect(45, 78, 990, 2);
      type(String(year), 44, 185, '100px Georgia');
      const left = 355,
        span = 680;
      c.fillStyle = rule;
      c.fillRect(left, 148, span, 4);
      c.fillStyle = muted;
      c.fillRect(left, 148, Math.max(2, span * age), 4);
      for (let j = 0; j <= 10; j++) c.fillRect(left + (j * span) / 10 - 1, 148, 2, j % 5 ? 9 : 14);
      c.fillRect(left + Math.round(span * age) - 4, 137, 8, 23);
      type('2026', left, 191, '25px Arial', muted);
      type('2126', left + span, 191, '25px Arial', muted, 'right');
      c.drawImage(native, 0, 0, 480, 335, 0, 212, 1080, 754);
      c.fillStyle = '#f2f3ed';
      c.fillRect(0, 982, W, H - 982);
      c.fillStyle = '#ffffff';
      c.fillRect(44, 1012, 315, 298);
      c.drawImage(native, 170, 2, 155, 147, 44, 1012, 315, 298);
      c.fillStyle = '#ffffff';
      c.fillRect(44, 1274, 315, 36);
      type('TOWER  /  DETAIL', 56, 1301, 'bold 23px Arial', muted);
      type('IN THE CITY', 386, 1054, 'bold 25px Arial', muted);
      type(title, 384, 1137, '52px Georgia');
      type(caption, 386, 1193, '32px Arial');
      type('Inspired by Post Humans · @zzzzshawn', 386, 1295, '25px Arial', muted);
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
  return { create, encode, FRAMES, FPS, W, H };
})();

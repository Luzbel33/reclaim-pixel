/* One silent H.264 track, one chunk, constant sample duration. AVC samples are
   length-prefixed by WebCodecs; the leading moov lets playback start immediately. */
const ReclaimMP4 = (() => {
  'use strict';
  const str = (s) => Uint8Array.from(s, (c) => c.charCodeAt(0));
  const word = (n) => Uint8Array.of(n >>> 8, n & 255);
  const long = (n) => Uint8Array.of(n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255);
  const zero = (n) => new Uint8Array(n);
  function join(...parts) {
    const a = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let k = 0;
    for (const p of parts) {
      a.set(p, k);
      k += p.length;
    }
    return a;
  }
  function box(type, ...parts) {
    return join(long(parts.reduce((n, p) => n + p.length, 8)), str(type), ...parts);
  }
  const full = (type, flags, ...parts) => box(type, long(flags), ...parts);
  function mux(samples, config, w, h, fps) {
    if (!samples.length || !config)
      throw new Error('The encoder did not return an AVC configuration.');
    for (let i = 1; i < samples.length; i++)
      if (samples[i].timestamp <= samples[i - 1].timestamp)
        throw new Error('This encoder reordered frames. A low-latency AVC encoder is required.');
    const scale = fps * 1000,
      duration = samples.length * 1000;
    const identity = join(
      long(65536),
      long(0),
      long(0),
      long(0),
      long(65536),
      long(0),
      long(0),
      long(0),
      long(0x40000000),
    );
    const ftyp = box('ftyp', str('isom'), long(0x200), str('isomiso2avc1mp41'));
    const mvhd = full(
      'mvhd',
      0,
      zero(8),
      long(scale),
      long(duration),
      long(65536),
      word(256),
      zero(10),
      identity,
      zero(24),
      long(2),
    );
    const tkhd = full(
      'tkhd',
      7,
      zero(8),
      long(1),
      zero(4),
      long(duration),
      zero(16),
      identity,
      long(w * 65536),
      long(h * 65536),
    );
    const mdhd = full('mdhd', 0, zero(8), long(scale), long(duration), word(0x55c4), zero(2));
    const hdlr = full('hdlr', 0, zero(4), str('vide'), zero(12), str('Reclaim Video\0'));
    const vmhd = full('vmhd', 1, zero(8)),
      dinf = box('dinf', full('dref', 0, long(1), full('url ', 1)));
    const compressor = join(Uint8Array.of(7), str('Reclaim'), zero(24));
    const entry = box(
      'avc1',
      zero(6),
      word(1),
      zero(16),
      word(w),
      word(h),
      long(0x480000),
      long(0x480000),
      zero(4),
      word(1),
      compressor,
      word(24),
      word(65535),
      box('avcC', config),
    );
    const stsd = full('stsd', 0, long(1), entry),
      stts = full('stts', 0, long(1), long(samples.length), long(1000));
    const stsc = full('stsc', 0, long(1), long(1), long(samples.length), long(1));
    const stsz = full(
      'stsz',
      0,
      long(0),
      long(samples.length),
      ...samples.map((s) => long(s.bytes.length)),
    );
    const keys = samples.flatMap((s, i) => (s.key ? [long(i + 1)] : [])),
      stss = full('stss', 0, long(keys.length), ...keys);
    function movie(offset) {
      const table = box(
        'stbl',
        stsd,
        stts,
        stss,
        stsc,
        stsz,
        full('stco', 0, long(1), long(offset)),
      );
      return box(
        'moov',
        mvhd,
        box('trak', tkhd, box('mdia', mdhd, hdlr, box('minf', vmhd, dinf, table))),
      );
    }
    const moov = movie(ftyp.length + movie(0).length + 8);
    return new Blob(
      [
        ftyp,
        moov,
        long(samples.reduce((n, s) => n + s.bytes.length, 8)),
        str('mdat'),
        ...samples.map((s) => s.bytes),
      ],
      { type: 'video/mp4' },
    );
  }
  return { mux };
})();

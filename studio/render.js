(() => {
  'use strict';
  const el = (id) => document.getElementById(id);
  let cancel = false,
    url;
  el('cancel').onclick = () => {
    cancel = true;
  };
  el('start').onclick = async () => {
    cancel = false;
    el('start').disabled = true;
    el('cancel').hidden = false;
    el('progress').value = 0;
    if (url) URL.revokeObjectURL(url);
    el('save').hidden = true;
    el('status').textContent = 'Rendering…';
    try {
      const blob = await ReclaimFilm.encode(
        (n) => {
          el('progress').value = n;
          el('status').textContent = 'Rendered ' + n + ' / 576 frames.';
        },
        () => cancel,
      );
      url = URL.createObjectURL(blob);
      el('save').href = url;
      el('save').hidden = false;
      el('status').textContent = '576 frames ready · 24 fps · 1440 × 1260.';
    } catch (e) {
      el('status').textContent = e.message;
    } finally {
      el('start').disabled = false;
      el('cancel').hidden = true;
    }
  };
})();

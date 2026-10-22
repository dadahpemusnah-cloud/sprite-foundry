  // src/ui/live-preview.js
  function previewFrame(p, t, n, opts2, dur) {
    const seq = playSequence(n, { ...opts2, loop: true });
    if (!seq.length) return 0;
    if (p.pos >= seq.length) p.pos = 0;
    if (p.at == null || t - p.at > 4 * dur(seq[p.pos]) + 1e3) p.at = t;
    for (let guard = 0; t - p.at >= dur(seq[p.pos]) && guard < 64; guard++) {
      p.at += dur(seq[p.pos]);
      p.pos = (p.pos + 1) % seq.length;
    }
    return seq[p.pos];
  }
  function createLivePreview({ box, canvas, playBtn, scaleSel, source, onScale, playing: playing2 = true }) {
    const p = { pos: 0, at: null };
    let shown = null, frame = 0, draws = 0, last = null;
    const sync = () => {
      playBtn.textContent = playing2 ? "Pause" : "Play";
      playBtn.setAttribute("aria-pressed", String(!playing2));
    };
    playBtn.addEventListener("click", () => {
      playing2 = !playing2;
      p.at = null;
      sync();
    });
    scaleSel.addEventListener("change", () => onScale(Number(scaleSel.value)));
    sync();
    function update(t) {
      const s = source();
      box.hidden = !s;
      if (!s || !s.n) {
        last = null;
        return;
      }
      if (!box.offsetParent) return;
      frame = playing2 ? previewFrame(p, t, s.n, s.opts, s.dur) : Math.min(frame, s.n - 1);
      const img = s.image(frame), key = s.w + "x" + s.h + "@" + s.scale;
      if (scaleSel.value !== String(s.scale)) scaleSel.value = String(s.scale);
      if (img === shown && key === last) return;
      if (canvas.width !== s.w * s.scale || canvas.height !== s.h * s.scale) {
        canvas.width = s.w * s.scale;
        canvas.height = s.h * s.scale;
        canvas.style.width = canvas.width + "px";
        canvas.style.height = canvas.height + "px";
      }
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      shown = img;
      last = key;
      draws++;
    }
    const loop = (t) => {
      update(t);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    return { update, info: () => ({ shown: !box.hidden, frame, playing: playing2, draws, scale: Number(scaleSel.value), width: canvas.width }) };
  }


  // src/ui/rotation-preview.js
  var COMPASS = { NW: [0, 0], N: [1, 0], NE: [2, 0], W: [0, 1], E: [2, 1], SW: [0, 2], S: [1, 2], SE: [2, 2] };
  var order = (dirs) => CIRCLE.filter((d) => dirs.includes(d));
  function createRotationPreview({ box, canvas, layoutSel, playBtn, source, playing: playing2 = true }) {
    const p = { pos: 0, at: null };
    let frame = 0, key = null, shown = [], drawn = { dirs: [], frames: [] };
    const sync = () => {
      playBtn.textContent = playing2 ? "Pause" : "Play";
    };
    playBtn.addEventListener("click", () => {
      playing2 = !playing2;
      p.at = null;
      sync();
    });
    layoutSel.addEventListener("change", () => {
      key = null;
    });
    sync();
    function update(t) {
      const s = source();
      box.hidden = !s;
      if (!s || !s.n) {
        key = null;
        return;
      }
      if (!box.offsetParent) return;
      frame = playing2 ? previewFrame(p, t, s.n, s.opts, s.dur) : Math.min(frame, s.n - 1);
      const views = s.views.filter((v) => COMPASS[v.dir]), row = layoutSel.value === "row", dirs = order(views.map((v) => v.dir));
      const idx = dirs.map((d) => frame % views.find((x) => x.dir === d).frames);
      const imgs = dirs.map((d, i) => views.find((x) => x.dir === d).image(idx[i]));
      drawn = { dirs, frames: idx };
      const k = [row, s.w, s.h, s.scale, frame, dirs.join()].join("|");
      if (k === key && imgs.every((im, i) => im === shown[i])) return;
      const cw = s.w * s.scale, ch = s.h * s.scale, gap = 6;
      const W = row ? dirs.length * (cw + gap) - gap : 3 * cw + 2 * gap, H = row ? ch : 3 * ch + 2 * gap;
      if (canvas.width !== W || canvas.height !== H) {
        canvas.width = W;
        canvas.height = H;
        canvas.style.width = W + "px";
        canvas.style.height = H + "px";
      }
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, W, H);
      dirs.forEach((d, i) => {
        const [cx, cy] = row ? [i, 0] : COMPASS[d], x = cx * (cw + gap), y = cy * (ch + gap);
        ctx.drawImage(imgs[i], x, y, cw, ch);
      });
      key = k;
      shown = imgs;
    }
    const loop = (t) => {
      update(t);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    return {
      update,
      // the frame each direction was last drawn with (the tests check they are equal)
      info() {
        return { shown: !box.hidden, frame, layout: layoutSel.value, directions: drawn.dirs.slice(), frames: drawn.frames.slice(), width: canvas.width, height: canvas.height };
      }
    };
  }


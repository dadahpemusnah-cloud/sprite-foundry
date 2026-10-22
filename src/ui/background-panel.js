  // src/ui/background-panel.js
  var LOCAL = /* @__PURE__ */ new Set(["flood", "key", "alpha"]);
  var NAMES = { grabcut: "OpenCV GrabCut", flood: "edge flood-fill", key: "colour key", alpha: "keep transparency" };
  function initBackgroundPanel({ $: $2, importPanel: importPanel2 }) {
    const canvas = $2("#maskCanvas"), view = $2("#maskView");
    const st = {
      method: "auto",
      tolerance: 40,
      key: [106, 160, 216],
      iterations: 5,
      clean: true,
      view: "cut",
      brush: "off",
      size: 6,
      img: null,
      w: 0,
      h: 0,
      cropKey: "",
      raw: null,
      base: null,
      final: null,
      used: null,
      hints: null,
      undo: [],
      picking: false,
      running: 0,
      runs: 0
    };
    let scale = 1, stroke = null, rebuildTimer = 0;
    const listeners = [];
    const notify = () => {
      for (const f of listeners) f();
    };
    const cv = createCv({ onState: showCv });
    function showCv(c) {
      const t = {
        idle: `OpenCV.js ${OPENCV_VERSION}: loads the first time GrabCut runs (about 10 MB)`,
        loading: "OpenCV.js: loading (about 10 MB)\u2026",
        ready: `OpenCV.js ${OPENCV_VERSION} ready (${c.mode === "worker" ? "background worker" : "main thread"})`,
        failed: `OpenCV.js could not load (${c.error}). The local tools still work.`
      }[c.state];
      $2("#cvStatus").textContent = t;
    }
    function msg(kind, text) {
      const el2 = $2("#bgMsg");
      el2.textContent = text || "";
      el2.className = "hint " + (kind || "");
    }
    function rebuild() {
      clearTimeout(rebuildTimer);
      const s = importPanel2.session, b = s.bitmap;
      if (!b) return false;
      $2("#bgWork").hidden = false;
      const c = s.crop, key = `${s.original.hash}:${c.x},${c.y},${c.w},${c.h}`;
      if (key === st.cropKey) return true;
      const hadWork = st.final || st.hints && countValues(st.hints, 0) !== st.hints.length;
      const { w: w2, h } = maskSize(c.w, c.h, MASK_MAX_SIDE);
      const off2 = document.createElement("canvas");
      off2.width = w2;
      off2.height = h;
      const ctx = off2.getContext("2d", { willReadFrequently: true });
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(b, c.x, c.y, c.w, c.h, 0, 0, w2, h);
      st.img = ctx.getImageData(0, 0, w2, h);
      Object.assign(st, { w: w2, h, cropKey: key, raw: null, base: null, final: null, used: null, hints: new Uint8Array(w2 * h), undo: [], running: st.running ? st.running + 1 : 0 });
      msg("", hadWork ? "The image or crop changed, so the mask and brush strokes were cleared. Run background removal again." : "Choose a method and press Remove background.");
      sync();
      draw();
      notify();
      return true;
    }
    importPanel2.onChange((what) => {
      if (what === "place") return;
      if (what === "reset") {
        clear();
        return;
      }
      if (what === "image") {
        st.cropKey = "";
        rebuild();
      } else {
        clearTimeout(rebuildTimer);
        rebuildTimer = setTimeout(rebuild, 200);
      }
    });
    function clear() {
      clearTimeout(rebuildTimer);
      Object.assign(st, { img: null, w: 0, h: 0, cropKey: "", raw: null, base: null, final: null, used: null, hints: null, undo: [], running: st.running + 1, reduced: null });
      $2("#bgWork").hidden = true;
      msg("", "");
      notify();
    }
    function state2() {
      if (!st.img) return null;
      return { method: st.method, tolerance: st.tolerance, iterations: st.iterations, key: st.key.slice(), clean: st.clean, used: st.used, w: st.w, h: st.h, raw: st.raw, hints: st.hints };
    }
    function restore(b) {
      st.cropKey = "";
      if (!rebuild()) return false;
      if (!b) return true;
      if (b.w !== st.w || b.h !== st.h) {
        msg("error", "The saved background mask does not fit this crop, so it was not restored. Run background removal again.");
        return false;
      }
      Object.assign(st, { method: b.method, tolerance: b.tolerance, iterations: b.iterations, key: b.key.slice(), clean: b.clean, used: b.used, hints: Uint8Array.from(b.hints), raw: b.raw ? Uint8Array.from(b.raw) : null, undo: [] });
      $2("#bgMethod").value = st.method;
      $2("#bgTol").value = st.tolerance;
      $2("#bgIter").value = st.iterations;
      $2("#bgClean").checked = st.clean;
      $2("#bgKey").value = "#" + st.key.map((v) => v.toString(16).padStart(2, "0")).join("");
      if (st.raw) {
        finish();
        msg("", `Restored the saved background (${NAMES[st.used]}).`);
      } else {
        sync();
        draw();
      }
      return true;
    }
    function reducedCopy() {
      if (!st.img) return null;
      if (st.reduced && st.reduced.key === st.cropKey) return st.reduced.copy;
      const c = document.createElement("canvas");
      c.width = st.w;
      c.height = st.h;
      c.getContext("2d").putImageData(st.img, 0, 0);
      st.reduced = { key: st.cropKey, copy: { dataUrl: c.toDataURL("image/png"), width: st.w, height: st.h } };
      return st.reduced.copy;
    }
    const resolveMethod = () => st.method !== "auto" ? st.method : hasTransparency(st.img) ? "alpha" : "grabcut";
    function localMask(m) {
      if (m === "alpha") return alphaMask(st.img);
      if (m === "key") return colourKeyMask(st.img, st.key, { tolerance: st.tolerance });
      return floodFillMask(st.img, { tolerance: st.tolerance });
    }
    function finish() {
      const n = defaultSpeck(st.w, st.h);
      st.base = st.clean ? cleanMask(st.raw, st.w, st.h, { minSpeck: n, maxHole: n }) : st.raw;
      st.final = applyHints(st.base, st.hints);
      sync();
      draw();
      notify();
    }
    async function run() {
      try {
        await runMethod();
      } finally {
        st.runs++;
        sync();
      }
    }
    async function runMethod() {
      if (!rebuild()) return;
      const m = resolveMethod(), token = ++st.running;
      if (m === "alpha" && !hasTransparency(st.img)) {
        msg("error", "This image has no transparent pixels. Use another method.");
        return;
      }
      if (LOCAL.has(m)) {
        st.raw = localMask(m);
        st.used = m;
        msg("", `Background removed with ${NAMES[m]}.`);
        finish();
        return;
      }
      $2("#bgRun").disabled = true;
      msg("", cv.state === "ready" ? "Running GrabCut\u2026" : "Loading OpenCV.js, then running GrabCut\u2026");
      try {
        const out = await cv.grabCut(st.img, st.hints, { iterations: st.iterations });
        if (token !== st.running) return;
        st.raw = out;
        st.used = "grabcut";
        msg("", "Background removed with OpenCV GrabCut. Paint Keep/Remove strokes and run again to refine.");
      } catch (e) {
        if (token !== st.running) return;
        st.raw = floodFillMask(st.img, { tolerance: st.tolerance });
        st.used = "flood";
        msg("error", `GrabCut could not run (${e.message}). Edge flood-fill was used instead.`);
      } finally {
        $2("#bgRun").disabled = false;
      }
      finish();
    }
    function settingsChanged() {
      if (!st.raw) {
        sync();
        return;
      }
      if (LOCAL.has(st.used) && LOCAL.has(resolveMethod()) && resolveMethod() === st.used) st.raw = localMask(st.used);
      finish();
    }
    function sync() {
      $2("#bgTolV").textContent = st.tolerance;
      $2("#brSizeV").textContent = st.size;
      $2("#bgKeyRow").hidden = resolveMethodSafe() !== "key";
      for (const [id, v] of [["#brKeep", "keep"], ["#brRemove", "remove"], ["#brOff", "off"]]) $2(id).setAttribute("aria-pressed", String(st.brush === v));
      $2("#bgPickKey").setAttribute("aria-pressed", String(st.picking));
      $2("#brUndo").disabled = !st.undo.length;
      canvas.style.cursor = st.picking ? "copy" : st.brush === "off" ? "default" : "crosshair";
      const i = info();
      $2("#bgInfo").textContent = !i ? "" : i.used ? `${i.w}\xD7${i.h} px mask \xB7 ${NAMES[i.used]} \xB7 character ${(100 * i.fg / i.total).toFixed(1)}% \xB7 brush keep ${i.keep} px / remove ${i.remove} px` : `${i.w}\xD7${i.h} px mask \xB7 not run yet`;
    }
    const resolveMethodSafe = () => st.img ? resolveMethod() : st.method;
    function draw() {
      if (!st.img) return;
      const boxW = Math.max(200, view.clientWidth - 4), boxH = 440;
      scale = Math.min(boxW / st.w, boxH / st.h, 8);
      const cw = Math.max(1, Math.round(st.w * scale)), ch = Math.max(1, Math.round(st.h * scale));
      canvas.width = cw;
      canvas.height = ch;
      canvas.style.width = cw + "px";
      canvas.style.height = ch + "px";
      const out = new ImageData(st.w, st.h), s = st.img.data, d = out.data;
      for (let p = 0; p < st.w * st.h; p++) {
        const i = p * 4, on = !st.final || st.final[p] === 1;
        if (st.view === "overlay" || !st.final) {
          d[i] = s[i];
          d[i + 1] = s[i + 1];
          d[i + 2] = s[i + 2];
          d[i + 3] = s[i + 3];
          if (!on) {
            d[i] = (d[i] + 255 * 2) / 3;
            d[i + 1] = d[i + 1] / 3;
            d[i + 2] = d[i + 2] / 3;
            d[i + 3] = 255;
          }
        } else if (on) {
          d[i] = s[i];
          d[i + 1] = s[i + 1];
          d[i + 2] = s[i + 2];
          d[i + 3] = 255;
        }
        const hv = st.hints[p];
        if (hv) {
          const c = hv === HINT_KEEP ? [60, 220, 90] : [240, 60, 60];
          for (let k = 0; k < 3; k++) d[i + k] = (d[i + k] + c[k]) / 2;
          d[i + 3] = 255;
        }
      }
      const off2 = document.createElement("canvas");
      off2.width = st.w;
      off2.height = st.h;
      off2.getContext("2d").putImageData(out, 0, 0);
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = scale < 1;
      ctx.clearRect(0, 0, cw, ch);
      ctx.drawImage(off2, 0, 0, cw, ch);
    }
    const toMask = (e) => {
      const r = canvas.getBoundingClientRect();
      return [(e.clientX - r.left) / scale, (e.clientY - r.top) / scale];
    };
    canvas.addEventListener("pointerdown", (e) => {
      if (!st.img) return;
      const [x, y] = toMask(e);
      if (st.picking) {
        const px = Math.max(0, Math.min(st.w - 1, Math.floor(x))), py = Math.max(0, Math.min(st.h - 1, Math.floor(y))), i = (py * st.w + px) * 4, d = st.img.data;
        st.key = [d[i], d[i + 1], d[i + 2]];
        st.picking = false;
        $2("#bgKey").value = "#" + st.key.map((v) => v.toString(16).padStart(2, "0")).join("");
        settingsChanged();
        return;
      }
      if (st.brush === "off") return;
      e.preventDefault();
      st.undo.push(Uint8Array.from(st.hints));
      if (st.undo.length > 20) st.undo.shift();
      stroke = { x, y, v: st.brush === "keep" ? HINT_KEEP : HINT_REMOVE };
      paintHint(st.hints, st.w, st.h, x, y, x, y, st.size, stroke.v);
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch (err) {
      }
      afterPaint();
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!stroke) return;
      const [x, y] = toMask(e);
      paintHint(st.hints, st.w, st.h, stroke.x, stroke.y, x, y, st.size, stroke.v);
      stroke.x = x;
      stroke.y = y;
      afterPaint();
    });
    const endStroke = () => {
      stroke = null;
      sync();
    };
    canvas.addEventListener("pointerup", endStroke);
    canvas.addEventListener("pointercancel", endStroke);
    function afterPaint() {
      if (st.base) {
        st.final = applyHints(st.base, st.hints);
        notify();
      }
      draw();
    }
    $2("#bgRun").addEventListener("click", run);
    $2("#bgMethod").addEventListener("change", (e) => {
      st.method = e.target.value;
      sync();
    });
    $2("#bgTol").addEventListener("input", (e) => {
      st.tolerance = Number(e.target.value);
      settingsChanged();
    });
    $2("#bgKey").addEventListener("input", (e) => {
      const v = e.target.value;
      st.key = [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16));
      settingsChanged();
    });
    $2("#bgPickKey").addEventListener("click", () => {
      st.picking = !st.picking;
      sync();
    });
    $2("#bgIter").addEventListener("change", (e) => {
      const v = Math.round(Number(e.target.value));
      st.iterations = Number.isFinite(v) ? Math.max(1, Math.min(10, v)) : 5;
      e.target.value = st.iterations;
    });
    $2("#bgClean").addEventListener("change", (e) => {
      st.clean = e.target.checked;
      settingsChanged();
    });
    $2("#bgView").addEventListener("change", (e) => {
      st.view = e.target.value === "overlay" ? "overlay" : "cut";
      draw();
    });
    for (const [id, v] of [["#brKeep", "keep"], ["#brRemove", "remove"], ["#brOff", "off"]]) $2(id).addEventListener("click", () => {
      st.brush = v;
      st.picking = false;
      sync();
    });
    $2("#brSize").addEventListener("input", (e) => {
      st.size = Number(e.target.value);
      sync();
    });
    $2("#brUndo").addEventListener("click", () => {
      if (!st.undo.length) return;
      st.hints = st.undo.pop();
      afterPaint();
      sync();
    });
    $2("#brClear").addEventListener("click", () => {
      if (!st.hints) return;
      st.undo.push(Uint8Array.from(st.hints));
      st.hints.fill(0);
      afterPaint();
      sync();
    });
    observeSize(view, draw);
    showCv(cv);
    sync();
    function info() {
      if (!st.img) return null;
      return {
        method: st.method,
        resolved: resolveMethod(),
        used: st.used,
        cv: cv.state,
        cvMode: cv.mode,
        cvError: cv.error,
        w: st.w,
        h: st.h,
        total: st.w * st.h,
        fg: st.final ? countValues(st.final) : null,
        keep: countValues(st.hints, HINT_KEEP),
        remove: countValues(st.hints, HINT_REMOVE),
        stale: !st.final,
        tolerance: st.tolerance,
        iterations: st.iterations,
        key: [...st.key],
        clean: st.clean,
        view: st.view,
        brush: st.brush,
        runs: st.runs,
        maskHash: st.final ? bytesHash(st.final) : null
      };
    }
    return {
      info,
      mask: () => st.final ? Array.from(st.final) : null,
      // for the conversion step (phase I3)
      result: () => st.final ? { mask: st.final, w: st.w, h: st.h, img: st.img, cropKey: st.cropKey, method: st.used } : null,
      cv,
      state: state2,
      restore,
      reducedCopy,
      onChange(f) {
        listeners.push(f);
      }
    };
  }


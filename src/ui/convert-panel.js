  // src/ui/convert-panel.js
  var PRESETS3 = ["pico8", "sweetie16", "endesga32", "gameboy"];
  function initConvertPanel({ $: $2, importPanel: importPanel2, bgPanel: bgPanel2 }) {
    const canvas = $2("#convCanvas"), view = $2("#convView");
    const st = { ...DEFAULTS2, view: "pixel", split: 50, locked: null, result: null, src: null, runs: 0 };
    let timer = 0;
    const listeners = [];
    function schedule() {
      clearTimeout(timer);
      timer = setTimeout(convert, 120);
    }
    bgPanel2.onChange(schedule);
    importPanel2.onChange((what) => {
      if (what === "place") schedule();
    });
    function paletteColours2() {
      if (st.locked) return st.locked;
      if (st.palette === "auto") return null;
      const P = PALETTES[st.palette];
      return P ? P.colors : null;
    }
    function convert() {
      clearTimeout(timer);
      const bg = bgPanel2.result();
      $2("#convWork").hidden = !importPanel2.session.bitmap;
      if (!bg) {
        st.result = null;
        st.src = null;
        for (const f of listeners) f();
        msg("Remove the background first (step 2); the pixel art appears here.");
        sync();
        draw();
        return;
      }
      if (st.palette === "custom" && !PALETTES.custom && !st.locked) st.palette = "auto";
      st.result = convertToPixelArt(bg.img, bg.mask, { ...pick(st), place: importPanel2.session.place, paletteColours: paletteColours2() });
      st.src = bg;
      st.runs++;
      for (const f of listeners) f();
      msg(st.result.stats.opaque ? "" : "The mask is empty: nothing to convert.");
      sync();
      draw();
    }
    const pick = (s) => {
      const o = {};
      for (const k of Object.keys(DEFAULTS2)) o[k] = s[k];
      return o;
    };
    function msg(t) {
      $2("#convMsg").textContent = t;
      $2("#convMsg").hidden = !t;
    }
    function sync() {
      const r = st.result;
      $2("#convHeight").value = String(st.height);
      $2("#convHeadroom").value = st.headroom;
      $2("#convFloor").value = st.floor;
      $2("#convColours").value = st.colours;
      $2("#convColoursV").textContent = st.colours;
      $2("#convContrast").value = Math.round(st.contrast * 100);
      $2("#convContrastV").textContent = Math.round(st.contrast * 100) + "%";
      $2("#convSat").value = Math.round(st.saturation * 100);
      $2("#convSatV").textContent = Math.round(st.saturation * 100) + "%";
      $2("#convResample").value = st.resample;
      $2("#convDither").checked = st.dither;
      $2("#convClean").checked = st.cleanup;
      const sel = $2("#convPalette");
      const opts2 = ["auto", ...PRESETS3, ...PALETTES.custom ? ["custom"] : []];
      if (sel.options.length !== opts2.length) sel.replaceChildren(...opts2.map((v) => {
        const o = document.createElement("option");
        o.value = v;
        o.textContent = v === "auto" ? "automatic (k-means)" : v === "custom" ? "custom palette" : v;
        return o;
      }));
      sel.value = st.palette;
      sel.disabled = !!st.locked;
      $2("#convColours").disabled = !!st.locked || st.palette !== "auto";
      $2("#convLock").checked = !!st.locked;
      $2("#convLock").disabled = !r;
      $2("#convApply").disabled = !r || !r.stats.opaque;
      for (const [id, v] of [["#cvwOrig", "original"], ["#cvwPixel", "pixel"], ["#cvwSlider", "slider"]]) $2(id).setAttribute("aria-pressed", String(st.view === v));
      $2("#convSplitRow").hidden = st.view !== "slider";
      const sw = $2("#convSwatches");
      sw.replaceChildren(...(r ? r.palette : []).map((c) => {
        const s = document.createElement("span");
        s.className = "conv-sw";
        s.style.background = c;
        s.title = c;
        return s;
      }));
      $2("#convInfo").textContent = r ? `${r.N}\xD7${r.N} sprite (frame ${r.N + 4}\xD7${r.N + 4}) \xB7 ${r.stats.colours} colours${st.locked ? " (locked)" : ""} \xB7 ${r.stats.opaque} px \xB7 clean-up: ${r.stats.orphans} stray, ${r.stats.holes} holes, ${r.stats.noise} noise` : "";
    }
    function draw() {
      const r = st.result, ctx = canvas.getContext("2d");
      if (!r) {
        canvas.width = canvas.height = 1;
        return;
      }
      const N = r.N, z = Math.max(1, Math.floor(Math.min(Math.max(200, view.clientWidth - 4), 440) / N)), S = N * z;
      canvas.width = S;
      canvas.height = S;
      canvas.style.width = S + "px";
      canvas.style.height = S + "px";
      ctx.clearRect(0, 0, S, S);
      const pix = document.createElement("canvas");
      pix.width = N;
      pix.height = N;
      const id = new ImageData(N, N);
      r.px.forEach((c, p) => {
        if (!c) return;
        const [R, G, B] = rgbOf(c);
        id.data.set([R, G, B, 255], p * 4);
      });
      pix.getContext("2d").putImageData(id, 0, 0);
      const L = r.work.layout, box = r.work.box, src = st.src;
      const orig = document.createElement("canvas");
      orig.width = src.w;
      orig.height = src.h;
      const od = new ImageData(src.w, src.h);
      for (let p = 0; p < src.w * src.h; p++) if (src.mask[p]) {
        od.data[p * 4] = src.img.data[p * 4];
        od.data[p * 4 + 1] = src.img.data[p * 4 + 1];
        od.data[p * 4 + 2] = src.img.data[p * 4 + 2];
        od.data[p * 4 + 3] = 255;
      }
      orig.getContext("2d").putImageData(od, 0, 0);
      const drawOrig = () => {
        if (!box) return;
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(orig, box.x, box.y, box.w, box.h, L.x * z, L.y * z, L.w * z, L.h * z);
      };
      const drawPix = () => {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(pix, 0, 0, S, S);
      };
      if (st.view === "original") drawOrig();
      else if (st.view === "pixel") drawPix();
      else {
        const cut = Math.round(S * st.split / 100);
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, cut, S);
        ctx.clip();
        drawOrig();
        ctx.restore();
        ctx.save();
        ctx.beginPath();
        ctx.rect(cut, 0, S - cut, S);
        ctx.clip();
        drawPix();
        ctx.restore();
        ctx.fillStyle = "#ffd34d";
        ctx.fillRect(cut - 1, 0, 2, S);
      }
    }
    const num3 = (v, lo, hi, d) => {
      v = Math.round(Number(v));
      return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d;
    };
    const onSet = (id, ev, f) => $2(id).addEventListener(ev, (e) => {
      f(e.target);
      convert();
    });
    onSet("#convHeight", "change", (t) => {
      const v = Number(t.value);
      st.height = HEIGHTS.includes(v) ? v : DEFAULTS2.height;
    });
    onSet("#convHeadroom", "change", (t) => {
      st.headroom = num3(t.value, 0, 32, DEFAULTS2.headroom);
    });
    onSet("#convFloor", "change", (t) => {
      st.floor = num3(t.value, 0, 8, DEFAULTS2.floor);
    });
    onSet("#convColours", "input", (t) => {
      st.colours = num3(t.value, 2, 32, 16);
    });
    onSet("#convPalette", "change", (t) => {
      st.palette = t.value;
    });
    onSet("#convResample", "change", (t) => {
      st.resample = ["majority", "exact"].includes(t.value) ? t.value : "average";
    });
    onSet("#convContrast", "input", (t) => {
      st.contrast = num3(t.value, 0, 50, 0) / 100;
    });
    onSet("#convSat", "input", (t) => {
      st.saturation = num3(t.value, 0, 50, 0) / 100;
    });
    onSet("#convDither", "change", (t) => {
      st.dither = t.checked;
    });
    onSet("#convClean", "change", (t) => {
      st.cleanup = t.checked;
    });
    onSet("#convLock", "change", (t) => {
      st.locked = t.checked && st.result ? st.result.palette.slice() : null;
    });
    for (const [id, v] of [["#cvwOrig", "original"], ["#cvwPixel", "pixel"], ["#cvwSlider", "slider"]]) $2(id).addEventListener("click", () => {
      st.view = v;
      sync();
      draw();
    });
    $2("#convSplit").addEventListener("input", (e) => {
      st.split = num3(e.target.value, 0, 100, 50);
      draw();
    });
    observeSize(view, draw);
    sync();
    return {
      // Project files (phase I4)
      state: () => ({ ...pick(st), locked: st.locked ? st.locked.slice() : null }),
      restore(c) {
        Object.assign(st, pick({ ...DEFAULTS2, ...c }), { locked: c.locked ? c.locked.slice() : null });
        sync();
      },
      convertNow() {
        if (timer) convert();
      },
      onChange(f) {
        listeners.push(f);
      },
      info() {
        const r = st.result;
        return r ? { N: r.N, colours: r.stats.colours, palette: r.palette.slice(), locked: st.locked ? st.locked.slice() : null, opaque: r.stats.opaque, stats: { ...r.stats, layout: void 0 }, settings: pick(st), view: st.view, runs: st.runs, canvas: canvas.width } : { runs: st.runs, settings: pick(st) };
      },
      pixels: () => st.result ? st.result.px.slice() : null,
      // for the imported character type (phase I4)
      result: () => st.result
    };
  }


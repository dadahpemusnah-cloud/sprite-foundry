  // src/ui/art-panel.js
  function initArtPanel({ $: $2, cv, onChange }) {
    const canvas = $2("#arCanvas");
    const st = { rest: null, part: "head", layer: "hidden", colour: null, tool: "pencil", undo: [], redo: [], z: 4, painting: null };
    function msg(t, kind = "") {
      const el2 = $2("#arMsg");
      el2.textContent = t || "";
      el2.className = "hint " + kind;
    }
    const art = () => st.rest && st.rest.art || emptyArt();
    const N = () => st.rest.N;
    function refresh(rest) {
      st.rest = rest;
      const on = !!(rest && rest.seg && rest.rig);
      $2("#artWork").hidden = !on;
      if (!on) return;
      if (!rest.seg.parts.some((p) => p.id === st.part)) st.part = rest.seg.parts[0].id;
      if (st.layer !== "hidden" && !(art().swaps[st.part] || []).some((a) => a.name === st.layer)) st.layer = "hidden";
      if (!st.colour || !rest.palette.includes(st.colour)) st.colour = rest.palette[Math.floor(rest.palette.length / 2)];
      render();
    }
    function commit(next, note) {
      st.undo.push(art());
      if (st.undo.length > 30) st.undo.shift();
      st.redo = [];
      st.rest.art = next;
      onChange(next);
      if (note !== void 0) msg(note);
      render();
    }
    function current() {
      const a = art(), n = N();
      if (st.layer === "hidden") return { px: (a.holes[st.part] || new Array(n * n).fill(null)).slice(), allowed: hiddenAllowed(st.rest, st.part) };
      const d = (a.swaps[st.part] || []).find((x) => x.name === st.layer);
      return { px: d.px.slice(), allowed: null };
    }
    function store(px) {
      return st.layer === "hidden" ? setHidden(art(), st.part, px) : setDrawing(art(), st.part, st.layer, px);
    }
    function render() {
      const rest = st.rest, a = art(), label = (id) => (rest.seg.parts.find((p) => p.id === id) || { label: id }).label;
      const parts = rest.seg.parts.map((p) => p.id);
      if ($2("#arPart").options.length !== parts.length || [...$2("#arPart").options].some((o, i) => o.value !== parts[i])) $2("#arPart").replaceChildren(...parts.map((id) => new Option(label(id), id)));
      $2("#arPart").value = st.part;
      const layers = [["hidden", "hidden area (under other parts)"], ...(a.swaps[st.part] || []).map((d) => [d.name, "drawing: " + d.name])];
      $2("#arLayer").replaceChildren(...layers.map(([v, t]) => new Option(t, v)));
      $2("#arLayer").value = st.layer;
      const isDrawing = st.layer !== "hidden";
      $2("#arRename").disabled = !isDrawing;
      $2("#arDelete").disabled = !isDrawing;
      $2("#arAuto").disabled = isDrawing;
      $2("#arRenameTo").value = isDrawing ? st.layer : "";
      $2("#arUndo").disabled = !st.undo.length;
      $2("#arRedo").disabled = !st.redo.length;
      for (const [id, v] of [["#arPencil", "pencil"], ["#arEraser", "eraser"]]) $2(id).setAttribute("aria-pressed", String(st.tool === v));
      $2("#arSwatches").replaceChildren(...rest.palette.map((c) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "ar-sw";
        b.style.background = c;
        b.title = c;
        b.setAttribute("aria-label", "Paint with " + c);
        b.setAttribute("aria-pressed", String(c === st.colour));
        b.addEventListener("click", () => {
          st.colour = c;
          st.tool = "pencil";
          render();
        });
        return b;
      }));
      const { px, allowed } = current(), n = rest.N, count = px.filter(Boolean).length;
      $2("#arInfo").textContent = isDrawing ? `${label(st.part)} \xB7 drawing "${st.layer}": ${count} px \xB7 chosen in step 6 per key \xB7 user-made` : `${label(st.part)} \xB7 hidden area: ${count} of ${allowed.reduce((s, v) => s + v, 0)} px painted \xB7 shows only when the parts in front move \xB7 user-made`;
      draw(px, allowed);
    }
    function draw(px, allowed) {
      const rest = st.rest, n = rest.N, z = st.z = Math.max(3, Math.floor(400 / n)), ctx = canvas.getContext("2d");
      canvas.width = canvas.height = n * z;
      canvas.style.width = canvas.style.height = n * z + "px";
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const tags = spriteTags(rest.seg, rest.px, n);
      for (let i = 0; i < n * n; i++) {
        const x = i % n, y = i / n | 0;
        if (rest.px[i]) {
          ctx.globalAlpha = tags[i] === st.part ? 0.55 : 0.2;
          ctx.fillStyle = rest.px[i];
          ctx.fillRect(x * z, y * z, z, z);
        }
        if (allowed && allowed[i]) {
          ctx.globalAlpha = 0.35;
          ctx.strokeStyle = "#ff3fb4";
          ctx.strokeRect(x * z + 0.5, y * z + 0.5, z - 1, z - 1);
        }
        if (px[i]) {
          ctx.globalAlpha = 1;
          ctx.fillStyle = px[i];
          ctx.fillRect(x * z, y * z, z, z);
        }
      }
      ctx.globalAlpha = 1;
    }
    const cell = (e) => {
      const r = canvas.getBoundingClientRect();
      return [Math.floor((e.clientX - r.left) / st.z), Math.floor((e.clientY - r.top) / st.z)];
    };
    function paintAt2(x, y) {
      const p = st.painting, n = N();
      if (x < 0 || y < 0 || x >= n || y >= n) return;
      const i = y * n + x;
      if (p.allowed && !p.allowed[i]) return;
      p.px[i] = st.tool === "eraser" ? null : st.colour;
      draw(p.px, p.allowed);
    }
    canvas.addEventListener("pointerdown", (e) => {
      if (!st.rest) return;
      e.preventDefault();
      const c = current();
      st.painting = { px: c.px, allowed: c.allowed };
      paintAt2(...cell(e));
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch (err) {
      }
    });
    canvas.addEventListener("pointermove", (e) => {
      if (st.painting) paintAt2(...cell(e));
    });
    const end = () => {
      const p = st.painting;
      if (!p) return;
      st.painting = null;
      commit(store(p.px));
    };
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", end);
    $2("#arPart").addEventListener("change", (e) => {
      st.part = e.target.value;
      st.layer = "hidden";
      render();
    });
    $2("#arLayer").addEventListener("change", (e) => {
      st.layer = e.target.value;
      render();
    });
    $2("#arPencil").addEventListener("click", () => {
      st.tool = "pencil";
      render();
    });
    $2("#arEraser").addEventListener("click", () => {
      st.tool = "eraser";
      render();
    });
    $2("#arNew").addEventListener("click", () => {
      const list = art().swaps[st.part] || [];
      let k = list.length + 1;
      while (list.some((a) => a.name === "drawing " + k)) k++;
      try {
        const name = "drawing " + k;
        commit(addDrawing(art(), st.part, name, drawingFromPart(st.rest, st.part)), `New drawing "${name}" for this part, started from its pixels. Choose it for a key in step 6.`);
        st.layer = name;
        render();
      } catch (err) {
        msg(err.message, "error");
      }
    });
    $2("#arRename").addEventListener("click", () => {
      const to = $2("#arRenameTo").value.trim();
      if (!/^[A-Za-z0-9][A-Za-z0-9 _-]{0,23}$/.test(to)) {
        msg("A drawing name uses letters, digits, spaces, _ or - (up to 24).", "error");
        return;
      }
      try {
        commit(renameDrawing(art(), st.part, st.layer, to), `Renamed to "${to}".`);
        st.layer = to;
        render();
      } catch (err) {
        msg(err.message, "error");
      }
    });
    $2("#arDelete").addEventListener("click", () => {
      const n = st.layer;
      st.layer = "hidden";
      commit(deleteDrawing(art(), st.part, n), `Deleted "${n}"; keys that chose it use the image again.`);
    });
    $2("#arClear").addEventListener("click", () => commit(store(new Array(N() * N()).fill(null)), "Cleared."));
    $2("#arAuto").addEventListener("click", async () => {
      const method = $2("#arAutoMethod").value, useCv = method === "opencv" || method === "auto" && cv.state === "ready";
      const allowed = hiddenAllowed(st.rest, st.part);
      if (!allowed.some(Boolean)) {
        msg("No other part covers this one in the image, so it has no hidden area.", "error");
        return;
      }
      let px = null, used = "the nearest colour of the part";
      if (useCv) {
        try {
          msg("Running OpenCV inpaint\u2026");
          const { img, mask } = inpaintInput(st.rest, st.part);
          px = toPaletteHex(await cv.inpaint(img, mask, 3), allowed, st.rest.palette);
          used = "OpenCV inpaint (mapped to the palette)";
        } catch (err) {
          px = null;
          used = `the nearest colour of the part (OpenCV unavailable: ${err.message})`;
        }
      }
      if (!px) px = fillNearest(st.rest, st.part);
      st.layer = "hidden";
      commit(setHidden(art(), st.part, px), `Filled the hidden area with ${used}. It is a guess, not the image: check it and paint over it.`);
    });
    $2("#arUndo").addEventListener("click", () => {
      if (!st.undo.length) return;
      st.redo.push(art());
      st.rest.art = st.undo.pop();
      onChange(st.rest.art);
      render();
    });
    $2("#arRedo").addEventListener("click", () => {
      if (!st.redo.length) return;
      st.undo.push(art());
      st.rest.art = st.redo.pop();
      onChange(st.rest.art);
      render();
    });
    return {
      refresh,
      info() {
        if (!st.rest || !st.rest.seg) return { ready: false };
        const a = art(), c = current();
        return {
          ready: true,
          part: st.part,
          layer: st.layer,
          tool: st.tool,
          colour: st.colour,
          z: st.z,
          px: c.px,
          allowed: c.allowed ? Array.from(c.allowed) : null,
          drawings: Object.fromEntries(Object.entries(a.swaps).map(([id, l]) => [id, l.map((d) => d.name)])),
          holes: Object.keys(a.holes)
        };
      }
    };
  }


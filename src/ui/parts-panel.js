  // src/ui/parts-panel.js
  var HUES = (i) => `hsl(${i * 137.508 % 360}, 80%, 55%)`;
  var hueRGB = (i) => {
    const c = document.createElement("canvas").getContext("2d");
    c.fillStyle = HUES(i);
    const h = c.fillStyle;
    return [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
  };
  function initPartsPanel({ $: $2, cv, onChange, onReady = () => {
  } }) {
    const canvas = $2("#partsCanvas"), view = $2("#partsView");
    const st = { rest: null, rgba: null, size: 0, seg: null, active: "torso", tool: "brush", radius: 4, tol: 40, show: "all", highlight: true, method: "auto", undo: [], redo: [], lastGrow: null, loadToken: 0 };
    let scale = 1, drag = null, colours = [];
    function msg(t, kind = "") {
      const el2 = $2("#partsMsg");
      el2.textContent = t || "";
      el2.className = "hint " + kind;
    }
    async function setRest(rest) {
      const token = ++st.loadToken;
      st.rest = rest;
      st.undo = [];
      st.redo = [];
      $2("#partsWork").hidden = !rest;
      if (!rest) {
        st.rgba = null;
        st.seg = null;
        onReady();
        return;
      }
      if (!rest.work) {
        st.rgba = null;
        st.seg = null;
        msg("This version was made before body parts existed. Press Use as sprite again in step 3 to edit its parts.", "error");
        sync();
        draw();
        return;
      }
      const img = new Image();
      img.src = rest.work.dataUrl;
      try {
        await img.decode();
      } catch (e) {
        if (token === st.loadToken) msg("The working image could not be decoded.", "error");
        return;
      }
      if (token !== st.loadToken) return;
      const c = document.createElement("canvas");
      c.width = c.height = rest.work.size;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      st.rgba = ctx.getImageData(0, 0, c.width, c.height).data;
      st.size = c.width;
      st.seg = rest.seg || newSegmentation(st.rgba, st.size);
      if (!st.seg.parts.some((p) => p.id === st.active)) st.active = st.seg.parts[0] ? st.seg.parts[0].id : null;
      msg(rest.seg ? "" : "Assign every pixel to a body part: start with Rough guess or paint a stroke in each part and press Grow from strokes.");
      renderList();
      sync();
      draw();
      onReady();
    }
    function commit(next, note) {
      if (next === st.seg) return;
      st.undo.push(st.seg);
      if (st.undo.length > 30) st.undo.shift();
      st.redo = [];
      st.seg = next;
      changed(note);
    }
    function changed(note) {
      renderList();
      sync();
      draw();
      if (note !== void 0) msg(note);
      onChange(st.seg);
    }
    function sync() {
      const on = !!st.seg;
      for (const [id, v] of [["#ptBrush", "brush"], ["#ptErase", "erase"], ["#ptLasso", "lasso"], ["#ptFill", "fill"]]) {
        $2(id).setAttribute("aria-pressed", String(st.tool === v));
        $2(id).disabled = !on;
      }
      for (const id of ["#ptGuess", "#ptGrow", "#ptAdd", "#ptBack", "#ptClear"]) $2(id).disabled = !on;
      $2("#ptUndo").disabled = !st.undo.length;
      $2("#ptRedo").disabled = !st.redo.length;
      $2("#ptSizeV").textContent = st.radius;
      $2("#ptTolV").textContent = st.tol;
      if (!on) {
        $2("#partsInfo").textContent = "";
        return;
      }
      const c = counts(st.seg);
      $2("#partsInfo").textContent = `${c.character - c.unassigned} of ${c.character} px assigned \xB7 ${c.unassigned} unassigned \xB7 ${st.seg.parts.length} parts${st.seg.extras.length ? ` \xB7 ${st.seg.extras.length} user-made back layers` : ""}`;
      $2("#partsInfo").classList.toggle("warn", c.unassigned > 0);
    }
    function renderList() {
      const list = $2("#ptList");
      if (!st.seg) {
        list.replaceChildren();
        $2("#ptExtras").replaceChildren();
        return;
      }
      colours = st.seg.parts.map((p, i) => hueRGB(i));
      const per = counts(st.seg).perPart;
      const head = document.createElement("div");
      head.className = "pt-row pt-head";
      head.append(...["", "", "part", "px", "absent", ""].map((t) => {
        const c = document.createElement("span");
        c.textContent = t;
        return c;
      }));
      head.children[4].title = "Not in this image";
      head.setAttribute("aria-hidden", "true");
      list.replaceChildren(head, ...st.seg.parts.map((p, i) => {
        const row = document.createElement("div");
        row.className = "pt-row" + (p.id === st.active ? " on" : "");
        const pick = document.createElement("input");
        pick.type = "radio";
        pick.name = "ptActive";
        pick.checked = p.id === st.active;
        pick.setAttribute("aria-label", "Paint " + p.label);
        pick.addEventListener("change", () => {
          st.active = p.id;
          renderList();
          draw();
        });
        const chip = document.createElement("span");
        chip.className = "pt-chip";
        chip.style.background = HUES(i);
        const name = document.createElement("input");
        name.type = "text";
        name.value = p.label;
        name.className = "pt-name";
        name.setAttribute("aria-label", `Name of part ${p.id}`);
        name.addEventListener("change", () => {
          const v = name.value.trim().slice(0, 80) || p.id;
          commit(setPart(st.seg, p.id, { label: v }));
        });
        const n = document.createElement("span");
        n.className = "mono pt-n";
        n.textContent = per[i];
        const miss = document.createElement("label");
        miss.className = "pt-miss";
        const mc = document.createElement("input");
        mc.type = "checkbox";
        mc.checked = !!p.missing;
        mc.setAttribute("aria-label", `${p.label} is not in this image`);
        mc.addEventListener("change", () => commit(setPart(st.seg, p.id, { missing: mc.checked }), mc.checked ? `${p.label} is marked as not in this image.` : ""));
        mc.title = "Not in this image";
        miss.append(mc);
        const del = document.createElement("button");
        del.type = "button";
        del.textContent = "\xD7";
        del.setAttribute("aria-label", "Delete part " + p.label);
        del.addEventListener("click", () => {
          commit(deletePart(st.seg, p.id), `Deleted ${p.label}; its pixels are unassigned.`);
          if (st.active === p.id) st.active = st.seg.parts[0] ? st.seg.parts[0].id : null;
          renderList();
        });
        row.append(pick, chip, name, n, miss, del);
        return row;
      }));
      $2("#ptExtras").replaceChildren(...st.seg.extras.map((e) => {
        const li = document.createElement("li");
        li.textContent = `${e.label} \xB7 user-made (not in the image) \xB7 darkened ${Math.round(e.darken * 100)}%`;
        return li;
      }));
    }
    function draw() {
      const ctx = canvas.getContext("2d");
      if (!st.seg || !st.rgba) {
        canvas.width = canvas.height = 1;
        return;
      }
      const N = st.size;
      scale = Math.max(1, Math.floor(Math.min(Math.max(200, view.clientWidth - 4), 440) / N));
      canvas.width = canvas.height = N * scale;
      canvas.style.width = canvas.style.height = N * scale + "px";
      const id = new ImageData(N, N), d = id.data, m = st.seg.map, act = partIndex(st.seg, st.active);
      for (let t = 0; t < N * N; t++) {
        const v = m[t];
        if (!v) continue;
        let r = st.rgba[t * 4], g = st.rgba[t * 4 + 1], b = st.rgba[t * 4 + 2];
        if (v === UNASSIGNED) {
          if (st.highlight) {
            r = 255;
            g = 0;
            b = 200;
          }
        } else if (st.show === "all" || st.show === "active" && v === act) {
          const c = colours[v - 1];
          r = (r + c[0] * 1.2) / 2.2;
          g = (g + c[1] * 1.2) / 2.2;
          b = (b + c[2] * 1.2) / 2.2;
        }
        d[t * 4] = r;
        d[t * 4 + 1] = g;
        d[t * 4 + 2] = b;
        d[t * 4 + 3] = 255;
      }
      const off2 = document.createElement("canvas");
      off2.width = off2.height = N;
      off2.getContext("2d").putImageData(id, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(off2, 0, 0, canvas.width, canvas.height);
      if (drag && drag.points && drag.points.length > 1) {
        ctx.strokeStyle = "#ffd34d";
        ctx.lineWidth = 2;
        ctx.beginPath();
        drag.points.forEach(([x, y], i) => i ? ctx.lineTo(x * scale, y * scale) : ctx.moveTo(x * scale, y * scale));
        ctx.stroke();
      }
    }
    const toWork = (e) => {
      const r = canvas.getBoundingClientRect();
      return [(e.clientX - r.left) / scale, (e.clientY - r.top) / scale];
    };
    const value = () => st.tool === "erase" ? UNASSIGNED : partIndex(st.seg, st.active);
    canvas.addEventListener("pointerdown", (e) => {
      if (!st.seg) return;
      e.preventDefault();
      const [x, y] = toWork(e);
      if (st.tool === "fill") {
        const v = value();
        if (!v) return;
        commit({ ...st.seg, map: connectedFill(st.seg.map, st.size, st.rgba, Math.floor(x), Math.floor(y), v, st.tol) });
        return;
      }
      if (st.tool !== "lasso" && !value()) return;
      drag = { start: st.seg, x, y, points: st.tool === "lasso" ? [[x, y]] : null };
      if (st.tool !== "lasso") {
        st.seg = { ...st.seg, map: paint(st.seg.map, st.size, x, y, x, y, st.radius, value()) };
        draw();
      }
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch (err) {
      }
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const [x, y] = toWork(e);
      if (drag.points) drag.points.push([x, y]);
      else {
        st.seg = { ...st.seg, map: paint(st.seg.map, st.size, drag.x, drag.y, x, y, st.radius, value()) };
        drag.x = x;
        drag.y = y;
      }
      draw();
    });
    const endDrag = () => {
      if (!drag) return;
      const d = drag;
      drag = null;
      if (d.points) {
        const v = value();
        if (v && d.points.length > 2) commit({ ...st.seg, map: lasso(st.seg.map, st.size, d.points, v) });
        else draw();
        return;
      }
      const after = st.seg;
      st.seg = d.start;
      commit(after);
    };
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);
    for (const [id, v] of [["#ptBrush", "brush"], ["#ptErase", "erase"], ["#ptLasso", "lasso"], ["#ptFill", "fill"]]) $2(id).addEventListener("click", () => {
      st.tool = v;
      sync();
    });
    $2("#ptSize").addEventListener("input", (e) => {
      st.radius = Math.max(1, Math.min(32, Number(e.target.value) || 4));
      sync();
    });
    $2("#ptTol").addEventListener("input", (e) => {
      st.tol = Math.max(0, Math.min(160, Number(e.target.value) || 0));
      sync();
    });
    $2("#ptShow").addEventListener("change", (e) => {
      st.show = e.target.value;
      draw();
    });
    $2("#ptHighlight").addEventListener("change", (e) => {
      st.highlight = e.target.checked;
      draw();
    });
    $2("#ptMethod").addEventListener("change", (e) => {
      st.method = e.target.value;
    });
    $2("#ptGuess").addEventListener("click", () => {
      const r = {}, next = roughGuess(st.seg, r, { rgba: st.rgba }), B = WORK * WORK;
      const notes = [
        r.staff ? ` A staff reaching below the feet (${Math.ceil(r.weapon / B)} px) is the weapon, held by the nearest hand: check it in the list.` : r.across ? ` A sword held across the body (${Math.ceil(r.weapon / B)} px, with what is in line with it: a scabbard too) is the weapon, held by the nearest hand: check it in the list.` : r.weapon ? ` A long thin piece beside a hand (${Math.ceil(r.weapon / B)} px) is the weapon: check it in the list.` : "",
        r.thin && !r.staff ? ` ${Math.ceil(r.thin / B)} px of a thin piece reaching below the feet (a staff?) are left unassigned: paint them as the weapon.` : "",
        r.cloak ? " A long cloak or skirt is its own part, cloak: it hangs from the pelvis instead of swinging with the legs." : ""
      ];
      if (r.bigHead) notes.unshift(" The head is big (a helmet or a chibi figure): everything above the neck is the head.");
      commit(next, "Rough guess from body proportions and the arms' outlines. Check every part: it assumes an upright figure facing you." + notes.join(""));
    });
    $2("#ptClear").addEventListener("click", () => commit({ ...st.seg, map: Uint8Array.from(st.seg.map, (v) => v ? UNASSIGNED : 0) }, "All parts cleared."));
    $2("#ptGrow").addEventListener("click", async () => {
      const seg2 = st.seg, img = { width: st.size, height: st.size, data: st.rgba };
      const useCv = st.method === "opencv" || st.method === "auto" && cv.state === "ready";
      let map = seg2.map, used = "local region growing";
      $2("#ptGrow").disabled = true;
      try {
        if (useCv) {
          msg(cv.state === "ready" ? "Running OpenCV watershed\u2026" : "Loading OpenCV.js, then running watershed\u2026");
          try {
            map = await cv.watershed(img, seg2.map);
            used = "OpenCV watershed, then local growing for edge pixels";
          } catch (e) {
            used = `local region growing (OpenCV unavailable: ${e.message})`;
          }
        }
        if (st.seg !== seg2) return;
        map = growRegions(map, st.size, st.rgba);
        st.lastGrow = used.startsWith("OpenCV") ? "opencv" : "local";
        const left = counts({ ...seg2, map }).unassigned;
        commit({ ...seg2, map }, `Grown from strokes with ${used}.` + (left ? ` ${left} px are in pieces with no stroke yet (shown in pink): paint a stroke there.` : ""));
      } finally {
        $2("#ptGrow").disabled = false;
        sync();
      }
    });
    $2("#ptUndo").addEventListener("click", () => {
      if (!st.undo.length) return;
      st.redo.push(st.seg);
      st.seg = st.undo.pop();
      changed("");
    });
    $2("#ptRedo").addEventListener("click", () => {
      if (!st.redo.length) return;
      st.undo.push(st.seg);
      st.seg = st.redo.pop();
      changed("");
    });
    $2("#ptAdd").addEventListener("click", () => {
      const raw = $2("#ptNew").value.trim(), id = raw.replace(/\s+(\w)/g, (m, c) => c.toUpperCase());
      try {
        commit(addPart(st.seg, id, raw), `Added part ${raw}.`);
        st.active = id;
        $2("#ptNew").value = "";
        renderList();
      } catch (e) {
        msg(e.message, "error");
      }
    });
    $2("#ptBack").addEventListener("click", () => {
      const limb = $2("#ptLimb").value, chain = LIMBS[limb];
      const next = duplicateBackLimb(st.seg, limb);
      if (next.extras.length === st.seg.extras.filter((e) => !chain.includes(e.from)).length) {
        msg("That limb has no pixels yet: assign its parts first.", "error");
        return;
      }
      commit(next, "Added a user-made back copy of that limb, darkened and drawn behind the body. The image does not show this limb; it is a copy.");
    });
    observeSize(view, draw);
    sync();
    function focus({ part = null, unassigned = false } = {}) {
      if (!st.seg) return;
      if (unassigned) {
        st.highlight = true;
        $2("#ptHighlight").checked = true;
      }
      if (part && st.seg.parts.some((p) => p.id === part)) st.active = part;
      renderList();
      draw();
    }
    return {
      setRest,
      focus,
      data: () => st.rgba ? { rgba: st.rgba, size: st.size } : null,
      info() {
        if (!st.seg) return { ready: false, needsWork: !!(st.rest && !st.rest.work) };
        const c = counts(st.seg);
        return {
          ready: true,
          size: st.size,
          parts: st.seg.parts.map((p) => p.id),
          labels: st.seg.parts.map((p) => p.label),
          missing: st.seg.parts.filter((p) => p.missing).map((p) => p.id),
          active: st.active,
          tool: st.tool,
          ...c,
          extras: st.seg.extras.map((e) => e.id),
          undo: st.undo.length,
          redo: st.redo.length,
          lastGrow: st.lastGrow,
          mapHash: bytesHash(st.seg.map),
          scale
        };
      },
      // for tests: owner of a working-image pixel
      ownerAt: (x, y) => {
        if (!st.seg) return null;
        const v = st.seg.map[y * st.size + x];
        return v === 0 ? "background" : v === UNASSIGNED ? "unassigned" : st.seg.parts[v - 1].id;
      }
    };
  }


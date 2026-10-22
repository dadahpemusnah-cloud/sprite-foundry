  // src/ui/import-panel.js
  function initImportPanel({ $: $2, toast: toast2 }) {
    const session = { original: null, bitmap: null, crop: null, zoom: 1, place: { anchor: "bottom", offsetX: 0, offsetY: 0 } };
    const canvas = $2("#importCanvas"), view = $2("#importView");
    let drag = null, scale = 1;
    const listeners = [];
    const notify = (what) => {
      for (const f of listeners) f(what);
    };
    function showMsg(kind, lines) {
      const el2 = $2("#importMsg");
      el2.replaceChildren(...lines.map((t) => {
        const p = document.createElement("p");
        p.className = "msg " + kind;
        p.textContent = t;
        return p;
      }));
      el2.hidden = !lines.length;
    }
    const sizeText = (n) => n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB";
    async function loadFile(file) {
      const keep = session.original ? " The current image is unchanged." : "";
      let bytes;
      try {
        bytes = new Uint8Array(await file.arrayBuffer());
      } catch (e) {
        showMsg("error", [`${file.name} could not be read.${keep}`]);
        return;
      }
      const check = checkImageFile({ name: file.name, size: file.size, bytes });
      if (!check.ok) {
        showMsg("error", [...check.errors.slice(0, -1), check.errors[check.errors.length - 1] + keep]);
        return;
      }
      let bitmap;
      try {
        bitmap = await createImageBitmap(new Blob([bytes], { type: check.type === "png" ? "image/png" : "image/jpeg" }));
      } catch (e) {
        showMsg("error", [`${file.name} could not be decoded; the image data is damaged.${keep}`]);
        return;
      }
      if (session.bitmap) session.bitmap.close();
      session.original = { name: file.name, type: check.type, size: bytes.length, width: bitmap.width, height: bitmap.height, bytes, hash: bytesHash(bytes) };
      session.bitmap = bitmap;
      session.crop = { x: 0, y: 0, w: bitmap.width, h: bitmap.height };
      session.zoom = 1;
      session.place = { anchor: "bottom", offsetX: 0, offsetY: 0 };
      showMsg("info", [`Loaded ${file.name}. Drag on the preview to crop to the character.`]);
      $2("#importWork").hidden = false;
      $2("#importDrop").classList.add("loaded");
      syncInputs();
      render();
      notify("image");
    }
    function syncInputs() {
      const o = session.original;
      if (!o) return;
      $2("#importInfo").textContent = `${o.name} \xB7 ${o.type.toUpperCase()} \xB7 ${o.width}\xD7${o.height} px \xB7 ${sizeText(o.size)} \xB7 ${o.reduced ? `reduced working copy only (original fingerprint ${o.hash})` : `original kept unchanged (fingerprint ${o.hash})`}`;
      for (const k of ["x", "y", "w", "h"]) {
        const el2 = $2("#crop" + k.toUpperCase());
        if (document.activeElement !== el2) el2.value = session.crop[k];
      }
      $2("#cropInfo").textContent = `Crop ${session.crop.w}\xD7${session.crop.h} px of ${o.width}\xD7${o.height}`;
      $2("#ivLabel").textContent = session.zoom === 1 ? "Fit" : "\xD7" + session.zoom;
      $2("#placeAnchor").value = session.place.anchor;
      $2("#placeX").value = session.place.offsetX;
      $2("#placeY").value = session.place.offsetY;
    }
    function render() {
      const b = session.bitmap;
      if (!b) return;
      const boxW = Math.max(200, view.clientWidth - 4), boxH = 440;
      scale = Math.min(boxW / b.width, boxH / b.height) * session.zoom;
      const w2 = Math.max(1, Math.round(b.width * scale)), h = Math.max(1, Math.round(b.height * scale));
      canvas.width = Math.min(w2, 8192);
      canvas.height = Math.min(h, 8192);
      canvas.style.width = canvas.width + "px";
      canvas.style.height = canvas.height + "px";
      view.classList.toggle("zoomed", session.zoom > 1);
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = scale < 1;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(b, 0, 0, canvas.width, canvas.height);
      const c = session.crop, cx = c.x * scale, cy = c.y * scale, cw = c.w * scale, ch = c.h * scale;
      ctx.fillStyle = "rgba(10,12,20,.55)";
      ctx.fillRect(0, 0, canvas.width, cy);
      ctx.fillRect(0, cy + ch, canvas.width, canvas.height - cy - ch);
      ctx.fillRect(0, cy, cx, ch);
      ctx.fillRect(cx + cw, cy, canvas.width - cx - cw, ch);
      ctx.strokeStyle = "#ffd34d";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(cx + 1, cy + 1, cw - 2, ch - 2);
      ctx.setLineDash([]);
      ctx.fillStyle = "#ffd34d";
      for (const [hx, hy] of corners()) ctx.fillRect(hx - 4, hy - 4, 8, 8);
      const ax = cx + cw / 2, ay = session.place.anchor === "bottom" ? cy + ch : cy + ch / 2;
      ctx.strokeStyle = "#4dd2ff";
      ctx.beginPath();
      ctx.moveTo(ax - 8, ay);
      ctx.lineTo(ax + 8, ay);
      ctx.moveTo(ax, ay - 8);
      ctx.lineTo(ax, ay + 8);
      ctx.stroke();
    }
    const corners = () => {
      const c = session.crop;
      return [[c.x, c.y], [c.x + c.w, c.y], [c.x, c.y + c.h], [c.x + c.w, c.y + c.h]].map(([x, y]) => [x * scale, y * scale]);
    };
    const toSource = (e) => {
      const r = canvas.getBoundingClientRect();
      return [(e.clientX - r.left) / scale, (e.clientY - r.top) / scale];
    };
    canvas.addEventListener("pointerdown", (e) => {
      if (!session.bitmap) return;
      e.preventDefault();
      const r = canvas.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top, [sx, sy] = toSource(e), c = session.crop;
      const hit = corners().findIndex(([hx, hy]) => Math.abs(hx - px) <= 8 && Math.abs(hy - py) <= 8);
      if (hit >= 0) {
        const fx = hit % 2 === 0 ? c.x + c.w : c.x, fy = hit < 2 ? c.y + c.h : c.y;
        drag = { mode: "draw", ax: fx, ay: fy };
      } else if (!(c.w === session.bitmap.width && c.h === session.bitmap.height) && sx >= c.x && sx <= c.x + c.w && sy >= c.y && sy <= c.y + c.h) drag = { mode: "move", sx, sy, c0: { ...c } };
      else drag = { mode: "draw", ax: sx, ay: sy };
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch (err) {
      }
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const [sx, sy] = toSource(e), W = session.bitmap.width, H = session.bitmap.height;
      if (drag.mode === "move") session.crop = clampCrop({ ...drag.c0, x: drag.c0.x + sx - drag.sx, y: drag.c0.y + sy - drag.sy }, W, H);
      else {
        const x0 = Math.max(0, Math.min(drag.ax, sx)), y0 = Math.max(0, Math.min(drag.ay, sy));
        const x1 = Math.min(W, Math.max(drag.ax, sx)), y1 = Math.min(H, Math.max(drag.ay, sy));
        session.crop = clampCrop({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, W, H);
      }
      syncInputs();
      render();
      notify("crop");
    });
    const endDrag = () => {
      drag = null;
    };
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);
    for (const k of ["x", "y", "w", "h"]) $2("#crop" + k.toUpperCase()).addEventListener("change", (e) => {
      if (!session.bitmap) return;
      const v = Number(e.target.value);
      if (!Number.isFinite(v)) {
        syncInputs();
        return;
      }
      const W = session.bitmap.width, H = session.bitmap.height, c = { ...session.crop };
      if (k === "x") {
        c.x = Math.max(0, Math.min(W - MIN_CROP, v));
        c.w = Math.min(c.w, W - c.x);
      } else if (k === "y") {
        c.y = Math.max(0, Math.min(H - MIN_CROP, v));
        c.h = Math.min(c.h, H - c.y);
      } else if (k === "w") c.w = Math.min(v, W - c.x);
      else c.h = Math.min(v, H - c.y);
      session.crop = clampCrop(c, W, H);
      syncInputs();
      render();
      notify("crop");
    });
    $2("#cropAll").addEventListener("click", () => {
      if (!session.bitmap) return;
      session.crop = { x: 0, y: 0, w: session.bitmap.width, h: session.bitmap.height };
      syncInputs();
      render();
      notify("crop");
    });
    const ZOOMS3 = [1, 2, 4, 8];
    const zoomTo = (z) => {
      session.zoom = z;
      syncInputs();
      render();
    };
    $2("#ivIn").addEventListener("click", () => zoomTo(ZOOMS3[Math.min(ZOOMS3.length - 1, ZOOMS3.indexOf(session.zoom) + 1)]));
    $2("#ivOut").addEventListener("click", () => zoomTo(ZOOMS3[Math.max(0, ZOOMS3.indexOf(session.zoom) - 1)]));
    $2("#ivFit").addEventListener("click", () => zoomTo(1));
    $2("#placeAnchor").addEventListener("change", (e) => {
      session.place.anchor = e.target.value === "centre" ? "centre" : "bottom";
      render();
      notify("place");
    });
    for (const [id, key] of [["#placeX", "offsetX"], ["#placeY", "offsetY"]]) $2(id).addEventListener("change", (e) => {
      const v = Math.round(Number(e.target.value));
      session.place[key] = Number.isFinite(v) ? Math.max(-16, Math.min(16, v)) : 0;
      syncInputs();
      notify("place");
    });
    const pick = () => $2("#importFile").click();
    $2("#importPick").addEventListener("click", pick);
    $2("#importReplace").addEventListener("click", pick);
    $2("#importFile").addEventListener("change", (e) => {
      const f = e.target.files && e.target.files[0];
      e.target.value = "";
      if (f) loadFile(f);
    });
    const drop = $2("#importPanel");
    drop.addEventListener("dragover", (e) => {
      e.preventDefault();
      drop.classList.add("dragging");
    });
    drop.addEventListener("dragleave", () => drop.classList.remove("dragging"));
    drop.addEventListener("drop", (e) => {
      e.preventDefault();
      drop.classList.remove("dragging");
      const f = e.dataTransfer && e.dataTransfer.files[0];
      if (f) loadFile(f);
    });
    observeSize(view, render);
    $2("#importLimits").textContent = `PNG or JPEG, up to ${MAX_BYTES / 1048576} MB and ${MAX_DIM}\xD7${MAX_DIM} px. The original file is kept unchanged.`;
    function state2() {
      const o = session.original;
      if (!o) return null;
      if (o.bytes && !o.base64) o.base64 = encodeBase64(o.bytes);
      return { source: { name: o.name, type: o.type, size: o.size, width: o.width, height: o.height, hash: o.hash, bytes: o.bytes, base64: o.base64 || null, reduced: o.reduced || null }, crop: { ...session.crop }, place: { ...session.place } };
    }
    async function restore(asset) {
      const src = asset.source;
      let bitmap;
      try {
        bitmap = src.bytes ? await createImageBitmap(new Blob([src.bytes], { type: src.type === "png" ? "image/png" : "image/jpeg" })) : await createImageBitmap(await (await fetch(src.reduced.dataUrl)).blob());
      } catch (e) {
        return { ok: false, message: `The saved image ${src.name} could not be decoded.` };
      }
      if (session.bitmap) session.bitmap.close();
      session.bitmap = bitmap;
      session.original = { name: src.name, type: src.type, size: src.size, width: src.width, height: src.height, bytes: src.bytes, base64: src.base64 || null, hash: src.hash, reduced: src.bytes ? null : src.reduced };
      session.crop = src.bytes ? { ...asset.crop } : { x: 0, y: 0, w: bitmap.width, h: bitmap.height };
      session.zoom = 1;
      session.place = { ...asset.place };
      const note = src.bytes ? `Reopened ${src.name}.` : `Reopened a reduced working copy of ${src.name}: the full original was too large for browser storage. Background and conversion still work; to change the crop, open the project file or upload the image again.`;
      showMsg(src.bytes ? "info" : "warning", [note]);
      $2("#importWork").hidden = false;
      $2("#importDrop").classList.add("loaded");
      syncInputs();
      render();
      return { ok: true, reduced: !src.bytes };
    }
    function reset() {
      if (session.bitmap) session.bitmap.close();
      Object.assign(session, { original: null, bitmap: null, crop: null, zoom: 1, place: { anchor: "bottom", offsetX: 0, offsetY: 0 } });
      $2("#importWork").hidden = true;
      $2("#importDrop").classList.remove("loaded");
      showMsg("info", []);
      notify("reset");
    }
    return {
      // read-only view for tests and later phases
      info() {
        const o = session.original;
        return o ? { name: o.name, type: o.type, size: o.size, width: o.width, height: o.height, hash: o.hash, currentHash: o.bytes ? bytesHash(o.bytes) : null, reduced: !!o.reduced, crop: { ...session.crop }, zoom: session.zoom, place: { ...session.place }, canvasWidth: canvas.width } : null;
      },
      state: state2,
      restore,
      reset,
      load: loadFile,
      get session() {
        return session;
      },
      onChange(f) {
        listeners.push(f);
      }
    };
  }


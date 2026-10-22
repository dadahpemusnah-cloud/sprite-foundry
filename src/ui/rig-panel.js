  // src/ui/rig-panel.js
  function initRigPanel({ $: $2, onChange }) {
    const canvas = $2("#rigCanvas"), view = $2("#rigView"), pix = $2("#rigPixel");
    const st = { rest: null, rgba: null, rig: null, sel: "forearmR", pose: { rot: {} }, stress: null, undo: [], redo: [], L: null, Lkey: null, last: null, restMatches: null };
    let scale = 1, drag = null;
    function msg(t, kind = "") {
      const el2 = $2("#rigMsg");
      el2.textContent = t || "";
      el2.className = "hint " + kind;
    }
    function refresh(rest, rgba) {
      st.rest = rest;
      st.rgba = rgba;
      const on = !!(rest && rest.seg && rest.rig && rgba);
      $2("#rigWork").hidden = !on;
      if (!on) {
        st.rig = null;
        return;
      }
      if (st.rig !== rest.rig) {
        st.rig = rest.rig;
      }
      if (!st.rig.bones[st.sel]) st.sel = st.rig.order[0] || Object.keys(st.rig.bones)[0];
      if (st.stress) {
        showStress(st.stress.id);
        return;
      }
      renderControls();
      redraw();
    }
    function layers() {
      const key = st.rest.seg;
      if (st.L && st.Lkey === key && st.L.bleed === st.rig.bleed && st.L.art === (st.rest.art || null)) return st.L;
      st.L = prepareLayers(st.rest.seg, st.rgba, st.rig, st.rest.art || null, st.rest.N);
      st.L.bleed = st.rig.bleed;
      st.L.art = st.rest.art || null;
      st.Lkey = key;
      return st.L;
    }
    function commit(next, note) {
      if (!next || next === st.rig) return;
      st.undo.push(st.rig);
      if (st.undo.length > 30) st.undo.shift();
      st.redo = [];
      st.rig = next;
      st.rest.rig = next;
      onChange(next);
      if (note !== void 0) msg(note);
      if (st.stress) {
        showStress(st.stress.id);
        return;
      }
      renderControls();
      redraw();
    }
    const posed = () => Object.values(st.pose.rot).some((v) => v);
    function renderControls() {
      const rig = st.rig, ids = Object.keys(rig.bones);
      const label = (id) => {
        const p = st.rest.seg.parts.find((x) => x.id === id), e = st.rest.seg.extras.find((x) => x.id === id);
        return (p || e || { label: id }).label;
      };
      const fill = (sel, opts2, value) => {
        sel.replaceChildren(...opts2.map(([v, t]) => new Option(t, v)));
        sel.value = value;
      };
      fill($2("#rigBone"), ids.map((id) => [id, `${label(id)} \xB7 ${jointName(id)}${rig.bones[id].auto ? "" : " (moved)"}`]), st.sel);
      fill($2("#rigParent"), [["", "(root: moves with the whole body)"], ...ids.filter((id) => id !== st.sel).map((id) => [id, label(id)])], rig.bones[st.sel].parent || "");
      const holder = rig.bones.weapon ? rig.bones.weapon.parent : null;
      $2("#rigHolderRow").hidden = !rig.bones.weapon;
      if (rig.bones.weapon) fill($2("#rigHolder"), HOLDERS.filter((h) => rig.bones[h]).map((h) => [h, label(h)]), HOLDERS.includes(holder) ? holder : HOLDERS[0]);
      $2("#rigBleed").value = rig.bleed;
      $2("#rigKeepUn").checked = !!rig.keepUnassigned;
      $2("#rigStress").value = st.stress ? st.stress.id : "";
      $2("#rigTurn").value = st.pose.rot[st.sel] || 0;
      $2("#rigTurnV").textContent = (st.pose.rot[st.sel] || 0) + "\xB0";
      $2("#rigUndo").disabled = !st.undo.length;
      $2("#rigRedo").disabled = !st.redo.length;
      const list = $2("#rigOrder");
      list.replaceChildren(...[...rig.order].reverse().map((id) => {
        const row = document.createElement("div");
        row.className = "rig-row" + (id === st.sel ? " on" : "");
        const name = document.createElement("button");
        name.type = "button";
        name.className = "rig-name";
        name.textContent = label(id);
        name.addEventListener("click", () => {
          st.sel = id;
          renderControls();
          redraw();
        });
        const up = document.createElement("button");
        up.type = "button";
        up.textContent = "\u25B2";
        up.setAttribute("aria-label", `Bring ${label(id)} forward`);
        up.disabled = rig.order.indexOf(id) === rig.order.length - 1;
        up.addEventListener("click", () => commit(moveLayer(st.rig, id, 1)));
        const dn = document.createElement("button");
        dn.type = "button";
        dn.textContent = "\u25BC";
        dn.setAttribute("aria-label", `Send ${label(id)} back`);
        dn.disabled = rig.order.indexOf(id) === 0;
        dn.addEventListener("click", () => commit(moveLayer(st.rig, id, -1)));
        row.append(name, up, dn);
        return row;
      }));
    }
    function redraw() {
      const rig = st.rig, rest = st.rest;
      if (!rig) return;
      const L = layers(), r = renderRig(L, rig, st.pose, { N: rest.N, palette: rest.palette, settings: rest.settings || void 0 });
      st.last = r;
      if (!posed()) st.restMatches = r.px.every((c, i) => c === rest.px[i]);
      const S = L.size, ctx = canvas.getContext("2d");
      scale = Math.max(1, Math.floor(Math.min(Math.max(200, view.clientWidth - 4), 440) / S));
      canvas.width = canvas.height = S * scale;
      canvas.style.width = canvas.style.height = S * scale + "px";
      const off2 = document.createElement("canvas");
      off2.width = off2.height = S;
      off2.getContext("2d").putImageData(new ImageData(r.work, S, S), 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 0.75;
      ctx.drawImage(off2, 0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1;
      const W = worldMatrices(rig, st.pose), at = (id) => apply(W[id], rig.bones[id].pivot).map((v) => v * scale);
      ctx.lineWidth = 2;
      for (const [id, b] of Object.entries(rig.bones)) {
        if (!b.parent || !rig.bones[b.parent]) continue;
        const [x0, y0] = at(b.parent), [x1, y1] = at(id);
        ctx.strokeStyle = id === st.sel ? "#ffd34d" : "rgba(77,210,255,.8)";
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
      for (const [id, b] of Object.entries(rig.bones)) {
        const [x, y] = at(id), on = id === st.sel;
        ctx.fillStyle = on ? "#ffd34d" : b.auto ? "#4dd2ff" : "#ff8a3d";
        ctx.strokeStyle = "#111";
        ctx.beginPath();
        ctx.arc(x, y, on ? 6 : 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      const F = rest.N, cv = toCanvas(r.px, F), z = Math.max(1, Math.floor(200 / F));
      pix.width = pix.height = F * z;
      const pc = pix.getContext("2d");
      pc.imageSmoothingEnabled = false;
      pc.clearRect(0, 0, pix.width, pix.height);
      pc.drawImage(cv, 0, 0, F * z, F * z);
      const showMade = $2("#rigMade").checked, sum = madeSummary(r.stats.made);
      if (showMade) tintMade(pc, r.stats.made, F, 0, 0, z);
      $2("#rigMadeKey").hidden = !showMade;
      $2("#rigMadeNote").textContent = showMade ? sum ? sum + " not from the image in this pose." : "Every pixel of this pose is from the image." : "";
      const moved = Object.values(rig.bones).filter((b) => !b.auto).length;
      $2("#rigInfo").textContent = `${Object.keys(rig.bones).length} joints (${moved} moved by hand) \xB7 rest pose ${st.restMatches ? "matches the converted sprite exactly" : "DIFFERS from the converted sprite"}` + (posed() ? ` \xB7 test pose: ${r.stats.bleedPixels} px of joint fill` : "");
      $2("#rigInfo").classList.toggle("warn", st.restMatches === false);
    }
    const toWork = (e) => {
      const r = canvas.getBoundingClientRect();
      return [(e.clientX - r.left) / scale, (e.clientY - r.top) / scale];
    };
    canvas.addEventListener("pointerdown", (e) => {
      if (!st.rig) return;
      e.preventDefault();
      const [x, y] = toWork(e), W = worldMatrices(st.rig, st.pose);
      let best = null, bd = 10 / scale;
      for (const [id, b] of Object.entries(st.rig.bones)) {
        const [px, py] = apply(W[id], b.pivot), d = Math.hypot(px - x, py - y);
        if (d <= bd) {
          best = id;
          bd = d;
        }
      }
      if (!best) return;
      st.sel = best;
      renderControls();
      if (posed()) {
        msg("Reset the test pose to move joints.");
        redraw();
        return;
      }
      drag = { id: best, start: st.rig };
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch (err) {
      }
      redraw();
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!drag) return;
      st.rig = setPivot(st.rig, drag.id, toWork(e), st.rest.seg.size);
      redraw();
    });
    const endDrag = () => {
      if (!drag) return;
      const d = drag, after = st.rig;
      drag = null;
      st.rig = d.start;
      commit(after, `Moved the ${jointName(d.id)} joint.`);
    };
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);
    $2("#rigBone").addEventListener("change", (e) => {
      st.sel = e.target.value;
      renderControls();
      redraw();
    });
    $2("#rigParent").addEventListener("change", (e) => {
      try {
        commit(setParent(st.rig, st.sel, e.target.value || null), "");
      } catch (err) {
        msg(err.message + " The parent was not changed.", "error");
        renderControls();
      }
    });
    $2("#rigHolder").addEventListener("change", (e) => {
      try {
        commit(setParent(st.rig, "weapon", e.target.value), "The weapon now moves with " + e.target.selectedOptions[0].textContent + ".");
      } catch (err) {
        msg(err.message, "error");
      }
    });
    $2("#rigKeepUn").addEventListener("change", (e) => {
      const next = { ...st.rig };
      if (e.target.checked) next.keepUnassigned = true;
      else delete next.keepUnassigned;
      commit(next, e.target.checked ? "Unassigned pixels are kept on purpose: they move with the whole body." : "");
    });
    $2("#rigBleed").addEventListener("change", (e) => {
      const v = Math.max(0, Math.min(4, Math.round(Number(e.target.value)) || 0));
      commit({ ...st.rig, bleed: v });
    });
    $2("#rigSuggest").addEventListener("click", () => commit(suggestAll(st.rest.seg, st.rig), "All joints are suggestions again; they follow the parts as you edit them."));
    $2("#rigTurn").addEventListener("input", (e) => {
      st.pose = { ...st.pose, rot: { ...st.pose.rot, [st.sel]: Number(e.target.value) } };
      renderControls();
      redraw();
    });
    $2("#rigResetPose").addEventListener("click", () => {
      st.pose = { rot: {} };
      st.stress = null;
      renderControls();
      redraw();
      msg("");
    });
    $2("#rigStress").replaceChildren(new Option("(choose a pose)", ""), ...STRESS_POSES.map((p) => new Option(p.name, p.id)));
    const rows = (el2, list) => el2.replaceChildren(...list.map((f) => {
      const li = document.createElement("li");
      li.className = "pf-item";
      li.dataset.code = f.code;
      const chip = document.createElement("span");
      chip.className = "pf-chip " + (f.level === "warning" ? "attention" : "na");
      chip.textContent = f.level === "warning" ? "problem" : "note";
      const t = document.createElement("span");
      t.className = "hint";
      t.textContent = f.message;
      li.append(chip, t, document.createElement("span"));
      return li;
    }));
    function showStress(id) {
      const def = stressById(id);
      if (!def) {
        st.stress = null;
        st.pose = { rot: {} };
        renderControls();
        redraw();
        rows($2("#rigStressFind"), []);
        return;
      }
      const c = stressCheck({ rest: { ...st.rest, rig: st.rig }, layers: layers(), def });
      st.pose = c.pose;
      st.stress = { id, findings: c.findings };
      renderControls();
      redraw();
      const list = c.findings.filter((f) => f.code !== "not-in-image");
      rows($2("#rigStressFind"), list.length ? list : [{ level: "info", code: "none", message: `${def.name}: no problems found. Look at the preview for anything a rule cannot see.` }]);
    }
    $2("#rigStress").addEventListener("change", (e) => showStress(e.target.value));
    $2("#rigStressAll").addEventListener("click", () => {
      const all = stressAll({ rest: { ...st.rest, rig: st.rig }, layers: layers() });
      $2("#rigStressList").replaceChildren(...all.map((p) => {
        const li = document.createElement("li");
        li.className = "pf-item";
        li.dataset.pose = p.id;
        const chip = document.createElement("span");
        chip.className = "pf-chip " + (p.warnings ? "attention" : "ready");
        chip.textContent = p.warnings ? `${p.warnings} problem${p.warnings > 1 ? "s" : ""}` : "ok";
        const t = document.createElement("span");
        t.className = "hint";
        t.textContent = p.name + (p.notes ? ` \xB7 ${p.notes} note${p.notes > 1 ? "s" : ""}` : "");
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = "Show";
        b.setAttribute("aria-label", "Show the stress pose " + p.name);
        b.addEventListener("click", () => {
          $2("#rigStress").value = p.id;
          showStress(p.id);
        });
        li.append(chip, t, b);
        return li;
      }));
      const bad = all.filter((p) => p.warnings).length;
      msg(bad ? `${bad} of ${all.length} stress poses show problems; Show opens one.` : `All ${all.length} stress poses passed the checks (look at the previews too).`);
    });
    $2("#rigUndo").addEventListener("click", () => {
      if (!st.undo.length) return;
      st.redo.push(st.rig);
      st.rig = st.undo.pop();
      st.rest.rig = st.rig;
      onChange(st.rig);
      if (st.stress) showStress(st.stress.id);
      else {
        renderControls();
        redraw();
      }
    });
    $2("#rigRedo").addEventListener("click", () => {
      if (!st.redo.length) return;
      st.undo.push(st.rig);
      st.rig = st.redo.pop();
      st.rest.rig = st.rig;
      onChange(st.rig);
      if (st.stress) showStress(st.stress.id);
      else {
        renderControls();
        redraw();
      }
    });
    $2("#rigMadeKey").replaceChildren(...madeLegend());
    $2("#rigMade").addEventListener("change", () => {
      if (st.rig) redraw();
    });
    observeSize(view, () => {
      if (st.rig) redraw();
    });
    function focus({ joint = null, control = null } = {}) {
      if (!st.rig) return;
      if (joint && st.rig.bones[joint]) st.sel = joint;
      renderControls();
      redraw();
      const el2 = { parent: "#rigParent", holder: "#rigHolder", joint: "#rigBone", rest: "#rigUndo" }[control];
      if (el2 && $2(el2) && !$2(el2).disabled) $2(el2).focus();
    }
    return {
      refresh,
      focus,
      info() {
        if (!st.rig) return { ready: false };
        const W = worldMatrices(st.rig, st.pose);
        return {
          ready: true,
          stress: st.stress ? { id: st.stress.id, findings: st.stress.findings.map((f) => ({ ...f })) } : null,
          pose: JSON.parse(JSON.stringify(st.pose)),
          sel: st.sel,
          order: st.rig.order.slice(),
          bleed: st.rig.bleed,
          restMatches: st.restMatches,
          posed: posed(),
          scale,
          bones: Object.fromEntries(Object.entries(st.rig.bones).map(([id, b]) => [id, { parent: b.parent, pivot: b.pivot.slice(), auto: b.auto, at: apply(W[id], b.pivot) }])),
          px: st.last ? st.last.px.slice() : null,
          made: st.last ? st.last.stats.made.slice() : null,
          bleedPixels: st.last ? st.last.stats.bleedPixels : null,
          undo: st.undo.length
        };
      }
    };
  }


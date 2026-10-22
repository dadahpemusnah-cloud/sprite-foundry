  // src/ui/template-panel.js
  var FACING_LABEL = { right: "facing right", left: "facing left", front: "facing the viewer" };
  function initTemplatePanel({ $: $2, directions: directions2, shownDir, frameOf, F, addTo, showManual, onSelect = () => {
  } }) {
    const st = { rest: null, tab: "manual", cat: "all", dir: null, sel: null, anim: null, frames: [], frame: 0, playing: false, timer: 0, undo: [], redo: [] };
    function msg(t) {
      $2("#tmMsg").textContent = t || "";
    }
    const D2 = () => {
      const all = directions2();
      return all.find((d) => d.dir === st.dir) || all[0] || null;
    };
    const compatible = () => {
      const d = D2();
      return !!(d && d.rest && d.rest.rig && d.rest.seg && d.layers);
    };
    function setTab(tab) {
      st.tab = tab === "template" ? "template" : "manual";
      for (const b of document.querySelectorAll("#anTabs button")) b.setAttribute("aria-pressed", String(b.dataset.tab === st.tab));
      $2("#anManual").hidden = st.tab !== "manual";
      $2("#anTemplate").hidden = st.tab !== "template";
      stop();
      render();
    }
    for (const b of document.querySelectorAll("#anTabs button")) b.addEventListener("click", () => setTab(b.dataset.tab));
    function drawCharacter() {
      const d = D2(), N = d.rest.N, c = $2("#tmChar"), z = Math.max(1, Math.floor(160 / N));
      c.width = c.height = N * z;
      const ctx = c.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(toCanvas(d.rest.px, N), 0, 0, N * z, N * z);
      const parts = d.rest.seg.parts.filter((p) => !p.missing).length, n = Object.keys(d.rest.anims || {}).length;
      $2("#tmCharInfo").textContent = `Imported \xB7 ${N}\xD7${N} px sprite \xB7 direction ${d.dir}${d.main ? " (main image)" : ""} \xB7 ${parts} parts \xB7 ${n} animation${n === 1 ? "" : "s"}`;
      const all = directions2(), have = all.map((x) => x.dir);
      const items = all.map((x) => {
        const li = document.createElement("li");
        li.className = "has";
        const lab = document.createElement("label"), r = document.createElement("input");
        r.type = "radio";
        r.name = "tmDir";
        r.value = x.dir;
        r.checked = x.dir === d.dir;
        r.disabled = !(x.rest.rig && x.layers);
        r.addEventListener("change", () => {
          st.dir = x.dir;
          if (st.sel) rebuild();
          else render();
        });
        lab.append(r, ` ${x.dir} \xB7 ${DIRECTION_LABEL[x.dir]}${x.main ? " (main image)" : ""}${x.rest.rig ? "" : " \u2014 needs parts and joints (steps 4\u20135)"}`);
        li.append(lab);
        return li;
      });
      const missing = DIRECTIONS.filter((x) => !have.includes(x));
      if (missing.length) items.push(Object.assign(document.createElement("li"), { className: "others", textContent: "Needs its own artwork: " + missing.join(", ") + " (add it in Image to pixel art, Direction)" }));
      items.push(Object.assign(document.createElement("li"), { className: "others", textContent: "Diagonal directions (SE, NE, NW, SW) are not supported yet." }));
      $2("#tmDirs").replaceChildren(...items);
      $2("#tmAddTo").querySelector('option[value="all"]').disabled = all.length < 2;
      if (all.length < 2) $2("#tmAddTo").value = "this";
    }
    const filters = [{ id: "all", label: "All" }, ...CATEGORIES];
    $2("#tmFilters").replaceChildren(...filters.map((f) => {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.cat = f.id;
      b.textContent = `${f.label} (${f.id === "all" ? TEMPLATES.length : TEMPLATES.filter((t) => t.category === f.id).length})`;
      b.addEventListener("click", () => {
        st.cat = f.id;
        render();
      });
      return b;
    }));
    const fits = (t, d) => checkTemplate(t, d.rest.rig, presentParts(d.rest, d.layers));
    function renderCards() {
      const d = D2();
      $2("#tmCards").replaceChildren(...TEMPLATES.filter((t) => st.cat === "all" || t.category === st.cat).map((t) => {
        const def = templateDefaults(t, d.rest.rig), chk = fits(t, d);
        const b = document.createElement("button");
        b.type = "button";
        b.className = "tm-card";
        b.dataset.id = t.id;
        b.setAttribute("aria-pressed", String(!!st.sel && st.sel.id === t.id));
        b.disabled = !chk.ok;
        b.setAttribute("aria-label", `${t.name} template${chk.ok ? "" : " (not available: " + chk.reason + ")"}`);
        const line = (cls, text) => {
          const s = document.createElement("span");
          s.className = cls;
          s.textContent = text;
          return s;
        };
        b.append(
          line("tm-name", t.name),
          line("tm-desc", t.description),
          line("tm-meta", `${def.frames} frames \xB7 ${Math.round(def.frames * 1e3 / def.fps)} ms at ${def.fps} fps \xB7 ${def.loop ? "loops" : "plays once"}`),
          line("tm-needs", "Needs: " + t.requires(d.rest.rig).map(jointName).join(", "))
        );
        if (!chk.ok) b.append(line("tm-why", chk.reason));
        b.addEventListener("click", () => choose(t.id));
        return b;
      }));
    }
    function choose(id) {
      const t = templateById(id), def = templateDefaults(t, D2().rest.rig);
      st.undo = [];
      st.redo = [];
      set({ id, fps: def.fps, loop: def.loop, frames: def.frames });
      $2("#tmName").value = freeName(t.id, directions2().flatMap((x) => Object.keys(x.rest.anims || {})));
      msg("");
      play2();
    }
    function change(next) {
      st.undo.push(st.sel);
      st.redo = [];
      set(next);
    }
    const rebuild = () => {
      if (st.sel) {
        const chk = fits(templateById(st.sel.id), D2());
        if (chk.ok) set(st.sel);
        else drop(chk.reason);
      }
    };
    function drop(reason) {
      stop();
      st.sel = null;
      st.anim = null;
      st.frames = [];
      msg(`The chosen motion does not fit direction ${D2().dir} (${reason})`);
      render();
    }
    function set(sel) {
      stop();
      st.sel = sel;
      const d = D2(), t = templateById(sel.id);
      const out = {};
      st.anim = buildTemplate(t, d.rest, d.layers, { ...sel, facing: FACING_OF[d.dir] }, out);
      st.reach = out;
      st.frames = sampleAnim(st.anim).map((f) => frameOf({ pose: f.pose, ...f.flash ? { flash: true } : {}, ...d.main ? {} : { view: d.dir } }));
      st.frame = Math.min(st.frame, st.frames.length - 1);
      render();
    }
    $2("#tmFps").addEventListener("change", (e) => {
      const v = Math.round(Number(e.target.value));
      if (!(v >= 1 && v <= 60)) {
        msg("Speed is 1 to 60 fps.");
        render();
        return;
      }
      if (v !== st.sel.fps) change({ ...st.sel, fps: v });
    });
    $2("#tmFrames").addEventListener("change", (e) => {
      const v = Math.round(Number(e.target.value));
      if (!(v >= 1 && v <= 64)) {
        msg("Frames are 1 to 64.");
        render();
        return;
      }
      const keys = st.anim.keys.length;
      if (v < keys) msg(`At least ${keys} frames: one per key.`);
      if (Math.max(v, keys) !== st.sel.frames) change({ ...st.sel, frames: Math.max(v, keys) });
      else render();
    });
    $2("#tmLoop").addEventListener("change", (e) => change({ ...st.sel, loop: e.target.checked }));
    $2("#tmUndo").addEventListener("click", () => {
      if (!st.undo.length) return;
      st.redo.push(st.sel);
      set(st.undo.pop());
    });
    $2("#tmRedo").addEventListener("click", () => {
      if (!st.redo.length) return;
      st.undo.push(st.sel);
      set(st.redo.pop());
    });
    $2("#tmReset").addEventListener("click", () => {
      const def = templateDefaults(templateById(st.sel.id), D2().rest.rig);
      change({ ...st.sel, fps: def.fps, loop: def.loop, frames: def.frames });
    });
    $2("#tmCancel").addEventListener("click", () => {
      stop();
      st.sel = null;
      st.anim = null;
      st.frames = [];
      st.undo = [];
      st.redo = [];
      msg("Cancelled: nothing was added.");
      render();
    });
    $2("#tmPlay").addEventListener("click", () => st.playing ? stop() : play2());
    $2("#tmScrub").addEventListener("input", (e) => {
      stop();
      st.frame = Number(e.target.value);
      renderPlayer();
    });
    function play2() {
      if (!st.anim) return;
      if (!st.anim.loop && st.frame >= st.frames.length - 1) st.frame = 0;
      st.playing = true;
      renderPlayer();
      const step2 = () => {
        if (!st.playing || !st.anim) return;
        if (st.frame + 1 >= st.frames.length && !st.anim.loop) {
          stop();
          return;
        }
        st.frame = (st.frame + 1) % st.frames.length;
        renderPlayer();
        st.timer = setTimeout(step2, 1e3 / st.anim.fps);
      };
      st.timer = setTimeout(step2, 1e3 / st.anim.fps);
    }
    function stop() {
      clearTimeout(st.timer);
      st.timer = 0;
      if (st.playing) {
        st.playing = false;
        renderPlayer();
      }
    }
    $2("#tmAccept").addEventListener("click", () => {
      const name = $2("#tmName").value.trim(), t = templateById(st.sel.id);
      if (!ANIM_NAME.test(name) || name === "pose") {
        msg('A name is a lower-case letter, then up to 23 lower-case letters, digits, - or _ (and not "pose").');
        return;
      }
      const all = directions2(), targets = $2("#tmAddTo").value === "all" ? all : [D2()];
      const taken = targets.filter((d) => Object.keys(d.rest.anims || {}).includes(name));
      if (taken.length) {
        msg(`There is already an animation called "${name}" in direction ${taken.map((d) => d.dir).join(", ")}. Choose another name: adding never replaces an animation.`);
        return;
      }
      const full = targets.filter((d) => Object.keys(d.rest.anims || {}).length >= MAX_ANIMS);
      if (full.length) {
        msg(`Direction ${full.map((d) => d.dir).join(", ")} already has ${MAX_ANIMS} animations, the most a direction can have. Delete one in Manual first.`);
        return;
      }
      const added = [], skipped = [];
      stop();
      for (const d of targets) {
        const chk = d.rest.rig && d.layers ? fits(t, d) : { ok: false, reason: "its parts and joints are not ready" };
        if (!chk.ok) {
          skipped.push(`${d.dir} (${chk.reason})`);
          continue;
        }
        const a = buildTemplate(t, d.rest, d.layers, { ...st.sel, facing: FACING_OF[d.dir] });
        addTo(d.dir, name, JSON.parse(JSON.stringify(a)), `Added "${name}" from the ${t.name} template (direction ${d.dir}, ${FACING_LABEL[a.facing]}, ${a.fps} fps, ${a.loop ? "loops" : "plays once"}). Every key can be edited here.`);
        added.push(d.dir);
      }
      st.sel = null;
      st.anim = null;
      st.frames = [];
      msg(`Added "${name}" to direction ${added.join(", ")}.${skipped.length ? " Not added to " + skipped.join("; ") + "." : ""}`);
      if (added.includes(shownDir())) {
        setTab("manual");
        showManual(name);
      } else render();
    });
    const KIND = {
      "joint-gap": "Gaps open at joints",
      uncovered: "Holes open where a part moved away (the image has nothing there)",
      clipped: "Parts are cut off at the frame edge",
      "not-in-image": "Joint fill shows (colour spread at the joints, not in the image)",
      ground: "The feet leave the ground line",
      "body-jump": "The whole body jumps between frames",
      proportion: "A part is drawn larger or smaller than at rest",
      "few-parts": "Few parts move",
      "moved-copy": "A frame is the still image only moved"
    };
    function summarise(found, name) {
      const by = /* @__PURE__ */ new Map();
      for (const f of found) {
        if (!by.has(f.code)) by.set(f.code, { frames: /* @__PURE__ */ new Set(), first: f });
        if (f.frame !== null && f.frame !== void 0) by.get(f.code).frames.add(f.frame + 1);
      }
      return [...by].map(([code, g]) => {
        const frames = [...g.frames].sort((a, b) => a - b);
        const where = frames.length ? ` in frame${frames.length > 1 ? "s" : ""} ${frames.join(", ")}` : "";
        return KIND[code] ? `${KIND[code]}${where}. For example: ${g.first.message.replace(new RegExp("^" + name + " "), "")}` : g.first.message;
      });
    }
    function renderPlayer() {
      if (!st.anim) return;
      const n = st.frames.length, size = F(), z = Math.max(2, Math.floor(260 / size)), c = $2("#tmCanvas");
      c.width = c.height = size * z;
      const ctx = c.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(toCanvas(st.frames[st.frame], size), 0, 0, size * z, size * z);
      $2("#tmPlay").textContent = st.playing ? "Pause" : "Play";
      $2("#tmScrub").max = String(n - 1);
      $2("#tmScrub").value = String(st.frame);
      $2("#tmFrameLabel").textContent = `${st.frame + 1}/${n}`;
      for (const [i, b] of [...$2("#tmStrip").children].entries()) b.setAttribute("aria-pressed", String(i === st.frame));
    }
    function renderPreview() {
      const on = !!st.anim;
      $2("#tmPreview").hidden = !on;
      if (!on) return;
      const d = D2(), t = templateById(st.sel.id), a = st.anim, size = F();
      $2("#tmTitle").textContent = `${t.name} \xB7 direction ${d.dir} \xB7 ${FACING_LABEL[a.facing]}`;
      $2("#tmFrames").value = String(a.frames);
      $2("#tmFps").value = String(a.fps);
      $2("#tmLoop").checked = a.loop;
      $2("#tmTiming").textContent = `${a.frames} frames \xB7 ${Math.round(a.frames * 1e3 / a.fps)} ms per ${a.loop ? "loop" : "play (holds the last frame)"}`;
      $2("#tmUndo").disabled = !st.undo.length;
      $2("#tmRedo").disabled = !st.redo.length;
      $2("#tmStrip").replaceChildren(...st.frames.map((px, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.setAttribute("aria-label", `preview frame ${i + 1}`);
        const c = document.createElement("canvas"), k = Math.max(1, Math.floor(40 / size));
        c.width = c.height = size * k;
        const ctx = c.getContext("2d");
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(toCanvas(px, size), 0, 0, size * k, size * k);
        b.append(c);
        b.addEventListener("click", () => {
          stop();
          st.frame = i;
          renderPlayer();
        });
        return b;
      }));
      const name = t.id;
      const findings = checkRig({
        timeline: applyToTimeline({ order: [], anims: {} }, name, a),
        rest: d.rest,
        rig: d.rest.rig,
        render: (p) => renderRig(d.layers, d.rest.rig, p, { N: d.rest.N, palette: d.rest.palette, settings: d.rest.settings || void 0 })
      });
      const shown = findings.filter((f) => f.level === "warning" || f.code === "uncovered" || f.code === "not-in-image" && /joint fill|hidden area/.test(f.message));
      $2("#tmWarn").replaceChildren(...shown.length ? summarise(shown, name).map((x) => Object.assign(document.createElement("li"), { textContent: x })) : [Object.assign(document.createElement("li"), { textContent: "The frame check finds nothing to fix in this motion." })]);
      if (reachNote(st.reach)) $2("#tmWarn").prepend(Object.assign(document.createElement("li"), { textContent: reachNote(st.reach) }));
      if (shown.length) {
        const li = document.createElement("li");
        li.textContent = "Gaps and hidden areas are not filled in automatically: after adding, raise the joint fill (step 5), paint the hidden area (step 7) or edit frames by hand.";
        $2("#tmWarn").append(li);
      }
      renderPlayer();
    }
    function render() {
      if (!compatible()) {
        $2("#tmCards").replaceChildren();
        $2("#tmPreview").hidden = true;
        msg("Template Motion needs an Imported character with parts and joints (steps 4 and 5).");
        return;
      }
      for (const b of document.querySelectorAll("#tmFilters button")) b.setAttribute("aria-pressed", String(b.dataset.cat === st.cat));
      drawCharacter();
      renderCards();
      renderPreview();
      onSelect(st.sel ? st.sel.id : null);
    }
    return {
      refresh(rest) {
        st.rest = rest;
        const all = directions2(), shown = shownDir();
        if (shown !== st.shown && all.some((d) => d.dir === shown)) {
          st.dir = shown;
          st.shown = shown;
        }
        if (!all.some((d) => d.dir === st.dir)) st.dir = (all.find((d) => d.dir === shown) || all[0] || {}).dir || null;
        if (st.sel && compatible()) {
          const chk = fits(templateById(st.sel.id), D2());
          if (chk.ok) set(st.sel);
          else {
            stop();
            st.sel = null;
            st.anim = null;
            st.frames = [];
            msg("The chosen motion no longer fits the rig (" + chk.reason + ")");
          }
        }
        if (st.tab === "template") render();
      },
      setTab,
      info() {
        return {
          tab: st.tab,
          cat: st.cat,
          dir: D2() ? D2().dir : null,
          directions: directions2().map((d) => d.dir),
          selected: st.sel ? { ...st.sel } : null,
          frame: st.frame,
          playing: st.playing,
          frames: st.frames.length,
          anim: st.anim ? JSON.parse(JSON.stringify(st.anim)) : null,
          preview: st.frames.map((f) => f.slice()),
          canUndo: st.undo.length > 0,
          canRedo: st.redo.length > 0
        };
      }
    };
  }


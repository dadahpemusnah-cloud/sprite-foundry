  // src/ui/auto-animate.js
  // Auto Animate: one motion on every screen direction at once (down S, up N, left W, right E, and the
  // diagonals SE, SW, NE, NW since V7).
  // Each direction is built from its own image and rig with the existing template, previewed side by
  // side, and applied, undone or redone as one step. Directions without their own image are not faked.
  var AUTO_DIRS = [["S", "down"], ["N", "up"], ["W", "left"], ["E", "right"], ["SE", "down-right"], ["SW", "down-left"], ["NE", "up-right"], ["NW", "up-left"]];
  var AUTO_MOTIONS = {
    walk: { template: "walk", label: "Walk", frames: 12, fps: 10 },
    run: { template: "run", label: "Run", frames: 8, fps: 12 },
    sneak: { template: "sneak", label: "Sneak", frames: 8, fps: 8 },
    idle: { template: "idle", label: "Idle", frames: 8, fps: 6 }
  };
  function initAutoAnimate({ $: $2, directions: directions2, frameOf, setAnim, F, handEdited = () => false }) {
    const st = { pick: new Set(AUTO_DIRS.map(([d]) => d)), built: null, frame: 0, timer: 0, done: [], undone: [] };
    const msg = (t) => {
      $2("#aaMsg").textContent = t || "";
    };
    const motion = () => AUTO_MOTIONS[$2("#aaMotion").value] || AUTO_MOTIONS.walk;
    const restOf = (dir) => {
      const d = directions2().find((x) => x.dir === dir);
      return d ? d.rest : null;
    };
    const animsOf = (dir) => restOf(dir) && restOf(dir).anims || {};
    const screenOf = (dir) => AUTO_DIRS.find(([d]) => d === dir)[1];
    const settings = () => ({ frames: Math.round(Number($2("#aaFrames").value)), fps: Math.round(Number($2("#aaFps").value)), name: $2("#aaName").value.trim() });
    // per screen direction: is there artwork with a rig the motion fits?
    function status() {
      const all = directions2(), t = templateById(motion().template);
      return AUTO_DIRS.map(([dir, screen]) => {
        const d = all.find((x) => x.dir === dir);
        if (!d) return { dir, screen, ok: false, why: "needs its own image (add it under Direction)" };
        if (!(d.rest && d.rest.rig && d.rest.seg && d.layers)) return { dir, screen, d, ok: false, why: "needs parts and joints (steps 4–5)" };
        const chk = checkTemplate(t, d.rest.rig, presentParts(d.rest, d.layers));
        return chk.ok ? { dir, screen, d, ok: true } : { dir, screen, d, ok: false, why: chk.reason };
      });
    }
    function invalid() {
      const { frames, fps, name } = settings();
      if (!(frames >= 1 && frames <= 64)) return "Frames per direction are 1 to 64.";
      if (!(fps >= 1 && fps <= 60)) return "Speed is 1 to 60 fps.";
      if (!ANIM_NAME.test(name) || name === "pose") return 'A name is a lower-case letter, then up to 23 lower-case letters, digits, - or _ (and not "pose").';
      return "";
    }
    function build() {
      stop();
      const bad = invalid();
      if (bad) {
        st.built = null;
        msg(bad);
        return render();
      }
      const { frames, fps, name } = settings(), t = templateById(motion().template);
      const items = status().filter((s) => s.ok && st.pick.has(s.dir)).map(({ dir, screen, d }) => {
        const anim2 = buildTemplate(t, d.rest, d.layers, { facing: FACING_OF[dir], frames, fps, loop: true });
        const px = sampleAnim(anim2).map((f) => frameOf({ pose: f.pose, ...f.flash ? { flash: true } : {}, ...d.main ? {} : { view: dir } }));
        const found = checkRig({
          timeline: applyToTimeline({ order: [], anims: {} }, name, anim2),
          rest: d.rest,
          rig: d.rest.rig,
          render: (p) => renderRig(d.layers, d.rest.rig, p, { N: d.rest.N, palette: d.rest.palette, settings: d.rest.settings || void 0 })
        }).filter((f) => f.level === "warning");
        return { dir, screen, anim: anim2, px, warnings: found };
      });
      st.built = items.length ? { name, fps, frames: items[0].anim.frames, items } : null;
      st.frame = 0;
      msg(items.length ? "Preview only: nothing is added until you apply." : "No direction is ready for this motion (see the list).");
      render();
    }
    function draw() {
      const b = st.built, c = $2("#aaCanvas");
      $2("#aaView").hidden = !b;
      if (!b) return;
      // up to four directions per row
      const size = F(), z = Math.max(1, Math.floor(140 / size)), gap = 8, cols = Math.min(4, b.items.length), cell = size * z + gap;
      c.width = cols * cell - gap;
      c.height = Math.ceil(b.items.length / cols) * cell - gap;
      const ctx = c.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, c.width, c.height);
      b.items.forEach((it, i) => ctx.drawImage(toCanvas(it.px[st.frame % it.px.length], size), i % cols * cell, (i / cols | 0) * cell, size * z, size * z));
      $2("#aaFrameLabel").textContent = `frame ${st.frame % b.frames + 1} / ${b.frames}`;
    }
    function stop() {
      clearInterval(st.timer);
      st.timer = 0;
      $2("#aaPlay").textContent = "Play";
    }
    function play() {
      if (st.timer) return stop();
      if (!st.built) return;
      $2("#aaPlay").textContent = "Pause";
      st.timer = setInterval(() => {
        st.frame = (st.frame + 1) % st.built.frames;
        draw();
      }, 1e3 / st.built.fps);
    }
    function render() {
      const s = status(), { frames, fps } = settings(), n = s.filter((x) => x.ok && st.pick.has(x.dir)).length;
      $2("#aaDirs").replaceChildren(...s.map((x) => {
        const li = document.createElement("li"), lab = document.createElement("label"), cb = document.createElement("input");
        li.className = x.ok ? "has" : "";
        cb.type = "checkbox";
        cb.checked = x.ok && st.pick.has(x.dir);
        cb.disabled = !x.ok;
        cb.addEventListener("change", () => {
          if (cb.checked) st.pick.add(x.dir);
          else st.pick.delete(x.dir);
          st.built = null;
          stop();
          render();
        });
        lab.append(cb, ` ${x.screen} (${x.dir})${x.ok ? "" : " — " + x.why}`);
        li.append(lab);
        return li;
      }));
      $2("#aaTiming").textContent = frames >= 1 && fps >= 1 ? `${n} direction${n === 1 ? "" : "s"} \xD7 ${frames} frames = ${n * frames} frames \xB7 ${Math.round(frames / fps * 1e3)} ms per loop` : "";
      const b = st.built;
      $2("#aaPlay").disabled = !b;
      $2("#aaUndo").disabled = !st.done.length;
      $2("#aaRedo").disabled = !st.undone.length;
      $2("#aaWarn").replaceChildren(...b ? b.items.map((it) => {
        const codes = [...new Set(it.warnings.map((w) => w.code))];
        return Object.assign(document.createElement("li"), { textContent: `${it.screen} (${it.dir}): ${it.warnings.length ? `${it.warnings.length} frame-check warning${it.warnings.length === 1 ? "" : "s"} (${codes.join(", ")})` : "the frame check finds nothing to fix"}` });
      }) : []);
      draw();
    }
    // runs one applied step forwards ("after") or backwards ("before") on every direction it touched
    function run(step, side) {
      for (const it of step.items) setAnim(it.dir, step.name, it[side], side === "after" ? `${step.name} made by Auto Animate (direction ${it.dir}). Every key can be edited here.` : void 0);
    }
    // directions where the animation's keys changed since `side`, or whose frames were edited by hand (removing loses those)
    const editedSince = (step, side) => step.items.filter((it) => animsOf(it.dir)[step.name] !== it[side] || handEdited(it.dir, step.name)).map((it) => screenOf(it.dir));
    function apply() {
      if (!st.built) build();
      const b = st.built;
      if (!b) return;
      const clash = b.items.filter((it) => animsOf(it.dir)[b.name]);
      if (clash.length && !confirm(`Replace the existing "${b.name}" in ${clash.map((it) => it.screen).join(", ")}? Undo in Auto Animate brings it back.`)) {
        msg("Nothing changed.");
        return;
      }
      const full = b.items.filter((it) => !animsOf(it.dir)[b.name] && Object.keys(animsOf(it.dir)).length >= MAX_ANIMS);
      if (full.length) {
        msg(`Direction ${full.map((it) => it.dir).join(", ")} already has ${MAX_ANIMS} animations, the most a direction can have. Delete one in Manual first.`);
        return;
      }
      stop();
      const step = { name: b.name, items: b.items.map((it) => ({ dir: it.dir, before: animsOf(it.dir)[b.name] || null, after: JSON.parse(JSON.stringify(it.anim)) })) };
      run(step, "after");
      st.done.push(step);
      st.undone = [];
      const skipped = status().filter((x) => !x.ok).map((x) => x.screen);
      st.built = null;
      msg(`Applied "${b.name}" to ${b.items.map((it) => it.screen).join(", ")}: ${b.items.length * b.frames} frames, ${Math.round(b.frames / b.fps * 1e3)} ms per loop.${skipped.length ? ` Not made for ${skipped.join(", ")} (no ready image).` : ""} Undo here removes it from every direction at once.`);
      render();
    }
    function undoRedo(from, to, side, verb) {
      const step = from[from.length - 1];
      if (!step) return;
      const other = side === "before" ? "after" : "before", edited = editedSince(step, other);
      if (edited.length && !confirm(`"${step.name}" was changed since in ${edited.join(", ")}. ${verb} anyway and lose those changes?`)) return;
      from.pop();
      run(step, side);
      to.push(step);
      msg(`${verb === "Undo" ? "Undone" : "Redone"}: "${step.name}" in ${step.items.map((it) => screenOf(it.dir)).join(", ")}.`);
      render();
    }
    $2("#aaPreview").addEventListener("click", build);
    $2("#aaPlay").addEventListener("click", play);
    $2("#aaApply").addEventListener("click", apply);
    $2("#aaUndo").addEventListener("click", () => undoRedo(st.done, st.undone, "before", "Undo"));
    $2("#aaRedo").addEventListener("click", () => undoRedo(st.undone, st.done, "after", "Redo"));
    $2("#aaMotion").addEventListener("change", () => {
      const m = motion();
      $2("#aaFrames").value = m.frames;
      $2("#aaFps").value = m.fps;
      $2("#aaName").value = m.template;
      st.built = null;
      render();
    });
    for (const id of ["#aaFrames", "#aaFps", "#aaName"]) $2(id).addEventListener("change", () => {
      st.built = null;
      stop();
      msg(invalid());
      render();
    });
    return {
      refresh() {
        st.built = null;
        stop();
        render();
      },
      info: () => ({
        status: status().map(({ dir, screen, ok, why }) => ({ dir, screen, ok, why: why || null })),
        settings: settings(),
        built: st.built ? { name: st.built.name, frames: st.built.frames, fps: st.built.fps, dirs: st.built.items.map((it) => it.dir), warnings: Object.fromEntries(st.built.items.map((it) => [it.dir, it.warnings.map((w) => w.code)])) } : null,
        frame: st.frame,
        playing: !!st.timer,
        undo: st.done.length,
        redo: st.undone.length
      })
    };
  }

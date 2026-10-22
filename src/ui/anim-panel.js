  // src/ui/anim-panel.js
  var PRESET_LABEL = { idle: "idle", walk: "walk", attack: "sword attack", run: "run", jump: "jump", hurt: "hurt", death: "death" };
  function initAnimPanel({ $: $2, getLayers, onChange, edited: edited2 = () => [], rerender = () => {
  }, facing: dirFacing = () => "right" }) {
    const canvas = $2("#anCanvas");
    const st = { rest: null, name: null, frame: 0, bone: "upperArmR", clip: null, undo: [], redo: [], playing: false, timer: 0, z: 4, drag: null };
    function msg(t, kind = "") {
      const el2 = $2("#anMsg");
      el2.textContent = t || "";
      el2.className = "hint " + kind;
    }
    const anims = () => st.rest && st.rest.anims || {};
    const anim2 = () => anims()[st.name];
    function refresh(rest) {
      st.rest = rest;
      const on = !!(rest && rest.rig && rest.seg);
      $2("#animWork").hidden = !on;
      if (!on) {
        stop();
        return;
      }
      if (!anims()[st.name]) st.name = Object.keys(anims())[0] || null;
      if (!rest.rig.bones[st.bone]) st.bone = rest.rig.order[0];
      if (anim2() && st.frame >= anim2().frames) st.frame = 0;
      render();
    }
    function commit(nextAnims, name, note) {
      st.undo.push({ anims: anims(), name: st.name });
      if (st.undo.length > 40) st.undo.shift();
      st.redo = [];
      apply_(nextAnims, name);
      if (note !== void 0) msg(note);
    }
    function apply_(nextAnims, name) {
      const before = anims();
      st.rest.anims = nextAnims;
      st.name = name in nextAnims ? name : Object.keys(nextAnims)[0] || null;
      const changed = new Set([...Object.keys(before), ...Object.keys(nextAnims)].filter((n) => before[n] !== nextAnims[n]));
      onChange(nextAnims, [...changed]);
      render();
    }
    const withAnim2 = (name, a) => ({ ...anims(), [name]: a });
    function editPose(fn) {
      const a = anim2();
      if (!a) return;
      const p = clonePose(keyedPose(a, st.frame));
      fn(p);
      commit(withAnim2(st.name, setKey(a, st.frame, p)), st.name);
    }
    function render() {
      const a = anim2();
      const names = Object.keys(anims());
      $2("#anName").replaceChildren(...names.map((n) => new Option(`${n} \xB7 ${anims()[n].frames} frames${anims()[n].loop ? "" : " \xB7 plays once"}`, n)));
      $2("#anName").value = st.name || "";
      for (const id of ["#anFrames", "#anFps", "#anLoop", "#anDelete", "#anKeyDel", "#anEase", "#anCopy", "#anPaste", "#anMirror", "#anBone", "#anRot", "#anRotN", "#anOffX", "#anOffY", "#anRootX", "#anRootY", "#anSmear", "#anPlay", "#anPrev", "#anNext"]) $2(id).disabled = !a;
      if (a) $2("#anFacing").value = a.facing;
      $2("#anUndo").disabled = !st.undo.length;
      $2("#anRedo").disabled = !st.redo.length;
      const strip = $2("#anStrip");
      if (!a) {
        strip.replaceChildren();
        $2("#anInfo").textContent = "Make an animation from a preset to start.";
        drawPreview();
        $2("#anWarn").replaceChildren();
        return;
      }
      $2("#anFrames").value = a.frames;
      $2("#anFps").value = a.fps;
      $2("#anLoop").checked = a.loop;
      $2("#anSmooth").checked = !!a.smooth;
      const key = a.keys.find((k) => k.t === st.frame);
      $2("#anKeyDel").disabled = !key || a.keys.length < 2;
      $2("#anEase").value = key ? key.ease : "easeInOut";
      $2("#anEase").disabled = !key;
      $2("#anHold").value = key ? String(key.hold || 0) : "0";
      $2("#anHold").disabled = !key || key.ease === "step";
      $2("#anCurveWrap").hidden = !(key && key.ease === "curve");
      if (key && key.curve && document.activeElement !== $2("#anCurve")) $2("#anCurve").value = key.curve.join(" ");
      $2("#anPaste").disabled = !st.clip;
      strip.replaceChildren(...Array.from({ length: a.frames }, (_, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "an-cell" + (a.keys.some((k) => k.t === i) ? " key" : "");
        b.textContent = String(i + 1);
        b.setAttribute("aria-label", `${st.name} frame ${i + 1}${a.keys.some((k) => k.t === i) ? " (key)" : ""}`);
        b.setAttribute("aria-pressed", String(i === st.frame));
        b.addEventListener("click", () => {
          stop();
          st.frame = i;
          render();
        });
        return b;
      }));
      const bones = Object.keys(st.rest.rig.bones), label = (id) => {
        const p2 = st.rest.seg.parts.find((x) => x.id === id) || st.rest.seg.extras.find((x) => x.id === id);
        return p2 ? p2.label : id;
      };
      if ($2("#anBone").options.length !== bones.length || [...$2("#anBone").options].some((o, i) => o.value !== bones[i])) $2("#anBone").replaceChildren(...bones.map((id) => new Option(`${label(id)} \xB7 turns at ${jointName(id)}`, id)));
      $2("#anBone").value = st.bone;
      const fol = Object.entries(a.follow || {});
      $2("#anFollow").disabled = !(st.rest.rig.bones[st.bone] && st.rest.rig.bones[st.bone].parent);
      $2("#anFollow").textContent = a.follow && a.follow[st.bone] ? "Update trail" : "Make it trail";
      $2("#anFollowList").replaceChildren(...fol.map(([id, f]) => {
        const li = document.createElement("li"), x = document.createElement("button");
        li.textContent = `${label(id)} trails ${f.from.map(label).join(" \u2192 ")} by ${f.delay} frame${f.delay > 1 ? "s" : ""} (amount ${f.amount}) `;
        x.type = "button";
        x.textContent = "Remove";
        x.setAttribute("aria-label", "Remove the trail of " + label(id));
        x.addEventListener("click", () => commit(withAnim2(st.name, setFollow(anim2(), st.rest.rig, id, { amount: 0 })), st.name, `${label(id)} no longer trails.`));
        li.append(x);
        return li;
      }));
      const kp = a.keys.find((k) => k.t === st.frame);
      $2("#anSmear").value = String(kp && kp.pose.smear && kp.pose.smear[st.bone] || 1);
      const p = keyedPose(a, st.frame), rot = p.rot[st.bone] || 0, off2 = p.off[st.bone] || [0, 0];
      $2("#anRot").value = Math.max(-180, Math.min(180, rot));
      $2("#anRotN").value = rot;
      $2("#anOffX").value = off2[0];
      $2("#anOffY").value = off2[1];
      $2("#anRootX").value = p.root[0];
      $2("#anRootY").value = p.root[1];
      const alts = (st.rest.art && st.rest.art.swaps[st.bone] || []).map((d) => d.name);
      $2("#anDrawing").replaceChildren(new Option("the image", ""), ...alts.map((n) => new Option("drawing: " + n, n)));
      $2("#anDrawing").value = p.swap && p.swap[st.bone] || "";
      $2("#anDrawing").disabled = !alts.length;
      $2("#anOrder").value = p.order && p.order[st.bone] || "";
      $2("#anOrder").disabled = !st.rest.rig.order.includes(st.bone);
      const ed = edited2(st.name);
      $2("#anEditedRow").hidden = !ed.length;
      $2("#anEdited").replaceChildren(...ed.map((i) => {
        const l = document.createElement("label");
        l.className = "field";
        const c = document.createElement("input");
        c.type = "checkbox";
        c.value = String(i);
        c.checked = true;
        c.setAttribute("aria-label", `Re-render frame ${i + 1}`);
        l.append(c, " " + (i + 1));
        return l;
      }));
      const w2 = jointWarnings(a);
      $2("#anWarn").replaceChildren(...w2.map((x) => {
        const li = document.createElement("li");
        li.textContent = x.text + " (allowed; check it looks right)";
        return li;
      }));
      for (const b of strip.children) {
        const i = Number(b.textContent) - 1;
        if (ed.includes(i)) {
          b.classList.add("edited");
          b.title = "Edited by hand: keeps its pixels when keys change";
        }
      }
      $2("#anInfo").textContent = `${st.name}: frame ${st.frame + 1} of ${a.frames}${key ? " \xB7 key" : " \xB7 in-between (editing makes a key)"} \xB7 ${a.keys.length} keys \xB7 ${a.fps} fps \xB7 ${a.loop ? "loops" : "plays once"} \xB7 facing ${a.facing}`;
      drawPreview();
    }
    let last = null;
    function drawPreview() {
      const a = anim2(), L = getLayers(), rest = st.rest, ctx = canvas.getContext("2d");
      if (!a || !L) {
        canvas.width = canvas.height = 1;
        last = null;
        return;
      }
      const N = rest.N, z = st.z = Math.max(2, Math.floor(400 / (N + 4)));
      const pose2 = samplePose(a, st.frame), r = renderRig(L, rest.rig, pose2, { N, palette: rest.palette, settings: rest.settings || void 0 });
      last = { pose: pose2, px: r.px, bleed: r.stats.bleedPixels };
      canvas.width = canvas.height = (N + 4) * z;
      canvas.style.width = canvas.style.height = (N + 4) * z + "px";
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if ($2("#anOnion").checked && a.frames > 1) {
        const prev = (st.frame - 1 + a.frames) % a.frames;
        if (prev !== st.frame && (a.loop || st.frame > 0)) {
          ctx.globalAlpha = 0.3;
          ctx.drawImage(toCanvas(renderRig(L, rest.rig, samplePose(a, prev), { N, palette: rest.palette, settings: rest.settings || void 0 }).px, N), 2 * z, 2 * z, N * z, N * z);
          ctx.globalAlpha = 1;
        }
      }
      ctx.drawImage(toCanvas(r.px, N), 2 * z, 2 * z, N * z, N * z);
      const show = $2("#anMade").checked, sum = madeSummary(r.stats.made), hand = edited2(st.name).includes(st.frame);
      if (show) tintMade(ctx, r.stats.made, N, 2 * z, 2 * z, z);
      $2("#anMadeKey").hidden = !show;
      $2("#anMadeNote").textContent = (show ? `Frame ${st.frame + 1}: ${sum ? sum + " not from the image" : "every pixel is from the image"}.` : "") + (hand ? ` Frame ${st.frame + 1} was edited by hand: the sheet keeps your pixels; this preview shows the rig's frame (re-render it below to use the rig's).` : "");
      last.made = r.stats.made;
      const W = worldMatrices(rest.rig, pose2, rest.N * 4), [jx, jy] = apply(W[st.bone], rest.rig.bones[st.bone].pivot);
      ctx.strokeStyle = "#ffd34d";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(2 * z + jx / 4 * z, 2 * z + jy / 4 * z, 5, 0, Math.PI * 2);
      ctx.stroke();
    }
    $2("#anMadeKey").replaceChildren(...madeLegend());
    $2("#anMade").addEventListener("change", () => drawPreview());
    const jointAt = () => {
      const W = worldMatrices(st.rest.rig, samplePose(anim2(), st.frame), st.rest.N * 4), [x, y] = apply(W[st.bone], st.rest.rig.bones[st.bone].pivot);
      return [2 * st.z + x / 4 * st.z, 2 * st.z + y / 4 * st.z];
    };
    const pt = (e) => {
      const r = canvas.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };
    canvas.addEventListener("pointerdown", (e) => {
      if (!anim2()) return;
      e.preventDefault();
      stop();
      const [jx, jy] = jointAt(), [x, y] = pt(e);
      st.drag = { a0: Math.atan2(y - jy, x - jx), rot0: keyedPose(anim2(), st.frame).rot[st.bone] || 0, before: { anims: anims(), name: st.name }, j: [jx, jy] };
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch (err) {
      }
    });
    canvas.addEventListener("pointermove", (e) => {
      const d = st.drag;
      if (!d) return;
      const [x, y] = pt(e), deg2 = Math.round((d.rot0 + (Math.atan2(y - d.j[1], x - d.j[0]) - d.a0) * 180 / Math.PI) * 2) / 2;
      const p = clonePose(keyedPose(anim2(), st.frame));
      p.rot[st.bone] = (deg2 + 540) % 360 - 180;
      if (!p.rot[st.bone]) delete p.rot[st.bone];
      st.rest.anims = withAnim2(st.name, setKey(anim2(), st.frame, p));
      render();
    });
    const endDrag = () => {
      const d = st.drag;
      if (!d) return;
      st.drag = null;
      const after = anims();
      st.rest.anims = d.before.anims;
      commit(after, st.name);
    };
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);
    function play2() {
      const a = anim2();
      if (!a) return;
      st.playing = true;
      $2("#anPlay").textContent = "Stop";
      const step2 = () => {
        const a2 = anim2();
        if (!st.playing || !a2) return stop();
        if (st.frame + 1 >= a2.frames && !a2.loop) return stop();
        st.frame = (st.frame + 1) % a2.frames;
        render();
        st.timer = setTimeout(step2, 1e3 / a2.fps);
      };
      if (!a.loop && st.frame >= a.frames - 1) {
        st.frame = 0;
        render();
      }
      st.timer = setTimeout(step2, 1e3 / a.fps);
    }
    function stop() {
      st.playing = false;
      clearTimeout(st.timer);
      $2("#anPlay").textContent = "Play";
    }
    const makePreset = (kind, facing, out) => fittedPreset(st.rest, getLayers(), kind, facing, out);
    for (const [id, kind] of [["#anIdle", "idle"], ["#anWalk", "walk"], ["#anAttack", "attack"], ["#anRun", "run"], ["#anJump", "jump"], ["#anHurt", "hurt"], ["#anDeath", "death"]]) $2(id).addEventListener("click", () => {
      stop();
      const facing = dirFacing(), existed = kind in anims();
      st.frame = 0;
      const out = {}, made = makePreset(kind, facing, out);
      const reach = reachNote(out) ? " " + reachNote(out) : "";
      commit(
        withAnim2(kind, made),
        kind,
        `${existed ? "Replaced" : "Made"} ${PRESET_LABEL[kind]} from the preset (facing ${facing}).${reach} Every key can be edited.${existed ? " Undo brings the old one back." : ""}`
      );
    });
    $2("#anName").addEventListener("change", (e) => {
      stop();
      st.name = e.target.value;
      st.frame = 0;
      render();
    });
    $2("#anDelete").addEventListener("click", () => {
      const n = st.name, next = { ...anims() };
      delete next[n];
      stop();
      st.frame = 0;
      commit(next, Object.keys(next)[0] || null, `Deleted ${n}.`);
    });
    $2("#anFacing").addEventListener("change", (e) => {
      if (anim2()) commit(withAnim2(st.name, { ...anim2(), facing: e.target.value }), st.name, "This animation\u2019s facing changed (used by its joint warnings). The keys are unchanged; new presets follow the direction.");
    });
    $2("#anFrames").addEventListener("change", (e) => {
      const a = anim2(), want = Math.round(Number(e.target.value)) || 1, next = $2("#anRetime").checked ? retime(a, want) : setFrames(a, want);
      const cut = a.keys.length - next.keys.length;
      const note = $2("#anRetime").checked ? next.frames > want ? `At least ${next.frames} frames: one per key. The keys were stretched to ${next.frames} frames.` : `Retimed to ${next.frames} frames: every key kept, its timing scaled.` : cut > 0 ? `${next.frames} frames: ${cut} key${cut > 1 ? "s" : ""} past the end cut. Undo brings ${cut > 1 ? "them" : "it"} back.` : `${next.frames} frames; the keys did not move.`;
      commit(withAnim2(st.name, next), st.name, note);
      st.frame = Math.min(st.frame, anim2().frames - 1);
      render();
    });
    $2("#anFps").addEventListener("change", (e) => {
      const v = Math.max(1, Math.min(60, Math.round(Number(e.target.value)) || 8));
      commit(withAnim2(st.name, { ...anim2(), fps: v }), st.name);
    });
    $2("#anLoop").addEventListener("change", (e) => commit(withAnim2(st.name, { ...anim2(), loop: e.target.checked }), st.name));
    $2("#anSmooth").addEventListener("change", (e) => {
      const { smooth: smooth2, ...a } = anim2();
      commit(withAnim2(st.name, e.target.checked ? { ...a, smooth: true } : a), st.name, e.target.checked ? "Smooth turns: turned parts take their colours from RotSprite (no stray specks; the same outline)." : "Plain turns, as before V4.");
    });
    $2("#anKeyAdd").addEventListener("click", () => editPose(() => {
    }));
    $2("#anKeyDel").addEventListener("click", () => commit(withAnim2(st.name, deleteKey(anim2(), st.frame)), st.name));
    $2("#anHold").addEventListener("change", (e) => {
      const a = anim2(), k = a && a.keys.find((x) => x.t === st.frame);
      if (!k) return;
      const h = Math.max(0, Math.min(63, Math.round(Number(e.target.value)) || 0));
      commit(withAnim2(st.name, setKeyTiming(a, st.frame, { hold: h })), st.name, h ? `The pose of frame ${st.frame + 1} is held ${h} frame${h > 1 ? "s" : ""} before it moves on.` : "No hold: the motion starts at the key.");
    });
    $2("#anCurve").addEventListener("change", (e) => {
      const a = anim2(), k = a && a.keys.find((x) => x.t === st.frame);
      if (!k || k.ease !== "curve") return;
      const v = e.target.value.trim().split(/[\s,]+/).map(Number);
      if (v.length !== 4 || !v.every(Number.isFinite) || v[0] < 0 || v[0] > 1 || v[2] < 0 || v[2] > 1 || v.some((x) => Math.abs(x) > 4)) {
        msg("A curve is four numbers x1 y1 x2 y2, with x1 and x2 between 0 and 1 (for example 0.42 0 0.58 1).");
        render();
        return;
      }
      commit(withAnim2(st.name, setKeyTiming(a, st.frame, { curve: v })), st.name, `Curve ${v.join(" ")} from frame ${st.frame + 1}.`);
    });
    $2("#anEase").addEventListener("change", (e) => {
      const a = anim2(), k = a.keys.find((x) => x.t === st.frame);
      if (k) commit(withAnim2(st.name, setKey(a, st.frame, k.pose, e.target.value)), st.name);
    });
    $2("#anCopy").addEventListener("click", () => {
      st.clip = clonePose(keyedPose(anim2(), st.frame));
      msg(`Copied the pose of frame ${st.frame + 1}.`);
      render();
    });
    $2("#anPaste").addEventListener("click", () => {
      if (st.clip) commit(withAnim2(st.name, setKey(anim2(), st.frame, st.clip)), st.name, `Pasted onto frame ${st.frame + 1}.`);
    });
    $2("#anMirror").addEventListener("click", () => commit(withAnim2(st.name, setKey(anim2(), st.frame, mirrorPose(keyedPose(anim2(), st.frame)))), st.name, "Swapped left and right parts in this frame."));
    $2("#anBone").addEventListener("change", (e) => {
      st.bone = e.target.value;
      render();
    });
    $2("#anSmear").addEventListener("change", (e) => {
      const v = Math.round(Math.max(1, Math.min(4, Number(e.target.value) || 1)) * 10) / 10, id = st.bone;
      editPose((p) => {
        const sm = { ...p.smear || {} };
        if (v > 1) sm[id] = v;
        else delete sm[id];
        if (Object.keys(sm).length) p.smear = sm;
        else delete p.smear;
      });
      msg(v > 1 ? "Frame " + (st.frame + 1) + ": " + id + " smeared \xD7" + v + " (user-made, this frame only; the frame check lists it)." : "No smear of " + id + " on frame " + (st.frame + 1) + ".");
    });
    $2("#anFollow").addEventListener("click", () => {
      const delay = Number($2("#anFollowDelay").value) || 2, amount = Number($2("#anFollowAmount").value) || 1, next = setFollow(anim2(), st.rest.rig, st.bone, { delay, amount }), f = next.follow && next.follow[st.bone];
      if (!f) {
        msg("This part hangs from nothing, so it cannot trail.");
        return;
      }
      commit(withAnim2(st.name, next), st.name, `${st.bone} trails ${f.from.join(" \u2192 ")} by ${f.delay} frame${f.delay > 1 ? "s" : ""} (amount ${f.amount}).`);
    });
    const setRot = (v) => editPose((p) => {
      v = (Math.round(v * 2) / 2 + 540) % 360 - 180;
      if (v) p.rot[st.bone] = v;
      else delete p.rot[st.bone];
    });
    $2("#anRot").addEventListener("change", (e) => setRot(Number(e.target.value)));
    $2("#anRotN").addEventListener("change", (e) => setRot(Number(e.target.value) || 0));
    const setOff = (k, v) => editPose((p) => {
      const o = (p.off[st.bone] || [0, 0]).slice();
      o[k] = Math.max(-64, Math.min(64, Math.round(Number(v)) || 0));
      if (o[0] || o[1]) p.off[st.bone] = o;
      else delete p.off[st.bone];
    });
    $2("#anOffX").addEventListener("change", (e) => setOff(0, e.target.value));
    $2("#anOffY").addEventListener("change", (e) => setOff(1, e.target.value));
    const setRoot = (k, v) => editPose((p) => {
      p.root[k] = Math.max(-MAX_ROOT, Math.min(MAX_ROOT, Math.round(Number(v)) || 0));
    });
    $2("#anRootX").addEventListener("change", (e) => setRoot(0, e.target.value));
    $2("#anRootY").addEventListener("change", (e) => setRoot(1, e.target.value));
    $2("#anPlay").addEventListener("click", () => st.playing ? stop() : play2());
    $2("#anOrder").addEventListener("change", (e) => {
      const v = e.target.value, id = st.bone;
      editPose((p) => {
        const o = { ...p.order || {} };
        if (v) o[id] = v;
        else delete o[id];
        if (Object.keys(o).length) p.order = o;
        else delete p.order;
      });
      msg(v ? `From frame ${st.frame + 1} until the next key, ${id} is drawn ${v === "front" ? "in front of" : "behind"} every part.` : `${id} follows the layer order of step 5 from frame ${st.frame + 1}.`);
    });
    $2("#anDrawing").addEventListener("change", (e) => editPose((p) => {
      const v = e.target.value;
      p.swap = { ...p.swap || {} };
      if (v) p.swap[st.bone] = v;
      else delete p.swap[st.bone];
      if (!Object.keys(p.swap).length) delete p.swap;
    }));
    $2("#anRerender").addEventListener("click", () => {
      const picked = [...$2("#anEdited").querySelectorAll("input:checked")].map((c) => Number(c.value));
      if (!picked.length) {
        msg("Tick the frames to re-render.");
        return;
      }
      rerender(st.name, picked);
      msg(`Re-rendered ${picked.length} frame${picked.length > 1 ? "s" : ""} from the rig; your hand edits on ${picked.length > 1 ? "them" : "it"} are gone (Undo in the frame editor brings them back).`);
      render();
    });
    $2("#anPrev").addEventListener("click", () => {
      stop();
      const a = anim2();
      st.frame = (st.frame - 1 + a.frames) % a.frames;
      render();
    });
    $2("#anNext").addEventListener("click", () => {
      stop();
      const a = anim2();
      st.frame = (st.frame + 1) % a.frames;
      render();
    });
    $2("#anOnion").addEventListener("change", () => drawPreview());
    $2("#anUndo").addEventListener("click", () => {
      if (!st.undo.length) return;
      const u = st.undo.pop();
      st.redo.push({ anims: anims(), name: st.name });
      apply_(u.anims, u.name);
    });
    $2("#anRedo").addEventListener("click", () => {
      if (!st.redo.length) return;
      const r = st.redo.pop();
      st.undo.push({ anims: anims(), name: st.name });
      apply_(r.anims, r.name);
    });
    return {
      refresh,
      // a new animation from elsewhere (Template Motion): one undo step here, then shown here
      add(name, a, note) {
        stop();
        st.frame = 0;
        commit(withAnim2(name, a), name, note);
      },
      select(name) {
        if (!anims()[name]) return;
        stop();
        st.name = name;
        st.frame = 0;
        render();
      },
      info() {
        const a = anim2();
        return {
          ready: !!(st.rest && st.rest.rig),
          names: Object.keys(anims()),
          name: st.name,
          frame: st.frame,
          bone: st.bone,
          playing: st.playing,
          anim: a ? JSON.parse(JSON.stringify(a)) : null,
          px: last ? last.px.slice() : null,
          made: last && last.made ? last.made.slice() : null,
          warnings: a ? jointWarnings(a).map((w2) => w2.text) : [],
          undo: st.undo.length,
          z: st.z
        };
      },
      sampled: (name) => anims()[name] ? sampleAnim(anims()[name]) : null
    };
  }


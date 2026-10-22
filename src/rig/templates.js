  // src/rig/templates.js
  var CATEGORIES = [
    { id: "movement", label: "Movement" },
    { id: "combat", label: "Combat" },
    { id: "reactions", label: "Reactions" },
    { id: "actions", label: "Actions" }
  ];
  var LEGS = ["thighL", "thighR", "shinL", "shinR"];
  var ARMS = ["upperArmL", "upperArmR", "forearmL", "forearmR"];
  var weaponSide = (rig) => {
    const h = rig.bones.weapon && rig.bones.weapon.parent;
    return h === "handL" ? "L" : h === "handR" ? "R" : null;
  };
  var TEMPLATES = [
    { id: "idle", preset: "idle", name: "Idle", category: "movement", description: "Standing and breathing: the upper body bobs, the arms sway a little.", requires: () => ["torso"] },
    { id: "walk", preset: "walk", name: "Walk", category: "movement", description: "A walk cycle on the spot: legs in opposite phase, arms swing against them, feet stay on the ground.", requires: () => LEGS },
    { id: "run", preset: "run", name: "Run", category: "movement", description: "Longer strides, bent arms, the body leaning in, both feet off the ground between steps.", requires: () => LEGS },
    { id: "sneak", preset: "sneak", name: "Sneak", category: "movement", description: "A slow, low walk on the spot: half-length steps on bent knees, leaning in, arms held up and forward.", requires: () => LEGS },
    { id: "jump", preset: "jump", name: "Jump", category: "movement", description: "Crouch, take off, tuck at the top, land. Rises only within the headroom above the head.", requires: () => LEGS },
    { id: "crouch", preset: "crouch", name: "Crouch", category: "movement", description: "Bends the knees and lowers the body, feet planted, arms forward for balance; holds the low pose.", requires: () => LEGS },
    {
      id: "attack",
      preset: "attack",
      name: "Sword attack",
      category: "combat",
      description: "The weapon arm swings back, over the top and down in front, with a small step and follow-through.",
      requires: (rig) => {
        const S = weaponSide(rig) || "R";
        return ["weapon", "upperArm" + S, "forearm" + S];
      },
      note: (rig) => weaponSide(rig) ? null : "The weapon must hang from a hand (step 5, rig)."
    },
    { id: "hurt", preset: "hurt", name: "Hurt", category: "reactions", description: "A hit: the first frame flashes white, the body recoils and recovers.", requires: () => ["torso", "head"] },
    { id: "death", preset: "death", name: "Death", category: "reactions", description: "Staggers, knees buckle, falls and lies on the ground; holds the last frame.", requires: () => ["torso"] },
    {
      id: "wave",
      preset: "wave",
      name: "Wave",
      category: "actions",
      description: "The free arm (not the weapon arm) held up, the forearm waving side to side.",
      requires: (rig) => {
        const S = weaponSide(rig) === "R" ? "L" : "R";
        return ["upperArm" + S, "forearm" + S];
      }
    },
    // library v2 (phase U7): top-down and side-scroller motions, each with a side and a front view
    { id: "block", preset: "block", name: "Block", category: "combat", description: "The arms come up in front of the face, the knees give, the body takes the hit and holds the guard.", requires: () => ARMS },
    { id: "punch", preset: "punch", name: "Punch", category: "combat", description: "An attack without a weapon: the free arm guards the face, the other winds back, jabs forwards with a lean and a small step, and comes back.", requires: () => ARMS },
    { id: "cast", preset: "cast", name: "Cast", category: "combat", description: "Both arms draw back, rise and thrust forwards (from the front: up, then out to the sides), with a lean into it.", requires: () => ARMS },
    { id: "bow", preset: "bow", name: "Bow shot", category: "combat", description: "The bow arm holds out at shoulder height, the other draws to the face, holds, lets go and comes down.", requires: () => ARMS },
    { id: "climb", preset: "climb", name: "Climb", category: "movement", description: "On the spot: one arm reaches up while the other pulls, the opposite knee comes up. Feet leave the ground.", requires: () => [...ARMS, ...LEGS] },
    { id: "push", preset: "push", name: "Push", category: "movement", description: "Leaning hard into something ahead, arms forward at shoulder height, short slow steps.", requires: () => [...ARMS, ...LEGS] },
    { id: "roll", preset: "roll", name: "Dodge roll", category: "movement", description: "Tucks, turns the whole body once around its feet (forwards, or sideways from the front) and comes up in the same place.", requires: () => ["torso"] },
    { id: "slide", preset: "slide", name: "Slide", category: "movement", description: "Drops low, front leg out ahead, back leg folded under, leaning back; holds and gets up.", requires: () => LEGS },
    { id: "sit", preset: "sit", name: "Sit", category: "actions", description: "Sits on a seat that is not drawn: thighs level, shins down, hands on the knees; holds.", requires: () => LEGS },
    { id: "victory", preset: "victory", name: "Victory", category: "actions", description: "Both arms thrown up, a small hop inside the headroom, a fist pump.", requires: () => ARMS },
    // V4: top-down motions after SLYNYRD (Pixelblog 55)
    { id: "run_topdown", preset: "runTopDown", name: "Run (top-down, 6 frames)", category: "movement", description: "A top-down run: per stride the body sinks 1 px, 1 px more, then springs up 2 px at once; legs and arms in opposite phase.", requires: () => LEGS },
    { id: "idle_held", preset: "idleHeld", name: "Idle (held extremes)", category: "movement", description: "A breath whose up and down poses each last two frames, the moves between them one.", requires: () => ["torso"] },
    { id: "hair_bounce", preset: "hairBounce", name: "Hair bounce", category: "actions", description: "A light step on the spot: the head, with its hair, settles 1 px late on frames 2 and 4.", requires: () => ["head"] }
  ];
  var templateById = (id) => TEMPLATES.find((t) => t.id === id) || null;
  function templateDefaults(t, rig) {
    const raw = PRESETS[t.preset](rig, "right");
    return { frames: raw.frames, fps: raw.fps, loop: raw.loop };
  }
  function checkTemplate(t, rig, present) {
    const marked = present.marked || /* @__PURE__ */ new Set();
    const moves2 = (id, seen = /* @__PURE__ */ new Set()) => present(id) || !marked.has(id) && Object.entries(rig.bones).some(([c, b]) => b.parent === id && !seen.has(c) && (seen.add(c), moves2(c, seen)));
    const missing = t.requires(rig).filter((id) => !rig.bones[id] || !moves2(id));
    const extra = t.note ? t.note(rig) : null;
    const reason = missing.length ? `Needs ${missing.map(jointName).join(", ")} (part${missing.length > 1 ? "s" : ""} missing or empty in step 5).` : extra;
    return { ok: !missing.length && !extra, missing, reason };
  }
  function presentParts(rest, layers) {
    const missing = new Set((rest.seg.parts || []).filter((p) => p.missing).map((p) => p.id));
    const fn = (id) => !missing.has(id) && !!(layers && layers.layers[id] && layers.layers[id].ts.length);
    fn.marked = missing;
    return fn;
  }
  // frames: a preset that can build itself at that frame count (walk) does; the others are retimed after
  function fittedPreset(rest, layers, kind, facing, out = {}, frames = 0) {
    const info = bodyInfo(rest), raw = PRESETS[kind](rest.rig, facing, info, frames);
    Object.assign(out, { reach: 1, grip: "swing", cut: 0 });
    if (!layers) {
      const { ground, air, reach, centre, bob, ...plain } = raw;
      const keys = bob ? plain.keys.map((k) => ({ ...k, pose: { ...k.pose, off: { ...k.pose.off, ...bob[k.t] ? { torso: [0, bob[k.t] * 4] } : {} } } })) : plain.keys;
      return { ...plain, keys, smooth: true };
    }
    const render = (p) => renderRig(layers, rest.rig, p, { N: rest.N, palette: rest.palette, settings: rest.settings || void 0 });
    return { ...fitPreset(raw, render, info, out, raw.reach ? frameJudge(rest, render, [...raw.reach.bones, ...raw.reach.parts, ...raw.reach.grip ? [raw.reach.grip] : []]) : null), smooth: true };
  }
  function frameJudge(rest, render, movers = null) {
    const ctx = rigContext({ rest, rig: rest.rig, render }), mv = movers ? new Set(movers) : new Set(Object.keys(rest.rig.bones));
    const owner = (r) => r.stats.owner || [], before = apartPieces(ctx.base.px, owner(ctx.base), rest.N, mv);
    const kinds = (pose2) => {
      const r = render(pose2), f = poseFindings(ctx, r, pose2, ""), out = [];
      if (Object.keys(r.stats.clipped || {}).some((id) => mv.has(id))) out.push("clipped");
      if (f.some((x) => x.code === "joint-gap" && mv.has(x.part))) out.push("gap");
      if (apartPieces(r.px, owner(r), rest.N, mv) > before) out.push("apart");
      return out;
    };
    const judge = (anim2) => sampleAnim(anim2).reduce((n, { pose: pose2 }) => n + (kinds(pose2).length ? 1 : 0), 0);
    judge.detail = (anim2) => {
      const d = { clipped: [], gap: [], apart: [] };
      sampleAnim(anim2).forEach(({ pose: pose2 }, i) => {
        for (const k of kinds(pose2)) d[k].push(i + 1);
      });
      return d;
    };
    return judge;
  }
  function buildTemplate(t, rest, layers, { facing = "right", fps, loop, frames } = {}, out = {}) {
    const a = fittedPreset(rest, layers, t.preset, facing, out, frames), b = { ...a, fps: fps ?? a.fps, loop: loop ?? a.loop };
    return frames ? retime(b, frames) : b;
  }
  function reachNote(out) {
    const pc = Math.round(out.reach * 100), r = out.reason;
    if (out.cut && out.left) {
      const fr = (l) => `frame${l.length > 1 ? "s" : ""} ${l.length > 1 ? l.slice(0, -1).join(", ") + " and " + l[l.length - 1] : l[0]}`, L = out.left, what = [];
      if (L.clipped.length) what.push(`part of it is cut off at the frame edge (${fr(L.clipped)})`);
      if (L.gap.length) what.push(`a gap opens at a joint (${fr(L.gap)})`);
      if (L.apart.length) what.push(`the arm or the weapon comes away from the body (${fr(L.apart)})`);
      const how = out.grip === "steady" ? `held at its drawn angle (${pc}% of the arc)` : `with ${pc}% of the swing`;
      return `${r && r.weapon ? `The weapon is long: even ${how}` : `Even ${how}`}, ${what.join("; ")}. ${L.apart.length ? "Check those frames and edit their keys, or give the sprite more room in step 3." : "The frame check lists them. Give the sprite more room in step 3, or edit the keys."}`;
    }
    if (out.prefer === "steady" && out.grip === "steady" && out.reach === 1 && !out.cut) return "The weapon is held at its drawn angle while the arms swing.";
    if (r && !r.weapon) {
      if (out.grip === "steady") return `At the full swing ${r.frames} frame${r.frames > 1 ? "s" : ""} came apart or opened a gap at a joint, so the weapon is held at its drawn angle while the arm moves (${pc}% of the arc): every frame passes the frame check.`;
      if (out.reach < 1) return `At the full swing ${r.frames} frame${r.frames > 1 ? "s" : ""} came apart or opened a gap at a joint, so the swing uses ${pc}% of the full arc: every frame passes the frame check.`;
      return "";
    }
    if (out.cut) return `The weapon is long: even ${out.grip === "steady" ? `held at its drawn angle (${pc}% of the arc)` : `with ${pc}% of the swing`}, part of it is cut off at the frame edge (see the frame check). Give the sprite more room in step 3, or edit the keys.`;
    if (out.grip === "steady") return `The weapon is long: it is held at its drawn angle while the arm moves (${pc}% of the arc), so it stays inside the frame.`;
    if (out.reach < 1) return `The weapon is long: the swing uses ${pc}% of the full arc, so it stays inside the frame.`;
    return "";
  }
  function freeName(base, taken) {
    if (!taken.includes(base)) return base;
    for (let i = 2; ; i++) if (!taken.includes(base + i)) return base + i;
  }


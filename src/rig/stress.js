  // src/rig/stress.js
  var holderSide = (rig) => {
    const h = rig.bones.weapon && rig.bones.weapon.parent;
    return h === "handL" ? "L" : h === "handR" ? "R" : null;
  };
  var STRESS_POSES = [
    { id: "arms-up", name: "Arms raised", rot: () => ({ upperArmL: 150, upperArmR: -150, forearmL: 20, forearmR: -20 }) },
    { id: "arms-forward", name: "Arms swung one way", rot: () => ({ upperArmL: -80, upperArmR: -80, forearmL: -30, forearmR: -30 }) },
    { id: "arms-back", name: "Arms swung the other way", rot: () => ({ upperArmL: 70, upperArmR: 70, forearmL: 30, forearmR: 30 }) },
    { id: "arms-across", name: "Arms across the body", rot: () => ({ upperArmL: -50, upperArmR: 50, forearmL: -70, forearmR: 70 }) },
    { id: "elbows", name: "Elbows bent hard", rot: () => ({ forearmL: 120, forearmR: -120, handL: 30, handR: -30 }) },
    { id: "kick", name: "High kick", rot: () => ({ thighR: -80, shinR: 10, footR: 20 }) },
    { id: "split", name: "Legs wide apart", rot: () => ({ thighL: 40, thighR: -40 }) },
    { id: "crouch", name: "Deep knee bend", rot: () => ({ thighL: -60, thighR: -60, shinL: 100, shinR: 100, footL: -40, footR: -40, torso: 15 }) },
    { id: "lean-a", name: "Torso leaning one way", rot: () => ({ torso: 25, head: -10 }) },
    { id: "lean-b", name: "Torso leaning the other way", rot: () => ({ torso: -25, head: 10 }) },
    { id: "head", name: "Head turned", rot: () => ({ head: 30 }) },
    { id: "weapon-up", name: "Weapon arm raised", rot: (rig) => {
      const S = holderSide(rig) || "R";
      return { ["upperArm" + S]: S === "R" ? -150 : 150, ["forearm" + S]: S === "R" ? -30 : 30, ["hand" + S]: S === "R" ? -20 : 20 };
    } }
  ];
  var stressById = (id) => STRESS_POSES.find((p) => p.id === id) || null;
  function stressPose(def, rig) {
    const rot = Object.fromEntries(Object.entries(def.rot(rig)).filter(([id]) => rig.bones[id]));
    return { rot, off: {}, root: [0, 0], smooth: true };
  }
  var ARM = /^(upperArm|forearm|hand)[LR]$/;
  function touch(owner, N, a, b) {
    for (let i = 0; i < owner.length; i++) {
      if (owner[i] !== a) continue;
      const x = i % N;
      for (const u of [x > 0 ? i - 1 : -1, x < N - 1 ? i + 1 : -1, i - N, i + N]) if (u >= 0 && u < owner.length && owner[u] === b) return true;
    }
    return false;
  }
  var moves = (rig, pose2, id) => {
    for (let b = id, k = 0; b && k < 32; b = rig.bones[b] && rig.bones[b].parent, k++) if (pose2.rot[b]) return true;
    return false;
  };
  function stressCheck({ rest, layers, def }) {
    const rig = rest.rig, N = rest.N, opts2 = { N, palette: rest.palette, settings: rest.settings || void 0 };
    const render = (p) => renderRig(layers, rig, p, opts2);
    const ctx = rigContext({ rest, rig, render }), pose2 = stressPose(def, rig), r = render(pose2), label = def.name;
    const findings = poseFindings(ctx, r, pose2, label), add = (level, code, message) => findings.push({ level, code, message });
    const owner = r.stats.owner, restOwner = ctx.base.stats.owner, drawn = (id) => !!(layers.layers[id] && layers.layers[id].ts.length);
    const holder = rig.bones.weapon && rig.bones.weapon.parent;
    if (drawn("weapon") && !/^hand[LR]$/.test(holder || "")) for (const h of ["handR", "handL"]) {
      if (!drawn(h) || !touch(restOwner, N, "weapon", h) || !moves(rig, pose2, h) || moves(rig, pose2, "weapon") || touch(owner, N, "weapon", h)) continue;
      add("warning", "weapon-off", `${label}: the weapon stays put while ${h} moves away from it: it hangs from ${holder || "nothing (the whole body)"}. If it is held in that hand, choose ${h} under "weapon held in" in step 5.`);
      break;
    }
    for (const [id, b] of Object.entries(rig.bones)) {
      const dp = defaultParent(rest.seg, id);
      if (!dp || dp === b.parent || !drawn(id) || !drawn(dp) || id === "weapon") continue;
      if (touch(restOwner, N, id, dp) && moves(rig, pose2, dp) !== moves(rig, pose2, id) && !touch(owner, N, id, dp))
        add("warning", "came-apart", `${label}: ${id} comes away from ${dp}, which it touches at rest, because it hangs from ${b.parent || "nothing (the whole body)"}. If it belongs to ${dp}, choose ${dp} under "moves with" in step 5.`);
    }
    const order2 = rig.order, swapped = (a, b) => {
      const o = order2.filter((x) => x !== a), k = o.indexOf(b);
      o.splice(order2.indexOf(a) < order2.indexOf(b) ? k + 1 : k, 0, a);
      return { ...rig, order: o };
    };
    const pairs = [...Object.keys(rig.bones).filter((id) => ARM.test(id) || id === "weapon").map((id) => [id, "torso"]), ["thighL", "thighR"], ["shinL", "shinR"]];
    for (const [a, b] of pairs) {
      if (!drawn(a) || !drawn(b) || !order2.includes(a) || !order2.includes(b) || !(moves(rig, pose2, a) || moves(rig, pose2, b))) continue;
      const alt = renderRig(layers, swapped(a, b), pose2, opts2);
      if (alt.px.some((c, i) => c !== r.px[i])) {
        const front = order2.indexOf(a) > order2.indexOf(b);
        add("info", "order", `${label}: ${a} crosses ${b} and is drawn ${front ? "in front of" : "behind"} it. If it should pass ${front ? "behind" : "in front"}, set its draw order to "${front ? "behind every part" : "in front of every part"}" on that key in step 6 (or change the layer order in step 5 for every frame).`);
      }
    }
    return { pose: pose2, render: r, findings };
  }
  var stressAll = ({ rest, layers }) => STRESS_POSES.map((def) => {
    const c = stressCheck({ rest, layers, def });
    return { id: def.id, name: def.name, warnings: c.findings.filter((f) => f.level === "warning").length, notes: c.findings.filter((f) => f.level === "info").length, findings: c.findings };
  });


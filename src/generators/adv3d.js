  // src/generators/adv3d.js
  // V7.2 (preview): the Adventurer as a small 3D figure rendered to pixel art. The body is built from
  // signed-distance shapes (rounded cones for limbs, ellipsoids for head and chest, cone shells for robes
  // and capes), seen by an orthographic camera tilted slightly down. Each of the 8 directions is a real
  // view (the figure turns; nothing is mirrored), lit from the upper left of the screen, reduced to 5
  // tones per material, with dark lines where a part passes in front of another. 48 px.
  var A3_N = 48;
  var A3_YAW = { S: 0, SE: 45, E: 90, NE: 135, N: 180, NW: -135, W: -90, SW: -45 };
  var A3_TILT = 22 * Math.PI / 180;
  // ---- vectors and distance functions (after Inigo Quilez's formulas)
  const vSub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const vDot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const vLen = (a) => Math.hypot(a[0], a[1], a[2]);
  const vNorm = (a) => {
    const l = vLen(a) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  };
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  function sdEllipsoid(p, c, r) {
    const q = [(p[0] - c[0]) / r[0], (p[1] - c[1]) / r[1], (p[2] - c[2]) / r[2]];
    const k0 = vLen(q), k1 = Math.hypot(q[0] / r[0], q[1] / r[1], q[2] / r[2]);
    return k1 === 0 ? -Math.min(...r) : k0 * (k0 - 1) / k1;
  }
  // a rounded cone between points a (radius ra) and b (radius rb): limbs, robes, staffs
  function sdCone(p, a, b, ra, rb) {
    const ba = vSub(b, a), pa = vSub(p, a), l2 = vDot(ba, ba);
    const h = clamp01(vDot(pa, ba) / l2), r = ra + (rb - ra) * h;
    return vLen([pa[0] - ba[0] * h, pa[1] - ba[1] * h, pa[2] - ba[2] * h]) - r;
  }
  function sdBox(p, c, hw, round = 0) {
    const q = [Math.abs(p[0] - c[0]) - hw[0] + round, Math.abs(p[1] - c[1]) - hw[1] + round, Math.abs(p[2] - c[2]) - hw[2] + round];
    return vLen([Math.max(q[0], 0), Math.max(q[1], 0), Math.max(q[2], 0)]) + Math.min(Math.max(q[0], q[1], q[2]), 0) - round;
  }
  // ---- materials: 5 tones, from deepest shadow to glint
  function a3Mat(h, s, l, kind = "matte") {
    const r = ramp(h, s, l);
    return { kind, tones: [mix(r.sh2, "#000000", 0.2), r.sh, r.base, r.hi, kind === "metal" ? mix(r.hi2, "#ffffff", 0.5) : r.hi2] };
  }
  var A3_CLASSES = { fighter: "Fighter", wizard: "Wizard", druid: "Druid" };
  // ---- shapes with a bounding sphere b = [x, y, z, r] (the renderer skips a shape whose sphere is
  // farther away than the nearest surface found so far)
  const A3 = {
    cone: (a, b, ra, rb) => ({ d: (p) => sdCone(p, a, b, ra, rb), b: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, vLen(vSub(a, b)) / 2 + Math.max(ra, rb)] }),
    ell: (c, r) => ({ d: (p) => sdEllipsoid(p, c, r), b: [...c, Math.max(...r)] }),
    box: (c, hw, round = 0) => ({ d: (p) => sdBox(p, c, hw, round), b: [...c, vLen(hw)] }),
    // an upright cylinder with flat ends (bands, hems)
    cyl: (c, r, h) => ({ d: (p) => Math.max(Math.hypot(p[0] - c[0], p[2] - c[2]) - r, Math.abs(p[1] - c[1]) - h), b: [...c, Math.hypot(r, h)] }),
    union: (...list) => {
      const c = [0, 1, 2].map((k) => list.reduce((t, s) => t + s.b[k], 0) / list.length);
      return { d: (p) => Math.min(...list.map((s) => s.d(p))), b: [...c, Math.max(...list.map((s) => vLen(vSub(c, s.b)) + s.b[3]))] };
    },
    // a shape with its own distance function inside a given sphere
    custom: (b, d) => ({ d, b })
  };
  // ---- the figure: a list of shapes {part, mat, d, b}; character space: y up from the soles, the
  // figure faces +z, its right hand is at -x
  function a3Figure(cls, colourSeed) {
    const rc = seedRng("a3:" + colourSeed), skinT = rc.pick(SKIN);
    const flat = (c) => ({ kind: "flat", tones: Array(5).fill(c) });
    const M = {
      skin: { kind: "skin", tones: [mix(skinT[2], "#000000", 0.3), skinT[2], skinT[1], skinT[0], mix(skinT[0], "#ffffff", 0.25)] },
      hair: a3Mat(rc.pick([28, 22, 40, 8]), rc.range(35, 55), rc.pick([26, 34, 46])),
      white: a3Mat(40, 10, 84),
      eye: flat(rc.pick(["#2b1d16", "#1d3550", "#25401f"])),
      eyeWhite: flat("#f2ede4"),
      lip: flat(mix(skinT[2], "#6a2424", 0.45)),
      brow: flat(mix(skinT[2], "#000000", 0.55)),
      metal: a3Mat(215, 10, 60, "metal"),
      dark: a3Mat(220, 12, 32, "metal"),
      gold: a3Mat(44, 75, 50, "metal"),
      leather: a3Mat(28, 42, 34),
      boot: a3Mat(24, 32, 24),
      wood: a3Mat(30, 42, 34),
      pants: a3Mat(rc() * 360, 16, 26),
      leaf: a3Mat(110, 55, 42)
    };
    const cloth = cls === "fighter" ? a3Mat(rc.pick([355, 215, 275, 5]), 62, 38) : cls === "wizard" ? a3Mat(rc.pick([228, 262, 205]), 58, 42) : a3Mat(rc.pick([105, 95, 125]), 36, 36);
    M.cloth = { ...cloth, kind: "cloth" };
    M.glow = { kind: "glow", tones: a3Mat(rc.pick([195, 205, 285]), 90, 62, "metal").tones };
    const P = [], add = (part, mat, s) => P.push({ part, mat, d: s.d, b: s.b });
    const plate = cls === "fighter", robe = cls === "wizard", druid = cls === "druid";
    for (const s of ["R", "L"]) {
      const X = (x) => (s === "R" ? -1 : 1) * x;
      const J = { shoulder: [X(7.6), 31.2, 0], elbow: [X(8.4), 24.6, 0.4], wrist: [X(8.7), 18.8, 0.9], hand: [X(8.8), 17, 1.1], hip: [X(3), 19.6, 0], knee: [X(3.2), 10.8, 0.4], ankle: [X(3.2), 2.6, 0], foot: [X(3.2), 1.3, 1.1] };
      add("upperArm" + s, plate || robe ? (plate ? M.metal : M.cloth) : M.cloth, A3.cone(J.shoulder, J.elbow, 2.6, 2.2));
      add("forearm" + s, plate ? M.metal : robe ? M.cloth : M.leather, robe ? A3.cone(J.elbow, [J.wrist[0], J.wrist[1] - 0.3, J.wrist[2]], 2.2, 3) : A3.cone(J.elbow, J.wrist, 2.2, 1.8));
      add("hand" + s, plate ? M.metal : M.skin, A3.ell(J.hand, [1.7, 2, 1.6]));
      add("thigh" + s, M.pants, A3.cone(J.hip, J.knee, 3, 2.4));
      add("shin" + s, plate ? M.metal : M.boot, A3.cone(J.knee, J.ankle, 2.4, 1.85));
      add("foot" + s, plate ? M.metal : M.boot, A3.box(J.foot, [1.85, 1.3, 2.9], 0.75));
      if (!plate) add("shin" + s, M.boot, A3.cyl([J.knee[0], J.knee[1] - 1.6, J.knee[2] * 0.6], 2.55, 0.8));
      if (plate) {
        add("upperArm" + s, M.metal, A3.ell([J.shoulder[0], J.shoulder[1] + 0.7, J.shoulder[2]], [3.4, 2.7, 3.3]));
        add("shin" + s, M.metal, A3.ell([J.knee[0], J.knee[1], J.knee[2] + 1.3], [1.9, 1.7, 1.4]));
        add("forearm" + s, M.metal, A3.cyl([J.wrist[0], J.wrist[1] + 1, J.wrist[2]], 2.1, 0.7));
      } else add("forearm" + s, robe ? M.gold : M.boot, A3.cyl([J.wrist[0], J.wrist[1] + (robe ? 0.2 : 1.3), J.wrist[2]], robe ? 3.05 : 2, 0.6));
    }
    add("pelvis", plate ? M.cloth : robe ? M.cloth : M.leather, A3.ell([0, 20.6, 0], [6, 3.6, 3.8]));
    add("torso", plate ? M.metal : robe ? M.cloth : M.leather, A3.union(A3.ell([0, 28.6, 0], [7.3, 5.4, 4.3]), A3.ell([0, 23.6, 0], [5.9, 3.6, 3.7])));
    add("pelvis", plate ? M.dark : robe ? M.gold : M.boot, A3.cyl([0, 22.3, 0], 6.15, 0.7));
    add("head", M.skin, A3.cone([0, 32.5, -0.2], [0, 35.5, 0], 2.2, 2.1));
    // the head: skull, ears, nose, eyes (white and iris), brows, mouth
    add("head", M.skin, A3.ell([0, 39.4, 0.2], [5.5, 6.1, 5.6]));
    for (const k of [1, -1]) {
      add("head", M.skin, A3.ell([5.4 * k, 39.1, 0], [0.8, 1.5, 1.1]));
    }
    add("head", M.skin, A3.ell([0, 37.9, 5.6], [0.85, 1.2, 0.95]));
    const hair = (low) => A3.custom([0, 40, 0, 7], (p) => {
      // a cap over the skull: down to the brows in front, to `low` at the back
      const front = clamp01(p[2] / 3.5), thr = low + (41.9 - low) * front;
      return Math.max(sdEllipsoid(p, [0, 39.9, -0.2], [5.85, 6.35, 5.95]), (thr - p[1]) * 0.6);
    });
    // ---- class gear and clothing
    if (cls === "fighter") {
      // an open helmet with a nose guard and a plume; plate with a tabard and a gold boss; a cape; a longsword
      // a shell (not a solid), so the face shows through its opening
      add("head", M.metal, A3.custom([0, 40, 0, 7.5], (p) => Math.max(sdEllipsoid(p, [0, 40, -0.1], [6.2, 6.8, 6.3]), -sdEllipsoid(p, [0, 40, -0.1], [5.7, 6.3, 5.8]), -sdBox(p, [0, 38.2, 5], [3.6, 3.6, 3.4], 0.8), 33.6 - p[1])));
      add("head", M.metal, A3.box([0, 40.2, 6.05], [0.4, 1.9, 0.45], 0.2));
      add("head", M.dark, A3.cyl([0, 41.9, -0.1], 6.3, 0.45));
      add("head", M.cloth, A3.union(A3.cone([0, 46.2, 0.6], [0, 46.6, -3.4], 1.55, 1.25), A3.cone([0, 46.6, -3.4], [0, 44.4, -6], 1.25, 0.8)));
      add("torso", M.cloth, A3.box([0, 23.6, 4.25], [2.3, 6.4, 0.6], 0.3));
      add("pelvis", M.cloth, A3.box([0, 16.4, 3.95], [2.3, 3.9, 0.5], 0.3));
      add("torso", M.gold, A3.ell([0, 26, 4.95], [1.1, 1.3, 0.45]));
      add("cloak", M.cloth, A3.custom([0, 17, -2, 14], (p) => capeD(p, 31.5, 6.2, 9.8, -2.2)));
      add("weapon", M.metal, A3.cone([-9.6, 18.8, 2.6], [-15.2, 33.4, 4], 1, 0.6));
      add("weapon", M.gold, A3.cone([-7.4, 18.7, 1.6], [-11.6, 17.3, 3.4], 0.6, 0.6));
      add("weapon", M.leather, A3.cone([-9, 17.4, 1.6], [-8.3, 15.3, 1], 0.6, 0.6));
      add("weapon", M.gold, A3.ell([-8.1, 14.8, 0.9], [0.85, 0.85, 0.85]));
    } else if (cls === "wizard") {
      // a pointed hat with a broad brim and a gold band, white hair and a long beard below the mouth,
      // a robe to the ankles with a gold hem, an orb staff
      add("head", M.white, hair(33.5));
      add("head", M.white, A3.cone([0, 34.6, 4.6], [0, 26.2, 5.8], 3.3, 0.6));
      add("head", M.white, A3.ell([0, 36, -2.6], [5.3, 6.5, 3]));
      add("head", M.cloth, A3.cyl([0, 44.2, 0], 9.6, 0.55));
      add("head", M.cloth, A3.union(A3.cone([0, 44.4, 0], [-0.6, 48, -1.4], 5.5, 2.5), A3.cone([-0.6, 48, -1.4], [-1.9, 50, -4.6], 2.5, 0.5)));
      add("head", M.gold, A3.cyl([0, 45.3, 0], 5.6, 0.55));
      add("robe", M.cloth, A3.custom([0, 13, 0.4, 14], (p) => clothD(sdCone(p, [0, 24, 0.2], [0, 1.6, 0.6], 6.4, 9.6), p, 0.35)));
      add("robe", M.gold, A3.custom([0, 2, 0.6, 10.5], (p) => Math.max(sdCone(p, [0, 24, 0.2], [0, 1.6, 0.6], 6.55, 9.75), Math.abs(p[1] - 2.3) - 0.7)));
      add("torso", M.gold, A3.box([0, 26.2, 4.35], [0.55, 6, 0.45], 0.2));
      add("weapon", M.wood, A3.cone([-10.6, 0.6, 1.4], [-10.6, 46, 1.4], 0.9, 0.8));
      add("weapon", M.glow, A3.ell([-10.6, 48, 1.4], [2.1, 2.1, 2.1]));
      add("weapon", M.gold, A3.cyl([-10.6, 45.8, 1.4], 1.3, 0.6));
    } else {
      // an antlered hood with a wide opening, a cloak around the shoulders, a leather tunic with a strap
      // and a pouch, a crook staff with leaves
      add("head", M.hair, hair(35));
      add("head", M.hair, A3.cone([0, 35.4, 4.7], [0, 33.4, 5.2], 3.2, 2));
      add("head", M.cloth, A3.custom([0, 37, -1, 10], (p) => {
        const shell = Math.max(sdEllipsoid(p, [0, 40.2, -0.7], [6.7, 7.1, 6.9]), -sdEllipsoid(p, [0, 40.2, -0.7], [5.95, 6.4, 6.2]));
        const open = sdEllipsoid(p, [0, 38.8, 5.4], [4.6, 5.4, 4.6]);
        return Math.max(Math.min(shell, sdCone(p, [0, 35, -1.4], [0, 31.4, -2], 6.4, 8.2) + 0.2), -open, 30 - p[1]);
      }));
      for (const k of [1, -1]) add("head", M.white, A3.union(A3.cone([3.6 * k, 45.2, -0.4], [6.6 * k, 49.4, -1], 0.6, 0.45), A3.cone([5.2 * k, 47.4, -0.7], [4.4 * k, 50, -0.6], 0.45, 0.4), A3.cone([6.6 * k, 49.4, -1], [8.8 * k, 49.6, -1.4], 0.45, 0.4)));
      add("cloak", M.cloth, A3.custom([0, 17, -1, 14], (p) => capeD(p, 32, 7.4, 10.4, 0.6)));
      add("torso", M.boot, A3.cone([5.8, 32, 3.9], [-5.8, 21, 4.3], 0.6, 0.6));
      add("pelvis", M.leather, A3.ell([4.6, 19.4, 3.3], [1.6, 1.9, 1.2]));
      add("weapon", M.wood, A3.union(A3.cone([-10.6, 0.6, 1.4], [-10.4, 44, 1.4], 0.9, 0.85), A3.cone([-10.4, 44, 1.4], [-11.6, 47.6, 1.4], 0.85, 0.75), A3.cone([-11.6, 47.6, 1.4], [-13.8, 48, 1.4], 0.75, 0.65), A3.cone([-13.8, 48, 1.4], [-14.4, 45.6, 1.4], 0.65, 0.6)));
      add("weapon", M.leaf, A3.union(A3.ell([-10, 44.6, 2.4], [1.1, 0.7, 0.9]), A3.ell([-11.2, 43.4, 0.4], [1, 0.7, 0.9])));
    }
    const iris = M.eye.tones[0];
    return { parts: P, M, face: { white: "#f2ede4", iris, irisDark: mix(iris, "#000000", 0.45), brow: cls === "wizard" ? M.white.tones[1] : mix(M.hair.tones[1], "#000000", 0.25), lip: M.lip.tones[0] } };
  }
  // a fold ripple on cloth: a small sine around the vertical axis, stronger towards the hem
  function clothD(d, p, amp) {
    const a = Math.atan2(p[0], p[2]), down = clamp01((24 - p[1]) / 22);
    return d + Math.sin(a * 9) * amp * down;
  }
  // a cape or cloak: a thin shell of a cone from the shoulders down, open in front of `front` (z)
  function capeD(p, top, rTop, rHem, front) {
    const shell = Math.abs(sdCone(p, [0, top, -1.2], [0, 3, -2.6], rTop, rHem)) - 0.55;
    return clothD(Math.max(shell, p[2] - front, p[1] - top - 1.2), p, 0.45);
  }
  // ---- render one direction
  function a3Render(fig, dir) {
    const N = A3_N, yaw = A3_YAW[dir] * Math.PI / 180, cy = Math.cos(yaw), sy = Math.sin(yaw);
    const ct = Math.cos(A3_TILT), st = Math.sin(A3_TILT);
    // camera: screen x = world x, screen up = (0, cos t, -sin t), towards the viewer = (0, sin t, cos t)
    const toLocal = (w) => [w[0] * cy - w[2] * sy, w[1], w[0] * sy + w[2] * cy];
    const scene = (q) => {
      let best = Infinity, hit = null;
      for (const pr of fig.parts) {
        const b = pr.b, db = Math.hypot(q[0] - b[0], q[1] - b[1], q[2] - b[2]) - b[3];
        if (db > best) continue;
        const d = pr.d(q);
        if (d < best) {
          best = d;
          hit = pr;
        }
      }
      return [best, hit];
    };
    const L = vNorm([-0.55, 0.62, 0.56]), V = [0, 0, 1];
    const SS = 2, cells = [];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const samples = [];
      for (let a = 0; a < SS; a++) for (let b = 0; b < SS; b++) {
        const sx = i + (a + 0.5) / SS - N / 2, syv = N - 1.6 - (j + (b + 0.5) / SS);
        // a point far towards the viewer on this pixel's ray, then march away from the viewer
        let w = [sx, syv * ct + 60 * st, -syv * st + 60 * ct], t = 0, res = null;
        const dir2 = [0, -st, -ct];
        // start where the ray enters the figure's sphere (centre at hip height), or skip it
        {
          const oc = [w[0], w[1] - 24, w[2]], bq = vDot(oc, dir2), cq = vDot(oc, oc) - 31 * 31, disc = bq * bq - cq;
          if (disc < 0) continue;
          const t0 = Math.max(0, -bq - Math.sqrt(disc));
          w = [w[0], w[1] + dir2[1] * t0, w[2] + dir2[2] * t0];
          t = t0;
        }
        for (let k = 0; k < 90; k++) {
          const q = toLocal(w), [d, pr] = scene(q);
          if (d < 0.04) {
            res = { pr, q, t };
            break;
          }
          t += Math.max(d * 0.9, 0.05);
          w = [w[0], w[1] + dir2[1] * Math.max(d * 0.9, 0.05), w[2] + dir2[2] * Math.max(d * 0.9, 0.05)];
          if (t > 130) break;
        }
        if (!res) continue;
        // the normal of the shape that was hit, turned into camera space
        const e = 0.05, f = res.pr.d, q = res.q;
        const nl = vNorm([f([q[0] + e, q[1], q[2]]) - f([q[0] - e, q[1], q[2]]), f([q[0], q[1] + e, q[2]]) - f([q[0], q[1] - e, q[2]]), f([q[0], q[1], q[2] + e]) - f([q[0], q[1], q[2] - e])]);
        const nw = [nl[0] * cy + nl[2] * sy, nl[1], -nl[0] * sy + nl[2] * cy];
        const n = [nw[0], nw[1] * ct - nw[2] * st, nw[1] * st + nw[2] * ct];
        const m = res.pr.mat, lam = Math.max(0, vDot(n, L));
        let v = 0.18 + 0.82 * lam;
        if (m.kind === "metal") {
          const r = [2 * vDot(n, L) * n[0] - L[0], 2 * vDot(n, L) * n[1] - L[1], 2 * vDot(n, L) * n[2] - L[2]], spec = Math.pow(Math.max(0, vDot(r, V)), 14);
          v = 0.08 + 0.85 * lam + (spec > 0.45 ? 0.5 : 0);
        }
        if (m.kind === "glow") v = 0.62 + 0.5 * lam;
        if (m.kind === "skin") v = 0.32 + 0.72 * lam;
        const tone = v < 0.3 ? 0 : v < 0.5 ? 1 : v < 0.74 ? 2 : v < 0.93 ? 3 : 4;
        samples.push({ part: res.pr.part, mat: m, tone, depth: res.t });
      }
      if (samples.length < 2) {
        cells.push(null);
        continue;
      }
      // the pixel takes the part seen most; its tone is the middle of that part's samples
      const count = {};
      for (const s of samples) count[s.part] = (count[s.part] || 0) + 1;
      const part = Object.keys(count).sort((a, b) => count[b] - count[a])[0], mine = samples.filter((s) => s.part === part);
      const mats = new Map();
      for (const s of mine) mats.set(s.mat, (mats.get(s.mat) || 0) + 1);
      const mat = [...mats].sort((a, b) => b[1] - a[1])[0][0], tones = mine.filter((s) => s.mat === mat).map((s) => s.tone).sort((a, b) => a - b);
      cells.push({ part, mat, tone: tones[tones.length >> 1], depth: mine.reduce((t, s) => t + s.depth, 0) / mine.length });
    }
    // dark lines: where a part passes in front of another (much deeper behind it), its edge darkens
    const out = cells.map((c) => c && { ...c });
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const c = cells[j * N + i];
      if (!c) continue;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const I = i + di, J = j + dj, o = I >= 0 && J >= 0 && I < N && J < N ? cells[J * N + I] : null;
        if (o && o.part !== c.part && o.depth > c.depth + 1) out[j * N + i].tone = 0;
        else if (o && o.mat !== c.mat && o.depth > c.depth + 0.5 && c.mat.kind !== "flat" && c.mat.kind !== "glow") out[j * N + i].tone = Math.min(out[j * N + i].tone, 1);
      }
    }
    const px = out.map((c) => c ? { part: c.part, colour: c.mat.tones[c.tone] } : null);
    a3Face(fig, cells, px, { cy, sy, ct, st });
    return px;
  }
  // the face, drawn as exact pixels where the 3D head puts it: each eye a white and an iris (an iris
  // alone when it turns away), a brow above it, the mouth; a feature is drawn only where it faces the
  // camera and the head's skin is what is seen there (not a helmet, hood or beard in front of it)
  function a3Face(fig, cells, px, { cy, sy, ct, st }) {
    const N = A3_N, F = fig.face;
    if (!F) return;
    const toWorld = (l) => [l[0] * cy + l[2] * sy, l[1], -l[0] * sy + l[2] * cy];
    const project = (l) => {
      const w = toWorld(l), up = w[1] * ct - w[2] * st;
      return { i: Math.floor(w[0] + N / 2), j: Math.floor(N - 1.6 - up), depth: 60 - (w[1] * st + w[2] * ct) };
    };
    // how much a point on the head (from the skull's centre) faces the camera
    const facing = (l) => {
      const n = toWorld(vNorm(vSub(l, [0, 39.4, 0.2])));
      return n[1] * st + n[2] * ct;
    };
    const seen = (q) => {
      const c = q.i >= 0 && q.j >= 0 && q.i < N && q.j < N ? cells[q.j * N + q.i] : null;
      return c && c.part === "head" && c.mat === fig.M.skin && Math.abs(c.depth - q.depth) < 1.6;
    };
    const put = (i, j, colour) => {
      if (i >= 0 && j >= 0 && i < N && j < N && px[j * N + i]) px[j * N + i] = { part: "head", colour };
    };
    for (const k of [-1, 1]) {
      const at = [2.2 * k, 39.4, 5], f = facing(at), q = project(at);
      if (f < 0.2 || !seen(q)) continue;
      // which side of the eye is towards the nose, on screen
      const nose = project([0, 39.4, 5.6]), inward = Math.sign(nose.i - q.i) || -k;
      if (f > 0.55) {
        put(q.i, q.j, inward > 0 ? F.white : F.iris);
        put(q.i + 1, q.j, inward > 0 ? F.iris : F.white);
        put(q.i, q.j + 1, inward > 0 ? F.iris : F.irisDark);
        put(q.i + 1, q.j + 1, inward > 0 ? F.irisDark : F.iris);
      } else {
        put(q.i, q.j, F.iris);
        put(q.i, q.j + 1, F.irisDark);
      }
      const b = project([2.2 * k, 41.3, 5]);
      if (seen(b)) for (const di of f > 0.55 ? [0, 1] : [0]) put(b.i + di, b.j, F.brow);
    }
    const m = project([0, 35.8, 5.3]);
    if (facing([0, 35.8, 5.3]) > 0.25 && seen(m)) {
      put(m.i, m.j, F.lip);
      if (facing([0, 35.8, 5.3]) > 0.6) put(m.i - 1, m.j, F.lip);
    }
  }

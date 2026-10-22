  // src/generators/character.js
  var SKIN = [["#ffe2c6", "#f2c39a", "#cf8f68"], ["#f3cba4", "#dca777", "#b27a50"], ["#dfa970", "#ba834e", "#8b5b35"], ["#ad7148", "#8a5232", "#64391f"], ["#7d4d31", "#5e3620", "#412313"]];
  var FANTASY_SKIN = [["#c4e8a8", "#8cc06c", "#5c9046"], ["#bcd0f5", "#8aa3dc", "#6077b3"], ["#e9b7e6", "#c784c9", "#955699"], ["#d8d8cf", "#acaca2", "#7c7c75"]];
  function genCharacter(N, rs, rc) {
    const s = makeSprite("character", N), cx = N / 2;
    const headW = even(N * 0.5), headH = Math.round(N * 0.44);
    const headL = cx - headW / 2, headR = cx + headW / 2 - 1, headT = 0, headB = headH - 1;
    const torsoT = headH, torsoH = Math.max(3, Math.round(N * 0.25)), torsoB = torsoT + torsoH - 1;
    const torsoL = headL + 1, torsoR = headR - 1, torsoW = torsoR - torsoL + 1;
    const armW = Math.max(1, Math.round(N / 16)), armB = torsoB + (N >= 24 ? 1 : 0);
    const armLx = torsoL - armW, armRx = torsoR + 1;
    const legT = torsoB + 1, legB = N - 1, legW = Math.max(1, Math.floor(torsoW / 2) - (N >= 16 ? 1 : 0));
    const fantasy = rc.chance(0.15);
    const skin = fantasy ? rc.pick(FANTASY_SKIN) : rc.pick(SKIN);
    const hairR = ramp(rc.pick([28, 22, 40, 48, 8, 275, 200, 330]), rc.range(30, 70), rc.pick([16, 26, 38, 55, 70]));
    const shirtHue = rc() * 360;
    const shirtR = ramp(shirtHue, rc.range(40, 75), rc.range(38, 54));
    const pantsR = ramp(rc() * 360, rc.range(18, 45), rc.range(24, 38));
    const shoe = hsl(20 + rc() * 25, 35, 17);
    const metalR = rc.chance(0.75) ? ramp(215, 12, 62) : ramp(44, 70, 55);
    const capeR = ramp(rc() * 360, rc.range(45, 70), rc.range(30, 42));
    const gemR = ramp(rc() * 360, 85, 58);
    const hair = rs.pick(["short", "short", "long", "spiky", "bald", "hood", "helmet"]);
    const cape = rs.chance(0.3), shield = rs.chance(0.3), beard = rs.chance(0.15) && hair !== "hood";
    const weapon = rs.pick(["sword", "sword", "staff", "axe", "none"]);
    const belt = rs.chance(0.6);
    if (cape) for (let y = torsoT + 1; y < legB; y++) for (let x = armLx; x < armRx + armW; x++) setPx(s, x, y, x === armRx + armW - 1 || y === legB - 1 ? capeR.sh : capeR.base, "cape");
    const shoeRows = Math.max(1, Math.round(N / 16));
    for (let y = legT; y <= legB; y++) for (let k = 0; k < legW; k++) {
      const sh = y > legB - shoeRows;
      setPx(s, torsoL + k, y, sh ? shoe : pantsR.base, "legL");
      setPx(s, torsoR - k, y, sh ? shoe : pantsR.sh, "legR");
    }
    for (let y = torsoT; y <= torsoB; y++) for (let x = torsoL; x <= torsoR; x++) {
      let c = shirtR.base;
      if (x === torsoR) c = shirtR.sh;
      else if (x === torsoL && torsoW >= 6) c = shirtR.hi;
      if (belt && y === torsoB) c = x === cx - 1 || x === cx ? metalR.hi : hsl(25, 40, 24);
      setPx(s, x, y, c, "body");
    }
    if (N >= 24) {
      setPx(s, cx - 1, torsoT, skin[2], "body");
      setPx(s, cx, torsoT, skin[2], "body");
    }
    for (let y = torsoT; y <= armB; y++) for (let k = 0; k < armW; k++) {
      const hand = y > armB - armW;
      setPx(s, armLx + k, y, hand ? skin[1] : shirtR.base, "armL");
      setPx(s, armRx + k, y, hand ? skin[2] : shirtR.sh, "armR");
    }
    if (shield) {
      const sw = Math.max(3, Math.round(N * 0.22)), sh = sw + 1, r = armLx + armW - 1, l = r - sw + 1, t = torsoT + 1;
      for (let y = t; y < t + sh; y++) for (let x = l; x <= r; x++) {
        if (y === t + sh - 1 && (x === l || x === r)) continue;
        let c = metalR.base;
        if (x === l || y === t) c = metalR.hi;
        if (x === r || y === t + sh - 1) c = metalR.sh;
        setPx(s, x, y, c, "armL");
      }
      setPx(s, Math.floor((l + r) / 2), t + Math.floor(sh / 2), shirtR.base, "armL");
    }
    for (let y = headT; y <= headB; y++) for (let x = headL; x <= headR; x++) setPx(s, x, y, x === headR ? skin[2] : skin[1], "head");
    for (const [x, y] of [[headL, headT], [headR, headT], [headL, headB], [headR, headB]]) setPx(s, x, y, null);
    const hairH = Math.max(1, Math.round(headH * 0.3)), sideB = headT + Math.round(headH * 0.45);
    const eyeRow = headT + Math.round(headH * 0.55), eyeS = Math.max(1, Math.round(N / 16)), eyeH = eyeS + (N >= 16 ? 1 : 0), eg = Math.max(1, Math.round(headW * 0.15));
    const hp = (x, y, R) => setPx(s, x, y, x >= headR ? R.sh : y === headT ? R.hi : R.base, "head");
    const sideW = N >= 24 ? 2 : 1;
    if (hair === "short" || hair === "long" || hair === "spiky") {
      for (let y = headT; y < headT + hairH; y++) for (let x = headL; x <= headR; x++) {
        if (y === headT && (x === headL || x === headR)) continue;
        if (hair === "spiky" && y === headT && (x - headL) % 2 === 0) continue;
        hp(x, y, hairR);
      }
      const bottom = hair === "long" ? headB : sideB;
      for (let y = headT + hairH; y <= bottom; y++) for (let k = 0; k < sideW; k++) {
        hp(headL + k, y, hairR);
        hp(headR - k, y, hairR);
      }
    } else if (hair === "bald") {
      setPx(s, headL + 1, headT + 1, skin[0], "head");
    } else if (hair === "hood") {
      for (let y = headT; y <= headT + hairH; y++) for (let x = headL; x <= headR; x++) hp(x, y, capeR);
      for (let y = headT + hairH; y <= headB; y++) for (let k = 0; k < sideW; k++) {
        hp(headL + k, y, capeR);
        hp(headR - k, y, capeR);
      }
    } else if (hair === "helmet") {
      for (let y = headT; y <= headT + hairH; y++) for (let x = headL; x <= headR; x++) {
        if (y === headT && (x === headL || x === headR)) continue;
        hp(x, y, metalR);
      }
      for (let y = headT + hairH; y < eyeRow; y++) {
        hp(headL, y, metalR);
        hp(headR, y, metalR);
      }
      for (let y = headT + hairH + 1; y < eyeRow + eyeH; y++) {
        setPx(s, cx - 1, y, metalR.sh, "head");
        setPx(s, cx, y, metalR.sh, "head");
      }
    }
    const eyeXs = [cx - 1 - eg - (eyeS - 1), cx + eg];
    eyeXs.forEach((ex, side) => {
      for (let dy = 0; dy < eyeH; dy++) for (let dx = 0; dx < eyeS; dx++) {
        const hl = eyeS >= 2 && dy === 0 && dx === (side === 0 ? 0 : eyeS - 1);
        setPx(s, ex + dx, eyeRow + dy, hl ? "#ffffff" : "#1c1828", "eye");
      }
    });
    if (beard) for (let y = eyeRow + eyeH + (N >= 24 ? 1 : 0); y <= headB; y++) for (let x = headL + 1; x <= headR - 1; x++) hp(x, y, hairR);
    else if (N >= 24 && eyeRow + eyeH + 1 < headB) {
      setPx(s, cx - 1, eyeRow + eyeH + 1, skin[2], "head");
      setPx(s, cx, eyeRow + eyeH + 1, skin[2], "head");
    }
    s.order = ["cape", "legL", "legR", "body", "armL", "head", "eye", "armR"];
    s.meta.lid = skin[1];
    s.meta.outline = hsl(toward(shirtHue, 245, 60), 30, 11);
    s.meta.weapon = weapon === "none" ? null : { kind: weapon, wx: armRx + armW, hy: armB, len: Math.round(N * 0.45), legB, blade: metalR, guard: ramp(44, 70, 52), grip: hsl(25, 40, 26), gem: gemR, thick: N >= 24, os: N >= 16 ? 2 : 1 };
    if (s.meta.weapon) {
      drawWeapon(s, "up", (x, y, c) => {
        const i = y * N + x;
        if (x < 0 || y < 0 || x >= N || y >= N || s.tag[i] && s.tag[i] !== "armR") return;
        setPx(s, x, y, c, "armR");
      });
      s.meta.weaponInfo = s.meta.weapon;
      s.meta.weapon = null;
    }
    s.meta.desc = `${hair} hair \xB7 ${weapon === "none" ? "unarmed" : weapon}${shield ? " \xB7 shield" : ""}${cape ? " \xB7 cape" : ""}`;
    const UP2 = ["head", "eye", "body", "armL", "armR", "cape"];
    let armTop = N;
    for (let i = 0; i < N * N; i++) if (s.tag[i] === "armR") {
      armTop = Math.floor(i / N);
      break;
    }
    const lift2 = Math.max(0, Math.min(2, armTop));
    const melee = weapon === "sword" || weapon === "axe";
    s.anims = {
      idle: [{}, { d: off(UP2, 0, 1) }, { d: off(UP2, 0, 1) }, { blink: true }],
      walk: [
        { d: { legL: [0, -1], armR: [0, -1], armL: [0, 1] } },
        { d: off(UP2, 0, 1) },
        { d: { legR: [0, -1], armL: [0, -1], armR: [0, 1] } },
        { d: off(UP2, 0, 1) }
      ],
      // B2: motions are sized to stay inside the frame margin. Melee: raise, then strike
      // down with an arc that fits the space right of the hand (no sideways lunge).
      attack: melee ? [
        { d: { armR: [0, -Math.min(1, lift2)] } },
        { d: { armR: [0, -lift2] } },
        { d: { armR: [0, 1] }, fx: "slash" },
        { d: { armR: [0, 1] } },
        {}
      ] : weapon === "staff" ? [
        { d: { armR: [0, -1] } },
        { d: { armR: [0, -2] }, fx: "glow" },
        { fx: "bolt1" },
        { fx: "bolt2" },
        {}
      ] : [
        { d: { armR: [0, -1] } },
        { d: { armR: [1, 0] }, fx: "punch" },
        { d: { armR: [1, 0] } },
        {}
      ],
      // B2: the character fills the full sprite height, so a jump tucks the legs up (feet
      // leave the ground) instead of moving the head out of the frame.
      jump: [
        { d: off(UP2, 0, 1) },
        { d: { legL: [0, -1], legR: [0, -1] } },
        { d: { legL: [0, -2], legR: [0, -2], armL: [0, -1], armR: [0, -1] } },
        { d: { legL: [0, -1], legR: [0, -1] } },
        { d: off(UP2, 0, 1) }
      ],
      hurt: [{ flash: true, g: [-1, 0] }, { g: [-1, 0], blink: true }, { flash: true }, {}]
    };
    s.post = (spec, put) => {
      const W = s.meta.weapon || s.meta.weaponInfo, o = spec.d && spec.d.armR || [0, 0];
      const maxX = s.N + PAD - 2;
      if (spec.fx === "slash" && W) {
        const r = Math.max(2, Math.min(W.len + 1, maxX - (W.wx + o[0])));
        for (let a = -80; a <= 40; a += 7) {
          const rad = a * Math.PI / 180;
          put(Math.round(W.wx + o[0] + Math.cos(rad) * r), Math.round(W.hy + o[1] + Math.sin(rad) * r), a > -55 && a < 20 ? "#ffffff" : "#bfe3ff");
        }
      }
      if (W && W.kind === "staff") {
        const ox = W.wx + o[0], oy = W.hy - W.len + 2 - W.os + o[1];
        if (spec.fx === "glow") for (const [dx, dy] of [[-1, 0], [W.os, 0], [0, -1], [0, W.os], [-1, -1], [W.os, -1]]) put(ox + dx, oy + dy, W.gem.hi2);
        if (spec.fx === "bolt1" || spec.fx === "bolt2") {
          const k = Math.min(spec.fx === "bolt1" ? 2 : 5, maxX - 1 - ox);
          for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) put(ox + k + i, oy + j, i ? "#ffffff" : W.gem.hi2);
          put(ox + k - 1, oy, W.gem.hi);
          put(ox + k - 2, oy + 1, W.gem.base);
        }
      }
      if (spec.fx === "punch") {
        const hx = Math.min(s.N / 2 + Math.round(s.N / 4) + 2, maxX - 2), hy = W ? W.hy : Math.round(s.N * 0.62);
        for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [2, -2], [2, 2]]) put(hx + dx, hy + dy, "#fff3b0");
      }
    };
    return s;
  }


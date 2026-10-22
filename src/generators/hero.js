  // src/generators/hero.js
  function genHero(N, rs, rc, opts2 = {}) {
    const config = rollHero({ shapeSeed: opts2.shapeSeed ?? "hero", colorSeed: opts2.colorSeed ?? "hero", cls: opts2.cls, locks: opts2.locks || {}, colourCls: opts2.colourCls || null });
    const { px, tag, issues } = composeHero(config);
    const s = makeSprite("hero", HUMANOID.N);
    s.px = px;
    s.tag = tag;
    s.order = HUMANOID.order.slice();
    const grip = weaponGrip(config);
    const kind = grip ? grip.kind : "none";
    s.meta.lid = config.colours.skin.base;
    s.meta.outline = hsl(toward(config.colours.clothHue, 245, 60), 30, 11);
    s.meta.hero = config;
    s.meta.issues = issues;
    s.meta.pivot = { ...HUMANOID.pivot };
    s.meta.motion = "generated";
    const weaponLabel = config.parts.weapon === "none" ? "unarmed" : PARTS_BY_ID[config.parts.weapon].label.toLowerCase();
    s.meta.desc = `${CLASSES[config.cls].label} \xB7 ${weaponLabel}`;
    const UP2 = ["head", "eye", "body", "armL", "armR", "cape"];
    const attack = {
      melee: [{ d: { armR: [0, -1] } }, { d: { armR: [0, -2] } }, { d: { armR: [1, 1] }, g: [1, 0], fx: "slash" }, { d: { armR: [1, 1] }, g: [1, 0] }, {}],
      staff: [{ d: { armR: [0, -1] } }, { d: { armR: [0, -2] }, fx: "glow" }, { fx: "bolt1" }, { fx: "bolt2" }, {}],
      bow: [{ d: { armR: [-1, 0] } }, { d: { armR: [-1, 0] }, fx: "nock" }, { fx: "arrow1" }, { fx: "arrow2" }, {}],
      none: [{ d: { armR: [0, -1], armL: [0, -1] } }, { d: { armR: [1, 0], armL: [-1, 0] }, g: [1, 0], fx: "claw" }, { d: { armR: [1, 0], armL: [-1, 0] }, g: [1, 0] }, {}]
    }[kind];
    s.anims = {
      idle: [{}, { d: off(UP2, 0, 1) }, { d: off(UP2, 0, 1) }, { blink: true }],
      walk: [
        { d: { legL: [0, -1], armR: [0, -1], armL: [0, 1] } },
        { d: off(UP2, 0, 1) },
        { d: { legR: [0, -1], armL: [0, -1], armR: [0, 1] } },
        { d: off(UP2, 0, 1) }
      ],
      attack,
      jump: [
        { d: off(UP2, 0, 1) },
        { g: [0, -1], d: { legL: [0, -1], legR: [0, -1] } },
        { g: [0, -1], d: { legL: [0, -2], legR: [0, -2] } },
        { g: [0, -1] },
        { d: off(UP2, 0, 1) }
      ],
      hurt: [{ flash: true, g: [-1, 0] }, { g: [-1, 0], blink: true }, { flash: true }, {}],
      // run: bigger stride than walk (legs lift 2, arms swing 2) and the body rises on each push
      run: [
        { d: merge(off(UP2, 0, -1), { legL: [0, -2], armR: [0, -1], armL: [0, 1] }) },
        { d: off(UP2, 0, 1) },
        { d: merge(off(UP2, 0, -1), { legR: [0, -2], armL: [0, -1], armR: [0, 1] }) },
        { d: off(UP2, 0, 1) }
      ],
      // death: hit, buckle, kneel, slump, then lie on the ground (held; does not loop)
      // (the weapon arm and cape sink at most 1 px so a staff or cape never leaves the frame)
      death: [
        { flash: true, g: [-1, 0] },
        { d: off(UP2, 0, 1), g: [-1, 0], blink: true },
        { d: { ...off(["head", "eye", "body", "armL"], 0, 2), armR: [0, 1], cape: [0, 1] }, blink: true },
        { d: { ...off(["head", "eye", "body", "armL"], 0, 3), armR: [0, 1], cape: [0, 1] }, g: [-1, 0], blink: true },
        { lie: true, blink: true },
        { lie: true, blink: true }
      ]
    };
    s.anims = { idle: s.anims.idle, walk: s.anims.walk, run: s.anims.run, attack: s.anims.attack, jump: s.anims.jump, hurt: s.anims.hurt, death: s.anims.death };
    s.animMeta = { death: { loop: false } };
    const gem = config.colours.gem;
    s.post = (spec, put) => {
      if (!spec.fx) return;
      const o = spec.d && spec.d.armR || [0, 0];
      if (spec.fx === "slash" && grip) {
        for (let a = -80; a <= 40; a += 7) {
          const rad = a * Math.PI / 180;
          put(Math.round(grip.x + o[0] + Math.cos(rad) * 6), Math.round(grip.y + o[1] + Math.sin(rad) * 6), a > -55 && a < 20 ? "#ffffff" : "#bfe3ff");
        }
      }
      if (kind === "staff") {
        const ox = grip.x + o[0], oy = 3 + o[1];
        if (spec.fx === "glow") for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [-1, -1], [1, -1], [-1, 1], [1, 1]]) put(ox + dx, oy + dy, gem.hi2);
        if (spec.fx === "bolt1" || spec.fx === "bolt2") {
          const k = spec.fx === "bolt1" ? 3 : 6;
          for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) put(ox + k + i, oy + j, i ? "#ffffff" : gem.hi2);
          put(ox + k - 1, oy, gem.hi);
          put(ox + k - 2, oy + 1, gem.base);
        }
      }
      if (kind === "bow") {
        const ax = grip.x, ay = grip.y;
        const arrow = (x0) => {
          for (let i = 0; i < 4; i++) put(x0 + i, ay, "#c8a26a");
          put(x0 + 4, ay, "#ffffff");
          put(x0 + 3, ay - 1, "#e8e8e8");
          put(x0 + 3, ay + 1, "#e8e8e8");
        };
        if (spec.fx === "nock") {
          for (let i = 0; i < 3; i++) put(ax + i, ay, "#c8a26a");
          put(ax + 3, ay, "#ffffff");
        }
        if (spec.fx === "arrow1") arrow(ax + 2);
        if (spec.fx === "arrow2") arrow(ax + 4);
      }
      if (spec.fx === "claw") {
        for (let k = 0; k < 3; k++) for (let i = 0; i < 3; i++) put(22 + i + k, 14 + k * 2 + i, "#f2f2f2");
      }
    };
    return s;
  }


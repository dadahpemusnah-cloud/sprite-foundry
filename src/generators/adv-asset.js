  // src/generators/adv-asset.js
  // V7.2: a generated Adventurer as an imported character with 8 directions, like the chibi: each
  // direction is the 3D figure rendered to 48 px pixel art; every part's pixels hidden behind others are
  // rendered too (the part alone, only there), so a limb that moves shows what was behind it; the
  // joints are the figure's own, projected; the drawing order goes from the farthest part to the nearest.
  var ADV_MOTIONS = [
    { id: "idle", fps: 6 },
    { id: "walk", fps: 10 },
    { id: "run", fps: 12 }
  ];
  var ADV_PARTS = { cloak: "cloak", robe: "robe", shield: "shield" };
  var advCombat = (cls) => cls === "wizard" || cls === "druid" ? { id: "cast", fps: 10 } : { id: "attack", fps: 12 };
  function advDirection(fig, dir, page, name) {
    const N = A3_N, cells = a3Render(fig, dir);
    const px = cells.map((c) => c ? c.colour : null), owner = cells.map((c) => c ? c.part : null);
    const hidden = {}, depth = {};
    for (const g of fig.groups) {
      const part = g.list[0].part, c = a3Project(dir, g.b), r = g.b[3] + 1.5;
      // only the pixels near the part that another part covers
      const mask = new Uint8Array(N * N);
      let any = false;
      for (let j = Math.max(0, Math.floor(c[1] - r)); j < Math.min(N, Math.ceil(c[1] + r)); j++) for (let i = Math.max(0, Math.floor(c[0] - r)); i < Math.min(N, Math.ceil(c[0] + r)); i++) if (owner[j * N + i] !== part) {
        mask[j * N + i] = 1;
        any = true;
      }
      const ds = cells.filter((x) => x && x.part === part).map((x) => x.depth);
      if (any) {
        const alone = a3Render(fig, dir, { only: part, mask, raw: true }), h = new Array(N * N).fill(null);
        let n = 0;
        alone.forEach((x, i) => {
          if (x && owner[i]) {
            h[i] = x.mat.tones[x.tone];
            ds.push(x.depth);
            n++;
          }
        });
        if (n) hidden[part] = h;
      }
      if (ds.length) depth[part] = ds.reduce((a, b) => a + b, 0) / ds.length;
    }
    const order = Object.keys(depth).sort((a, b) => depth[b] - depth[a]);
    const joints = Object.fromEntries(Object.entries(fig.joints).map(([id, l]) => [id, a3Project(dir, l)]));
    return riggedDirection({ N, px, owner, hidden, order, joints, parents: [["weapon", "handR"], ["shield", "handL"], ["cloak", "torso"], ["robe", "pelvis"]], extraParts: ADV_PARTS, motions: ADV_MOTIONS, combat: advCombat(fig.cls), facing: FACING_OF[dir], name, page, fromModel: true, offScale: A3_N / 32, unclipAll: true, settle: true, steady: fig.cls === "wizard" || fig.cls === "druid" ? ["weapon", "robe"] : ["robe"], slide: ["weapon"], sway: { cloak: 4, robe: 2, ...dir === "S" || dir === "N" ? { torso: 2 } : {} } });
  }
  // the whole character, one direction at a time (onStep(i, dir) between them, so a page can show progress)
  async function advAsset(cls, shapeSeed, colourSeed, page, onStep = async () => {
  }) {
    const fig = a3Figure(cls, shapeSeed + "/" + colourSeed), out = {};
    for (const [i, dir] of DIRECTIONS.entries()) {
      await onStep(i, dir);
      out[dir] = advDirection(fig, dir, page, `adventurer-${cls}-${shapeSeed}-${dir.toLowerCase()}.png`);
    }
    const views = {};
    for (const dir of DIRECTIONS) if (dir !== "S") views[dir] = { direction: dir, work: out[dir].work, rest: out[dir].rest, history: [] };
    return { design: { cls, shape: String(shapeSeed), colour: String(colourSeed) }, directions: out, asset: { rest: out.S.rest, history: [], direction: "S", views, work: out.S.work } };
  }

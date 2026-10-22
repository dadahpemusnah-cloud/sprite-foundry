  // src/parts/library.js
  var rep = (row, n) => Array(n).fill(row);
  var PARTS = [
    /* ---------- body (skin base) ---------- */
    { id: "body.base", slot: "body", label: "Base body", pieces: [
      { at: "head", off: [0, 0], tag: "head", rows: [
        ".SSSSSSSS.",
        "SKSSSSSSSs",
        "SSSSSSSSSs",
        "SSSSSSSSSs",
        "SSSSSSSSSs",
        "SSSSSSSSSs",
        "SSSSSSSSSs",
        ".SSSssSSs.",
        "..ssssss.."
      ] },
      { at: "torso", off: [0, 0], tag: "body", rows: rep("SSSSSSSs", 7) },
      { at: "armL", off: [0, 0], tag: "armL", rows: rep("SS", 8) },
      { at: "armR", off: [0, 0], tag: "armR", rows: rep("Ss", 8) },
      { at: "legL", off: [0, 0], tag: "legL", rows: rep("SSS", 9) },
      { at: "legR", off: [0, 0], tag: "legR", rows: rep("SSs", 9) }
    ] },
    /* ---------- eyes ---------- */
    { id: "eyes.dot", slot: "eyes", label: "Dot eyes", pieces: [{ at: "head", off: [2, 4], tag: "eye", rows: ["E....E", "E....E"] }] },
    { id: "eyes.big", slot: "eyes", label: "Big eyes", pieces: [{ at: "head", off: [2, 4], tag: "eye", rows: ["XE..EX", "EE..EE"] }] },
    { id: "eyes.glow", slot: "eyes", label: "Glowing eyes", pieces: [{ at: "head", off: [2, 4], tag: "eye", rows: ["Y....Y", "Y....Y"] }] },
    /* ---------- hair ---------- */
    { id: "hair.short", slot: "hair", label: "Short", pieces: [{ at: "head", off: [-1, -1], tag: "head", rows: [
      "..AAAAAAAA..",
      ".AHAAAAAAAa.",
      "AAAAAAAAAAAa",
      "AA........aa",
      "AA........aa",
      "A..........a"
    ] }] },
    { id: "hair.long", slot: "hair", label: "Long", pieces: [{ at: "head", off: [-1, -1], tag: "head", rows: [
      "..AAAAAAAA..",
      ".AHAAAAAAAa.",
      "AAAAAAAAAAAa",
      ...rep("AA........aa", 7)
    ] }] },
    { id: "hair.spiky", slot: "hair", label: "Spiky", pieces: [{ at: "head", off: [-1, -2], tag: "head", rows: [
      "..A..A..A...",
      ".AAA.AAA.AA.",
      ".AHAAAAAAAa.",
      "AAAAAAAAAAAa",
      "AA........aa",
      "A..........a"
    ] }] },
    /* ---------- facial hair ---------- */
    { id: "facial.beard", slot: "facial", label: "Beard", pieces: [{ at: "head", off: [1, 6], tag: "head", rows: [
      "A......A",
      "AAAaaAAA",
      ".AAAAAA."
    ] }] },
    /* ---------- headgear ---------- */
    {
      id: "hat.helmet",
      slot: "headgear",
      label: "Helmet",
      clear: [{ at: "head", off: [-1, -3], w: 12, h: 3 }],
      pieces: [{ at: "head", off: [-1, -1], tag: "head", rows: [
        "..NNNNNNNN..",
        ".NWIIIIIIINn",
        "NNNNNNNNNNNn",
        "NN...nn...Nn",
        "NN...nn...Nn",
        "N..........n"
      ] }]
    },
    {
      id: "hat.hood",
      slot: "headgear",
      label: "Hood",
      clear: [{ at: "head", off: [-1, -3], w: 12, h: 3 }],
      pieces: [{ at: "head", off: [-1, -1], tag: "head", rows: [
        "..PPPPPPPP..",
        ".PCPPPPPPPp.",
        "PPPPPPPPPPPp",
        "PPP......ppp",
        ...rep("PP........pp", 4),
        "PPP......ppp",
        ".PPP....ppp."
      ] }]
    },
    {
      id: "hat.wizard",
      slot: "headgear",
      label: "Wizard hat",
      clear: [{ at: "head", off: [-1, -2], w: 12, h: 4 }],
      pieces: [{ at: "head", off: [-1, -2], tag: "head", rows: [
        "......PP....",
        ".....PPPp...",
        "....PPPPPp..",
        "..CPPPPPPPp.",
        "RRRRRRRRRRRr"
      ] }]
    },
    /* ---------- torso wear (with sleeves) ---------- */
    { id: "torso.tunic", slot: "torso", label: "Tunic", pieces: [
      { at: "torso", off: [0, 0], tag: "body", rows: ["CPP..PPp", ...rep("CPPPPPPp", 4), "RRRRRRRr", "CPPPPPPp"] },
      { at: "armL", off: [0, 0], tag: "armL", rows: rep("PP", 5) },
      { at: "armR", off: [0, 0], tag: "armR", rows: rep("Pp", 5) }
    ] },
    { id: "torso.vest", slot: "torso", label: "Leather vest", pieces: [
      { at: "torso", off: [0, 0], tag: "body", rows: ["LLP..PLl", ...rep("LLPPPPLl", 4), "lllIIlll", "LLPPPPLl"] },
      { at: "armL", off: [0, 0], tag: "armL", rows: ["PP", "PP"] },
      { at: "armR", off: [0, 0], tag: "armR", rows: ["Pp", "Pp"] }
    ] },
    { id: "torso.plate", slot: "torso", label: "Plate armour", pieces: [
      { at: "torso", off: [0, 0], tag: "body", rows: ["INNNNNNn", "IWNNNNNn", "INNNNNNn", "INNNnNNn", "INNNNNNn", "RRRRRRRr", "NNNNNNNn"] },
      { at: "armL", off: [0, 0], tag: "armL", rows: ["IN", "IN", "NN", "nn", "IN", "IN", "NN", "Nn"] },
      { at: "armR", off: [0, 0], tag: "armR", rows: ["Nn", "Nn", "Nn", "nn", "Nn", "Nn", "Nn", "nn"] }
    ] },
    { id: "torso.rags", slot: "torso", label: "Rags", pieces: [
      { at: "torso", off: [0, 0], tag: "body", rows: ["CPP..PPp", "CP.PPPPp", "CPPPP.Pp", "C.PPPPPp", "CPPP.PPp", "rRRRRrRr", "C.P.PP.p"] },
      { at: "armL", off: [0, 0], tag: "armL", rows: ["PP", "P.", "PP"] },
      { at: "armR", off: [0, 0], tag: "armR", rows: ["Pp", ".p"] }
    ] },
    /* ---------- legs ---------- */
    { id: "legs.pants", slot: "legs", label: "Trousers", pieces: [
      { at: "legL", off: [0, 0], tag: "legL", rows: ["TRR", ...rep("RRR", 6)] },
      { at: "legR", off: [0, 0], tag: "legR", rows: rep("RRr", 7) }
    ] },
    { id: "legs.plate", slot: "legs", label: "Greaves", pieces: [
      { at: "legL", off: [0, 0], tag: "legL", rows: ["INN", "INN", "NNN", "nNn", "INN", "INN", "NNN"] },
      { at: "legR", off: [0, 0], tag: "legR", rows: ["NNn", "NNn", "NNn", "nnn", "NNn", "NNn", "NNn"] }
    ] },
    /* ---------- boots ---------- */
    { id: "boots.leather", slot: "boots", label: "Leather boots", pieces: [
      { at: "legL", off: [0, 6], tag: "legL", rows: ["BBB", "BBB", "bbb"] },
      { at: "legR", off: [0, 6], tag: "legR", rows: ["BBb", "BBb", "bbb"] }
    ] },
    { id: "boots.metal", slot: "boots", label: "Sabatons", pieces: [
      { at: "legL", off: [0, 6], tag: "legL", rows: ["INN", "NNN", "nnn"] },
      { at: "legR", off: [0, 6], tag: "legR", rows: ["NNn", "NNn", "nnn"] }
    ] },
    /* ---------- back ---------- */
    { id: "back.cape", slot: "back", label: "Cape", pieces: [
      // only where the body leaves gaps (beside the legs and between them)
      { at: "torso", off: [-2, 8], tag: "cape", rows: [...rep("RR", 6), "rr"] },
      { at: "torso", off: [3, 7], tag: "cape", rows: [...rep("Rr", 7), "rr"] },
      { at: "torso", off: [8, 8], tag: "cape", rows: [...rep("Rr", 6), "rr"] }
    ] },
    /* ---------- off hand ---------- */
    { id: "offhand.shield", slot: "offhand", label: "Shield", pieces: [
      { at: "armL", off: [-3, 1], tag: "armL", rows: ["INNn", "INRn", "IRRn", "INRn", "INNn", ".nn."] }
    ] },
    /* ---------- weapons (right hand at armR + [0..1, 6..7]; grip column x = armR + 2) ---------- */
    { id: "weapon.sword", slot: "weapon", label: "Sword", kind: "melee", grip: { at: "armR", off: [2, 6] }, pieces: [
      { at: "armR", off: [1, -7], tag: "armR", rows: [".W..", ...rep(".In.", 10), "oOOo", ".l..", ".l..", ".l..", ".O.."] }
    ] },
    { id: "weapon.axe", slot: "weapon", label: "Axe", kind: "melee", grip: { at: "armR", off: [2, 6] }, pieces: [
      { at: "armR", off: [2, -6], tag: "armR", rows: ["DNI.", "DNNI", "DNNN", "DNNn", "Dnn.", ...rep("D...", 9), "d..."] }
    ] },
    { id: "weapon.dagger", slot: "weapon", label: "Dagger", kind: "melee", grip: { at: "armR", off: [2, 6] }, pieces: [
      { at: "armR", off: [1, 1], tag: "armR", rows: [".W.", ".I.", ".In", ".In", "oOo", ".l.", ".l."] }
    ] },
    { id: "weapon.staff", slot: "weapon", label: "Staff", kind: "staff", grip: { at: "armR", off: [2, 6] }, pieces: [
      { at: "armR", off: [1, -10], tag: "armR", rows: [".J.", ".Gg", ".g.", ...rep(".D.", 22)] }
    ] },
    { id: "weapon.bow", slot: "weapon", label: "Bow", kind: "bow", grip: { at: "armR", off: [2, 6] }, pieces: [
      { at: "armR", off: [2, -2], tag: "armR", rows: [
        "...D",
        "..DQ",
        "..DQ",
        ".D.Q",
        ".D.Q",
        ...rep("D..Q", 7),
        ".D.Q",
        ".D.Q",
        "..DQ",
        "..DQ",
        "...D"
      ] }
    ] }
  ];
  var PARTS_BY_ID = Object.fromEntries(PARTS.map((p) => [p.id, p]));
  var partsForSlot = (slot) => PARTS.filter((p) => p.slot === slot);


  // src/parts/template.js
  var HUMANOID = {
    id: "humanoid-28",
    N: 28,
    pivot: { x: 16, y: 30 },
    ground: 27,
    anchors: { head: [9, 3], torso: [10, 12], armL: [8, 12], armR: [18, 12], legL: [10, 19], legR: [15, 19] },
    // pixels of each hand (inner coordinates); weapons must touch the right hand
    hands: { L: [[8, 18], [9, 18], [8, 19], [9, 19]], R: [[18, 18], [19, 18], [18, 19], [19, 19]] },
    // draw order: lower layer first. `optional` slots may be 'none'.
    slots: [
      { name: "back", layer: 10, optional: true, label: "Back" },
      { name: "body", layer: 20, optional: false, label: "Body" },
      { name: "legs", layer: 22, optional: false, label: "Legs" },
      { name: "boots", layer: 24, optional: true, label: "Boots" },
      { name: "torso", layer: 32, optional: false, label: "Torso" },
      { name: "eyes", layer: 52, optional: false, label: "Eyes" },
      { name: "hair", layer: 60, optional: true, label: "Hair" },
      { name: "facial", layer: 62, optional: true, label: "Facial hair" },
      { name: "headgear", layer: 70, optional: true, label: "Headgear" },
      { name: "offhand", layer: 80, optional: true, label: "Off hand" },
      { name: "weapon", layer: 85, optional: true, label: "Weapon" }
    ],
    // part tags = animation groups; renderFrame draws groups in this order
    order: ["cape", "legL", "legR", "body", "armL", "head", "eye", "armR"],
    requiredTags: ["head", "eye", "body", "armL", "armR", "legL", "legR"],
    // tags that always move together, so their pixels may overlap in the base pose
    rigidGroups: [["head", "eye"]]
  };


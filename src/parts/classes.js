  // src/parts/classes.js
  var w = (id, weight = 1) => [id, weight];
  var CLASSES = {
    knight: { label: "Knight", slots: {
      eyes: [w("eyes.dot", 2), w("eyes.big")],
      hair: [w("hair.short", 2), w("none")],
      facial: [w("none", 3), w("facial.beard")],
      headgear: [w("hat.helmet", 3), w("none")],
      torso: [w("torso.plate")],
      legs: [w("legs.plate", 2), w("legs.pants")],
      boots: [w("boots.metal", 2), w("boots.leather")],
      weapon: [w("weapon.sword")],
      offhand: [w("offhand.shield", 4), w("none")],
      back: [w("back.cape"), w("none")]
    }, colours: { metalGold: 0.25 } },
    warrior: { label: "Warrior", slots: {
      eyes: [w("eyes.dot", 2), w("eyes.big")],
      hair: [w("hair.short"), w("hair.spiky"), w("hair.long")],
      facial: [w("facial.beard"), w("none")],
      headgear: [w("none", 3), w("hat.helmet")],
      torso: [w("torso.vest")],
      legs: [w("legs.pants")],
      boots: [w("boots.leather")],
      weapon: [w("weapon.axe", 2), w("weapon.sword")],
      offhand: [w("none", 2), w("offhand.shield")],
      back: [w("none", 3), w("back.cape")]
    } },
    mage: { label: "Mage", slots: {
      eyes: [w("eyes.dot"), w("eyes.big")],
      hair: [w("hair.long", 2), w("hair.short"), w("none")],
      facial: [w("facial.beard"), w("none")],
      headgear: [w("hat.wizard", 2), w("hat.hood")],
      torso: [w("torso.tunic")],
      legs: [w("legs.pants")],
      boots: [w("boots.leather"), w("none")],
      weapon: [w("weapon.staff")],
      offhand: [w("none")],
      back: [w("back.cape"), w("none")]
    }, colours: { clothHue: [200, 300] } },
    archer: { label: "Archer", slots: {
      eyes: [w("eyes.dot"), w("eyes.big")],
      hair: [w("hair.short"), w("hair.long")],
      facial: [w("none")],
      headgear: [w("hat.hood", 3), w("none", 2)],
      torso: [w("torso.vest"), w("torso.tunic")],
      legs: [w("legs.pants")],
      boots: [w("boots.leather")],
      weapon: [w("weapon.bow")],
      offhand: [w("none")],
      back: [w("none", 2), w("back.cape")]
    }, colours: { clothHue: [70, 160] } },
    rogue: { label: "Rogue", slots: {
      eyes: [w("eyes.dot"), w("eyes.big")],
      hair: [w("hair.short"), w("hair.spiky")],
      facial: [w("none")],
      headgear: [w("hat.hood", 3), w("none")],
      torso: [w("torso.tunic"), w("torso.vest")],
      legs: [w("legs.pants")],
      boots: [w("boots.leather")],
      weapon: [w("weapon.dagger")],
      offhand: [w("none")],
      back: [w("back.cape"), w("none")]
    }, colours: { dark: true } },
    zombie: { label: "Zombie", slots: {
      eyes: [w("eyes.glow")],
      hair: [w("none", 2), w("hair.short"), w("hair.long")],
      facial: [w("none")],
      headgear: [w("none")],
      torso: [w("torso.rags")],
      legs: [w("legs.pants")],
      boots: [w("none")],
      weapon: [w("none")],
      offhand: [w("none")],
      back: [w("none")]
    }, colours: { zombie: true } },
    custom: { label: "Custom", slots: Object.fromEntries(HUMANOID.slots.filter((s) => s.name !== "body").map((s) => [
      s.name,
      [...partsForSlot(s.name).map((p) => w(p.id)), ...s.optional ? [w("none")] : []]
    ])), colours: { fantasy: 0.2 } }
  };
  var CLASS_NAMES = Object.keys(CLASSES);
  var RANDOM_CLASSES = CLASS_NAMES.filter((c) => c !== "custom");
  var ALL_PART_IDS = new Set(PARTS.map((p) => p.id));


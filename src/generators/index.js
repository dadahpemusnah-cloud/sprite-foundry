  // src/generators/index.js
  var TYPES = {
    character: { label: "Character", gen: genCharacter },
    creature: { label: "Creature", gen: genCreature },
    ship: { label: "Ship", gen: genShip },
    item: { label: "Item", gen: genItem },
    hero: { label: "RPG Hero", gen: genHero, fixedSize: 28 },
    // V7: a generated character with parts, joints and 8 directions, kept as an imported character
    chibi: { label: "Chibi", gen: genImported, sizeFromAsset: true, rigged: true },
    imported: { label: "Imported", gen: genImported, sizeFromAsset: true }
  };
  var GENERATOR_VERSIONS = { character: 2, creature: 2, ship: 2, item: 2, hero: HERO_GENERATOR_VERSION, chibi: IMPORTED_GENERATOR_VERSION, imported: IMPORTED_GENERATOR_VERSION };
  function generate(type, N, shapeSeed, colorSeed, opts2 = {}) {
    const T = TYPES[type], n = T.fixedSize || (T.sizeFromAsset && opts2.asset && opts2.asset.rest ? opts2.asset.rest.N : N);
    const s = TYPES[type].gen(n, seedRng(type + ":" + n + ":" + shapeSeed), seedRng("colour:" + colorSeed), { ...opts2, shapeSeed, colorSeed });
    s.seedShape = shapeSeed;
    s.seedColor = colorSeed;
    return s;
  }


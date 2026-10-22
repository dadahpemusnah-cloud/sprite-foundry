  // src/core/variants.js
  var VARIANT_NAME = /^[a-z][a-z0-9_-]{0,23}$/;
  var MAX_VARIANTS = 8;
  var MAX_MAPPED = 256;
  var HEX = /^#[0-9a-f]{6}$/;
  var NAME_RULE = "A variant name starts with a letter and uses lower-case letters, digits, - or _ (up to 24).";
  var copyVariants = (list) => (list || []).map((v) => ({ name: v.name, map: { ...v.map } }));
  var variantByName = (list, name) => (list || []).find((v) => v.name === name) || null;
  function addVariant(list, name) {
    name = String(name || "").trim().toLowerCase();
    if (!VARIANT_NAME.test(name)) throw new Error(NAME_RULE);
    if (list.some((v) => v.name === name)) throw new Error(`There is already a variant called ${name}.`);
    if (list.length >= MAX_VARIANTS) throw new Error(`Up to ${MAX_VARIANTS} variants.`);
    return [...list, { name, map: {} }];
  }
  function renameVariant(list, from, to) {
    to = String(to || "").trim().toLowerCase();
    if (to === from) return list;
    if (!VARIANT_NAME.test(to)) throw new Error(NAME_RULE);
    if (list.some((v) => v.name === to)) throw new Error(`There is already a variant called ${to}.`);
    return list.map((v) => v.name === from ? { name: to, map: v.map } : v);
  }
  var deleteVariant = (list, name) => list.filter((v) => v.name !== name);
  function setMapping(list, name, from, to) {
    from = String(from).toLowerCase();
    to = to == null ? null : String(to).toLowerCase();
    const v = variantByName(list, name);
    if (!v || !HEX.test(from) || to !== null && !HEX.test(to)) return list;
    const map = { ...v.map };
    if (to === null || to === from) {
      if (!(from in map)) return list;
      delete map[from];
    } else {
      if (map[from] === to) return list;
      if (!(from in map) && Object.keys(map).length >= MAX_MAPPED) return list;
      map[from] = to;
    }
    return list.map((x) => x === v ? { name: v.name, map } : x);
  }
  function readVariants(raw) {
    if (raw === void 0 || raw === null) return { variants: [] };
    if (!Array.isArray(raw) || raw.length > MAX_VARIANTS) return { error: "colour variants" };
    const names = /* @__PURE__ */ new Set(), out = [];
    for (const v of raw) {
      if (!v || typeof v !== "object" || typeof v.name !== "string" || !VARIANT_NAME.test(v.name) || names.has(v.name)) return { error: "colour variant names" };
      if (!v.map || typeof v.map !== "object" || Array.isArray(v.map)) return { error: `colour variant ${v.name}` };
      const entries = Object.entries(v.map);
      if (entries.length > MAX_MAPPED || !entries.every(([a, b]) => HEX.test(a) && typeof b === "string" && HEX.test(b) && a !== b)) return { error: `colour variant ${v.name}` };
      names.add(v.name);
      out.push({ name: v.name, map: Object.fromEntries(entries) });
    }
    return { variants: out };
  }
  var variantFile = (base, name, ext = ".png") => `${base}_${name}${ext}`;


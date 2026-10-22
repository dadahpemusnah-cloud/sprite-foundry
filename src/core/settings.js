  // src/core/settings.js
  var DEFAULTS = {
    type: "character",
    size: 16,
    palette: "free",
    outline: "tinted",
    shape: "knight",
    color: "knight",
    batch: "forge",
    fps: 8,
    scale: 4,
    bg: "checker",
    heroClass: "random",
    heroLocks: {},
    lockColours: false,
    heroColourClass: null,
    customPalette: [],
    // V1: onion skin (frames back / ahead, red/blue tint, opacity)
    onionBack: 1,
    onionAhead: 1,
    onionTint: "none",
    onionOpacity: 0.3,
    // V1: the live preview's size (1×, 2× or 4× the frame)
    previewScale: 2
  };
  var SIZES = [12, 16, 24, 32];
  var SCALES = [1, 2, 4, 8];
  var OUTLINES = ["tinted", "black", "none"];
  var BACKGROUNDS = ["checker", "grass", "night", "sand"];
  var FPS_RANGE = [2, 24];
  function sanitizeSettings(saved, types) {
    const s = { ...DEFAULTS };
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return s;
    if (typeof saved.type === "string" && Object.prototype.hasOwnProperty.call(types, saved.type)) s.type = saved.type;
    if (SIZES.includes(saved.size)) s.size = saved.size;
    if (saved.palette === "free" || saved.palette === "custom" || typeof saved.palette === "string" && Object.prototype.hasOwnProperty.call(PALETTES, saved.palette)) s.palette = saved.palette;
    if (OUTLINES.includes(saved.outline)) s.outline = saved.outline;
    for (const k of ["shape", "color", "batch"]) {
      const v = saved[k];
      if (typeof v === "string" && v.trim() && v.length <= 64) s[k] = v;
    }
    if (Number.isInteger(saved.fps) && saved.fps >= FPS_RANGE[0] && saved.fps <= FPS_RANGE[1]) s.fps = saved.fps;
    if (SCALES.includes(saved.scale)) s.scale = saved.scale;
    if (BACKGROUNDS.includes(saved.bg)) s.bg = saved.bg;
    if (saved.heroClass === "random" || CLASS_NAMES.includes(saved.heroClass)) s.heroClass = saved.heroClass;
    s.heroLocks = sanitizeHeroLocks(saved.heroLocks);
    if (typeof saved.lockColours === "boolean") s.lockColours = saved.lockColours;
    if (s.lockColours && CLASS_NAMES.includes(saved.heroColourClass)) s.heroColourClass = saved.heroColourClass;
    if (Number.isInteger(saved.onionBack) && saved.onionBack >= 1 && saved.onionBack <= 3) s.onionBack = saved.onionBack;
    if (Number.isInteger(saved.onionAhead) && saved.onionAhead >= 0 && saved.onionAhead <= 3) s.onionAhead = saved.onionAhead;
    if (saved.onionTint === "none" || saved.onionTint === "redblue") s.onionTint = saved.onionTint;
    if (typeof saved.onionOpacity === "number" && saved.onionOpacity >= 0.1 && saved.onionOpacity <= 0.9) s.onionOpacity = Math.round(saved.onionOpacity * 20) / 20;
    if ([1, 2, 4].includes(saved.previewScale)) s.previewScale = saved.previewScale;
    if (Array.isArray(saved.customPalette)) {
      const seen = [];
      for (const c of saved.customPalette) if (typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c) && !seen.includes(c.toLowerCase())) seen.push(c.toLowerCase());
      s.customPalette = seen.slice(0, CUSTOM_MAX);
    }
    return s;
  }
  function sanitizeHeroLocks(locks) {
    const out = {};
    if (!locks || typeof locks !== "object" || Array.isArray(locks)) return out;
    for (const slot of HUMANOID.slots) {
      if (slot.name === "body" || !Object.prototype.hasOwnProperty.call(locks, slot.name)) continue;
      const v = locks[slot.name];
      if (v === "none" && slot.optional || typeof v === "string" && PARTS_BY_ID[v] && PARTS_BY_ID[v].slot === slot.name) out[slot.name] = v;
    }
    return out;
  }


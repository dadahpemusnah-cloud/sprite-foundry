  // src/core/color.js
  var rgbCache = /* @__PURE__ */ new Map();
  function hexToRgb(h) {
    let v = rgbCache.get(h);
    if (!v) {
      const n = parseInt(h.slice(1), 16);
      v = [n >> 16 & 255, n >> 8 & 255, n & 255];
      rgbCache.set(h, v);
    }
    return v;
  }
  function rgbToHex(r, g, b) {
    return "#" + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join("");
  }
  function hsl(h, s, l) {
    h = (h % 360 + 360) % 360;
    s = clamp(s, 0, 100) / 100;
    l = clamp(l, 0, 100) / 100;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => {
      const k = (n + h / 30) % 12;
      return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    };
    return rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255);
  }
  function toward(h, t, amt) {
    const d = (t - h + 540) % 360 - 180;
    return h + Math.sign(d) * Math.min(Math.abs(d), amt);
  }
  function ramp(h, s, l) {
    return { sh2: hsl(toward(h, 245, 34), s * 0.85, l - 30), sh: hsl(toward(h, 245, 16), s * 0.95, l - 15), base: hsl(h, s, l), hi: hsl(toward(h, 65, 14), s * 0.9, l + 14), hi2: hsl(toward(h, 65, 24), s * 0.7, l + 27) };
  }
  function mix(a, b, t) {
    const A = hexToRgb(a), B = hexToRgb(b);
    return rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
  }
  function lum(h) {
    const [r, g, b] = hexToRgb(h);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }


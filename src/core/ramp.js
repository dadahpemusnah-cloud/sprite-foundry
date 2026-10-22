  // src/core/ramp.js
  function toHsl(hex) {
    const [r, g, b] = hexToRgb(hex).map((v) => v / 255), max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
    if (!d) return [0, 0, l * 100];
    const s = d / (1 - Math.abs(2 * l - 1));
    const h = max === r ? (g - b) / d % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [(h * 60 + 360) % 360, s * 100, l * 100];
  }
  function buildRamp(base, n = 5, { hueShift = 12, lightStep = 12 } = {}) {
    base = String(base).toLowerCase();
    if (!/^#[0-9a-f]{6}$/.test(base)) throw new Error("A ramp starts from a colour like #3a7bd5.");
    n = clamp(Math.round(n), 3, 9);
    const [h, s, l] = toHsl(base), out = [];
    let a = Math.floor((n - 1) / 2), b = n - 1 - a;
    const up = 97 - l, down = l - 3, MIN = 4;
    while (a > 0 && up / a < MIN) {
      a--;
      b++;
    }
    while (b > 0 && down / b < MIN) {
      b--;
      a++;
    }
    const su = a ? Math.min(lightStep, up / a) : 0, sd = b ? Math.min(lightStep, down / b) : 0;
    for (let i = 0; i < n; i++) {
      const d = a - i;
      if (!d) {
        out.push(base);
        continue;
      }
      const hue = toward(h, d > 0 ? 60 : 245, Math.abs(d) * hueShift);
      const sat = s ? clamp(s * (1 - 0.07 * Math.abs(d)) + (d < 0 ? 4 : 0), 0, 100) : 0;
      out.push(hsl(hue, sat, clamp(d > 0 ? l + d * su : l + d * sd, 3, 97)));
    }
    return [...new Set(out)];
  }


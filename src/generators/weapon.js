  // src/generators/weapon.js
  function drawWeapon(s, pose2, put) {
    const W = s.meta.weapon;
    if (!W) return;
    const { kind, wx, hy, len, blade, guard, grip, gem, thick, os, legB } = W;
    if (kind === "sword") {
      if (pose2 === "forward") {
        put(wx, hy, grip);
        for (let k = -1; k <= 1; k++) put(wx + 1, hy + k, k ? guard.sh : guard.base);
        for (let i = 0; i < len; i++) {
          put(wx + 2 + i, hy, i === len - 1 ? blade.hi2 : blade.base);
          if (thick) put(wx + 2 + i, hy - 1, blade.hi);
        }
      } else {
        put(wx, hy, grip);
        put(wx, hy + 1, guard.sh);
        for (let k = -1; k <= 1; k++) put(wx + k, hy - 1, k ? guard.sh : guard.base);
        for (let y = hy - 2; y >= hy - 1 - len; y--) {
          put(wx, y, y === hy - 1 - len ? blade.hi2 : blade.hi);
          if (thick) put(wx + 1, y, blade.sh);
        }
      }
    } else if (kind === "axe") {
      const hh = Math.max(2, Math.round(len * 0.4));
      if (pose2 === "forward") {
        for (let x = wx; x < wx + len; x++) put(x, hy, grip);
        for (let y = hy - hh; y < hy; y++) {
          put(wx + len - 2, y, blade.base);
          put(wx + len - 1, y, blade.hi);
        }
        put(wx + len - 2, hy + 1, blade.sh);
        put(wx + len - 1, hy + 1, blade.base);
      } else {
        const top = hy - len + 1;
        for (let y = top; y <= hy + 1; y++) put(wx, y, grip);
        for (let y = top; y < top + hh; y++) {
          put(wx + 1, y, blade.base);
          put(wx + 2, y, blade.hi);
        }
        put(wx - 1, top + 1, blade.sh);
      }
    } else if (kind === "staff") {
      const top = hy - len + 2;
      for (let y = top; y <= legB - 1; y++) put(wx, y, y === top ? grip : mix(grip, "#000000", y % 3 === 0 ? 0.2 : 0));
      for (let dy = 0; dy < os; dy++) for (let dx = 0; dx < os; dx++) put(wx + dx, top - os + dy, dx === 0 && dy === 0 ? gem.hi2 : dx === os - 1 && dy === os - 1 ? gem.sh : gem.base);
    }
  }


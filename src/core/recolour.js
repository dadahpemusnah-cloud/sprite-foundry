  // src/core/recolour.js
  var countColour = (px, c) => {
    let n = 0;
    for (const x of px) if (x === c) n++;
    return n;
  };
  var replacePixels = (px, from, to) => px.includes(from) ? px.map((c) => c === from ? to : c) : px;
  function mapPixels(px, map) {
    let out = null;
    for (let i = 0; i < px.length; i++) {
      const to = px[i] && map[px[i]];
      if (to && to !== px[i]) {
        if (!out) out = px.slice();
        out[i] = to;
      }
    }
    return out || px;
  }


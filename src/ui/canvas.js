  // src/ui/canvas.js
  function toCanvas(out, F) {
    const c = document.createElement("canvas");
    c.width = F;
    c.height = F;
    const ctx = c.getContext("2d"), id = ctx.createImageData(F, F);
    for (let i = 0; i < out.length; i++) {
      const h = out[i];
      if (!h) continue;
      const [r, g, b] = hexToRgb(h);
      id.data[i * 4] = r;
      id.data[i * 4 + 1] = g;
      id.data[i * 4 + 2] = b;
      id.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(id, 0, 0);
    return c;
  }
  function blit(ctx, cv, x, y, scale) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(cv, 0, 0, cv.width, cv.height, x, y, cv.width * scale, cv.height * scale);
  }
  function observeSize(el2, draw) {
    new ResizeObserver(() => {
      if (el2.offsetWidth || el2.offsetHeight) draw();
    }).observe(el2);
  }
  function tinted(cv, [r, g, b]) {
    const c = document.createElement("canvas");
    c.width = cv.width;
    c.height = cv.height;
    const ctx = c.getContext("2d");
    ctx.drawImage(cv, 0, 0);
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle = `rgba(${r},${g},${b},0.5)`;
    ctx.fillRect(0, 0, c.width, c.height);
    return c;
  }


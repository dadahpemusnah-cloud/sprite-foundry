// Renders 3D-to-pixel Adventurer previews in 8 directions to a PNG: node tools/adv3d-preview.mjs out.png [class:seed ...]
import fs from 'node:fs';
import vm from 'node:vm';
import zlib from 'node:zlib';
const src = ['src/core/util.js', 'src/core/color.js', 'src/core/rng.js', 'src/generators/character.js', 'src/generators/adv3d.js'].map((f) => fs.readFileSync(f, 'utf8')).join('\n');
const ctx = vm.createContext({});
vm.runInContext(src + '\nthis.api = { a3Figure, a3Render, A3_N };', ctx);
const { a3Figure, a3Render, A3_N: N } = ctx.api;
const [out = 'adv3d.png', ...args] = process.argv.slice(2);
const list = args.length ? args : ['fighter:a', 'wizard:a', 'druid:a'];
const DIRS = ['S', 'SW', 'W', 'NW', 'N', 'NE', 'E', 'SE'], F = N + 4, K = 4, W = DIRS.length * F * K, H = list.length * F * K;
const img = Buffer.alloc(W * H * 4, 255);
const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const t0 = Date.now();
list.forEach((item, r) => {
  const [cls, seed = 'a'] = item.split(':'), fig = a3Figure(cls, seed);
  DIRS.forEach((dir, c) => {
    const cells = a3Render(fig, dir), g = (x, y) => (x >= 0 && y >= 0 && x < N && y < N && cells[y * N + x] ? cells[y * N + x].colour : null);
    for (let y = -2; y < N + 2; y++) for (let x = -2; x < N + 2; x++) {
      const col = g(x, y) ? hex(g(x, y)) : [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => g(x + a, y + b)) ? [26, 18, 24] : (((x + y) & 1) ? [228, 230, 236] : [240, 241, 245]);
      for (let yy = 0; yy < K; yy++) for (let xx = 0; xx < K; xx++) {
        const X = (c * F + x + 2) * K + xx, Y = (r * F + y + 2) * K + yy, o = (Y * W + X) * 4;
        img[o] = col[0]; img[o + 1] = col[1]; img[o + 2] = col[2]; img[o + 3] = 255;
      }
    }
  });
});
const crc = (b) => { let c = ~0; for (const v of b) { c ^= v; for (let k = 0; k < 8; k++) c = c >>> 1 ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const raw = Buffer.alloc((W * 4 + 1) * H);
for (let y = 0; y < H; y++) img.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4);
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
fs.writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.log('wrote', out, 'in', Date.now() - t0, 'ms');

// Draws generated chibis in all 8 directions to a PNG (no browser): node tools/chibi-preview.mjs out.png [seed...]
import fs from 'node:fs';
import vm from 'node:vm';
import zlib from 'node:zlib';
const src = ['src/core/util.js', 'src/core/color.js', 'src/core/rng.js', 'src/generators/character.js', 'src/generators/chibi.js'].map((f) => fs.readFileSync(f, 'utf8')).join('\n');
const ctx = vm.createContext({});
vm.runInContext(src + '\nthis.api = { chibiDesign, chibiView, chibiCompose, CHIBI_N };', ctx);
const { chibiDesign, chibiView, chibiCompose, CHIBI_N: N } = ctx.api;
const [out = 'chibi.png', ...seeds] = process.argv.slice(2);
const list = seeds.length ? seeds : ['a:villager', 'b:knight', 'c:mage', 'd:archer', 'e:rogue', 'f:warrior', 'g:zombie', 'h:random'];
const DIRS = ['S', 'SW', 'W', 'NW', 'N', 'NE', 'E', 'SE'], F = N + 4, K = 5, W = DIRS.length * F * K, H = list.length * F * K;
const img = Buffer.alloc(W * H * 4, 255);
const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
list.forEach((seed, r) => {
  const [sd, cls = 'random'] = seed.split(':'), d = chibiDesign(sd, sd, cls);
  DIRS.forEach((dir, c) => {
    const { px } = chibiCompose(chibiView(d, dir));
    const g = (x, y) => (x >= 0 && y >= 0 && x < N && y < N ? px[y * N + x] : null);
    for (let y = -2; y < N + 2; y++) for (let x = -2; x < N + 2; x++) {
      let col = g(x, y) ? hex(g(x, y)) : [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => g(x + a, y + b)) ? [40, 24, 30] : (((x + y) & 1) ? [236, 236, 240] : [250, 250, 252]);
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
console.log('wrote', out, list.map((s) => { const [a, c = 'random'] = s.split(':'), d = chibiDesign(a, a, c); return `${s}: ${d.cls} ${d.hair}/${d.hat}/${d.weapon}/${d.offhand}/${d.eyes}`; }).join('\n'));

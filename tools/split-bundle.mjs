// One-off: splits the published single-file bundle into page/head.html, src/**.js and page/tail.html
// at its "  // src/..." module markers. tools/build.mjs joins them back byte for byte.
import fs from 'node:fs';
import path from 'node:path';
const html = fs.readFileSync(process.argv[2] || 'index.html', 'utf8');
const lines = html.split('\n');
const marker = /^  \/\/ (src\/\S+\.js)$/;
const first = lines.findIndex((l) => marker.test(l));
const end = lines.lastIndexOf('})();'); // closes the bundle's IIFE
const order = [];
fs.mkdirSync('page', { recursive: true });
fs.writeFileSync('page/head.html', lines.slice(0, first).join('\n') + '\n');
let start = first;
for (let i = first + 1; i <= end; i++) {
  if (i === end || marker.test(lines[i])) {
    const file = lines[start].match(marker)[1];
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, lines.slice(start, i).join('\n') + '\n');
    order.push(file);
    start = i;
  }
}
fs.writeFileSync('page/tail.html', lines.slice(end).join('\n'));
fs.writeFileSync('src/order.json', JSON.stringify(order, null, 1) + '\n');
console.log(`${order.length} modules`);

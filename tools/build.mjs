// Builds index.html from page/head.html + src modules (in src/order.json order) + page/tail.html.
// usage: node tools/build.mjs [out=index.html]
import fs from 'node:fs';
const order = JSON.parse(fs.readFileSync('src/order.json', 'utf8'));
const parts = [fs.readFileSync('page/head.html', 'utf8'), ...order.map((f) => fs.readFileSync(f, 'utf8')), fs.readFileSync('page/tail.html', 'utf8')];
fs.writeFileSync(process.argv[2] || 'index.html', parts.join(''));
console.log(`built ${process.argv[2] || 'index.html'} from ${order.length} modules`);

// Baseline: every sprite type x every export preset and export button, files hashed one by one.
// node tests/baseline-exports.mjs          compare with tests/baseline/exports.json
// node tests/baseline-exports.mjs --update write it (only when an export change is intended)
import fs from 'node:fs';
import { openPage, download } from './lib.mjs';
const FILE = 'tests/baseline/exports.json', update = process.argv.includes('--update');
const TYPES = ['character', 'creature', 'ship', 'item', 'hero'];
const BUTTONS = ['#pngBtn', '#jsonBtn', '#gifBtn', '#aseBtn', '#zipBtn'];
const { browser, page, errors } = await openPage();
const presets = await page.$$eval('#exportPreset option', (os) => os.map((o) => o.value));
const got = {};
for (const type of TYPES) {
  await page.evaluate((t) => __sf.configure({ type: t }), type);
  for (const b of BUTTONS) got[`${type} ${b}`] = (await download(page, () => page.click(b))).files;
  for (const p of presets) {
    await page.selectOption('#exportPreset', p);
    got[`${type} preset:${p}`] = (await download(page, () => page.click('#presetBtn'))).files;
  }
}
await browser.close();
if (errors.length) { console.error('page errors:', errors); process.exit(1); }
const n = Object.values(got).reduce((s, f) => s + Object.keys(f).length, 0);
if (update) {
  fs.mkdirSync('tests/baseline', { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(got, null, 1) + '\n');
  console.log(`wrote ${FILE}: ${Object.keys(got).length} exports, ${n} files`);
  process.exit(0);
}
const want = JSON.parse(fs.readFileSync(FILE, 'utf8')), diffs = [];
for (const k of new Set([...Object.keys(want), ...Object.keys(got)])) {
  const a = want[k] || {}, b = got[k] || {};
  for (const f of new Set([...Object.keys(a), ...Object.keys(b)])) if (a[f] !== b[f]) diffs.push(`${k}: ${f} ${a[f] ? (b[f] ? 'changed' : 'missing') : 'new'}`);
}
console.log(diffs.length ? `EXPORTS DIFFER (${diffs.length}):\n` + diffs.slice(0, 40).join('\n') : `exports match baseline: ${Object.keys(got).length} exports, ${n} files`);
process.exit(diffs.length ? 1 : 0);

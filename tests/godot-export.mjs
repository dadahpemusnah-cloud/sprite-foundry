// Drives image → rig → animations in the page, exports the Godot preset and unpacks it to argv[2].
import { chromium, webkit } from 'playwright';
import JSZip from 'jszip';
import fs from 'node:fs';
import path from 'node:path';
const out = process.argv[2], engine = process.argv[3] === 'webkit' ? webkit : chromium;
const anims = (process.argv[4] || 'anIdle,anWalk,anAttack').split(',');
const b = await engine.launch();
const p = await b.newPage({ acceptDownloads: true });
const errors = [];
await p.route('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js', r => r.fulfill({ path: 'node_modules/jszip/dist/jszip.min.js', contentType: 'text/javascript' }));
await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
p.on('pageerror', e => errors.push(e.message));
await p.goto('file://' + path.resolve(process.env.SF_HTML || 'index.html'));
await p.setInputFiles('#importFile', 'tests/character.png');
await p.waitForSelector('#bgWork:not([hidden])');
await p.selectOption('#bgMethod', 'flood');
await p.click('#bgRun');
await p.waitForSelector('#convApply:not([disabled])', { timeout: 30000 });
await p.click('#convApply');
await p.click('#ptGuess');
await p.click('#rigSuggest');
for (const a of anims) { await p.click('#' + a); await p.waitForTimeout(300); }
// SF_SPARSE: drop the attack keys at frames 2 and 3 so frames 2-3 are eased in-betweens Godot must interpolate
if (process.env.SF_SPARSE) {
  const name = await p.evaluate(() => __sf.animInfo.name);
  if (name !== 'attack') throw new Error('expected attack selected, got ' + name);
  await p.click('#anNext'); await p.click('#anNext'); await p.click('#anKeyDel');
  await p.click('#anNext'); await p.click('#anKeyDel');
  const keys = await p.evaluate(() => __sf.animInfo.anim.keys.map(k => k.t + ':' + k.ease));
  console.log('sparse attack keys', keys.join(' '));
  if (keys.some(k => k.startsWith('2:') || k.startsWith('3:'))) throw new Error('keys 2/3 not deleted');
  // and swing the left arm across the torso at key 7, so parts overlap in a different colour without an order change
  for (let i = 0; i < 4; i++) await p.click('#anNext');
  await p.selectOption('#anBone', 'upperArmL');
  await p.fill('#anRotN', String(process.env.SF_ARM || -70));
  await p.dispatchEvent('#anRotN', 'change');
  const k7 = await p.evaluate(() => ({ f: __sf.animInfo.frame, k: __sf.animInfo.anim.keys.find(k => k.t === 7) }));
  console.log('key 7 upperArmL', k7.f, k7.k && k7.k.pose.rot.upperArmL);
}
const info = await p.evaluate(() => ({ rig: __sf.rigInfo, anim: __sf.animInfo, rows: __sf.sheetRows }));
await p.selectOption('#exportPreset', 'godot');
const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#presetBtn')]);
const zip = await JSZip.loadAsync(fs.readFileSync(await dl.path()));
fs.rmSync(out, { recursive: true, force: true });
for (const [n, f] of Object.entries(zip.files)) {
  if (f.dir) continue;
  fs.mkdirSync(path.dirname(path.join(out, n)), { recursive: true });
  fs.writeFileSync(path.join(out, n), await f.async('nodebuffer'));
}
fs.writeFileSync(path.join(out, '_info.json'), JSON.stringify({ download: dl.suggestedFilename(), errors, ...info }, null, 1));
console.log(JSON.stringify({ download: dl.suggestedFilename(), files: Object.keys(zip.files).length, errors }));
await b.close();

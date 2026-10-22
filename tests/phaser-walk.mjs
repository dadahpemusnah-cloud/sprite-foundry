// Phaser runtime (V6 stage 5): a four-direction walk exported with the Phaser preset loads in Phaser 3.90
// (the version the export README names) with load.aseprite + anims.createFromAseprite, played the way the
// README says (repeat from meta.animationSettings, since createFromAseprite ignores loop settings), and each
// of walk_down/up/left/right has 12 frames in sheet order, plays at 10 fps (1.2 s per loop) and loops.
// Also: the default compass names are unchanged, and the setting reaches every export file.
import { openPage, rigFourDirections, download } from './lib.mjs';
import { chromium } from 'playwright';
import fs from 'node:fs';
const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const SCREEN = ['walk_down', 'walk_up', 'walk_left', 'walk_right'], COMPASS = ['walk', 'walk_n', 'walk_w', 'walk_e'];

const { browser, page, errors } = await openPage();
await rigFourDirections(page);
await page.click('#aaApply');
await page.selectOption('#exportPreset', 'phaser');
const tagNames = async (zip) => JSON.parse(await zip.file(Object.keys(zip.files).find((n) => n.endsWith('.json') && n !== 'manifest.json')).async('string')).meta.frameTags.map((t) => t.name);
const compass = await download(page, () => page.click('#presetBtn'));
const cTags = await tagNames(compass.zip);
ok(COMPASS.every((n) => cTags.includes(n)) && !cTags.some((n) => /_(down|up|left|right)$/.test(n)), 'default export does not use compass names: ' + cTags);
await page.selectOption('#dirNames', 'screen');
const screen = await download(page, () => page.click('#presetBtn'));
const sTags = await tagNames(screen.zip);
ok(SCREEN.every((n) => sTags.includes(n)) && !COMPASS.some((n) => sTags.includes(n)), 'screen export tags: ' + sTags);
ok(sTags.includes('pose'), 'the rest pose row was renamed: ' + sTags);
const manifest = JSON.parse(await screen.zip.file('manifest.json').async('string'));
ok(SCREEN.every((n) => manifest.animations.some((a) => a.name === n && a.frames === 12 && a.fps === 10 && a.loop)), 'manifest animations: ' + manifest.animations.map((a) => `${a.name}/${a.frames}/${a.fps}`).join(' '));
// other exports follow the setting: full pack GIF names, Godot SpriteFrames
await page.selectOption('#exportPreset', 'full');
const full = await download(page, () => page.click('#presetBtn'));
ok(SCREEN.every((n) => Object.keys(full.files).some((f) => f.endsWith(`/${n}.gif`))), 'full pack GIFs: ' + Object.keys(full.files).filter((f) => f.endsWith('.gif')));
await page.selectOption('#exportPreset', 'godot');
const godot = await download(page, () => page.click('#presetBtn'));
const tres = await godot.zip.file(Object.keys(godot.zip.files).find((n) => n.endsWith('.tres'))).async('string');
ok(SCREEN.every((n) => tres.includes(`&"${n}"`)), 'Godot SpriteFrames names do not follow the setting');
await page.selectOption('#exportPreset', 'unity');
const unity = await download(page, () => page.click('#presetBtn'));
ok(SCREEN.every((n) => Object.keys(unity.files).some((f) => f.endsWith(`${n}.anim`))), 'Unity clips: ' + Object.keys(unity.files).filter((f) => f.endsWith('.anim')));
const ase = await download(page, () => page.click('#aseBtn'));
const aseBytes = ase.buf.toString('latin1');
ok(SCREEN.every((n) => aseBytes.includes(n)) && !/walk_[nwe]\b/.test(aseBytes), 'Aseprite tags do not follow the setting');
const sheetName = Object.keys(screen.zip.files).find((n) => n.endsWith('.png')), jsonName = Object.keys(screen.zip.files).find((n) => n.endsWith('.json') && n !== 'manifest.json');
const files = { 'sheet.png': await screen.zip.file(sheetName).async('nodebuffer'), 'sheet.json': await screen.zip.file(jsonName).async('nodebuffer') };
const atlas = JSON.parse(files['sheet.json']);
// the setting is saved with the project
const proj = await download(page, () => page.click('#saveProject'));
fs.writeFileSync('/tmp/sf-dirnames-project.json', proj.buf);
ok(!errors.length, 'page errors in the app: ' + errors.join(' | '));
await browser.close();
{
  const o = await openPage();
  await o.page.setInputFiles('#openFile', '/tmp/sf-dirnames-project.json');
  await o.page.waitForTimeout(800);
  const st = await o.page.evaluate(() => [__sf.state.dirNames, document.querySelector('#dirNames').value]);
  ok(st[0] === 'screen' && st[1] === 'screen', 'reopened project lost the direction names setting: ' + st);
  ok(!o.errors.length, 'page errors reopening the project: ' + o.errors.join(' | '));
  await o.browser.close();
}

// the Phaser scene, served over http (the loader fetches the JSON)
files['phaser.js'] = fs.readFileSync(process.env.SF_PHASER || 'node_modules/phaser/dist/phaser.min.js');
files['index.html'] = Buffer.from(`<!doctype html><meta charset="utf-8"><body><script src="phaser.js"></script><script>
const KEYS = ${JSON.stringify(SCREEN)};
window.log = {};
class S extends Phaser.Scene {
  preload() { this.load.aseprite('sf', 'sheet.png', 'sheet.json'); }
  create() {
    const made = this.anims.createFromAseprite('sf');
    window.created = made.map((a) => ({ key: a.key, frames: a.frames.map((f) => f.textureFrame), repeat: a.repeat, duration: a.duration, msPerFrame: a.frames.map((f) => f.duration || a.msPerFrame) }));
    KEYS.forEach((k, i) => {
      const s = this.add.sprite(60 + i * 120, 120, 'sf');
      const L = window.log[k] = { frames: [], repeats: 0 };
      s.on('animationupdate', (anim, frame) => L.frames.push([performance.now(), frame.textureFrame]));
      s.on('animationrepeat', () => L.repeats++);
      s.on('animationstart', () => L.frames.push([performance.now(), s.anims.currentFrame.textureFrame]));
      // as the export README says: createFromAseprite ignores loop settings, so pass repeat
      const meta = this.cache.json.get('sf').meta;
      s.play({ key: k, repeat: meta.animationSettings[k].loop ? -1 : 0 });
    });
    window.started = performance.now();
  }
}
new Phaser.Game({ type: Phaser.CANVAS, width: 480, height: 240, scene: S, banner: false, audio: { noAudio: true } });
</script>`);
const b = await chromium.launch(), p = await b.newPage(), perr = [];
p.on('pageerror', (e) => perr.push(e.message));
await p.route('http://phaser.test/**', (r) => { const f = new URL(r.request().url()).pathname.slice(1) || 'index.html'; return files[f] ? r.fulfill({ body: files[f], contentType: f.endsWith('.js') ? 'text/javascript' : f.endsWith('.png') ? 'image/png' : f.endsWith('.json') ? 'application/json' : 'text/html' }) : r.fulfill({ status: 404 }); });
await p.goto('http://phaser.test/index.html');
await p.waitForFunction(() => window.started, null, { timeout: 15000 });
await p.waitForTimeout(2700);
const res = await p.evaluate(() => ({ created: window.created, log: window.log, version: Phaser.VERSION }));
await b.close();
ok(!perr.length, 'Phaser page errors: ' + perr.join(' | '));
console.log(`Phaser ${res.version}: created ${res.created.length} animations`);
for (const k of SCREEN) {
  const a = res.created.find((x) => x.key === k), tag = atlas.meta.frameTags.find((t) => t.name === k);
  if (!a) { fails.push(`${k}: not created`); continue; }
  const want = Array.from({ length: tag.to - tag.from + 1 }, (_, i) => String(tag.from + i));
  ok(a.frames.length === 12, `${k}: ${a.frames.length} frames`);
  ok(JSON.stringify(a.frames) === JSON.stringify(want), `${k}: frame order ${a.frames} is not the sheet's ${want}`);
  ok(atlas.meta.animationSettings[k].loop === true, `${k}: the atlas does not mark it as looping`);
  ok(Math.abs(a.duration - 1200) < 2, `${k}: duration ${a.duration} ms, not 1200`);
  // what actually played: frames in order, wrapping round, about 100 ms each
  const L = res.log[k], seen = L.frames.map((f) => f[1]);
  const start = seen.indexOf(want[0]), run = seen.slice(start, start + 13);
  ok(JSON.stringify(run.slice(0, 12)) === JSON.stringify(want) && run[12] === want[0], `${k}: played ${run.join(',')}`);
  ok(L.repeats >= 1, `${k}: never looped in 2.7 s`);
  const t = L.frames.map((f) => f[0]), span = (t[start + 12] - t[start]);
  ok(Math.abs(span - 1200) < 150, `${k}: one loop took ${Math.round(span)} ms, not about 1200`);
  console.log(`  ${k}: ${a.frames.length} frames ${a.frames[0]}-${a.frames[11]}, repeat ${a.repeat}, ${a.duration} ms; played one loop in ${Math.round(span)} ms, looped ${L.repeats}x`);
}
console.log(fails.length ? 'PHASER WALK FAIL\n' + fails.join('\n') : 'phaser walk: all four animations load, play in order at 10 fps and loop');
process.exit(fails.length ? 1 : 0);

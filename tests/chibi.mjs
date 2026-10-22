// V7.0: the Chibi type. A generated character with parts and joints in all 8 directions and idle, walk,
// run and sneak (8 frames each) in every direction; seeds and variations draw it again; it saves and
// reopens; it never silently replaces an imported character; Auto Animate and exports work with it.
import { openPage, download, rigImage } from './lib.mjs';
import fs from 'node:fs';
import vm from 'node:vm';
const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const DIRS = ['S', 'E', 'W', 'N', 'SE', 'SW', 'NE', 'NW'], MOTIONS = ['idle', 'walk', 'run', 'sneak'];

// the drawing on its own (no browser): deterministic, every pixel in a part, left views mirror right ones
{
  const src = ['src/core/util.js', 'src/core/color.js', 'src/core/rng.js', 'src/generators/character.js', 'src/generators/chibi.js'].map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  const ctx = vm.createContext({});
  vm.runInContext(src + '\nthis.api = { chibiDesign, chibiView, chibiCompose, CHIBI_N, CHIBI_CLASSES };', ctx);
  const { chibiDesign, chibiView, chibiCompose, CHIBI_N: N, CHIBI_CLASSES } = ctx.api;
  const pic = (seed, dir, cls = 'villager') => chibiCompose(chibiView(chibiDesign(seed, seed, cls), dir));
  ok(JSON.stringify(pic('oak', 'SE')) === JSON.stringify(pic('oak', 'SE')), 'the same seeds draw a different chibi');
  const designs = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((s) => JSON.stringify(pic(s, 'S').px)));
  ok(designs.size >= 7, `8 seeds gave only ${designs.size} different chibis`);
  for (const seed of ['oak', 'luna', 'zed', 'mira']) for (const cls of Object.keys(CHIBI_CLASSES)) for (const dir of DIRS) {
    const { px, owner } = pic(seed, dir, cls);
    ok(px.every((c, i) => !c === !owner[i]), `${seed} ${dir}: a pixel without a part (or a part without a pixel)`);
    const rows = px.map((c, i) => (c ? i / N | 0 : -1)).filter((y) => y >= 0);
    ok(Math.max(...rows) <= 30 && Math.min(...rows) >= 3, `${seed} ${cls} ${dir}: drawn outside rows 3-30 (no room for a run's lift)`);
    // gear is held: every weapon, shield or bow touches (or overlaps) its own hand, also in the mirrored views
    const v = chibiView(chibiDesign(seed, seed, cls), dir);
    for (const [gear, hand] of [['weapon', 'handR'], ['shield', 'handL'], ['bow', 'handL']]) if (v.layers[gear]) {
      const H = [...v.layers[hand].keys()], G = [...v.layers[gear].keys()];
      const dist = Math.min(...G.map((g) => Math.min(...H.map((h) => Math.max(Math.abs(g % N - h % N), Math.abs((g / N | 0) - (h / N | 0)))))));
      ok(dist <= 1, `${seed} ${cls} ${dir}: the ${gear} is ${dist} px from ${hand}`);
    }
  }
  const classes = Object.keys(CHIBI_CLASSES).map((c) => chibiDesign('oak', 'oak', c));
  ok(classes.find((d) => d.cls === 'knight').weapon === 'sword' && classes.find((d) => d.cls === 'archer').offhand === 'bow' && classes.find((d) => d.cls === 'mage').hat === 'wizard', 'class gear: ' + JSON.stringify(classes.map((d) => [d.cls, d.weapon, d.offhand, d.hat])));
  for (const [l, r] of [['W', 'E'], ['SW', 'SE'], ['NW', 'NE']]) {
    const a = pic('oak', l), b = pic('oak', r), m = (i) => (i / N | 0) * N + N - 1 - i % N;
    ok(a.px.every((c, i) => c === b.px[m(i)]), `${l} is not ${r} mirrored`);
    ok(a.owner.every((o, i) => !o || o.replace(/L$/, '#').replace(/R$/, 'L').replace('#', 'R') === b.owner[m(i)]), `${l}: left and right parts are not swapped from ${r}`);
  }
}

const { browser, page, errors } = await openPage();
let dialogs = 0;
page.on('dialog', (d) => { dialogs++; d.accept(); });
const t0 = Date.now();
await page.click('#typeSeg button[data-val="chibi"]');
await page.waitForFunction(() => __sf.state.type === 'chibi' && __sf.imported && __sf.imported.views.length === 7, null, { timeout: 60000 });
const ms = Date.now() - t0;
ok(await page.evaluate(() => !document.querySelector('#chibiGroup').hidden), 'the chibi class picker is not shown');
await page.selectOption('#chibiClass', 'villager');
await page.waitForFunction(() => __sf.state.chibiClass === 'villager' && /^Villager/.test(document.querySelector('#chibiInfo').textContent), null, { timeout: 60000 });
await page.waitForTimeout(1500);
const made = await page.evaluate(() => ({
  rows: __sf.timeline.order,
  frames: Object.fromEntries(__sf.timeline.order.map((n) => [n, __sf.timeline.anims[n].frames.length])),
  views: __sf.imported.views.map((v) => [v.direction, v.anims.slice().sort().join()]),
  main: __sf.imported.direction,
  check: __sf.check,
  thumbs: __sf.thumbs.length,
  seedsOn: !document.querySelector('#shapeSeed').disabled
}));
ok(made.main === 'S' && made.views.length === 7 && made.views.every(([, a]) => a === 'idle,run,sneak,walk'), 'directions or their animations: ' + JSON.stringify(made.views));
const want = ['pose', ...DIRS.flatMap((d) => MOTIONS.map((m) => (d === 'S' ? m : `${m}_${d.toLowerCase()}`)))];
ok(want.every((r) => made.rows.includes(r)) && made.rows.length === want.length, 'rows: ' + made.rows.join(' '));
ok(want.slice(1).every((r) => made.frames[r] === 8), 'not 8 frames each: ' + JSON.stringify(made.frames));
ok(made.check.errors === 0, 'frame check errors: ' + made.check.errors);
const bad = made.check.findings.filter((f) => f.level === 'warning' && !(/^idle/.test(f.anim) && ['duplicate', 'same-frame'].includes(f.code)));
ok(!bad.length, 'frame check warnings beyond held idle frames: ' + bad.map((f) => f.code + ' ' + f.message).join(' | '));
ok(made.thumbs === 12 && made.seedsOn, 'variations or seeds not available for the chibi');
// every direction: rig preflight ready, so parts, joints and the exact rest pose hold
for (const d of DIRS) {
  await page.evaluate((x) => __sf.switchDirection(x), d);
  await page.waitForFunction(() => __sf.preflight, null, { timeout: 20000 });
  await page.waitForTimeout(300);
  const pf = await page.evaluate(() => __sf.preflight);
  ok(pf.state === 'ready', `direction ${d} preflight: ` + JSON.stringify(pf.items.filter((i) => i.state === 'attention')));
}
await page.evaluate(() => __sf.switchDirection('S'));
// motion: the walk's frames differ, its feet stay on one row, it loops back cleanly (checked above)
const walk = await page.evaluate(() => [0, 2, 4, 6].map((i) => __sf.framesFor('walk_e')[i].out.join()));
ok(new Set(walk).size === 4, 'walk_e frames 1, 3, 5, 7 are not all different');

// seeds and variations draw it again
const before = await page.evaluate(() => __sf.sprite.px.join());
await page.fill('#shapeSeed', 'zed');
await page.dispatchEvent('#shapeSeed', 'change');
await page.waitForFunction((b) => __sf.sprite.px.join() !== b && __sf.state.shape === 'zed', before, { timeout: 30000 });
const thumbSeed = await page.evaluate(() => __sf.thumbs[3].seed);
await page.click('#thumbs .thumb:nth-child(4)');
await page.waitForFunction((s) => __sf.state.shape === s && __sf.imported.views.length === 7, thumbSeed, { timeout: 30000 });
ok(dialogs === 0, 'reseeding an unchanged chibi asked first');

// Auto Animate: run on all 8 directions, replacing the chibi's run after confirming
await page.selectOption('#aaMotion', 'run');
await page.click('#aaPreview');
const aa = await page.evaluate(() => __sf.autoAnimate);
ok(aa.status.every((s) => s.ok) && aa.built && aa.built.dirs.length === 8 && aa.built.frames === 8, 'Auto Animate on the chibi: ' + JSON.stringify(aa.status.filter((s) => !s.ok)));
await page.click('#aaApply');
ok(dialogs === 1, 'replacing the run did not ask');
ok(/run_ne/.test((await page.evaluate(() => __sf.timeline.order)).join()), 'run_ne missing after Auto Animate');

// classes with gear: a combat motion in every direction, the gear rigged to its hand, nothing cut off
for (const [cls, motion] of [['knight', 'attack'], ['mage', 'cast'], ['archer', 'bow']]) {
  await page.selectOption('#chibiClass', cls);
  await page.waitForTimeout(300);
  // the run Auto Animate replaced is a change: drawing the chibi again asks first
  if (await page.evaluate(() => __sf.guardOpen)) await page.click('#guardGo');
  await page.waitForFunction((c) => __sf.state.chibiClass === c && document.querySelector('#chibiInfo').textContent.toLowerCase().startsWith(c), cls, { timeout: 60000 });
  await page.waitForTimeout(2000);
  const r = await page.evaluate(([m]) => ({ rows: __sf.timeline.order, frames: __sf.timeline.anims[m] ? __sf.timeline.anims[m].frames.length : 0, check: __sf.check.findings.filter((f) => f.level !== 'info').map((f) => f.code + ' ' + f.anim) }), [motion]);
  ok(DIRS.every((d) => r.rows.includes(d === 'S' ? motion : `${motion}_${d.toLowerCase()}`)) && r.frames === 8, `${cls}: ${motion} missing in some direction: ` + r.rows.join(' '));
  const bad2 = r.check.filter((c) => { const [code, anim] = c.split(' '); return !(['duplicate', 'same-frame'].includes(code) && /^(idle|bow)/.test(anim)); });
  ok(!bad2.length, `${cls}: frame check: ` + bad2.slice(0, 8).join(' | '));
}
// exports: screen names for the diagonals; the Godot pack has a cutout scene per direction
await page.selectOption('#dirNames', 'screen');
await page.selectOption('#exportPreset', 'phaser');
const ph = await download(page, () => page.click('#presetBtn'));
const atlas = JSON.parse(await ph.zip.file(Object.keys(ph.zip.files).find((n) => n.endsWith('.json') && n !== 'manifest.json')).async('string'));
const tags = atlas.meta.frameTags.map((t) => t.name);
ok(['walk_down', 'walk_up_right', 'sneak_down_left', 'run_up_left', 'idle_right'].every((n) => tags.includes(n)), 'screen names: ' + tags.join(' '));
await page.selectOption('#exportPreset', 'godot');
const gd = await download(page, () => page.click('#presetBtn'));
const scenes = Object.keys(gd.files).filter((f) => f.endsWith('.tscn'));
ok(scenes.length >= 8, 'Godot cutout scenes: ' + scenes.join(' '));

// a changed chibi asks before it is drawn again; save and reopen keeps it
await page.evaluate(() => __sf.switchDirection('S'));
await page.click('#rigSuggest');
await page.waitForTimeout(300);
await page.click('#recolorBtn');
await page.waitForTimeout(300);
const asked = await page.evaluate(() => __sf.guardOpen);
ok(asked, 'drawing a changed chibi again did not ask');
if (asked) await page.click('#guardCancel');
const shot = await page.evaluate(() => ({ rows: __sf.timeline.order.join(), f: __sf.framesFor('sneak_sw')[3].out.join(), shape: __sf.state.shape }));
const proj = await download(page, () => page.click('#saveProject'));
fs.writeFileSync('/tmp/sf-chibi-project.json', proj.buf);
ok(!errors.length, 'page errors: ' + errors.join(' | '));
await browser.close();
{
  const o = await openPage();
  await o.page.setInputFiles('#openFile', '/tmp/sf-chibi-project.json');
  await o.page.waitForFunction(() => __sf.state.type === 'chibi' && __sf.imported && __sf.imported.views.length === 7, null, { timeout: 30000 });
  await o.page.waitForTimeout(2500);
  const back = await o.page.evaluate(() => ({ rows: __sf.timeline.order.join(), f: __sf.framesFor('sneak_sw')[3].out.join(), shape: __sf.state.shape }));
  ok(back.rows === shot.rows && back.shape === shot.shape, 'reopened project lost rows or seeds');
  ok(back.f === shot.f, 'reopened project draws sneak_sw frame 4 differently');
  ok(!o.errors.length, 'page errors reopening: ' + o.errors.join(' | '));
  await o.browser.close();
}
// an imported character is never replaced without asking
{
  const o = await openPage();
  await rigImage(o.page);
  await o.page.click('#typeSeg button[data-val="chibi"]');
  await o.page.waitForTimeout(300);
  ok(await o.page.evaluate(() => __sf.guardOpen && __sf.state.type === 'imported'), 'making a chibi over an imported character did not ask');
  await o.browser.close();
}
console.log(`chibi made in ${ms} ms`);
console.log(fails.length ? 'CHIBI FAIL\n' + fails.join('\n') : 'chibi: 8 directions, 4 motions, checks, variations, Auto Animate, exports, save and reopen pass');
process.exit(fails.length ? 1 : 0);

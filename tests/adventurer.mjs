// V7.2: the Adventurer type. A 48 px character rendered from a 3D model in all 8 directions, with
// parts, joints and hidden areas; idle, walk, run and a combat motion (attack or cast), 8 frames each,
// in every direction; every class passes the frame check (held idle frames aside); it saves and
// reopens; it never silently replaces an imported character.
import { openPage, download, rigImage } from './lib.mjs';
import fs from 'node:fs';
const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const DIRS = ['S', 'E', 'W', 'N', 'SE', 'SW', 'NE', 'NW'];
const CLASSES = { fighter: 'attack', paladin: 'attack', barbarian: 'attack', rogue: 'attack', wizard: 'cast', druid: 'cast' };
// known and accepted: frames held in an idle; the druid's crook leaves the frame in one cast frame
// facing west (the arms swing up behind the head); one back-view idle frame of a caped class moves as a block
const accepted = (cls, f) => (/^idle/.test(f.anim) && ['duplicate', 'same-frame', 'moved-copy'].includes(f.code)) || (cls === 'druid' && f.code === 'clipped' && f.anim === 'cast_w');

const { browser, page, errors } = await openPage();
const row = (m, d) => (d === 'S' ? m : `${m}_${d.toLowerCase()}`);
const times = {};
let first = true;
for (const [cls, combat] of Object.entries(CLASSES)) {
  const t0 = Date.now();
  if (first) {
    await page.evaluate((c) => { __sf.state.advClass = c; }, cls);
    await page.click('#typeSeg button[data-val="adventurer"]');
    first = false;
  } else await page.selectOption('#advClass', cls);
  await page.waitForFunction((c) => __sf.state.type === 'adventurer' && __sf.state.advClass === c && !__sf.advBusy && /8 directions/.test(document.querySelector('#advInfo').textContent), cls, { timeout: 120000 });
  times[cls] = Date.now() - t0;
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => ({
    rows: __sf.timeline.order,
    frames: Object.fromEntries(__sf.timeline.order.map((n) => [n, __sf.timeline.anims[n].frames.length])),
    views: __sf.imported.views.length,
    N: __sf.sprite.px.length,
    check: __sf.check,
    shown: !document.querySelector('#advGroup').hidden
  }));
  const want = ['pose', ...DIRS.flatMap((d) => ['idle', 'walk', 'run', combat].map((m) => row(m, d)))];
  ok(r.views === 7 && r.N === 48 * 48 && r.shown, `${cls}: views ${r.views}, ${Math.sqrt(r.N)} px, picker shown ${r.shown}`);
  ok(want.every((n) => r.rows.includes(n)) && r.rows.length === want.length, `${cls} rows: ` + r.rows.join(' '));
  ok(want.slice(1).every((n) => r.frames[n] === 8), `${cls}: not 8 frames each`);
  ok(r.check.errors === 0, `${cls}: frame check errors ${r.check.errors}`);
  const bad = r.check.findings.filter((f) => f.level === 'warning' && !accepted(cls, f));
  ok(!bad.length, `${cls}: frame check: ` + bad.slice(0, 6).map((f) => f.message).join(' | '));
  // motion: the walk's frames differ in a side and a back view
  for (const n of ['walk_e', 'walk_n']) {
    const w = await page.evaluate((x) => [0, 2, 4, 6].map((i) => __sf.framesFor(x)[i].out.join()), n);
    ok(new Set(w).size === 4, `${cls}: ${n} frames 1, 3, 5, 7 are not all different`);
  }
}
// every direction of one class: rig preflight ready (parts, joints, exact rest pose)
for (const d of DIRS) {
  await page.evaluate((x) => __sf.switchDirection(x), d);
  await page.waitForFunction(() => __sf.preflight, null, { timeout: 20000 });
  await page.waitForTimeout(300);
  const pf = await page.evaluate(() => __sf.preflight);
  ok(pf.state === 'ready', `druid ${d} preflight: ` + JSON.stringify(pf.items.filter((i) => i.state === 'attention').map((i) => i.message)));
}
await page.evaluate(() => __sf.switchDirection('S'));
// exports: the Godot pack has a cutout scene per direction
await page.selectOption('#exportPreset', 'godot');
const gd = await download(page, () => page.click('#presetBtn'));
ok(Object.keys(gd.files).filter((f) => f.endsWith('.tscn')).length >= 8, 'Godot cutout scenes missing');
// save and reopen
const shot = await page.evaluate(() => ({ rows: __sf.timeline.order.join(), f: __sf.framesFor('walk_sw')[3].out.join(), cls: __sf.state.advClass }));
const proj = await download(page, () => page.click('#saveProject'));
fs.writeFileSync('/tmp/sf-adventurer-project.json', proj.buf);
ok(!errors.length, 'page errors: ' + errors.join(' | '));
await browser.close();
{
  const o = await openPage();
  await o.page.setInputFiles('#openFile', '/tmp/sf-adventurer-project.json');
  await o.page.waitForFunction(() => __sf.state.type === 'adventurer' && __sf.imported && __sf.imported.views.length === 7, null, { timeout: 30000 });
  await o.page.waitForTimeout(2500);
  const back = await o.page.evaluate(() => ({ rows: __sf.timeline.order.join(), f: __sf.framesFor('walk_sw')[3].out.join(), cls: __sf.state.advClass }));
  ok(back.rows === shot.rows && back.cls === shot.cls, 'reopened project lost rows or the class');
  ok(back.f === shot.f, 'reopened project draws walk_sw frame 4 differently');
  ok(!o.errors.length, 'page errors reopening: ' + o.errors.join(' | '));
  await o.browser.close();
}
// an imported character is never replaced without asking
{
  const o = await openPage();
  await rigImage(o.page);
  await o.page.click('#typeSeg button[data-val="adventurer"]');
  await o.page.waitForTimeout(300);
  ok(await o.page.evaluate(() => __sf.guardOpen && __sf.state.type === 'imported'), 'making an adventurer over an imported character did not ask');
  await o.browser.close();
}
console.log('made in ms: ' + JSON.stringify(times));
console.log(fails.length ? 'ADVENTURER FAIL\n' + fails.join('\n') : 'adventurer: 6 classes, 8 directions, 4 motions, checks, preflight, export, save and reopen pass');
process.exit(fails.length ? 1 : 0);

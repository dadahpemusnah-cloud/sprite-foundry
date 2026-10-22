// V8.0: Convert in one click. A front image becomes a rigged character with idle, walk, run, attack,
// defence, hurt and death; a side image adds right and left (its mirror); an unarmed view punches;
// an existing character is not replaced without asking; a broken file stops with a message.
import { openPage, rigImage } from './lib.mjs';
const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const MOTIONS = ['idle', 'walk', 'run', 'attack', 'defence', 'hurt', 'death'];
const done = (page) => page.waitForFunction(() => __sf.quick.report && !__sf.quick.busy, null, { timeout: 180000 });

// front only
{
  const { browser, page, errors } = await openPage();
  ok(await page.evaluate(() => document.querySelector('#qcGo').disabled), 'Convert is enabled without an image');
  await page.setInputFiles('#qcFront', 'tests/character.png');
  await page.click('#qcGo');
  await done(page);
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => ({ rep: __sf.quick.report, rows: __sf.timeline.order, type: __sf.state.type, main: __sf.imported.direction, check: __sf.check, frames: Object.fromEntries(__sf.timeline.order.map((n) => [n, __sf.timeline.anims[n].frames.length])) }));
  ok(!r.rep.error, 'front: ' + r.rep.error);
  ok(r.type === 'imported' && r.main === 'S', `front: type ${r.type}, main direction ${r.main}`);
  ok(MOTIONS.every((m) => r.rows.includes(m)), 'front rows: ' + r.rows.join(' '));
  ok(MOTIONS.every((m) => r.frames[m] >= 3), 'front: a motion with too few frames ' + JSON.stringify(r.frames));
  ok(r.check.errors === 0, 'front: frame check errors ' + r.check.errors);
  const walk = await page.evaluate(() => [0, 2, 4, 6].map((i) => __sf.framesFor('walk')[i].out.join()));
  ok(new Set(walk).size >= 3, 'front: the walk barely moves');
  // converting again asks first (a character exists now)
  await page.click('#qcGo');
  await page.waitForTimeout(300);
  ok(await page.evaluate(() => __sf.guardOpen), 'Convert over an existing character did not ask');
  await page.click('#guardCancel');
  ok(!errors.length, 'page errors: ' + errors.join(' | '));
  await browser.close();
}
// front and side: right, and left mirrored, with every motion
{
  const { browser, page, errors } = await openPage();
  await page.setInputFiles('#qcFront', 'tests/character.png');
  await page.setInputFiles('#qcSide', 'tests/character-side.png');
  const t0 = Date.now();
  await page.click('#qcGo');
  await done(page);
  const ms = Date.now() - t0;
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => ({ rep: __sf.quick.report, rows: __sf.timeline.order, views: __sf.imported.views.map((v) => v.direction), check: __sf.check.errors, list: document.querySelector('#qcResult').textContent }));
  ok(!r.rep.error && !r.rep.skipped.length, 'front+side: ' + (r.rep.error || r.rep.skipped.join(' | ')));
  const want = ['S', 'E', 'W'].flatMap((d) => MOTIONS.map((m) => (d === 'S' ? m : `${m}_${d.toLowerCase()}`)));
  ok(want.every((n) => r.rows.includes(n)), 'front+side rows: ' + r.rows.join(' '));
  ok(r.views.sort().join() === 'E,W' && r.rep.mirrored.join() === 'W' && /mirrored/.test(r.list), 'views or the mirrored note: ' + JSON.stringify(r.views) + r.list);
  ok(r.check === 0, 'front+side: frame check errors ' + r.check);
  // the left view is the right one mirrored: its rest pose is the right's, flipped
  const rest = await page.evaluate(() => ['E', 'W'].map((d) => __sf.restFrame(d)));
  const N = Math.sqrt(rest[0].length), flip = (px) => px.map((_, i) => px[(i / N | 0) * N + N - 1 - i % N]);
  const same = rest[1].filter((c, i) => c === flip(rest[0])[i]).length / rest[1].length;
  ok(same > 0.97, `the left view is not the right one mirrored (${(same * 100).toFixed(1)}% equal)`);
  ok(!errors.length, 'page errors: ' + errors.join(' | '));
  console.log(`front and side converted in ${ms} ms`);
  await browser.close();
}
// an existing imported character: asks; a damaged file: stops with a message and keeps the character
{
  const { browser, page } = await openPage();
  await rigImage(page);
  await page.setInputFiles('#qcFront', { name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('not a png') });
  await page.click('#qcGo');
  await page.waitForTimeout(300);
  ok(await page.evaluate(() => __sf.guardOpen), 'Convert over an imported character did not ask');
  await page.click('#guardGo');
  await done(page);
  const r = await page.evaluate(() => ({ rep: __sf.quick.report, msg: document.querySelector('#qcMsg').textContent, go: !document.querySelector('#qcGo').disabled, kept: __sf.state.type === 'imported' && !!__sf.imported }));
  ok(r.rep.error && /could not start.*nothing was changed/.test(r.msg) && r.go && r.kept, 'a damaged file: ' + JSON.stringify(r));
  await browser.close();
}
console.log(fails.length ? 'QUICK CONVERT FAIL\n' + fails.join('\n') : 'quick convert: front, front + side (mirrored left), guard, damaged file pass');
process.exit(fails.length ? 1 : 0);

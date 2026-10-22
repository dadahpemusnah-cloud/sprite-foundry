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
// V8.0b: the pose model (served as when published) and clicking the joints
{
  const { browser, page, errors } = await openPage({ serve: true });
  await page.setInputFiles('#qcFront', 'tests/character.png');
  await page.click('#qcGo');
  await done(page);
  await page.waitForTimeout(800);
  let q = await page.evaluate(() => __sf.quick);
  // the model loads and runs; this blocky test figure is not a body to it, so the joints are asked for
  ok(q.report.unsure && /no body was found/.test(q.report.unsure.S || ''), 'pose model: ' + JSON.stringify(q.report.unsure));
  ok(q.joints.dir === 'S' && q.joints.todo.length === 14 && await page.evaluate(() => !document.querySelector('#qcJoints').hidden && document.querySelector('#qcJointsUse').disabled), 'the joints editor does not ask for 14 clicks: ' + JSON.stringify(q.joints.todo));
  // click the 14 joints where the rough guess put them (the head 12 work px above the neck)
  const piv = await page.evaluate(() => Object.fromEntries(Object.entries(__sf.rigInfo.bones).map(([id, b]) => [id, b.pivot])));
  const want = { neck: piv.head, shoulderL: piv.upperArmL, elbowL: piv.forearmL, wristL: piv.handL, shoulderR: piv.upperArmR, elbowR: piv.forearmR, wristR: piv.handR, hipL: piv.thighL, kneeL: piv.shinL, ankleL: piv.footL, hipR: piv.thighR, kneeR: piv.shinR, ankleR: piv.footR };
  want.head = [piv.head[0], piv.head[1] - 12];
  const order = ['head', 'neck', 'shoulderL', 'elbowL', 'wristL', 'shoulderR', 'elbowR', 'wristR', 'hipL', 'kneeL', 'ankleL', 'hipR', 'kneeR', 'ankleR'];
  await page.locator('#qcJointsCanvas').scrollIntoViewIfNeeded();
  let box = await page.locator('#qcJointsCanvas').boundingBox();
  const dims = await page.evaluate(() => { const c = document.querySelector('#qcJointsCanvas'); return { w: c.width, S: __sf.quick.joints.dirs.S.S }; });
  const k = box.width / dims.S;
  for (const n of order) await page.mouse.click(box.x + (want[n][0] + 0.5) * k, box.y + (want[n][1] + 0.5) * k);
  q = await page.evaluate(() => __sf.quick);
  ok(!q.joints.todo.length && q.joints.dirs.S.source === 'click', 'after 14 clicks: ' + JSON.stringify(q.joints.todo));
  await page.click('#qcJointsUse');
  await page.waitForFunction(() => __sf.quick.report.remade === 'S' && !__sf.quick.busy, null, { timeout: 60000 });
  await page.waitForTimeout(800);
  const after = await page.evaluate(() => ({ bones: __sf.rigInfo.bones, rows: __sf.timeline.order, parts: __sf.partsInfo, msg: document.querySelector('#qcMsg').textContent, check: __sf.check.errors }));
  const near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= 3;
  ok(near(after.bones.forearmL.pivot, want.elbowL) && near(after.bones.shinR.pivot, want.kneeR) && after.bones.forearmL.auto === false, 'joints are not where they were clicked: ' + JSON.stringify([after.bones.forearmL, want.elbowL]));
  ok(MOTIONS.every((m) => after.rows.includes(m)) && /animations made again/.test(after.msg) && after.check === 0, 'remade rows: ' + after.rows.join(' ') + ' | ' + after.msg);
  ok(after.parts.unassigned === 0 && after.parts.perPart.filter((n) => n > 0).length >= 14, 'parts from the joints: ' + JSON.stringify(after.parts.perPart));
  // a pose "found by the model" (landmarks given), then one joint dragged
  await page.evaluate((w) => {
    const S = __sf.quick.joints.dirs.S.S, lm = Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 0.99 })), set = (i, p) => { lm[i] = { x: p[0] / S, y: p[1] / S, visibility: 0.99 }; };
    // the person's right (even numbers) on the left of the picture
    const m = { 12: w.shoulderL, 14: w.elbowL, 16: w.wristL, 24: w.hipL, 26: w.kneeL, 28: w.ankleL, 11: w.shoulderR, 13: w.elbowR, 15: w.wristR, 23: w.hipR, 25: w.kneeR, 27: w.ankleR };
    for (const [i, p] of Object.entries(m)) set(+i, p);
    for (const [i, from, dx] of [[18, w.wristL, -2], [20, w.wristL, -1], [17, w.wristR, 2], [19, w.wristR, 1]]) set(i, [from[0] + dx, from[1] + 4]);
    for (const [i, from, dx] of [[30, w.ankleL, 0], [32, w.ankleL, -4], [29, w.ankleR, 0], [31, w.ankleR, 4]]) set(i, [from[0] + dx, from[1] + 2]);
    set(0, [w.neck[0], w.head[1] + 6]); set(8, [w.neck[0] - 4, w.head[1] + 5]); set(7, [w.neck[0] + 4, w.head[1] + 5]);
    __sf.quickPose = () => lm;
  }, want);
  await page.click('#qcGo');
  await page.click('#guardGo');
  await done(page);
  await page.waitForTimeout(800);
  q = await page.evaluate(() => __sf.quick);
  ok(!Object.keys(q.report.unsure).length && q.joints.dirs.S.source === 'model' && /99% sure/.test(q.joints.dirs.S.note), 'given landmarks: ' + JSON.stringify(q.joints.dirs.S));
  await page.locator('#qcJointsCanvas').scrollIntoViewIfNeeded();
  box = await page.locator('#qcJointsCanvas').boundingBox();
  const elbow0 = q.joints.dirs.S.pts.elbowL, to = [elbow0[0] - 6, elbow0[1] + 4];
  await page.mouse.move(box.x + elbow0[0] * k, box.y + elbow0[1] * k);
  await page.mouse.down();
  await page.mouse.move(box.x + to[0] * k, box.y + to[1] * k, { steps: 4 });
  await page.mouse.up();
  await page.click('#qcJointsUse');
  await page.waitForFunction(() => __sf.quick.report.remade === 'S' && !__sf.quick.busy, null, { timeout: 60000 });
  const moved = await page.evaluate(() => __sf.rigInfo.bones.forearmL.pivot);
  ok(near(moved, to), `the dragged elbow is at ${moved}, not ${to}`);
  ok(!errors.length, 'page errors (pose): ' + errors.join(' | '));
  await browser.close();
}
console.log(fails.length ? 'QUICK CONVERT FAIL\n' + fails.join('\n') : 'quick convert: front, front + side (mirrored left), guard, damaged file, pose model, clicked and dragged joints pass');
process.exit(fails.length ? 1 : 0);

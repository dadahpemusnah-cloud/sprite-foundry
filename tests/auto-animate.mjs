// Auto Animate (V6 stage 2): four-direction walk, 12 frames at 10 fps, preview, apply, one-step undo/redo,
// replace-only-after-confirm, edit warnings, directions without artwork, determinism.
import { openPage, rigImage, rigFourDirections, sha } from './lib.mjs';
const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const ROWS = { S: 'walk', N: 'walk_n', W: 'walk_w', E: 'walk_e' };
const info = (page) => page.evaluate(() => __sf.autoAnimate);
const rows = (page) => page.evaluate(() => Object.fromEntries(__sf.timeline.order.filter((n) => /^walk/.test(n)).map((n) => {
  const a = __sf.timeline.anims[n];
  return [n, { frames: a.frames.length, fps: a.fps, loop: a.loop, ms: a.frames.reduce((s, f, i) => s + (f.dur || 1000 / a.fps), 0) }];
})));
const frameHashes = (page) => page.evaluate(() => __sf.timeline.order.filter((n) => /^walk/.test(n)).map((n) =>
  __sf.timeline.anims[n].frames.map((_, i) => JSON.stringify(__sf.frameIn(n, i))).join('|')));
let dialogs = [], answer = true;
const watchDialogs = (page) => page.on('dialog', (d) => { dialogs.push(d.message()); answer ? d.accept() : d.dismiss(); });

// 1. four directions with their own images
let { browser, page, errors } = await openPage();
watchDialogs(page);
await rigFourDirections(page);
let s = await info(page);
ok(s.status.every((x) => x.ok), 'not every direction ready: ' + JSON.stringify(s.status));
ok(JSON.stringify(s.settings) === JSON.stringify({ frames: 12, fps: 10, name: 'walk' }), 'defaults are not 12 frames / 10 fps / walk: ' + JSON.stringify(s.settings));
ok(/4 directions × 12 frames = 48 frames · 1200 ms per loop/.test(await page.textContent('#aaTiming')), 'timing line wrong: ' + await page.textContent('#aaTiming'));

// 2. preview changes nothing
await page.click('#aaPreview');
s = await info(page);
ok(s.built && s.built.frames === 12 && s.built.fps === 10, 'preview not 12 frames at 10 fps');
ok(s.built && s.built.dirs.join() === 'S,N,W,E', 'preview order is not down, up, left, right');
ok(Object.keys(await rows(page)).length === 0, 'preview added animations');
await page.click('#aaPlay');
await page.waitForTimeout(350);
ok((await info(page)).frame > 0, 'preview does not play');
await page.click('#aaPlay');

// 3. apply: 4 rows, 12 frames each at 10 fps, 1.2 s loops
await page.click('#aaApply');
let r = await rows(page);
ok(Object.keys(r).sort().join() === Object.values(ROWS).sort().join(), 'rows after apply: ' + Object.keys(r));
ok(Object.values(r).every((x) => x.frames === 12 && x.fps === 10 && x.loop && Math.abs(x.ms - 1200) < 1), 'a row is not 12 frames / 10 fps / looping / 1200 ms: ' + JSON.stringify(r));
ok(Object.values(r).reduce((n, x) => n + x.frames, 0) === 48, '48 frames in total');
ok(dialogs.length === 0, 'apply asked although nothing was replaced');
const firstApply = await frameHashes(page);
const sheet = await page.evaluate(() => __sf.sheetRows);
ok(Object.values(ROWS).every((n) => sheet.includes(n)), 'walk rows not in the sheet: ' + sheet);

// 4. one undo removes all four, one redo brings all four back
await page.click('#aaUndo');
ok(Object.keys(await rows(page)).length === 0, 'undo left rows: ' + Object.keys(await rows(page)));
await page.click('#aaRedo');
ok(Object.keys(await rows(page)).length === 4, 'redo did not restore all four');
ok(JSON.stringify(await frameHashes(page)) === JSON.stringify(firstApply), 'redo frames differ from the first apply');

// 5. applying again over "walk": asks; dismiss changes nothing; accept replaces; undo brings the old one back
await page.fill('#aaFrames', '16'); await page.dispatchEvent('#aaFrames', 'change');
answer = false; dialogs = [];
await page.click('#aaApply');
ok(dialogs.length === 1 && /Replace the existing "walk"/.test(dialogs[0]), 'no replace confirmation: ' + dialogs);
ok(Object.values(await rows(page)).every((x) => x.frames === 12), 'dismissed replace still changed frames');
answer = true; dialogs = [];
await page.click('#aaApply');
ok(Object.values(await rows(page)).every((x) => x.frames === 16), 'accepted replace did not make 16 frames');
await page.click('#aaUndo');
ok(Object.values(await rows(page)).every((x) => x.frames === 12), 'undo did not bring back the 12-frame walk');
ok(JSON.stringify(await frameHashes(page)) === JSON.stringify(firstApply), 'restored walk differs from before');

// 6. hand edits since: undo asks first
await page.selectOption('#anName', 'walk').catch(() => {});
const shown = await page.evaluate(() => __sf.animInfo.name);
await page.click('#anTabs button[data-tab="manual"]');
await page.selectOption('#anBone', 'head');
await page.fill('#anRotN', '9'); await page.dispatchEvent('#anRotN', 'change');
answer = false; dialogs = [];
const undoDepth = (await info(page)).undo;
await page.click('#aaUndo');
ok(dialogs.length === 1 && /was changed since/.test(dialogs[0]), `undo after an edit to "${shown}" did not ask: ${dialogs}`);
ok((await info(page)).undo === undoDepth, 'dismissed undo still undid');
const errs1 = errors.slice();
await browser.close();

// 7. only S and E have images: N and W are listed as needing artwork, not faked
({ browser, page, errors } = await openPage());
await rigImage(page, 'tests/character.png');
await page.selectOption('#dirMain', 'S');
await page.selectOption('#dirAdd', 'E'); await page.click('#dirAddBtn');
await rigImage(page, 'tests/character-side.png');
s = await info(page);
const st = Object.fromEntries(s.status.map((x) => [x.dir, x]));
ok(st.S.ok && st.E.ok && !st.N.ok && !st.W.ok && /own image/.test(st.N.why), 'missing directions not reported: ' + JSON.stringify(s.status));
await page.click('#aaApply');
r = await rows(page);
ok(Object.keys(r).sort().join() === 'walk,walk_e', 'with two images, rows are ' + Object.keys(r));
ok(/Not made for up, left/.test(await page.textContent('#aaMsg')), 'apply message does not name the skipped directions');
const errs2 = errors.slice();
await browser.close();

// 8. deterministic: a fresh page gives the same 48 frames
({ browser, page, errors } = await openPage());
await rigFourDirections(page);
await page.click('#aaApply');
ok(JSON.stringify(await frameHashes(page)) === JSON.stringify(firstApply), 'a second run made different frames');
await browser.close();

ok(![...errs1, ...errs2, ...errors].length, 'page errors: ' + [...errs1, ...errs2, ...errors].join(' | '));
console.log(fails.length ? 'AUTO ANIMATE FAIL\n' + fails.join('\n') : `auto animate: all checks pass (frames ${sha(JSON.stringify(firstApply))})`);
process.exit(fails.length ? 1 : 0);

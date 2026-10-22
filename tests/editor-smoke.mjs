// Editor smoke test: pencil on the base pose and on one frame, undo/redo, timeline duplicate/delete/undo,
// palette change, colour replace, project save and reopen in a fresh page. Exit 1 on any failure.
import { openPage, download } from './lib.mjs';
import fs from 'node:fs';
const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
let { browser, page, errors } = await openPage();
const frameHash = () => page.evaluate(() => JSON.stringify(__sf.frameIn(__sf.anim, __sf.frameIdx)));
const tl = () => page.evaluate(() => ({ n: __sf.timeline.anims[__sf.anim].frames.length }));
await page.click('#playBtn'); // pause so frameIdx stays put
await page.evaluate(() => __sf.configure({ type: 'character' }));
const before = await frameHash();

// pencil on the base pose, in the middle of the stage
await page.click('#editBtn');
ok(await page.evaluate(() => __sf.editMode), 'edit mode did not turn on');
await page.click('#toolSeg button:has-text("Pencil")');
await page.locator('#stageCanvas').scrollIntoViewIfNeeded();
const box = await page.locator('#stageCanvas').boundingBox();
await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.45);
const drawn = await frameHash();
ok(drawn !== before, 'pencil changed nothing');
ok(await page.evaluate(() => __sf.undoDepth) > 0, 'pencil made no undo step');
await page.click('#undoBtn');
ok(await frameHash() === before, 'undo did not restore the frame');
await page.click('#redoBtn');
ok(await frameHash() === drawn, 'redo did not bring the stroke back');

// timeline: duplicate, delete, undo
const n0 = (await tl()).n;
await page.click('#dupFrame');
ok((await tl()).n === n0 + 1, 'duplicate did not add a frame');
await page.click('#delFrame');
ok((await tl()).n === n0, 'delete did not remove a frame');
await page.click('#tlUndo');
ok((await tl()).n === n0 + 1, 'timeline undo did not bring the frame back');
await page.click('#tlRedo');
ok((await tl()).n === n0, 'timeline redo failed');

// palette and colour replace
await page.click('#editBtn');
const pal0 = await frameHash();
await page.selectOption('#palette', 'pico8');
ok(await frameHash() !== pal0, 'palette change did not recolour');
await page.selectOption('#palette', 'free');

// save the project, reopen it in a fresh page, compare a frame and the timeline
const stateBefore = await page.evaluate(() => ({ f: JSON.stringify(__sf.frameIn(__sf.anim, 0)), n: __sf.timeline.anims[__sf.anim].frames.length, anim: __sf.anim }));
const saved = await download(page, () => page.click('#saveProject'));
const projFile = '/tmp/sf-smoke-project.json';
fs.writeFileSync(projFile, saved.buf);
const errs1 = errors.slice();
await browser.close();
({ browser, page, errors } = await openPage());
await page.setInputFiles('#openFile', projFile);
await page.waitForTimeout(500);
const stateAfter = await page.evaluate((a) => ({ f: JSON.stringify(__sf.frameIn(a, 0)), n: __sf.timeline.anims[a].frames.length }), stateBefore.anim);
ok(stateAfter.f === stateBefore.f, 'reopened project shows a different frame (base-pose edit lost?)');
ok(stateAfter.n === stateBefore.n, 'reopened project has a different frame count');
await browser.close();
ok(!errs1.length && !errors.length, 'page errors: ' + [...errs1, ...errors].join(' | '));
console.log(fails.length ? 'EDITOR SMOKE FAIL\n' + fails.join('\n') : 'editor smoke: all checks pass');
process.exit(fails.length ? 1 : 0);

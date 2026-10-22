// Frame check additions (V6 stage 4): direction sets, loop seam, opaque background; plus the existing
// duplicate-frame warning (warned, never deleted). Also: no false alarms on the built-in sprites or on a
// clean four-direction walk.
import { openPage, rigImage, rigFourDirections } from './lib.mjs';
const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const NEW = ['loop-seam', 'opaque-background', 'direction-set', 'direction-missing'];
const check = async (page) => {
  await page.evaluate(() => __sf.recheck());
  await page.waitForTimeout(400);
  return page.evaluate(() => __sf.check.findings.map((f) => ({ level: f.level, code: f.code, anim: f.anim, message: f.message })));
};
const codes = (fs) => fs.map((f) => f.code);

// 1. built-in sprites: none of the new findings
let { browser, page, errors } = await openPage();
for (const type of ['character', 'creature', 'ship', 'item', 'hero']) {
  await page.evaluate((t) => __sf.configure({ type: t }), type);
  const got = codes(await check(page)).filter((c) => NEW.includes(c));
  ok(!got.length, `${type}: unexpected ${got.join(', ')}`);
}

// 2. duplicate frame: warned, the frame stays
await page.evaluate(() => __sf.configure({ type: 'character' }));
await page.click('#playBtn');
const n0 = await page.evaluate(() => __sf.timeline.anims[__sf.anim].frames.length);
await page.click('#dupFrame');
const dup = await check(page);
ok(dup.some((f) => f.code === 'duplicate' && f.level === 'warning'), 'duplicating a frame gave no duplicate warning');
ok(await page.evaluate(() => __sf.timeline.anims[__sf.anim].frames.length) === n0 + 1, 'the duplicate frame was removed');

// 3. all four corners filled in the base pose: opaque-background warning
await page.click('#editBtn');
await page.click('#targetSeg button:has-text("This frame")'); // the frame's corners lie outside the base pose
await page.click('#mirror'); // off, so each click paints one pixel
await page.click('#toolSeg button:has-text("Pencil")');
await page.locator('#stageCanvas').scrollIntoViewIfNeeded();
const box = await page.locator('#stageCanvas').boundingBox();
for (const [fx, fy] of [[0.005, 0.005], [0.995, 0.005], [0.005, 0.995], [0.995, 0.995]]) await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
const bg = await check(page);
ok(bg.some((f) => f.code === 'opaque-background'), 'filled corners gave no opaque-background warning: ' + codes(bg).join(','));
const errs1 = errors.slice();
await browser.close();

// 4. a clean four-direction walk: no direction-set or loop-seam findings
({ browser, page, errors } = await openPage());
await rigFourDirections(page);
await page.click('#aaApply');
let fs = await check(page);
ok(!fs.some((f) => ['direction-set', 'loop-seam', 'direction-missing'].includes(f.code)), 'clean walk flagged: ' + fs.filter((f) => NEW.includes(f.code)).map((f) => f.message).join(' | '));

// 5. walk in left (W, on screen) cut to 8 frames: direction-set warning naming the frame counts
await page.click('#anTabs button[data-tab="manual"]');
await page.selectOption('#anName', 'walk');
await page.uncheck('#anRetime').catch(() => {});
await page.fill('#anFrames', '8'); await page.dispatchEvent('#anFrames', 'change');
fs = await check(page);
const ds = fs.find((f) => f.code === 'direction-set');
ok(ds && /frame counts/.test(ds.message) && /W 8/.test(ds.message) && /S 12/.test(ds.message), 'no direction-set warning for 8 vs 12 frames: ' + (ds ? ds.message : codes(fs).join(',')));

// 6. a death that loops: loop-seam warning
await page.click('#anDeath');
await page.check('#anLoop'); await page.dispatchEvent('#anLoop', 'change');
fs = await check(page);
ok(fs.some((f) => f.code === 'loop-seam' && /death/.test(f.anim)), 'looping death gave no loop-seam warning: ' + codes(fs).join(','));
const errs2 = errors.slice();
await browser.close();

// 7. walk only in down and right although up and left have artwork: a note, not a warning
({ browser, page, errors } = await openPage());
await rigFourDirections(page);
for (const d of ['N', 'W']) await page.locator('#aaDirs label', { hasText: `(${d})` }).locator('input').uncheck();
await page.click('#aaApply');
fs = await check(page);
const miss = fs.find((f) => f.code === 'direction-missing');
ok(miss && miss.level === 'info' && /not in [NW], [NW]/.test(miss.message), 'no direction-missing note: ' + (miss ? miss.message : codes(fs).join(',')));
await browser.close();

ok(![...errs1, ...errs2, ...errors].length, 'page errors: ' + [...errs1, ...errs2, ...errors].join(' | '));
console.log(fails.length ? 'FRAME CHECK FAIL\n' + fails.join('\n') : 'frame check: new checks fire where they should and stay quiet elsewhere');
process.exit(fails.length ? 1 : 0);

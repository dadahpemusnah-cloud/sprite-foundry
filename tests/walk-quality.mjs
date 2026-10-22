// Walk quality at 12 frames on four directions (V6 stage 3), measured on the frames as drawn:
// frame-check warnings, ground contact (lowest opaque row), body jumps (top row between frames),
// loop seam (frame 11 -> 0 against the other steps), duplicate frames, frames that equal the rest pose.
// These checks cannot say whether the walk looks natural; that needs a person watching it.
import { openPage, rigFourDirections } from './lib.mjs';
const { browser, page, errors } = await openPage();
await rigFourDirections(page);
const pre = await page.evaluate(() => { document.querySelector('#aaPreview').click(); return __sf.autoAnimate.built.warnings; });
await page.click('#aaApply');
const m = await page.evaluate(() => {
  const F = __sf.frameSize(), rows = { S: 'walk', N: 'walk_n', W: 'walk_w', E: 'walk_e' }, out = {};
  const rest = (dir) => JSON.stringify(__sf.frameIn('pose', 0));
  for (const [dir, row] of Object.entries(rows)) {
    const fr = __sf.timeline.anims[row].frames.map((_, i) => __sf.frameIn(row, i));
    const rowsOf = (px) => { let top = F, bot = -1; px.forEach((c, i) => { if (c) { const y = i / F | 0; top = Math.min(top, y); bot = Math.max(bot, y); } }); return [top, bot]; };
    const diff = (a, b) => a.reduce((n, c, i) => n + (c !== b[i] ? 1 : 0), 0);
    const tb = fr.map(rowsOf), steps = fr.map((f, i) => diff(f, fr[(i + 1) % fr.length]));
    const topJumps = tb.map((t, i) => Math.abs(t[0] - tb[(i + 1) % tb.length][0]));
    out[dir] = {
      frames: fr.length,
      ground: [...new Set(tb.map((t) => t[1]))],
      maxTopJump: Math.max(...topJumps),
      seam: steps[steps.length - 1], maxOtherStep: Math.max(...steps.slice(0, -1)), minStep: Math.min(...steps),
      duplicates: steps.filter((s) => s === 0).length,
      restFrames: dir === 'S' ? fr.filter((f) => JSON.stringify(f) === rest()).length : null
    };
  }
  return out;
});
await browser.close();
const fails = [];
for (const [dir, x] of Object.entries(m)) {
  const w = pre[dir] || [];
  console.log(`${dir}: ${x.frames} frames · warnings [${w.join(', ') || 'none'}] · ground rows [${x.ground}] · max top jump ${x.maxTopJump}px · seam ${x.seam}px vs steps ${x.minStep}-${x.maxOtherStep}px · duplicates ${x.duplicates}`);
  if (x.frames !== 12) fails.push(`${dir}: ${x.frames} frames`);
  if (w.includes('body-jump')) fails.push(`${dir}: frame check reports a body jump`);
  if (w.includes('ground')) fails.push(`${dir}: frame check reports feet leaving the ground`);
  if (x.ground.length !== 1) fails.push(`${dir}: ground contact moves between rows ${x.ground}`);
  // the walk's body bounce spans about 3 px (lowest at contact, highest at passing), so a 2 px step
  // between frames is the bounce itself; more than that is a jump (before stage 3 the side views had 3)
  if (x.maxTopJump > 2) fails.push(`${dir}: the top of the body jumps ${x.maxTopJump}px between frames`);
  if (x.seam > x.maxOtherStep) fails.push(`${dir}: the loop seam (${x.seam}px) is bigger than any other step (${x.maxOtherStep}px)`);
  if (x.duplicates) fails.push(`${dir}: ${x.duplicates} frame(s) repeat the one before`);
}
if (errors.length) fails.push('page errors: ' + errors.join(' | '));
console.log(fails.length ? 'WALK QUALITY FAIL\n' + fails.join('\n') : 'walk quality: all checks pass');
process.exit(fails.length ? 1 : 0);

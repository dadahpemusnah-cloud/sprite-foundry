// Adding a direction: no step may act on the previous direction's data while the new image is still
// loading or converting.
// 1. Parts: right after a switch (same tick, image not decoded yet) the part tools are disabled.
// 2. Pixel art: "Use as sprite" in the same tick as "Remove background" takes the new image's
//    conversion, not the previous direction's (the conversion runs on a 120 ms timer).
import { openPage, rigImage } from './lib.mjs';
const fails = [];
const { browser, page, errors } = await openPage();
await rigImage(page, 'tests/character.png');
await page.selectOption('#dirMain', 'S');
const pxOf = (dir) => page.evaluate((d) => __sf.directions().find((x) => x.dir === d).rest.px.join(), dir);
const front = await pxOf('S');

await page.selectOption('#dirAdd', 'E'); await page.click('#dirAddBtn');
await page.setInputFiles('#importFile', 'tests/character-side.png');
await page.waitForSelector('#bgWork:not([hidden])');
await page.selectOption('#bgMethod', 'flood');
await page.evaluate(() => { document.querySelector('#bgRun').click(); document.querySelector('#convApply').click(); });
const early = await page.evaluate(() => { const d = __sf.directions().find((x) => x.dir === 'E'); return d && d.rest ? d.rest.px.join() : null; });
if (early === front) fails.push('E got the front image (the previous conversion)');
// nothing applied yet is fine; once the conversion is ready, Use as sprite takes the side image
if (!early) {
  await page.click('#convApply');
  const side = await pxOf('E').catch(() => null);
  if (!side || side === front) fails.push('after the conversion, E still lacks its own image');
}

await page.click('#ptGuess'); await page.click('#rigSuggest');
await page.waitForSelector('#ptGuess:not([disabled])');
const during = await page.evaluate(() => { __sf.switchDirection('S'); return ['#ptGuess', '#ptGrow', '#ptClear'].map((s) => document.querySelector(s).disabled); });
await page.waitForSelector('#ptGuess:not([disabled])', { timeout: 10000 });
if (!during.every(Boolean)) fails.push('part tools enabled before the new image was decoded: ' + during);
await browser.close();
if (errors.length) fails.push('page errors: ' + errors.join(' | '));
console.log(fails.length ? 'DIRECTION SWITCH FAIL\n' + fails.join('\n') : 'direction switch: parts and pixel art wait for the new image');
process.exit(fails.length ? 1 : 0);

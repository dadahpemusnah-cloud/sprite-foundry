// No horizontal page scroll at phone widths (360 and 390 px): on a fresh page, and with a rigged
// four-direction character and the Auto Animate preview open.
import { openPage, rigFourDirections } from './lib.mjs';
const fails = [];
const { browser, page, errors } = await openPage();
const measure = async (what) => {
  for (const w of [360, 390]) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForTimeout(150);
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    if (sw > w) fails.push(`${what} at ${w} px: the page is ${sw} px wide`);
  }
};
await measure('fresh page');
await page.setViewportSize({ width: 1300, height: 900 });
await rigFourDirections(page);
await page.click('#aaPreview');
await measure('four directions + preview');
await browser.close();
if (errors.length) fails.push('page errors: ' + errors.join(' | '));
console.log(fails.length ? 'PHONE WIDTH FAIL\n' + fails.join('\n') : 'phone width: no horizontal scroll at 360 or 390 px');
process.exit(fails.length ? 1 : 0);

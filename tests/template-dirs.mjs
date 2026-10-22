// Template motions panel: a diagonal direction with artwork is listed as usable, and no
// "not supported" note appears (V6 stage 1 fix).
import { openPage, rigImage } from './lib.mjs';
const { browser, page, errors } = await openPage();
await rigImage(page, 'tests/character.png');
await page.selectOption('#dirMain', 'S');
await page.selectOption('#dirAdd', 'SE');
await page.click('#dirAddBtn');
await rigImage(page, 'tests/character-side.png');
await page.click('#anTabs button[data-tab="template"]');
const text = await page.textContent('#tmDirs');
await browser.close();
const fails = [];
if (/not supported/i.test(text)) fails.push('stale "not supported" note still shown');
if (!/SE ·/.test(text)) fails.push('SE not listed as a direction');
if (/Needs its own artwork:[^\n]*\bSE\b/.test(text)) fails.push('SE listed as needing artwork although it has some');
if (errors.length) fails.push('page errors: ' + errors.join(' | '));
console.log(fails.length ? 'TEMPLATE DIRS FAIL\n' + fails.join('\n') + '\n' + text : 'template dirs: diagonal listed, no stale note');
process.exit(fails.length ? 1 : 0);

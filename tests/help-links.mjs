// Every control the help points at (C("label", "#selector") and go: "#selector" in src/help/content.js)
// exists in the page, so help entries cannot point at removed or renamed controls.
import fs from 'node:fs';
import { openPage } from './lib.mjs';
const src = fs.readFileSync('src/help/content.js', 'utf8');
const sels = [...new Set([...src.matchAll(/C\("(?:[^"\\]|\\.)*",\s*"([^"]+)"\)|go:\s*"([^"]+)"/g)].map((m) => m[1] || m[2]))];
const { browser, page, errors } = await openPage();
const missing = await page.evaluate((list) => list.filter((s) => { try { return !document.querySelector(s); } catch (e) { return true; } }), sels);
await browser.close();
const fails = [...missing.map((s) => `help points at ${s}, which is not in the page`), ...(errors.length ? ['page errors: ' + errors.join(' | ')] : [])];
console.log(fails.length ? 'HELP LINKS FAIL\n' + fails.join('\n') : `help links: all ${sels.length} controls exist`);
process.exit(fails.length ? 1 : 0);

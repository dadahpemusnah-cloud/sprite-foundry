// Shared browser helpers: open the page offline (JSZip from node_modules, no web fonts), collect page errors, read downloads.
import { chromium, webkit } from 'playwright';
import JSZip from 'jszip';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import http from 'node:http';

// serve: the page over http (as published), with the pose model files under pose/ (V8.0b); the
// browser is closed with the server
export async function openPage({ engine = process.env.SF_ENGINE || 'chromium', html = process.env.SF_HTML || 'index.html', serve = false } = {}) {
  const browser = await (engine === 'webkit' ? webkit : chromium).launch();
  const page = await browser.newPage({ acceptDownloads: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js', (r) => r.fulfill({ path: 'node_modules/jszip/dist/jszip.min.js', contentType: 'text/javascript' }));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  if (serve) {
    const { POSE_FILES } = await import('../tools/pose-files.mjs');
    const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.wasm': 'application/wasm' };
    const srv = http.createServer((q, s) => {
      const u = decodeURIComponent(q.url.split('?')[0]), f = u === '/' ? html : u.startsWith('/pose/') ? POSE_FILES[u.slice(6)] : null;
      if (!f || !fs.existsSync(f)) {
        s.writeHead(404);
        return s.end();
      }
      s.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(s);
    });
    await new Promise((r) => srv.listen(0, '127.0.0.1', r));
    const close = browser.close.bind(browser);
    browser.close = async () => { await close(); srv.close(); };
    await page.goto(`http://127.0.0.1:${srv.address().port}/`);
  } else await page.goto('file://' + path.resolve(html));
  await page.waitForFunction(() => window.__sf && window.__sf.sprite);
  return { browser, page, errors };
}

export const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);

// Clicks a button that downloads a file; returns { name, files: {path: hash} } (zips are opened, each file hashed).
export async function download(page, click) {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), click()]);
  const buf = fs.readFileSync(await dl.path()), name = dl.suggestedFilename();
  if (!name.endsWith('.zip')) return { name, files: { [name]: sha(buf) }, buf };
  const zip = await JSZip.loadAsync(buf), files = {};
  for (const [n, f] of Object.entries(zip.files)) if (!f.dir) files[n] = sha(await f.async('nodebuffer'));
  return { name, files, zip };
}

// Steps 1-5 of image import with a test image: background, pixel art, parts, joints.
export async function rigImage(page, file = 'tests/character.png') {
  await page.setInputFiles('#importFile', file);
  await page.waitForSelector('#bgWork:not([hidden])');
  await page.selectOption('#bgMethod', 'flood');
  await page.click('#bgRun');
  await page.waitForSelector('#convApply:not([disabled])', { timeout: 30000 });
  await page.click('#convApply');
  await page.click('#ptGuess');
  await page.click('#rigSuggest');
}

// A four-direction character: S (front, main image), N (back), E (side), W (side mirrored), each rigged.
export const FOUR_VIEWS = { S: 'tests/character.png', N: 'tests/character-back.png', E: 'tests/character-side.png', W: 'tests/character-side-left.png' };
export async function rigFourDirections(page, views = FOUR_VIEWS) {
  await rigImage(page, views.S);
  await page.waitForSelector('#dirBar:not([hidden])');
  await page.selectOption('#dirMain', 'S');
  for (const d of ['N', 'E', 'W']) {
    await page.selectOption('#dirAdd', d);
    await page.click('#dirAddBtn');
    await rigImage(page, views[d]);
  }
}

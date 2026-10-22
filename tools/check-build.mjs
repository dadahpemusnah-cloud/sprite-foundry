// Fails if index.html is not exactly what tools/build.mjs makes from src/ (someone edited the output by hand).
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sf-')), 'index.html');
execFileSync('node', ['tools/build.mjs', out]);
if (!fs.readFileSync(out).equals(fs.readFileSync('index.html'))) {
  console.error('index.html is out of date or hand-edited: edit src/ and run npm run build');
  process.exit(1);
}
console.log('index.html matches src/');

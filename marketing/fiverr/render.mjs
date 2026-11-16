// Renders thumbnail.html to thumbnail.png (1024x768) and thumbnail@2x.png (2048x1536).
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
let pw;
try {
  pw = require('playwright');
} catch {
  pw = createRequire(path.join(here, '../../tests/package.json'))('playwright');
}
const browser = await pw.chromium.launch();
for (const [scale, name] of [
  [1, 'thumbnail.png'],
  [2, 'thumbnail@2x.png'],
]) {
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: scale });
  await page.goto(pathToFileURL(path.join(here, 'thumbnail.html')).href, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(here, name) });
  await page.close();
}
await browser.close();
console.log('rendered thumbnail.png and thumbnail@2x.png');

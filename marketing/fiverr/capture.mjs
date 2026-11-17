// Captures the order form's payment step on a phone, with fictional demo data, for the
// portfolio thumbnail. Run inside the emulators (see README.md); writes screen.png here.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
// The pre-installed Playwright (or the tests package's copy).
const require = createRequire(import.meta.url);
let pw;
try {
  pw = require('playwright');
} catch {
  pw = createRequire(path.join(here, '../../tests/package.json'))('playwright');
}
const { chromium, devices } = pw;
const BASE = process.env.BASE ?? 'http://127.0.0.1:4321/booksbyajith/';
const browser = await chromium.launch();
// Full iPhone 13 screen height (the preset's viewport leaves out the browser bars).
const ctx = await browser.newContext({
  ...devices['iPhone 13'],
  viewport: { width: 390, height: 800 },
  baseURL: BASE,
});
const page = await ctx.newPage();
await page.goto('en/order/?book=portuguese-era-1505-1594');
await page.locator('[data-order-app][data-ready="true"]').waitFor();
// Fold the how-to-order box so the form is the focus.
await page.locator('[data-testid="how-to-order"] summary').click();
await page.click('[data-next-step]');
// Fictional customer (example.com address, unassigned test number).
await page.fill('#f-name', 'Sample Reader');
await page.fill('#f-mobile', '077 000 0001');
await page.fill('#f-email', 'reader@example.com');
await page.fill('#f-line1', '12 Library Lane');
await page.fill('#f-city', 'Colombo');
await page.fill('#f-postalCode', '00100');
await page.selectOption('#f-districtId', 'colombo');
await page.click('[data-next-step]');
await page.locator('[data-slip-button]').waitFor();
await page.waitForTimeout(800);
// Start the view just above the step tabs.
await page.evaluate(() => {
  const tabs = document.querySelector(
    '[data-order-app] ol, [data-order-app] [role="tablist"], [data-order-app] nav',
  );
  const y = tabs ? tabs.getBoundingClientRect().top + window.scrollY - 90 : 0;
  window.scrollTo(0, y);
});
await page.waitForTimeout(600);
await page.screenshot({ path: path.join(here, 'screen.png') });
await browser.close();
console.log('saved screen.png');

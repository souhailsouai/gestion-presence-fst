const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  const artifact = path.resolve('dist/web/Gestion-Presence-FST-Web-2026-2027.html');
  await page.goto(pathToFileURL(artifact).href, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(750);
  assert.equal(errors.length, 0, `startup errors: ${errors.join(' | ')}`);
  assert.equal(await page.locator('[data-testid="login-identifier"]').count(), 1);
  assert.equal(await page.locator('[data-testid="login-secret"]').count(), 1);
  assert.equal(await page.locator('[data-testid="login-submit"]').count(), 1);
  assert.equal(await page.locator('body').evaluate(el => el.innerText.trim().length > 40), true);
  await browser.close();
})().catch(error => {
  console.error(error);
  process.exit(1);
});

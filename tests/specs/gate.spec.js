const {test, expect} = require('@playwright/test');
const {openApp, noHorizontalScroll} = require('./helpers');

for (const lang of ['he', 'en']) test(`sign-in screen (${lang})`, async ({page}) => {
  const {errors} = await openApp(page, {lang, out: true});
  const gate = page.locator('#seGate');
  await expect(gate).toBeVisible();
  const google = gate.locator('[data-p="in"] .se-google');
  await expect(google).toBeVisible();
  await expect(google).toHaveText(lang === 'he' ? /המשך עם Google/ : /Continue with Google/);
  await expect(gate.locator('.se-about a[href="privacy.html"]')).toBeVisible();
  await expect(gate.locator('.se-about a[href="terms.html"]')).toBeVisible();
  await google.click();
  const calls = await page.evaluate(() => window.__calls);
  expect(calls).toContainEqual(['oauth', expect.objectContaining({provider: 'google', options: expect.objectContaining({queryParams: {prompt: 'select_account'}})})]);
  expect(await noHorizontalScroll(page)).toBe(true);
  expect(errors).toEqual([]);
});

test('legal pages exist and fit a phone', async ({page}) => {
  for (const f of ['privacy.html', 'terms.html']){
    await page.goto(f);
    await expect(page.locator('h1').first()).toBeVisible();
    await expect(page.locator('#en h1')).toBeVisible();
    expect(await noHorizontalScroll(page)).toBe(true);
  }
});

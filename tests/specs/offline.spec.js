const {test, expect} = require('@playwright/test');
const {openApp} = require('./helpers');

test('opens offline from the service worker and sends offline changes later', async ({page, context}) => {
  const {errors} = await openApp(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); await page.waitForTimeout(1500);   // now controlled by the service worker
  await context.setOffline(true);
  await page.reload(); await page.waitForTimeout(2500);
  await expect(page.locator('#seGate')).toBeHidden();
  await expect(page.locator('#weekLine')).toHaveText(/^שבוע 3/);
  await page.locator('#ready .pip').nth(2).click(); await page.waitForTimeout(500);
  const box = () => page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('se.outbox.u1') || '{}')));
  expect(await box()).toHaveLength(1);
  await context.setOffline(false);
  await page.evaluate(() => dispatchEvent(new Event('online'))); await page.waitForTimeout(1500);
  expect(await box()).toEqual([]);
  expect(errors).toEqual([]);
});

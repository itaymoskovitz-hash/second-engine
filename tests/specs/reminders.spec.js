const {test, expect} = require('@playwright/test');
const {openApp, tab} = require('./helpers');

/* The browser's push service is replaced with a fake subscription; the test checks what the app stores for the server. */
const FAKE_PUSH = () => {
  let sub = null;
  const make = () => ({endpoint: 'https://push.example/abc', toJSON(){ return {endpoint: this.endpoint, keys: {p256dh: 'p', auth: 'a'}}; }, unsubscribe: async () => { sub = null; return true; }});
  PushManager.prototype.getSubscription = async () => sub;
  PushManager.prototype.subscribe = async () => (sub = make());
  Notification.requestPermission = async () => 'granted';
  Object.defineProperty(Notification, 'permission', {get: () => sub ? 'granted' : 'default'});
};

for (const lang of ['he', 'en']) test(`turn the morning reminder on, change the hour, turn it off (${lang})`, async ({page}) => {
  await page.addInitScript(FAKE_PUSH);
  const {errors} = await openApp(page, {lang});
  await tab(page, 'profile');
  await expect(page.locator('#seRmRow')).toBeVisible();
  await expect(page.locator('#seRmHour')).toBeDisabled();
  await page.click('#seRm');
  await expect(page.locator('#seRm')).toHaveAttribute('aria-checked', 'true');
  let calls = await page.evaluate(() => window.__calls.filter(c => c[1] === 'push_subs'));
  const row = calls.find(c => c[0] === 'upsert')[2];
  expect(row).toMatchObject({endpoint: 'https://push.example/abc', hour: 7, lang, tz: 'Asia/Jerusalem'});
  // today (8.11) is "easy run 8 km + strength A" in the fixture, the next day intervals; rest days are left out
  expect(row.days['2026-11-08']).toMatch(lang === 'he' ? /ריצה קלה 8 ק"מ/ : /Easy run 8 km/);
  expect(Object.keys(row.days)).not.toContain('2026-11-12');   // Thursday is "מנוחה"
  await page.selectOption('#seRmHour', '6'); await page.waitForTimeout(300);
  calls = await page.evaluate(() => window.__calls.filter(c => c[1] === 'push_subs' && c[0] === 'upsert'));
  expect(calls.at(-1)[2].hour).toBe(6);
  await page.click('#seRm');
  await expect(page.locator('#seRm')).toHaveAttribute('aria-checked', 'false');
  expect(await page.evaluate(() => window.__calls.some(c => c[0] === 'delete' && c[1] === 'push_subs'))).toBe(true);
  expect(errors).toEqual([]);
});

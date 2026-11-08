const {test, expect} = require('@playwright/test');
const {openApp, tab} = require('./helpers');

for (const lang of ['he', 'en']) test(`delete account needs the typed word (${lang})`, async ({page}) => {
  const {errors} = await openApp(page, {lang});
  await tab(page, 'profile');
  await page.click('#seDelBtn');
  await page.fill('#seDelTxt', 'nope'); await page.click('#seDelForm button');
  await expect(page.locator('#seDelMsg')).toHaveText(lang === 'he' ? /כתוב "מחק"/ : /Type "delete"/);
  expect(await page.evaluate(() => localStorage.getItem('T_RPC'))).toBeNull();
  await page.evaluate(() => localStorage.setItem('se.db.u1.extra', '1'));
  await page.fill('#seDelTxt', lang === 'he' ? 'מחק' : 'delete');
  await Promise.all([page.waitForEvent('framenavigated'), page.click('#seDelForm button')]);
  expect(await page.evaluate(() => [localStorage.getItem('T_RPC'), localStorage.getItem('T_SO'), localStorage.getItem('se.db.u1.extra')]))
    .toEqual(['delete_my_account', '{"scope":"local"}', null]);
  expect(errors).toEqual([]);
});

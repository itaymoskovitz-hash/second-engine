const {test, expect} = require('@playwright/test');
const {openApp, tab} = require('./helpers');

// Hebrew that may stay in English mode: it is user content (calendar race name, the user's own name)
const ALLOWED = [/מרתון תל אביב/];

test('English mode leaves no app text in Hebrew', async ({page}) => {
  const {errors} = await openApp(page, {lang: 'en'});
  for (const t of ['home', 'plan', 'timer', 'fuel', 'coach', 'profile']){
    await tab(page, t);
    if (t === 'fuel') for (const b of await page.locator('#fuRaceTabs .fchip').all()){ await b.click(); await page.waitForTimeout(150); }
  }
  const left = (await page.evaluate(() => [...I18N.full])).filter(s => !ALLOWED.some(re => re.test(s)));
  expect(left).toEqual([]);
  expect(errors).toEqual([]);
});

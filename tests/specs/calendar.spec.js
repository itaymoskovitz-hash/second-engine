const {test, expect} = require('@playwright/test');
const {openApp, tab, noHorizontalScroll} = require('./helpers');

for (const lang of ['he', 'en']) test(`calendar plan: weeks, races and events (${lang})`, async ({page}) => {
  const {errors} = await openApp(page, {lang});
  // week 1 starts where the calendar's "שבוע 1" is (25.10), so 8.11 is week 3; the race on the last day is picked up
  await expect(page.locator('#weekLine')).toHaveText(lang === 'he' ? /^שבוע 3 מתוך 8 · מרתון תל אביב$/ : /^Week 3 of 8 · מרתון תל אביב$/);
  await tab(page, 'plan');
  // one event, shown once, start before end (LRM marks keep it from flipping in RTL)
  const times = await page.evaluate(() => [...document.querySelectorAll('#viewPlan *')].filter(e => !e.children.length && /\d\d:\d\d\W+\d\d:\d\d/.test(e.textContent)).map(e => e.textContent.replace(/[^\d:–]/g, '')));
  expect(times).toEqual(['10:00–11:00']);
  for (const t of ['home', 'plan', 'timer', 'fuel', 'coach', 'profile']){ await tab(page, t); expect(await noHorizontalScroll(page), t).toBe(true); }
  expect(errors).toEqual([]);
});

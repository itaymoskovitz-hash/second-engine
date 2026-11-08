const {test, expect} = require('@playwright/test');
const {openApp} = require('./helpers');

/* A beginner runner: answers the first option at each step, a 5 km time when asked, and starts the plan. */
async function runOnboarding(page){
  for (let i = 0; i < 30; i++){
    const st = await page.evaluate(() => {
      const ob = document.getElementById('ob'); if (!ob || ob.hidden) return 'closed';
      const vis = [...ob.querySelectorAll('button,input')].filter(x => x.offsetParent);
      const inp = vis.find(x => x.tagName === 'INPUT' && !['hidden','file','date'].includes(x.type));
      const multi = ob.querySelector('#obNext');
      if (multi && ob.querySelector('.ob-chip[aria-pressed="true"]')){ multi.click(); return 'multi'; }
      const chips = vis.filter(x => x.tagName === 'BUTTON' && x.closest('.ob-chips, .ob-opts, .ob-ans'));
      if (inp){ inp.value = /:/.test(inp.placeholder || '') ? '30:00' : inp.type === 'number' ? '72' : (inp.value || 'Dana'); inp.dispatchEvent(new Event('input', {bubbles: true})); }
      else if (chips.length){ chips[0].click(); return 'chip'; }
      const next = vis.find(x => x.tagName === 'BUTTON' && x.classList.contains('primary'));
      if (next){ next.click(); return 'next'; }
      return 'stuck';
    });
    if (st === 'closed') return true;
    if (st === 'stuck') return false;
    await page.waitForTimeout(350);
  }
  return false;
}

for (const lang of ['he', 'en']) test(`new user builds a plan without AI (${lang})`, async ({page}) => {
  const {errors, ai} = await openApp(page, {lang, scen: 'new'});
  await expect(page.locator('#ob')).toBeVisible();
  expect(await runOnboarding(page)).toBe(true);
  await expect(page.locator('#sessTitle')).not.toHaveText('');
  await expect(page.locator('#weekLine')).toHaveText(lang === 'he' ? /^שבוע \d+ מתוך \d+/ : /^Week \d+ of \d+/);
  if (lang === 'en'){ const left = (await page.evaluate(() => [...I18N.full])).filter(s => !/Dana/.test(s)); expect(left).toEqual([]); }
  expect(ai).toEqual([]);
  expect(errors).toEqual([]);
});

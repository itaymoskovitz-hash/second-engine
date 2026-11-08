const fs = require('fs'), path = require('path');
const FIX = path.join(__dirname, '..', 'fixtures');
const STUB = fs.readFileSync(path.join(FIX, 'supabase-stub.js'), 'utf8');
const CAL = fs.readFileSync(path.join(FIX, 'calendar.json'), 'utf8');
const NOW = new Date('2026-11-08T08:00:00+02:00');   // Sunday of week 3 in the calendar fixture

/* Opens the app with stubbed backends. opts: lang 'he'|'en', scen 'cal'|'new', out (signed out), calendar (default true for 'cal') */
async function openApp(page, opts = {}){
  const {lang = 'he', scen = 'cal', out = false} = opts;
  const calendar = opts.calendar !== undefined ? opts.calendar : scen === 'cal';
  const errors = [], ai = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.context().route(/supabase-js/, r => r.fulfill({body: STUB, contentType: 'text/javascript'}));
  await page.context().route(/accounts\.google\.com\/gsi|fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.context().route(/googleapis\.com\/calendar/, r => r.fulfill({body: calendar ? CAL : '{"items":[]}', contentType: 'application/json'}));
  await page.context().route(/functions\/v1\/coach-ai/, r => { ai.push(r.request().url()); r.fulfill({status: 503, body: '{}'}); });
  await page.addInitScript(([l, s, o, cal]) => {
    if (sessionStorage.getItem('T_INIT')) return; sessionStorage.setItem('T_INIT', '1');
    localStorage.setItem('T_LANG', l); localStorage.setItem('T_SCEN', s); localStorage.setItem('se.lang', l);
    if (o) localStorage.setItem('T_OUT', '1');
    if (cal) sessionStorage.setItem('se.gc', JSON.stringify({token: 'x', exp: Date.now() + 3e6}));
  }, [lang, scen, out, calendar]);
  await page.clock.setFixedTime(NOW);
  await page.goto('./');
  await page.waitForFunction(() => !document.querySelector('.splash'), null, {timeout: 10000}).catch(() => {});
  await page.waitForTimeout(800);
  return {errors, ai};
}
const tab = async (page, t) => { await page.click(`[data-tab="${t}"]`); await page.waitForTimeout(300); };
const noHorizontalScroll = page => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
module.exports = {openApp, tab, noHorizontalScroll, NOW};

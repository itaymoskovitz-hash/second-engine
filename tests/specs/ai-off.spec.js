const {test, expect} = require('@playwright/test');
const {openApp, tab} = require('./helpers');

test('with ai:false no AI entry point is visible and nothing calls the AI function', async ({page}) => {
  const {errors, ai} = await openApp(page);
  await expect(page.locator('html')).toHaveClass(/no-ai/);
  await tab(page, 'coach');
  for (const id of ['coForm', 'coBriefRe']) await expect(page.locator('#' + id)).toBeHidden();
  await expect(page.locator('#coBrief')).not.toBeEmpty();   // the rule-based brief
  await tab(page, 'fuel');
  for (const id of ['fuEst', 'fuAnalyze']) await expect(page.locator('#' + id)).toBeHidden();
  expect(ai).toEqual([]);
  expect(errors).toEqual([]);
});

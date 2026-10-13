import { test as base, expect } from '@playwright/test';
// Cada prueba abre la app en blanco con los datos de ejemplo y falla si hay errores de JavaScript.
export const test = base.extend({
  app: async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(m.text()); });
    await page.goto('/index.html');
    await page.waitForFunction(() => typeof S === 'object' && S && document.querySelector('#main').innerHTML);
    page.errors = errors;
    await use(page);
    expect(errors, 'errores de JavaScript').toEqual([]);
  },
});
export { expect };
export const tap = (page, sel) => page.locator(sel).first().click();

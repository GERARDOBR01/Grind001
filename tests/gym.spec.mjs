import { test, expect, tap } from './fixtures.mjs';

test('las 5 pestañas abren', async ({ app }) => {
  await expect(app.locator('#tabbar button')).toHaveText(['Inicio', 'Entrenar', 'Comida', 'Movilidad', 'Perfil']);
  for (const k of ['train', 'food', 'mov', 'me', 'home']) {
    await tap(app, `[data-a=tab][data-k=${k}]`);
    await expect(app.locator(`[data-a=tab][data-k=${k}]`)).toHaveAttribute('aria-current', 'page');
  }
});

test('entreno completo: rutina, serie, descanso, guardar', async ({ app }) => {
  const before = await app.evaluate(() => S.workouts.length);
  await tap(app, '[data-a=tab][data-k=train]');
  await tap(app, '[data-a=startRoutine]');
  await expect(app.locator('.exc').first()).toBeVisible();
  await tap(app, '.ck');
  await expect(app.locator('.tr.done')).toHaveCount(1);
  await expect(app.locator('#restbar .restbar')).toBeVisible();          // descanso automático
  await tap(app, '[data-a=back]');
  await expect(app.locator('#resume .resume')).toBeVisible();            // aviso de entreno en curso
  await tap(app, '[data-a=resume]');
  await tap(app, '[data-a=finish]');
  await tap(app, '[data-a=save]');
  expect(await app.evaluate(() => [S.workouts.length, !!S.active])).toEqual([before + 1, false]);
});

test('kg ↔ lb cambia lo que se muestra, no lo guardado', async ({ app }) => {
  const kg = await app.evaluate(() => S.body[S.body.length - 1].kg);
  await app.evaluate(() => { S.units = 'lb'; render(); });
  expect(await app.evaluate(() => wt(S.body[S.body.length - 1].kg))).toBe((Math.round(kg * 2.20462 * 100) / 100).toLocaleString('es-MX', { maximumFractionDigits: 2 }));
  expect(await app.evaluate(() => S.body[S.body.length - 1].kg)).toBe(kg);
});

test('fórmulas del gym: 1RM por tabla, volumen con peso corporal', async ({ app }) => {
  const r = await app.evaluate(() => ({
    e10: e1rm({ kg: 100, reps: 10 }, { type: 'wr' }),
    e1: e1rm({ kg: 100, reps: 1 }, { type: 'wr' }),
    vbw: setVol({ kg: 10, reps: 5, t: 'n' }, EX('pull'), 80),
  }));
  expect(r.e10).toBeCloseTo(100 / 0.75, 5);
  expect(r.e1).toBe(100);
  expect(r.vbw).toBe((10 + 80) * 5);
});

test('el botón atrás no saca de la app durante un entreno (también al reabrirla)', async ({ app }) => {
  await app.locator('[data-a=tab][data-k=train]').click();
  await app.locator('[data-a=startRoutine]').first().click();
  await app.goBack();
  await expect(app.locator('#resume .resume')).toBeVisible();
  await app.evaluate(() => saveNow());
  await app.reload();
  await expect(app.locator('[data-a=finish]')).toBeVisible();              // reabre en el entreno en curso
  await app.goBack();
  await expect(app.locator('#resume .resume')).toBeVisible();
});

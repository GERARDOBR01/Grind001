import { test, expect } from './fixtures.mjs';

test('el respaldo incluye los tres módulos', async ({ app }) => {
  const keys = await app.evaluate(() => Object.keys(JSON.parse(JSON.stringify({ ...S, active: null }))));
  for (const k of ['workouts', 'routines', 'body', 'nut', 'mov']) expect(keys).toContain(k);
});

test('importar un respaldo viejo (solo gym) no rompe comida ni movilidad', async ({ app }) => {
  await app.evaluate(() => { resetState(fill({ workouts: S.workouts, routines: S.routines, body: S.body, custom: [], active: null })); });
  for (const k of ['food', 'mov', 'me', 'home']) await app.evaluate(k => tab(k), k);
  expect(await app.evaluate(() => [S.nut.setup, S.mov.tests.length, S.workouts.length > 0])).toEqual([false, 0, true]);
});

test('borrar todo y restaurar el ejemplo', async ({ app }) => {
  await app.evaluate(() => { resetState(blank()); saveNow(); });
  for (const k of ['home', 'train', 'food', 'mov', 'me']) await app.evaluate(k => tab(k), k);
  expect(await app.evaluate(() => [S.workouts.length, Object.keys(S.nut.log).length, S.mov.sessions.length])).toEqual([0, 0, 0]);
  await app.evaluate(() => { resetState(blank()); SEEDS.forEach(f => f()); saveNow(); tab('home'); });
  const [w, d, m] = await app.evaluate(() => [S.workouts.length, Object.keys(S.nut.log).length, S.mov.sessions.length]);
  expect(w).toBeGreaterThan(20); expect(d).toBeGreaterThan(40); expect(m).toBeGreaterThan(5);
});

test('los datos sobreviven a recargar la página', async ({ app }) => {
  await app.evaluate(() => { S.nut.tgt.kcal = 1999; saveNow(); });
  await app.reload();
  await app.waitForFunction(() => typeof S === 'object' && S);
  expect(await app.evaluate(() => S.nut.tgt.kcal)).toBe(1999);
});

import { test, expect, tap } from './fixtures.mjs';

test('buscar y agregar un alimento suma al día', async ({ app }) => {
  await tap(app, '[data-a=tab][data-k=food]');
  const k0 = await app.evaluate(() => totals(dayLog(today())).k);
  await tap(app, '[data-a=go][data-v=fadd][data-id="2"]');
  await app.fill('#fq', 'pechuga cocida');
  await tap(app, '#flist [data-a=pickFood]');
  await tap(app, '[data-a=amtMode][data-k=g]');                           // de «1 filete» a gramos
  await app.fill('#fg', '200');
  await tap(app, '[data-a=amtOk]');
  await expect(app.locator('.h2', { hasText: 'Hoy' })).toBeVisible();
  const k1 = await app.evaluate(() => totals(dayLog(today())).k);
  expect(k1 - k0).toBeCloseTo(330, 0);                                   // 165 kcal/100 g × 200 g
  expect(await app.evaluate(() => dayLog(today()).at(-1).m)).toBe(2);    // en la cena
});

test('registro rápido, alimento propio y copiar día', async ({ app }) => {
  await tap(app, '[data-a=tab][data-k=food]');
  await app.evaluate(() => { const t = cur(); t.d = addDays(today(), 3); render(); });   // día vacío
  await tap(app, '[data-a=go][data-v=fadd]');
  await tap(app, '[data-a=quick]');
  await app.fill('#qn', 'Café con pan'); await app.fill('#qp', '10'); await app.fill('#qc', '40'); await app.fill('#qf', '5');
  await tap(app, '[data-a=quickOk]');
  const e = await app.evaluate(() => dayLog(addDays(today(), 3))[0]);
  expect(e.k).toBe(10 * 4 + 40 * 4 + 5 * 9);
  await tap(app, '[data-a=go][data-v=fadd]');
  await tap(app, '[data-a=go][data-v=fnew]');
  await app.fill('#nf_name', 'Yogur casero'); await app.fill('#nf_sg', '150'); await app.fill('#nf_k', '120'); await app.fill('#nf_p', '12');
  await tap(app, '[data-a=saveFood]');
  await expect(app.locator('#fg')).toBeVisible();                         // abre la hoja de cantidad
  expect(await app.evaluate(() => S.nut.foods[0])).toMatchObject({ name: 'Yogur casero', kcal: 80, p: 8 });
});

test('plan: calcular metas y check-in', async ({ app }) => {
  await tap(app, '[data-a=tab][data-k=food]');
  await tap(app, '[data-a=go][data-v=nsetup]');
  await app.fill('#ns_age', '28'); await app.fill('#ns_cm', '170'); await app.fill('#ns_kg', '70');
  await tap(app, '[data-a=nsSet][data-f=goal][data-k=maintain]');
  await tap(app, '[data-a=nsSave]');
  const t = await app.evaluate(() => S.nut.tgt);
  expect(t.p).toBe(140);                                                  // 2 g/kg
  expect(Math.abs(t.p * 4 + t.c * 4 + t.f * 9 - t.kcal)).toBeLessThan(15);
  await tap(app, '[data-a=go][data-v=nprog]');
  await tap(app, '[data-a=checkin]');
  await tap(app, '[data-a=checkinOk]');
  expect(await app.evaluate(() => Date.now() - S.nut.checkin)).toBeLessThan(5000);
});

test('cálculos: tendencia, pendiente y gasto adaptativo', async ({ app }) => {
  const r = await app.evaluate(() => {
    // 6 semanas comiendo 2200 con un gasto real de 2700: baja ~0.065 kg/día
    const TRUE = 2700, n = {sex:'m', age:30, cm:178, act:1.2, log:{}}, body = [];
    let kg = 85; const d0 = addDays(today(), -41);
    for (let i = 0; i < 42; i++){
      const k = addDays(d0, i), eat = 2200 + (i % 3 - 1) * 150;
      n.log[k] = [{k:eat, p:0, c:0, fa:0}];
      kg += (eat - TRUE) / KCAL_KG;
      body.push({t:kd(k) + 8 * 3600e3, kg:kg + ((i * 7919) % 11 - 5) / 10});   // ruido de ±0.5 kg
    }
    const E = NUT.expenditure(n, body, today());
    const tr = NUT.trend(body, null, today());
    return {first:E[0].v, last:E.at(-1).v, slope:NUT.slope([[0,1],[1,3],[2,5]]), trendLast:tr.at(-1).tr, kg,
      floor:NUT.targets({goal:'lose', rate:-1, sex:'f', prot:2, fat:.3}, 1300, 60).kcal};
  });
  expect(r.slope).toBe(2);
  expect(Math.abs(r.trendLast - r.kg)).toBeLessThan(0.8);
  expect(Math.abs(r.last - 2700)).toBeLessThan(150);                      // converge al gasto real
  expect(r.floor).toBe(1200);                                             // piso de seguridad
});

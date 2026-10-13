import { test, expect, tap } from './fixtures.mjs';

test('rutina guiada de principio a fin guarda la sesión', async ({ app }) => {
  await tap(app, '[data-a=tab][data-k=mov]');
  const n0 = await app.evaluate(() => S.mov.sessions.length);
  await tap(app, '[data-a=go][data-v=mroutine][data-id=escritorio]');
  await tap(app, '[data-a=playStart]');
  await expect(app.locator('.play')).toBeVisible();
  await expect(app.locator('.play .lbl')).toHaveText('Prepárate');
  await tap(app, '[data-a=playMv][data-k="1"]');
  await expect(app.locator('.play .lbl')).toHaveText('Sostén');
  await app.evaluate(() => { PLAY.active = 120; PLAY.i = PLAY.steps.length - 1; PLAY.phase = 'hold'; PLAY.left = 0.05; });
  await expect(app.locator('.done-hero')).toBeVisible();
  expect(await app.evaluate(() => S.mov.sessions.length)).toBe(n0 + 1);
});

test('crear una rutina propia', async ({ app }) => {
  await tap(app, '[data-a=tab][data-k=mov]');
  await tap(app, '[data-a=go][data-v=medit]');
  await app.fill('#me_title', 'Rodillas felices');
  for (const id of ['tobillo', 'sentadilla']) {
    await tap(app, '[data-a=go][data-v=mlib]');
    await tap(app, `[data-a=meditAdd][data-k=${id}]`);
  }
  await tap(app, '[data-a=meditSave]');
  expect(await app.evaluate(() => S.mov.custom.map(r => [r.title, r.items.map(i => i[0])]))).toEqual([['Rodillas felices', ['tobillo', 'sentadilla']]]);
});

// poses sintéticas con proporciones humanas (cm → píxeles de un cuadro de 720×1280)
const SYNTH = () => {
  const W = 720, H = 1280, sc = 5.5, ox = 360, gy = 1150;
  const mk = pts => { const lm = Array.from({ length: 33 }, () => ({ x: .5, y: .5, z: 0, visibility: .1 }));
    for (const [i, [x, y, z]] of Object.entries(pts)) lm[i] = { x: (ox + x * sc) / W, y: (gy - y * sc) / H, z: z || 0, visibility: .99 }; return lm; };
  const front = (squat, kx = squat ? 17 : 10) => { const hy = squat ? 55 : 95, sy = squat ? 105 : 145;
    return mk({ 0: [0, sy + 22], 7: [7, sy + 18], 8: [-7, sy + 18], 11: [17, sy], 12: [-17, sy], 13: [19, sy + 28], 14: [-19, sy + 28], 15: [17, sy + 55], 16: [-17, sy + 55],
      23: [11, hy], 24: [-11, hy], 25: [kx, 50], 26: [-kx, 50], 27: [13, 8], 28: [-13, 8], 29: [13, 2], 30: [-13, 2], 31: [15, 0], 32: [-15, 0] }); };
  const side = (squat, near = 'L') => { const P = {};
    const s = squat ? { sh: [22, 100], hip: [-12, 55], kn: [28, 50], an: [4, 8], ear: [33, 115], wr: [30, 155], el: [28, 128] }
                    : { sh: [0, 145], hip: [0, 95], kn: [1, 50], an: [0, 8], ear: [4, 163], wr: [1, 200], el: [1, 173] };
    const Lm = { sh: 11, el: 13, wr: 15, hip: 23, kn: 25, an: 27, ear: 7, he: 29, to: 31 }, Rm = { sh: 12, el: 14, wr: 16, hip: 24, kn: 26, an: 28, ear: 8, he: 30, to: 32 };
    const N = near === 'L' ? Lm : Rm, F = near === 'L' ? Rm : Lm;
    for (const k of ['sh', 'el', 'wr', 'hip', 'kn', 'an', 'ear']) { P[N[k]] = [...s[k], -10]; P[F[k]] = [s[k][0] + 2, s[k][1], 10]; }
    P[N.he] = [-4, 2, -10]; P[N.to] = [18, 0, -10]; P[F.he] = [-3, 2, 10]; P[F.to] = [19, 0, 10]; P[0] = [s.ear[0] + 9, s.ear[1] - 2, 0];
    return mk(P); };
  return { W, H, front, side };
};

test('test de movilidad: acepta posturas correctas, corrige las incorrectas y puntúa', async ({ app }) => {
  const r = await app.evaluate(`(${SYNTH})()`).then(() => app.evaluate(new Function(`
    const {W, H, front, side} = (${SYNTH})();
    const lms = [front(false), side(false,'L'), side(false,'R'), front(true), side(true,'L'), side(true,'R')];
    const ok = TEST_STEPS.map((st, i) => MT.check(lms[i], W, H, st).ok);
    const R = {}; TEST_STEPS.forEach((st, i) => R[st.mv + ':' + st.dir] = MT.measure(lms[i], W, H, st));
    const good = MT.score(R);
    const bad = MT.score({...R, 'squat:front': MT.measure(front(true, 9), W, H, TEST_STEPS[3])});   // rodillas hacia dentro
    return { ok, wrongSide: MT.check(side(false,'R'), W, H, TEST_STEPS[1]).ok, standing: MT.check(front(false), W, H, TEST_STEPS[3]).ok,
      good: good.scores.overall, valgus: bad.comps.find(c => c.type === 'valgus').v, badZones: bad.zones };`)));
  expect(r.ok).toEqual([true, true, true, true, true, true]);
  expect(r.wrongSide).toBe(false);
  expect(r.standing).toBe(false);
  expect(r.good).toBeGreaterThan(0.9);
  expect(r.valgus).toBeGreaterThan(0.5);
  expect(r.badZones.length).toBeGreaterThan(0);
});

test('el detector de pose carga y la cámara arranca', async ({ app }) => {
  test.slow();
  await tap(app, '[data-a=tab][data-k=mov]');
  await tap(app, '[data-a=go][data-v=mtest]');
  await tap(app, '[data-a=testStart]');
  await expect.poll(() => app.evaluate(() => !!LANDMARKER), { timeout: 60_000 }).toBe(true);
  await expect(app.locator('#tmsg')).toContainText(/No te veo|cuerpo|cámara/);
  await tap(app, '[data-a=testX]');
  expect(await app.evaluate(() => TEST)).toBe(null);                      // la cámara se apaga al salir
});

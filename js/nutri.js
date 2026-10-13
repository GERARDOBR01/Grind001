'use strict';
/* =====================================================================
   COMIDA — registro de alimentos, metas, peso de tendencia y gasto
   adaptativo. Se monta sobre el núcleo de index.html (S, VIEWS, A, go…).
   Método descrito en docs/ANALISIS.md §6.
   ===================================================================== */

const KCAL_KG = 7700;                 // energía por kg de cambio de peso
const MEALS = ['Desayuno','Comida','Cena','Colaciones'];
const ACT = [[1.2,'Sedentario','Trabajo sentado, casi sin ejercicio'],[1.375,'Ligero','Ejercicio 1–3 días'],[1.55,'Moderado','Ejercicio 3–5 días'],[1.725,'Activo','Ejercicio 6–7 días'],[1.9,'Muy activo','Trabajo físico + entreno']];
const PROT = [[1.6,'Moderada'],[2,'Alta'],[2.4,'Muy alta']];

BLANKS.push(() => ({nut:{setup:false, sex:'m', age:30, cm:175, act:1.55, goal:'lose', rate:-0.5, prot:2, fat:0.3,
  tgt:{kcal:2000, p:150, c:200, f:67}, checkin:0, log:{}, foods:[], meals:[], fav:[], recent:[]}}));

TABS.splice(2, 0, ['food','Comida','food']);
I.food = '<path d="M7 3v8a2 2 0 0 0 2 2v8M5 3v5a2 2 0 0 0 2 2h0M9 3v5a2 2 0 0 1-2 2"/><path d="M17 21V3c-2 1-3 4-3 8 0 1 1 2 3 2"/>';
I.scan = '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 9v6M10 9v6M13 9v6M17 9v6"/>';
I.star = '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>';
I.bolt = '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>';
I.copy = '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>';

/* ---------- fechas ---------- */
const dk = t => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); };
const kd = k => { const [y,m,d] = k.split('-').map(Number); return new Date(y, m-1, d).getTime(); };
const today = () => dk(Date.now());
const addDays = (k, n) => { const d = new Date(kd(k)); d.setDate(d.getDate() + n); return dk(d); };
function dayName(k){
  const t = today();
  if (k === t) return 'Hoy';
  if (k === addDays(t, -1)) return 'Ayer';
  if (k === addDays(t, 1)) return 'Mañana';
  return cap(DF.format(kd(k)));
}

/* ---------- alimentos ---------- */
let FMAP = null;
function foodIndex(){
  FMAP = {};
  for (const r of FOODS){ const [id,name,kcal,p,c,f,sg,sl,cat] = r; FMAP['db:'+id] = {ref:'db:'+id, name, kcal, p, c, f, sg, sl, cat}; }
  for (const x of S.nut.foods) FMAP['my:'+x.id] = Object.assign({ref:'my:'+x.id, cat:'otr'}, x);
}
const FOOD = ref => { if (!FMAP) foodIndex(); return FMAP[ref]; };
const per = (x, g) => ({k:x.kcal*g/100, p:x.p*g/100, c:x.c*g/100, f:x.f*g/100});
const kc = n => nf(Math.round(n), 0);
const gr = n => nf(n < 10 ? r1(n) : Math.round(n), 1);

const dayLog = k => S.nut.log[k] || [];
function totals(items){
  const t = {k:0, p:0, c:0, f:0};
  for (const e of items){ t.k += e.k; t.p += e.p; t.c += e.c; t.f += e.fa; }
  return t;
}
const loggedDay = k => dayLog(k).length > 0;

/* ---------- cálculos: tendencia, gasto, metas ---------- */
const NUT = {
  mifflin(sex, kg, cm, age){ return 10*kg + 6.25*cm - 5*age + (sex === 'f' ? -161 : 5); },

  // peso de tendencia diario: interpolación entre pesajes + media móvil exponencial
  trend(body, from, to, alpha = 0.1){
    const pts = body.map(b => ({k:dk(b.t), kg:b.kg})).sort((a,b) => a.k < b.k ? -1 : 1);
    const byDay = {}; for (const p of pts) byDay[p.k] = p.kg;
    const days = Object.keys(byDay).sort();
    if (!days.length) return [];
    const start = from && from > days[0] ? from : days[0];
    const out = []; let tr = null, i = 0;
    for (let k = days[0]; k <= to; k = addDays(k, 1)){
      while (i < days.length - 1 && days[i+1] <= k) i++;
      let w;
      if (byDay[k] != null) w = byDay[k];
      else if (k > days[days.length-1]) w = null;            // sin pesajes después del último: la tendencia se queda
      else { const a = days[i], b = days[i+1], ta = kd(a), tb = kd(b); w = byDay[a] + (byDay[b] - byDay[a]) * (kd(k) - ta) / (tb - ta); }
      if (w != null) tr = tr == null ? w : tr + alpha * (w - tr);
      if (k >= start) out.push({k, t:kd(k), w:byDay[k] ?? null, tr});
    }
    return out;
  },

  // gasto estimado día a día. Devuelve [{k, t, v, raw}]
  expenditure(n, body, to){
    const keys = Object.keys(n.log).filter(k => n.log[k].length).sort();
    const lastW = body.length ? body.slice().sort((a,b) => b.t - a.t)[0].kg : 75;
    const prior = Math.round(NUT.mifflin(n.sex, lastW, n.cm, n.age) * n.act);
    if (!keys.length) return [{k:to, t:kd(to), v:prior, raw:null}];
    const wBy = {}; for (const b of body) wBy[dk(b.t)] = b.kg;
    const out = []; let E = prior;
    for (let k = keys[0]; k <= to; k = addDays(k, 1)){
      let raw = null;
      const win = [];
      for (let j = 27; j >= 0; j--){ const d = addDays(k, -j); if (d >= keys[0]) win.push(d); }
      const logged = win.filter(d => n.log[d] && n.log[d].length);
      const ws = win.filter(d => wBy[d] != null).map(d => [kd(d) / DAY, wBy[d]]);
      const span = ws.length ? ws[ws.length-1][0] - ws[0][0] : 0;
      if (logged.length >= 7 && ws.length >= 4 && span >= 6){
        const intake = logged.reduce((s,d) => s + totals(n.log[d]).k, 0) / logged.length;
        raw = intake - NUT.slope(ws) * KCAL_KG;
        const kmix = 0.1 + 0.2 * Math.min(1, logged.length / 28);
        E += Math.max(-150, Math.min(150, kmix * (raw - E)));
      }
      out.push({k, t:kd(k), v:Math.round(E), raw});
    }
    return out;
  },

  // pendiente por mínimos cuadrados (kg por día)
  slope(pts){
    const m = pts.length, mx = pts.reduce((s,p) => s + p[0], 0) / m, my = pts.reduce((s,p) => s + p[1], 0) / m;
    let num = 0, den = 0;
    for (const [x,y] of pts){ num += (x-mx)*(y-my); den += (x-mx)**2; }
    return den ? num / den : 0;
  },

  // metas a partir del gasto, el objetivo y el peso
  targets(n, E, kg){
    const rate = n.goal === 'maintain' ? 0 : n.rate;                 // % del peso por semana
    let kcal = E + rate/100 * kg * KCAL_KG / 7;
    kcal = Math.max(kcal, n.sex === 'f' ? 1200 : 1500);
    kcal = Math.round(kcal / 10) * 10;
    const p = Math.round(n.prot * kg);
    const f = Math.round(Math.max(n.fat, 0.25) * kcal / 9);
    const c = Math.max(0, Math.round((kcal - p*4 - f*9) / 4));
    return {kcal, p, c, f};
  }
};
let EXP_CACHE = null;
function expNow(){
  const sig = JSON.stringify([S.body.length, S.body[S.body.length-1], Object.keys(S.nut.log).length, today(), S.nut.sex, S.nut.age, S.nut.cm, S.nut.act]) + JSON.stringify(S.nut.log).length;
  if (!EXP_CACHE || EXP_CACHE.sig !== sig) EXP_CACHE = {sig, s:NUT.expenditure(S.nut, S.body, today())};
  return EXP_CACHE.s;
}
const curTrend = () => { const t = NUT.trend(S.body, addDays(today(), -1), today()); return t.length ? t[t.length-1].tr : null; };
const lastKg = () => S.body.length ? S.body.slice().sort((a,b) => b.t - a.t)[0].kg : null;

/* ---------- gráficas ---------- */
function ring(val, max, label, sub){
  const R = 52, C = 2*Math.PI*R, f = Math.max(0, Math.min(1, max ? val/max : 0)), over = val > max;
  return `<svg viewBox="0 0 128 128" width="128" height="128" style="flex:none">
    <circle cx="64" cy="64" r="${R}" fill="none" stroke="var(--line)" stroke-width="10"/>
    <circle cx="64" cy="64" r="${R}" fill="none" stroke="${over ? 'var(--fail)' : 'var(--acc)'}" stroke-width="10" stroke-linecap="round"
      stroke-dasharray="${(C*f).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 64 64)"/>
    <text x="64" y="62" text-anchor="middle" style="font-size:24px;font-weight:700;fill:var(--ink);font-variant-numeric:tabular-nums">${label}</text>
    <text x="64" y="80" text-anchor="middle" style="font-size:10.5px;fill:var(--mut);font-family:var(--mono);letter-spacing:.08em">${sub}</text>
  </svg>`;
}
const MCOL = {p:'#3e7bfa', c:'#e0a83a', f:'#3fae6a'};
function macroBar(lbl, v, max, col){
  const pct = Math.min(100, max ? v/max*100 : 0);
  return `<div style="margin-top:9px"><div style="display:flex;justify-content:space-between;font-size:12.5px"><span>${lbl}</span><span class="num mut"><b style="color:var(--ink);font-weight:640">${Math.round(v)}</b> / ${max} g</span></div>
    <div class="bar2" style="height:7px;border-radius:4px;background:var(--line);overflow:hidden;margin-top:4px"><i style="display:block;height:100%;width:${pct}%;background:${col};border-radius:4px"></i></div></div>`;
}
// dos series: puntos (peso de báscula) y línea (tendencia / gasto)
function chart2(pts, opt = {}){
  const W = 320, H = 160, L = 36, R = 8, T = 10, B = 20;
  if (pts.length < 2) return '<div class="mut" style="font-size:13px;padding:8px 0">Aún no hay suficientes datos.</div>';
  const all = pts.flatMap(p => [p.a, p.b]).filter(v => v != null);
  let lo = Math.min(...all), hi = Math.max(...all);
  if (hi - lo < (opt.min || 1)){ const m = (hi+lo)/2; hi = m + (opt.min||1)/2; lo = m - (opt.min||1)/2; }
  const pad = (hi-lo)*.1; lo -= pad; hi += pad;
  const t0 = pts[0].t, t1 = pts[pts.length-1].t;
  const x = t => L + (W-L-R) * (t1 === t0 ? .5 : (t - t0)/(t1 - t0));
  const y = v => T + (H-T-B) * (1 - (v-lo)/(hi-lo));
  const line = pts.filter(p => p.b != null).map((p,i) => (i ? 'L' : 'M') + x(p.t).toFixed(1) + ' ' + y(p.b).toFixed(1)).join(' ');
  const ticks = [lo + (hi-lo)*.15, (lo+hi)/2, hi - (hi-lo)*.15];
  const d = opt.dec ?? (hi - lo < 20 ? 1 : 0);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">
    ${ticks.map(v => `<line class="grid" x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L-6}" y="${y(v)+3}" text-anchor="end">${nf(v, d)}</text>`).join('')}
    ${pts.filter(p => p.a != null).map(p => `<circle cx="${x(p.t).toFixed(1)}" cy="${y(p.a).toFixed(1)}" r="2.1" fill="var(--mut-2)"/>`).join('')}
    <path class="ln" d="${line}"/>
    <text x="${L}" y="${H-5}">${DFS.format(t0)}</text><text x="${W-R}" y="${H-5}" text-anchor="end">${DFS.format(t1)}</text>
  </svg>`;
}

/* ---------- vistas ---------- */
VIEWS.food = t => {
  if (!t.d) t.d = today();
  const n = S.nut, items = dayLog(t.d), tot = totals(items), tg = n.tgt;
  const left = tg.kcal - tot.k;
  const E = expNow(), Ev = E[E.length-1].v, tr = curTrend();
  const due = n.setup && Date.now() - n.checkin > 6.5*DAY;
  const meals = MEALS.map((m, mi) => {
    const list = items.map((e,i) => [e,i]).filter(([e]) => e.m === mi);
    const mt = totals(list.map(([e]) => e));
    return `<div class="card">
      <div style="display:flex;align-items:center;gap:8px;padding:12px 14px ${list.length ? '6px' : '12px'}">
        <span class="h2" style="flex:1">${m}</span>
        ${list.length ? `<span class="num mut" style="font-size:13px">${kc(mt.k)} kcal</span><button class="ib" style="width:30px;height:30px" data-a="mealMenu" data-k="${mi}" aria-label="Opciones">${ic('more')}</button>` : ''}
        <button class="link" data-a="go" data-v="fadd" data-id="${mi}">+ Agregar</button>
      </div>
      ${list.map(([e,i]) => `<button class="exi" style="border-bottom:0;border-top:1px solid var(--line-2);padding:9px 14px" data-a="entry" data-k="${i}">
        <div style="flex:1;min-width:0"><div class="tt" style="font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(e.n)}</div>
        <div class="dd num">${e.g ? gr(e.g) + ' g · ' : ''}P ${gr(e.p)} · C ${gr(e.c)} · G ${gr(e.fa)}</div></div>
        <span class="num" style="font-size:14px;font-weight:620">${kc(e.k)}</span></button>`).join('')}
    </div>`;
  }).join('');
  return {
    title:'Comida',
    right:`<button class="ib" data-a="go" data-v="nprog" aria-label="Progreso">${ic('trophy')}</button><button class="ib" data-a="go" data-v="nsetup" aria-label="Plan">${ic('gear')}</button>`,
    body:`
      <div class="pad" style="display:flex;align-items:center;gap:6px;padding-top:12px">
        <button class="ib" data-a="fday" data-k="-1" aria-label="Día anterior">${ic('back')}</button>
        <button class="h2" style="flex:1;text-align:center" data-a="fday" data-k="0">${dayName(t.d)}</button>
        <button class="ib" data-a="fday" data-k="1" aria-label="Día siguiente" style="transform:scaleX(-1)">${ic('back')}</button>
      </div>
      ${!n.setup ? `<div class="card p" style="border-color:var(--acc)"><b>Arma tu plan de comida</b><div class="mut" style="font-size:13.5px;margin:4px 0 10px">Con tu peso, estatura y objetivo calculamos calorías y macros. Cada semana se ajustan con lo que comes y lo que marca la báscula.</div><button class="btn acc" data-a="go" data-v="nsetup">Configurar mi plan</button></div>` : ''}
      ${due ? `<button class="card p" style="display:flex;width:calc(100% - 32px);text-align:left;gap:12px;align-items:center;border-color:var(--acc)" data-a="checkin"><span style="font-size:22px">📋</span><span style="flex:1"><b>Check-in semanal listo</b><br><span class="mut" style="font-size:13px">Revisa tu gasto y ajusta tus metas</span></span><span class="link">Ver</span></button>` : ''}
      <div class="card p" style="display:flex;gap:16px;align-items:center">
        ${ring(tot.k, tg.kcal, left >= 0 ? kc(left) : '+' + kc(-left), left >= 0 ? 'RESTANTES' : 'EXCEDIDAS')}
        <div style="flex:1;min-width:0">
          <div class="num" style="font-size:13px"><b style="font-size:17px">${kc(tot.k)}</b> <span class="mut">/ ${kc(tg.kcal)} kcal</span></div>
          ${macroBar('Proteína', tot.p, tg.p, MCOL.p)}${macroBar('Carbohidratos', tot.c, tg.c, MCOL.c)}${macroBar('Grasa', tot.f, tg.f, MCOL.f)}
        </div>
      </div>
      ${meals}
      <div class="pad" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px">
        <button class="btn sm" style="width:100%" data-a="copyDay">${ic('copy')}Copiar de ayer</button>
        <button class="btn sm" style="width:100%" data-a="addBody">Registrar peso</button>
      </div>
      <button class="card p" style="display:block;width:calc(100% - 32px);text-align:left" data-a="go" data-v="nprog">
        <div class="stats"><div><div class="lbl">Gasto</div><div class="v num">${kc(Ev)}</div></div>
        <div><div class="lbl">Tendencia</div><div class="v num">${tr != null ? wt(tr) + ' ' + u() : '—'}</div></div>
        <div><div class="lbl">Meta</div><div class="v num">${kc(tg.kcal)}</div></div></div>
        <div class="mut" style="font-size:12px;margin-top:8px">Gasto estimado con tu registro y tu peso. Toca para ver el progreso.</div>
      </button>
      <div style="height:24px"></div>`
  };
};

function foodRow(x, extra = ''){
  const s = per(x, x.sg || 100);
  return `<button class="exi" data-a="pickFood" data-k="${esc(x.ref)}">
    <div style="flex:1;min-width:0"><div class="tt" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(x.name)}${x.brand ? ` <span class="mut" style="font-weight:400">· ${esc(x.brand)}</span>` : ''}</div>
    <div class="dd num">${kc(s.k)} kcal · ${esc(x.sl || (x.sg || 100) + ' g')}${extra}</div></div>
    ${S.nut.fav.includes(x.ref) ? `<span style="color:var(--warm)">${ic('star')}</span>` : ''}</button>`;
}
function faddList(t){
  const q = norm(t.q || ''), n = S.nut;
  if (!FMAP) foodIndex();
  if (t.tab === 'meals'){
    if (!n.meals.length) return '<div class="empty"><b>Sin comidas guardadas</b>En el menú ⋯ de una comida del día elige «Guardar como comida frecuente».</div>';
    return n.meals.filter(m => !q || norm(m.name).includes(q)).map((m,i) => { const tt = totals(m.items);
      return `<button class="exi" data-a="addMeal" data-k="${i}"><div style="flex:1;min-width:0"><div class="tt">${esc(m.name)}</div><div class="dd num">${m.items.length} alimentos · ${kc(tt.k)} kcal · P ${gr(tt.p)} g</div></div></button>`; }).join('');
  }
  let list;
  if (q){
    const words = q.split(/\s+/).filter(Boolean);
    list = Object.values(FMAP).filter(x => { const nn = norm(x.name + ' ' + (x.brand || '')); return words.every(w => nn.includes(w)); });
    list.sort((a,b) => (norm(a.name).startsWith(words[0]) ? 0 : 1) - (norm(b.name).startsWith(words[0]) ? 0 : 1) || (n.recent.indexOf(b.ref) - n.recent.indexOf(a.ref)));
  } else if (t.tab === 'fav') list = n.fav.map(FOOD).filter(Boolean);
  else if (t.tab === 'mine') list = n.foods.map(x => FOOD('my:'+x.id)).filter(Boolean);
  else {
    const rec = n.recent.map(FOOD).filter(Boolean);
    if (t.tab === 'recent') list = rec;
    else return (rec.length ? `<div class="sec" style="padding-top:8px"><span class="lbl">Recientes</span></div>${rec.slice(0,8).map(x => foodRow(x)).join('')}` : '')
      + Object.entries(FOOD_CAT).map(([c,l]) => { const xs = Object.values(FMAP).filter(x => x.cat === c); return xs.length ? `<div class="sec"><span class="lbl">${l}</span></div>${xs.map(x => foodRow(x)).join('')}` : ''; }).join('');
  }
  if (!list.length) return q ? `<div class="empty"><b>Sin resultados para «${esc(t.q)}»</b>Escanea el código de barras o crea el alimento.</div><div class="pad"><button class="btn" data-a="go" data-v="fnew">${ic('plus')}Crear «${esc(t.q)}»</button></div>`
    : `<div class="empty"><b>Nada por aquí todavía</b>${t.tab === 'fav' ? 'Marca alimentos con ★ al agregarlos.' : t.tab === 'mine' ? 'Crea un alimento o escanea un código de barras.' : 'Lo que registres aparecerá aquí.'}</div>`;
  return list.slice(0, 80).map(x => foodRow(x)).join('');
}
VIEWS.fadd = t => {
  t.m = t.m ?? (t.id != null ? +t.id : 0); t.tab = t.tab || 'all';
  const back = NAV.find(x => x.v === 'food');
  t.d = t.d || (back && back.d) || today();
  return {
    title:`Agregar a ${MEALS[t.m]}`,
    body:`
      <div class="search">${ic('search')}<input id="fq" placeholder="Buscar alimento" value="${esc(t.q || '')}" autocomplete="off"></div>
      <div class="pad" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px">
        <button class="btn sm" style="width:100%" data-a="scan">${ic('scan')}Escanear</button>
        <button class="btn sm" style="width:100%" data-a="quick">${ic('bolt')}Rápido</button>
        <button class="btn sm" style="width:100%" data-a="go" data-v="fnew">${ic('plus')}Crear</button>
      </div>
      <div class="chips">${[['all','Todos'],['recent','Recientes'],['fav','Favoritos'],['mine','Mis alimentos'],['meals','Comidas guardadas']].map(([k,l]) => `<button class="chip" data-a="faddTab" data-k="${k}" aria-pressed="${t.tab===k}">${l}</button>`).join('')}</div>
      <div id="flist">${faddList(t)}</div><div style="height:30px"></div>`,
    after(){ if (!t.q && t.tab === 'all') {} }
  };
};

VIEWS.fnew = t => {
  const d = t.draft = t.draft || {name: NAV.find(x => x.v === 'fadd')?.q || '', brand:'', sg:100, sl:'', k:'', p:'', c:'', f:'', bc: t.bc || ''};
  const f = (id, lbl, v, ph = '', mode = 'decimal') => `<label style="display:grid;gap:4px"><span class="lbl">${lbl}</span><input class="field" id="${id}" inputmode="${mode}" value="${esc(v)}" placeholder="${ph}"></label>`;
  return {
    title:'Crear alimento',
    right:`<button class="bb acc" data-a="saveFood">Guardar</button>`,
    body:`<div class="pad" style="display:grid;gap:12px;padding-top:14px">
      ${f('nf_name','Nombre',d.name,'Ej. Yogur natural','text')}
      ${f('nf_brand','Marca (opcional)',d.brand,'','text')}
      <div class="row2">${f('nf_sg','Porción en gramos',d.sg)}${f('nf_sl','Nombre de la porción',d.sl,'1 vaso','text')}</div>
      <div class="lbl" style="margin-top:4px">Por porción</div>
      <div class="row2">${f('nf_k','Calorías',d.k,'kcal')}${f('nf_p','Proteína (g)',d.p)}</div>
      <div class="row2">${f('nf_c','Carbohidratos (g)',d.c)}${f('nf_f','Grasa (g)',d.f)}</div>
      ${f('nf_bc','Código de barras (opcional)',d.bc,'','numeric')}
      <div class="mut" style="font-size:12px">Copia los valores de la etiqueta. Se guardan en este teléfono y aparecen en «Mis alimentos».</div>
    </div>`
  };
};

VIEWS.nsetup = t => {
  const n = S.nut, kg = lastKg();
  const d = t.d = t.d || {sex:n.sex, age:n.age, cm:n.cm, kg: kg ? r1(toU(kg)) : '', act:n.act, goal:n.goal, rate:n.rate, prot:n.prot};
  const seg = (k, opts) => `<div class="seg">${opts.map(([v,l]) => `<button data-a="nsSet" data-f="${k}" data-k="${v}" aria-pressed="${String(d[k])===String(v)}">${l}</button>`).join('')}</div>`;
  const rates = d.goal === 'gain' ? [[0.25,'+0.25 %'],[0.5,'+0.5 %']] : [[-0.25,'−0.25 %'],[-0.5,'−0.5 %'],[-0.75,'−0.75 %'],[-1,'−1 %']];
  const kgv = parseFloat(String(d.kg).replace(',','.'));
  const wkKg = kgv > 0 && d.goal !== 'maintain' ? fromU(kgv) * d.rate / 100 : 0;
  return {
    title:'Plan de comida',
    body:`<div class="pad" style="display:grid;gap:14px;padding-top:14px">
      <div><div class="lbl" style="margin-bottom:6px">Sexo</div>${seg('sex', [['m','Hombre'],['f','Mujer']])}</div>
      <div class="row2">
        <label style="display:grid;gap:4px"><span class="lbl">Edad</span><input class="field" id="ns_age" inputmode="numeric" value="${d.age}"></label>
        <label style="display:grid;gap:4px"><span class="lbl">Estatura (cm)</span><input class="field" id="ns_cm" inputmode="numeric" value="${d.cm}"></label>
      </div>
      <label style="display:grid;gap:4px"><span class="lbl">Peso actual (${u()})</span><input class="field" id="ns_kg" inputmode="decimal" value="${d.kg}"></label>
      <div><div class="lbl" style="margin-bottom:6px">Actividad</div>
        <div class="card" style="margin:0;padding:0 12px">${ACT.map(([v,l,dd]) => `<button class="opt" data-a="nsSet" data-f="act" data-k="${v}" aria-checked="${d.act===v}"><span style="flex:1">${l}<br><span class="mut" style="font-size:12.5px;font-weight:400">${dd}</span></span>${d.act===v ? ic('check') : ''}</button>`).join('')}</div></div>
      <div><div class="lbl" style="margin-bottom:6px">Objetivo</div>${seg('goal', [['lose','Perder grasa'],['maintain','Mantener'],['gain','Ganar músculo']])}</div>
      ${d.goal !== 'maintain' ? `<div><div class="lbl" style="margin-bottom:6px">Ritmo (% del peso por semana)</div>${seg('rate', rates)}
        <div class="mut" style="font-size:12.5px;margin-top:6px">${wkKg ? `≈ ${wt(Math.abs(wkKg))} ${u()} por semana. ` : ''}${d.goal === 'lose' ? 'Más lento conserva más músculo.' : 'Más lento gana menos grasa.'}</div></div>` : ''}
      <div><div class="lbl" style="margin-bottom:6px">Proteína</div>${seg('prot', PROT.map(([v,l]) => [v, `${l} · ${v} g/kg`]))}</div>
      <button class="btn acc" data-a="nsSave">Calcular y guardar</button>
      ${n.setup ? `<button class="btn" data-a="editTgt">Escribir metas a mano</button>` : ''}
      <div class="mut" style="font-size:12px;line-height:1.5">El gasto inicial sale de la fórmula Mifflin-St Jeor por tu actividad. Después de una semana de registro, el gasto se recalcula con lo que comes y cómo cambia tu peso de tendencia, y el check-in semanal ajusta tus metas.</div>
      <div style="height:20px"></div>
    </div>`
  };
};

VIEWS.nprog = t => {
  t.r = t.r || 56;
  const to = today(), from = addDays(to, -t.r + 1);
  const tr = NUT.trend(S.body, from, to);
  const E = expNow().filter(p => p.k >= from);
  const tgt = S.nut.tgt;
  const curT = tr.length ? tr[tr.length-1].tr : null;
  const wkAgo = tr.find(p => p.k === addDays(to, -7));
  const wkCh = curT != null && wkAgo && wkAgo.tr != null ? curT - wkAgo.tr : null;
  const bars = []; let sum = 0, cnt = 0;
  for (let i = 13; i >= 0; i--){ const k = addDays(to, -i), v = totals(dayLog(k)).k; bars.push({label:DFS.format(kd(k)), v}); if (v){ sum += v; cnt++; } }
  const Ev = E.length ? E[E.length-1].v : expNow().slice(-1)[0].v;
  const E7 = E.find(p => p.k === addDays(to, -7));
  return {
    title:'Progreso de nutrición',
    body:`
      <div class="pad" style="padding-top:12px"><div class="seg">${[[28,'4 sem'],[56,'8 sem'],[91,'3 meses'],[182,'6 meses']].map(([k,l]) => `<button data-a="nprR" data-k="${k}" aria-pressed="${t.r===k}">${l}</button>`).join('')}</div></div>
      <div class="card p">
        <div style="display:flex;justify-content:space-between;align-items:baseline"><span class="lbl">Peso de tendencia</span><button class="link" data-a="addBody">+ Registrar</button></div>
        <div style="display:flex;align-items:baseline;gap:10px;margin:4px 0 8px"><span class="big">${curT != null ? wt(curT) + ' ' + u() : '—'}</span>
          ${wkCh != null ? `<span class="num" style="font-size:13px;color:${wkCh < 0 ? 'var(--ok)' : 'var(--warm)'}">${wkCh > 0 ? '+' : wkCh < 0 ? '−' : ''}${wt(Math.abs(wkCh))} ${u()}/sem</span>` : ''}</div>
        ${chart2(tr.map(p => ({t:p.t, a:p.w != null ? toU(p.w) : null, b:p.tr != null ? toU(p.tr) : null})))}
        <div class="mut" style="font-size:11.5px;margin-top:6px">Puntos: lo que marcó la báscula. Línea: tendencia, que filtra agua y comida del día.</div>
      </div>
      <div class="card p">
        <div class="lbl">Gasto estimado (TDEE)</div>
        <div style="display:flex;align-items:baseline;gap:10px;margin:4px 0 8px"><span class="big">${kc(Ev)} kcal</span>
          ${E7 ? `<span class="num mut" style="font-size:13px">${Ev - E7.v >= 0 ? '+' : '−'}${kc(Math.abs(Ev - E7.v))} en 7 días</span>` : ''}</div>
        ${chart2(E.map(p => ({t:p.t, a:null, b:p.v})), {min:200, dec:0})}
      </div>
      <div class="card p">
        <div style="display:flex;justify-content:space-between;align-items:baseline"><span class="lbl">Calorías · 14 días</span><span class="num" style="font-size:13px">${cnt ? kc(sum/cnt) : '—'} <span class="mut">promedio</span></span></div>
        ${barChart(bars)}
        <div class="mut" style="font-size:11.5px;margin-top:6px">Meta actual: ${kc(tgt.kcal)} kcal · P ${tgt.p} g · C ${tgt.c} g · G ${tgt.f} g</div>
      </div>
      <div class="pad" style="margin-top:14px"><button class="btn" data-a="checkin">Hacer check-in ahora</button></div>
      <div style="height:24px"></div>`
  };
};

/* ---------- acciones ---------- */
function rerenderList(){ const t = cur(); const el = $('#flist'); if (el && t.v === 'fadd') el.innerHTML = faddList(t); }
function pushRecent(ref){ const r = S.nut.recent; const i = r.indexOf(ref); if (i >= 0) r.splice(i, 1); r.unshift(ref); r.length = Math.min(r.length, 40); }
function addEntry(d, e){ (S.nut.log[d] = S.nut.log[d] || []).push(e); save(); }
function numIn(id){ const v = parseFloat(($('#'+id)?.value || '').replace(',', '.')); return isNaN(v) ? null : v; }

let AMT = null;   // alimento abierto en la hoja de cantidad
function amountSheet(x, opt = {}){
  AMT = {x, mode: opt.mode || (x.sg && x.sg !== 100 ? 's' : 'g'), qty: opt.qty ?? (x.sg && x.sg !== 100 ? 1 : 100), m: opt.m, idx: opt.idx};
  drawAmount();
}
function amtGrams(){ return AMT.mode === 's' ? AMT.qty * (AMT.x.sg || 100) : AMT.qty; }
function drawAmount(){
  const {x} = AMT, v = per(x, amtGrams() || 0), fav = S.nut.fav.includes(x.ref), edit = AMT.idx != null;
  sheet('', `
    <div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:12px"><div style="flex:1;min-width:0"><div class="h2">${esc(x.name)}</div>
      <div class="mut" style="font-size:12.5px">${x.brand ? esc(x.brand) + ' · ' : ''}${kc(x.kcal)} kcal por 100 g</div></div>
      ${x.ref && !x.ref.startsWith('q') ? `<button class="ib" data-a="favToggle" aria-label="Favorito" style="color:${fav ? 'var(--warm)' : 'var(--mut-2)'}">${ic('star')}</button>` : ''}</div>
    <div style="display:flex;gap:8px;align-items:center">
      <input class="field" id="fg" inputmode="decimal" value="${AMT.qty}" style="font-size:20px;font-weight:650;text-align:center;flex:1">
      <div class="seg" style="flex:1.3">${x.sg && x.sg !== 100 ? `<button data-a="amtMode" data-k="s" aria-pressed="${AMT.mode==='s'}">${esc(x.sl || 'porción')}</button>` : ''}<button data-a="amtMode" data-k="g" aria-pressed="${AMT.mode==='g'}">gramos</button></div>
    </div>
    <div class="stats" id="fprev" style="grid-template-columns:repeat(4,1fr);margin:14px 0">${prevHtml(v)}</div>
    <div class="chips" style="padding:0 0 12px">${MEALS.map((m,i) => `<button class="chip" data-a="amtMeal" data-k="${i}" aria-pressed="${AMT.m===i}">${m}</button>`).join('')}</div>
    <div style="display:grid;gap:8px"><button class="btn acc" data-a="amtOk">${edit ? 'Guardar cambios' : 'Agregar'}</button>
    ${edit ? `<button class="btn red" data-a="entryDel">Quitar del registro</button>` : ''}</div>`);
  setTimeout(() => { const i = $('#fg'); if (i){ i.focus(); i.select(); } }, 60);
}
const prevHtml = v => `<div><div class="lbl">kcal</div><div class="v num">${kc(v.k)}</div></div><div><div class="lbl" style="color:${MCOL.p}">Prot</div><div class="v num">${gr(v.p)}</div></div><div><div class="lbl" style="color:${MCOL.c}">Carb</div><div class="v num">${gr(v.c)}</div></div><div><div class="lbl" style="color:${MCOL.f}">Grasa</div><div class="v num">${gr(v.f)}</div></div>`;

document.addEventListener('input', ev => {
  const id = ev.target.id;
  if (id === 'fq'){ cur().q = ev.target.value; rerenderList(); }
  else if (id === 'fg' && AMT){ const v = parseFloat(ev.target.value.replace(',', '.')); AMT.qty = isNaN(v) ? 0 : v; $('#fprev').innerHTML = prevHtml(per(AMT.x, amtGrams())); }
  else if (id && id.startsWith('nf_')){ const t = cur(); if (t.draft) t.draft[{nf_name:'name',nf_brand:'brand',nf_sg:'sg',nf_sl:'sl',nf_k:'k',nf_p:'p',nf_c:'c',nf_f:'f',nf_bc:'bc'}[id]] = ev.target.value; }
  else if (id && id.startsWith('ns_')){ const t = cur(); if (t.d) t.d[id.slice(3)] = ev.target.value; }
});

Object.assign(A, {
  fday(el){
    const t = cur(), k = +el.dataset.k;
    t.d = k ? addDays(t.d, k) : today(); render();
  },
  faddTab(el){ const t = cur(); t.tab = el.dataset.k; render(); },
  pickFood(el){
    const t = cur(), x = FOOD(el.dataset.k);
    if (!x) return;
    amountSheet(x, {m: t.m ?? 0});
  },
  amtMode(el){
    const g = amtGrams(); AMT.mode = el.dataset.k;
    AMT.qty = AMT.mode === 's' ? r2(g / (AMT.x.sg || 100)) : Math.round(g);
    drawAmount();
  },
  amtMeal(el){ AMT.m = +el.dataset.k; document.querySelectorAll('[data-a=amtMeal]').forEach(b => b.setAttribute('aria-pressed', b === el)); },
  favToggle(){
    const f = S.nut.fav, i = f.indexOf(AMT.x.ref);
    i >= 0 ? f.splice(i, 1) : f.unshift(AMT.x.ref); save(); drawAmount();
  },
  amtOk(){
    const g = amtGrams();
    if (!(g > 0)) return $('#fg').focus();
    const x = AMT.x, v = per(x, g);
    const e = {id:uid(), f:x.ref, n:x.name, g:r1(g), k:r1(v.k), p:r1(v.p), c:r1(v.c), fa:r1(v.f), m:AMT.m ?? 0};
    const t = cur();
    if (AMT.idx != null){
      const d = t.d, list = dayLog(d); Object.assign(list[AMT.idx], {g:e.g, k:e.k, p:e.p, c:e.c, fa:e.fa, m:e.m});
      save(); close(); AMT = null; return render();
    }
    const d = t.v === 'fadd' ? t.d : (t.d || today());
    addEntry(d, e); pushRecent(x.ref); save();
    close(); AMT = null;
    toast(`${esc(x.name)} · ${kc(v.k)} kcal`);
    if (t.v === 'fadd') back();
    else render();
  },
  entry(el){
    const t = cur(), e = dayLog(t.d)[+el.dataset.k];
    const x = FOOD(e.f) || {ref:'q', name:e.n, kcal: e.g ? e.k/e.g*100 : e.k, p: e.g ? e.p/e.g*100 : e.p, c: e.g ? e.c/e.g*100 : e.c, f: e.g ? e.fa/e.g*100 : e.fa, sg: e.g ? 0 : 100};
    if (!e.g){ // registro rápido: se edita como porción única
      return quickSheet(e, +el.dataset.k);
    }
    amountSheet(x, {mode:'g', qty:e.g, m:e.m, idx:+el.dataset.k});
  },
  entryDel(){
    const t = cur(), list = dayLog(t.d); list.splice(AMT.idx, 1);
    if (!list.length) delete S.nut.log[t.d];
    save(); close(); AMT = null; render();
  },
  quick(){ quickSheet(null, null); },
  quickOk(el){
    const k = numIn('qk'), p = numIn('qp') || 0, c = numIn('qc') || 0, f = numIn('qf') || 0;
    const kcal = k ?? (p*4 + c*4 + f*9);
    if (!(kcal > 0)) return $('#qk').focus();
    const t = cur(), name = ($('#qn').value || '').trim() || 'Registro rápido', idx = el.dataset.k;
    const d = t.v === 'fadd' ? t.d : t.d || today();
    if (idx !== ''){ Object.assign(dayLog(d)[+idx], {n:name, k:kcal, p, c, fa:f}); save(); close(); return render(); }
    addEntry(d, {id:uid(), f:'q', n:name, g:0, k:kcal, p, c, fa:f, m:t.m ?? 0});
    close(); toast(`${esc(name)} · ${kc(kcal)} kcal`);
    t.v === 'fadd' ? back() : render();
  },
  quickDel(el){ const t = cur(), list = dayLog(t.d); list.splice(+el.dataset.k, 1); if (!list.length) delete S.nut.log[t.d]; save(); close(); render(); },
  saveFood(){
    const t = cur(), d = t.draft;
    const name = (d.name || '').trim(), sg = parseFloat(String(d.sg).replace(',', '.')) || 100;
    const num = v => parseFloat(String(v).replace(',', '.')) || 0;
    if (!name) return $('#nf_name').focus();
    const k = num(d.k), p = num(d.p), c = num(d.c), f = num(d.f);
    if (!(k > 0) && !(p + c + f > 0)) return $('#nf_k').focus();
    const kcal = k || p*4 + c*4 + f*9, sc = 100 / sg;
    const x = {id:uid(), name, brand:(d.brand || '').trim(), kcal:r1(kcal*sc), p:r1(p*sc), c:r1(c*sc), f:r1(f*sc), sg, sl:(d.sl || '').trim() || sg + ' g', bc:(d.bc || '').trim()};
    S.nut.foods.unshift(x); foodIndex(); save();
    back();
    setTimeout(() => { const tt = cur(); if (tt.v === 'fadd') amountSheet(FOOD('my:'+x.id), {m:tt.m}); }, 120);
  },
  mealMenu(el){
    const mi = +el.dataset.k;
    sheet(MEALS[mi], `
      <button class="opt" data-a="saveMeal" data-k="${mi}">${ic('star')}<span style="flex:1">Guardar como comida frecuente</span></button>
      <button class="opt" data-a="copyMealToday" data-k="${mi}">${ic('copy')}<span style="flex:1">Copiar a hoy</span></button>
      <button class="opt red" data-a="clearMeal" data-k="${mi}">${ic('x')}<span style="flex:1">Borrar esta comida</span></button>`);
  },
  saveMeal(el){
    const mi = +el.dataset.k, t = cur();
    sheet('Guardar comida', `<div style="display:grid;gap:10px"><input class="field" id="mname" placeholder="Nombre" value="${MEALS[mi]} de siempre"><button class="btn acc" data-a="saveMealOk" data-k="${mi}">Guardar</button></div>`);
    setTimeout(() => $('#mname').select(), 50);
  },
  saveMealOk(el){
    const mi = +el.dataset.k, t = cur(), name = $('#mname').value.trim() || MEALS[mi];
    S.nut.meals.unshift({id:uid(), name, items:dayLog(t.d).filter(e => e.m === mi).map(e => ({...e, id:undefined}))});
    save(); close(); toast('Comida guardada');
  },
  addMeal(el){
    const t = cur(), m = S.nut.meals[+el.dataset.k];
    for (const e of m.items) addEntry(t.d, {...e, id:uid(), m:t.m});
    for (const e of m.items) if (e.f && e.f !== 'q') pushRecent(e.f);
    save(); toast(`${esc(m.name)} agregada`); back();
  },
  copyMealToday(el){
    const mi = +el.dataset.k, t = cur(), td = today();
    for (const e of dayLog(t.d).filter(e => e.m === mi)) addEntry(td, {...e, id:uid()});
    close(); toast('Copiada a hoy'); render();
  },
  clearMeal(el){
    const mi = +el.dataset.k, t = cur();
    confirmBox('¿Borrar ' + MEALS[mi].toLowerCase() + '?', 'Se quitan sus alimentos de este día.', 'Borrar', () => {
      S.nut.log[t.d] = dayLog(t.d).filter(e => e.m !== mi); if (!S.nut.log[t.d].length) delete S.nut.log[t.d]; save(); render();
    });
  },
  copyDay(){
    const t = cur(), prev = dayLog(addDays(t.d, -1));
    if (!prev.length) return toast('El día anterior está vacío');
    const go = () => { for (const e of prev) addEntry(t.d, {...e, id:uid()}); render(); toast(`${prev.length} alimentos copiados`); };
    dayLog(t.d).length ? confirmBox('¿Copiar el día anterior?', 'Se agregan sus alimentos a los que ya tienes hoy.', 'Copiar', go) : go();
  },
  nsSet(el){ const t = cur(), f = el.dataset.f, v = el.dataset.k; t.d[f] = isNaN(+v) ? v : +v; if (f === 'goal') t.d.rate = v === 'gain' ? 0.25 : -0.5; render(); },
  nsSave(){
    const t = cur(), d = t.d, n = S.nut;
    const age = +d.age, cm = +d.cm, kg = parseFloat(String(d.kg).replace(',', '.'));
    if (!(age > 12 && age < 100)) return $('#ns_age').focus();
    if (!(cm > 100 && cm < 230)) return $('#ns_cm').focus();
    if (!(kg > 25)) return $('#ns_kg').focus();
    Object.assign(n, {sex:d.sex, age, cm, act:+d.act, goal:d.goal, rate:d.goal === 'maintain' ? 0 : +d.rate, prot:+d.prot});
    const kgK = fromU(kg), td = new Date().setHours(0,0,0,0);
    if (!lastKg() || Math.abs(lastKg() - kgK) > 0.05){ S.body = S.body.filter(b => new Date(b.t).setHours(0,0,0,0) !== td); S.body.push({t:Date.now(), kg:kgK}); }
    const E = expNow().slice(-1)[0].v;
    n.tgt = NUT.targets(n, E, kgK); n.setup = true; n.checkin = Date.now(); save();
    back(); toast(`Meta: ${kc(n.tgt.kcal)} kcal · P ${n.tgt.p} g`);
  },
  editTgt(){
    const g = S.nut.tgt;
    sheet('Metas diarias', `<div style="display:grid;gap:10px">
      <div class="row2"><label style="display:grid;gap:4px"><span class="lbl">Calorías</span><input class="field" id="tk" inputmode="numeric" value="${g.kcal}"></label>
      <label style="display:grid;gap:4px"><span class="lbl">Proteína g</span><input class="field" id="tp" inputmode="numeric" value="${g.p}"></label></div>
      <div class="row2"><label style="display:grid;gap:4px"><span class="lbl">Carbohidratos g</span><input class="field" id="tc" inputmode="numeric" value="${g.c}"></label>
      <label style="display:grid;gap:4px"><span class="lbl">Grasa g</span><input class="field" id="tf" inputmode="numeric" value="${g.f}"></label></div>
      <div class="mut" style="font-size:12px">Si escribes los gramos, las calorías se recalculan: proteína y carbohidratos 4 kcal/g, grasa 9.</div>
      <button class="btn acc" data-a="editTgtOk">Guardar</button></div>`);
  },
  editTgtOk(){
    const p = numIn('tp'), c = numIn('tc'), f = numIn('tf');
    let k = numIn('tk');
    const fromMacros = Math.round(p*4 + c*4 + f*9);
    if (p != null && c != null && f != null && Math.abs(fromMacros - k) > 25) k = fromMacros;
    if (!(k > 500)) return $('#tk').focus();
    S.nut.tgt = {kcal:Math.round(k), p:Math.round(p || 0), c:Math.round(c || 0), f:Math.round(f || 0)}; S.nut.setup = true; save(); close(); render();
  },
  checkin(){
    const n = S.nut, E = expNow(), Ev = E[E.length-1].v, tr = curTrend() || lastKg();
    if (!tr) return toast('Registra tu peso primero');
    const nt = NUT.targets(n, Ev, tr), old = n.tgt;
    const tr7 = NUT.trend(S.body, addDays(today(), -7), today());
    const ch = tr7.length > 1 && tr7[0].tr != null ? tr7[tr7.length-1].tr - tr7[0].tr : null;
    const days = []; for (let i = 6; i >= 0; i--) days.push(addDays(today(), -i));
    const logged = days.filter(loggedDay), avg = logged.length ? logged.reduce((s,d) => s + totals(dayLog(d)).k, 0) / logged.length : 0;
    const dlt = (a, b) => { const d = a - b; return d ? `<span class="num" style="color:${d > 0 ? 'var(--ok)' : 'var(--warm)'};font-size:12px"> ${d > 0 ? '+' : '−'}${Math.abs(d)}</span>` : ''; };
    sheet('Check-in semanal', `
      <div class="recs" style="margin-bottom:12px">
        <div><div class="lbl">Gasto estimado</div><div class="v num" style="font-weight:650;margin-top:2px">${kc(Ev)} kcal</div></div>
        <div><div class="lbl">Cambio de tendencia</div><div class="v num" style="font-weight:650;margin-top:2px">${ch != null ? (ch > 0 ? '+' : ch < 0 ? '−' : '') + wt(Math.abs(ch)) + ' ' + u() : '—'}</div></div>
        <div><div class="lbl">Promedio comido</div><div class="v num" style="font-weight:650;margin-top:2px">${avg ? kc(avg) + ' kcal' : '—'}</div></div>
        <div><div class="lbl">Días registrados</div><div class="v num" style="font-weight:650;margin-top:2px">${logged.length} de 7</div></div>
      </div>
      <div class="lbl" style="margin-bottom:4px">Metas nuevas</div>
      <div class="kv"><span>Calorías</span><span class="num">${kc(nt.kcal)}${dlt(nt.kcal, old.kcal)}</span></div>
      <div class="kv"><span>Proteína</span><span class="num">${nt.p} g${dlt(nt.p, old.p)}</span></div>
      <div class="kv"><span>Carbohidratos</span><span class="num">${nt.c} g${dlt(nt.c, old.c)}</span></div>
      <div class="kv"><span>Grasa</span><span class="num">${nt.f} g${dlt(nt.f, old.f)}</span></div>
      ${logged.length < 5 ? `<div class="mut" style="font-size:12.5px;margin-top:8px">Registraste ${logged.length} de 7 días: entre más días completes, más preciso es el gasto.</div>` : ''}
      <div style="display:grid;gap:8px;margin-top:14px"><button class="btn acc" data-a="checkinOk">Aplicar metas nuevas</button><button class="btn" data-a="checkinKeep">Mantener las actuales</button></div>`);
    CHK = nt;
  },
  checkinOk(){ S.nut.tgt = CHK; S.nut.checkin = Date.now(); save(); close(); render(); toast('Metas actualizadas'); },
  checkinKeep(){ S.nut.checkin = Date.now(); save(); close(); render(); },
  nprR(el){ cur().r = +el.dataset.k; render(); },
  scan(){ scanSheet(); },
  scanCode(){ const c = ($('#bcin').value || '').replace(/\D/g, ''); if (c.length < 6) return $('#bcin').focus(); lookupBarcode(c); },
});
let CHK = null;

function quickSheet(e, idx){
  sheet(e ? 'Editar registro rápido' : 'Registro rápido', `<div style="display:grid;gap:10px">
    <input class="field" id="qn" placeholder="Descripción (opcional)" value="${e ? esc(e.n) : ''}">
    <div class="row2"><input class="field" id="qk" inputmode="decimal" placeholder="Calorías" value="${e ? r1(e.k) : ''}"><input class="field" id="qp" inputmode="decimal" placeholder="Proteína g" value="${e ? r1(e.p) : ''}"></div>
    <div class="row2"><input class="field" id="qc" inputmode="decimal" placeholder="Carbohidratos g" value="${e ? r1(e.c) : ''}"><input class="field" id="qf" inputmode="decimal" placeholder="Grasa g" value="${e ? r1(e.fa) : ''}"></div>
    <div class="mut" style="font-size:12px">Si dejas las calorías vacías se calculan con los macros.</div>
    <button class="btn acc" data-a="quickOk" data-k="${idx ?? ''}">${e ? 'Guardar' : 'Agregar'}</button>
    ${e ? `<button class="btn red" data-a="quickDel" data-k="${idx}">Quitar del registro</button>` : ''}</div>`);
  setTimeout(() => $(e ? '#qk' : '#qn').focus(), 60);
}

/* ---------- código de barras ---------- */
let SCAN = null;
function stopScan(){ if (SCAN){ SCAN.stop = true; try { SCAN.stream && SCAN.stream.getTracks().forEach(t => t.stop()); } catch(e){} SCAN = null; } }
async function scanSheet(){
  stopScan();
  const can = 'BarcodeDetector' in window && navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
  sheet('Escanear código de barras', `
    ${can ? `<div style="position:relative;border-radius:12px;overflow:hidden;background:#000;aspect-ratio:4/3;margin-bottom:12px"><video id="bcv" playsinline muted style="width:100%;height:100%;object-fit:cover"></video>
      <div style="position:absolute;left:12%;right:12%;top:42%;height:16%;border:2px solid var(--acc);border-radius:8px"></div></div>` : `<div class="mut" style="font-size:13px;margin-bottom:10px">Este navegador no puede leer códigos con la cámara. Escribe los números que vienen debajo de las barras.</div>`}
    <div style="display:flex;gap:8px"><input class="field" id="bcin" inputmode="numeric" placeholder="Número del código"><button class="btn acc sm" data-a="scanCode">Buscar</button></div>
    <div class="mut" style="font-size:11.5px;margin-top:8px">Se busca primero en tus alimentos y luego en Open Food Facts (requiere internet). Lo encontrado se guarda en «Mis alimentos».</div>`);
  if (!can) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}, audio:false});
    const v = $('#bcv'); if (!v){ stream.getTracks().forEach(t => t.stop()); return; }
    SCAN = {stream, stop:false};
    v.srcObject = stream; await v.play();
    const det = new BarcodeDetector({formats:['ean_13','ean_8','upc_a','upc_e','code_128']});
    const loop = async () => {
      if (!SCAN || SCAN.stop || !$('#bcv')) return stopScan();
      try { const r = await det.detect(v); if (r.length){ const c = r[0].rawValue; stopScan(); try { navigator.vibrate && navigator.vibrate(60); } catch(e){} return lookupBarcode(c); } } catch(e){}
      setTimeout(loop, 180);
    };
    loop();
  } catch(e){ toast('No se pudo abrir la cámara'); }
}
async function lookupBarcode(code){
  const mine = S.nut.foods.find(x => x.bc === code);
  const t = cur(), m = t.m ?? 0;
  if (mine){ close(); return amountSheet(FOOD('my:'+mine.id), {m}); }
  sheet('', `<div class="empty" style="padding:24px"><b>Buscando ${esc(code)}…</b>Open Food Facts</div>`);
  try {
    const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,product_name_es,brands,nutriments,serving_quantity,serving_size`);
    const j = await r.json();
    const p = j && j.product, nu = p && p.nutriments;
    if (!p || !nu || (nu['energy-kcal_100g'] == null && nu['energy_100g'] == null)) throw 0;
    const kcal = nu['energy-kcal_100g'] ?? nu['energy_100g'] / 4.184;
    const sg = parseFloat(p.serving_quantity) || 100;
    const x = {id:uid(), name:(p.product_name_es || p.product_name || 'Producto ' + code).trim(), brand:(p.brands || '').split(',')[0].trim(),
      kcal:r1(kcal), p:r1(nu.proteins_100g || 0), c:r1(nu.carbohydrates_100g || 0), f:r1(nu.fat_100g || 0), sg, sl:p.serving_size || sg + ' g', bc:code};
    S.nut.foods.unshift(x); foodIndex(); save();
    amountSheet(FOOD('my:'+x.id), {m});
  } catch(e){
    close();
    confirmBox('No encontrado', `No hay datos para el código ${esc(code)} (o no hay internet). Puedes crearlo con los datos de la etiqueta.`, 'Crear alimento', () => go('fnew', {bc:code}));
  }
}
// al cerrar cualquier hoja se apaga la cámara del escáner
document.addEventListener('click', ev => { if (SCAN && ev.target.closest('[data-a=close]')) stopScan(); }, true);

/* ---------- datos de ejemplo: 8 semanas de registro y pesajes diarios ---------- */
SEEDS.push(() => {
  const R = rng(11), n = S.nut;
  Object.assign(n, {setup:true, sex:'m', age:31, cm:178, act:1.55, goal:'lose', rate:-0.5, prot:2});
  const plan = [
    [0, [['avena',60],['whey',30],['platano',120],['leche',200]]],
    [1, [['pechuga',180],['arroz',200],['aguacate',60],['ensalada',150],['tortmaiz',60]]],
    [2, [['res90',150],['frijol',130],['tortmaiz',90],['salsa',40]]],
    [3, [['yogurgr',170],['almendra',25],['manzana',180]]],
  ];
  const base = plan.reduce((s,[,xs]) => s + xs.reduce((a,[id,g]) => a + per(FOOD('db:'+id), g).k, 0), 0);
  const TRUE_TDEE = 2650;
  let kg = 80.4;
  const body = [], log = {};
  const d0 = addDays(today(), -55);
  for (let i = 0; i < 56; i++){
    const k = addDays(d0, i), isToday = k === today();
    const weekend = [0,6].includes(new Date(kd(k)).getDay());
    const skip = R() < .1 && !isToday;
    const target = 2150 + (weekend ? 350 : 0) + (R() - .5) * 400;
    let eaten = 0;
    if (!skip){
      const sc = target / base, items = [];
      for (const [m, xs] of plan){
        if (isToday && m > 1) continue;
        for (const [id, g0] of xs){
          const x = FOOD('db:'+id), g = Math.max(5, Math.round(g0 * sc * (0.85 + R()*0.3) / 5) * 5), v = per(x, g);
          items.push({id:uid(), f:x.ref, n:x.name, g, k:r1(v.k), p:r1(v.p), c:r1(v.c), fa:r1(v.f), m}); eaten += v.k;
        }
      }
      log[k] = items;
    } else eaten = target + 300;
    kg += (eaten - TRUE_TDEE) / KCAL_KG;
    if (R() < .85 || i === 55) body.push({t:kd(k) + 7.5*3600e3, kg:r1(kg + (R() - .5) * 0.9)});
  }
  n.log = log; S.body = body;
  n.recent = ['db:avena','db:whey','db:pechuga','db:arroz','db:res90','db:frijol','db:tortmaiz','db:yogurgr','db:almendra','db:platano'];
  n.fav = ['db:whey','db:pechuga','db:avena'];
  n.meals = [{id:uid(), name:'Desayuno de avena', items:plan[0][1].map(([id,g]) => { const x = FOOD('db:'+id), v = per(x, g); return {f:x.ref, n:x.name, g, k:r1(v.k), p:r1(v.p), c:r1(v.c), fa:r1(v.f), m:0}; })}];
  EXP_CACHE = null;
  const E = NUT.expenditure(n, S.body, addDays(today(), -3));
  n.tgt = NUT.targets(n, E[E.length-1].v, NUT.trend(S.body, addDays(today(), -3), addDays(today(), -3)).slice(-1)[0].tr);
  n.checkin = Date.now() - 3*DAY;
});

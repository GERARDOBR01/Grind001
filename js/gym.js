'use strict';
/* =====================================================================
   GYM — registro de entrenamiento: catálogo, series, récords, rutinas,
   entreno en curso con descanso, perfil y ajustes.
   Modelo de datos alineado con la API pública de referencia:
   tipos de serie  warmup | normal | failure | dropset   → w | n | f | d
   tipos de ejercicio weight_reps | bodyweight_reps | reps_only |
                      duration | distance_duration         → wr | bw | r | d | cd
   ===================================================================== */

BLANKS.push(() => ({rest:90, prevMode:'any', dbl:false, custom:[], routines:[], folders:[], workouts:[], active:null}));
TABS.push(['home','Inicio','home'], ['train','Entrenar','dumb'], ['me','Perfil','user']);

/* ---------- catálogo ---------- */
const MUSCLE = {
  chest:'Pecho', lats:'Dorsales', upper_back:'Espalda alta', lower_back:'Lumbares', shoulders:'Hombros',
  biceps:'Bíceps', triceps:'Tríceps', forearms:'Antebrazos', traps:'Trapecio', abdominals:'Abdomen',
  quadriceps:'Cuádriceps', hamstrings:'Isquios', glutes:'Glúteos', calves:'Pantorrillas',
  adductors:'Aductores', abductors:'Abductores', cardio:'Cardio', full_body:'Cuerpo completo', other:'Otro'
};
const EQUIP = {
  barbell:'Barra', dumbbell:'Mancuerna', machine:'Máquina', cable:'Polea', kettlebell:'Kettlebell',
  plate:'Disco', resistance_band:'Banda', none:'Sin equipo', other:'Otro'
};
const TYPE = {
  wr:'Peso y repeticiones', bw:'Peso corporal (+lastre)', as:'Peso corporal asistido', r:'Solo repeticiones',
  wd:'Peso y duración', d:'Duración', cd:'Distancia y tiempo'
};
// ejercicios en los que se levanta el 100 % del peso corporal: su volumen lo incluye
const FULL_BW = new Set(['pull','chin','dip','asp','asd']);
// [id, nombre, músculo, secundarios, equipo, tipo]
const LIB = [
  ['bp','Press de banca (barra)','chest',['triceps','shoulders'],'barbell','wr'],
  ['ibp','Press inclinado (barra)','chest',['shoulders','triceps'],'barbell','wr'],
  ['dbp','Press de banca (mancuernas)','chest',['triceps','shoulders'],'dumbbell','wr'],
  ['idb','Press inclinado (mancuernas)','chest',['shoulders','triceps'],'dumbbell','wr'],
  ['fly','Aperturas (mancuernas)','chest',['shoulders'],'dumbbell','wr'],
  ['cfly','Cruce de poleas','chest',['shoulders'],'cable','wr'],
  ['mcp','Press de pecho (máquina)','chest',['triceps'],'machine','wr'],
  ['pec','Pec deck (máquina)','chest',[],'machine','wr'],
  ['dip','Fondos en paralelas','triceps',['chest','shoulders'],'none','bw'],
  ['pu','Lagartijas','chest',['triceps','shoulders'],'none','r'],
  ['pull','Dominadas','lats',['biceps','upper_back'],'none','bw'],
  ['chin','Dominadas supinas','lats',['biceps'],'none','bw'],
  ['lpd','Jalón al pecho (polea)','lats',['biceps'],'cable','wr'],
  ['row','Remo con barra','upper_back',['lats','biceps'],'barbell','wr'],
  ['dbr','Remo con mancuerna','upper_back',['lats','biceps'],'dumbbell','wr'],
  ['crow','Remo sentado (polea)','upper_back',['lats','biceps'],'cable','wr'],
  ['trow','Remo en T','upper_back',['lats'],'barbell','wr'],
  ['spo','Pullover en polea','lats',[],'cable','wr'],
  ['dl','Peso muerto (barra)','lower_back',['hamstrings','glutes','traps'],'barbell','wr'],
  ['hyp','Hiperextensiones','lower_back',['glutes','hamstrings'],'none','bw'],
  ['asp','Dominadas asistidas (máquina)','lats',['biceps','upper_back'],'machine','as'],
  ['asd','Fondos asistidos (máquina)','triceps',['chest','shoulders'],'machine','as'],
  ['farm','Paseo del granjero','forearms',['traps','full_body'],'dumbbell','wd'],
  ['wplk','Plancha con peso','abdominals',[],'plate','wd'],
  ['fp','Face pull (polea)','shoulders',['upper_back'],'cable','wr'],
  ['ohp','Press militar (barra)','shoulders',['triceps'],'barbell','wr'],
  ['dsp','Press de hombro (mancuernas)','shoulders',['triceps'],'dumbbell','wr'],
  ['arn','Press Arnold (mancuernas)','shoulders',['triceps'],'dumbbell','wr'],
  ['lat','Elevaciones laterales (mancuernas)','shoulders',[],'dumbbell','wr'],
  ['clat','Elevaciones laterales (polea)','shoulders',[],'cable','wr'],
  ['rdf','Pájaros (mancuernas)','shoulders',['upper_back'],'dumbbell','wr'],
  ['shr','Encogimientos (mancuernas)','traps',[],'dumbbell','wr'],
  ['bc','Curl con barra','biceps',['forearms'],'barbell','wr'],
  ['dbc','Curl con mancuernas','biceps',['forearms'],'dumbbell','wr'],
  ['hc','Curl martillo','biceps',['forearms'],'dumbbell','wr'],
  ['pc','Curl predicador (máquina)','biceps',[],'machine','wr'],
  ['cc','Curl en polea','biceps',[],'cable','wr'],
  ['tpd','Extensión de tríceps (polea, cuerda)','triceps',[],'cable','wr'],
  ['skull','Press francés (barra Z)','triceps',[],'barbell','wr'],
  ['ote','Extensión sobre la cabeza (mancuerna)','triceps',[],'dumbbell','wr'],
  ['cgb','Press cerrado (barra)','triceps',['chest'],'barbell','wr'],
  ['kick','Patada de tríceps','triceps',[],'dumbbell','wr'],
  ['wc','Curl de muñeca','forearms',[],'dumbbell','wr'],
  ['sq','Sentadilla (barra)','quadriceps',['glutes','hamstrings'],'barbell','wr'],
  ['fsq','Sentadilla frontal','quadriceps',['glutes'],'barbell','wr'],
  ['lp','Prensa de piernas','quadriceps',['glutes'],'machine','wr'],
  ['le','Extensión de piernas','quadriceps',[],'machine','wr'],
  ['hack','Sentadilla hack','quadriceps',['glutes'],'machine','wr'],
  ['lc','Curl femoral acostado','hamstrings',[],'machine','wr'],
  ['slc','Curl femoral sentado','hamstrings',[],'machine','wr'],
  ['rdl','Peso muerto rumano (barra)','hamstrings',['glutes','lower_back'],'barbell','wr'],
  ['lun','Zancadas (mancuernas)','quadriceps',['glutes'],'dumbbell','wr'],
  ['bss','Sentadilla búlgara','quadriceps',['glutes'],'dumbbell','wr'],
  ['ht','Hip thrust (barra)','glutes',['hamstrings'],'barbell','wr'],
  ['scr','Elevación de talones de pie','calves',[],'machine','wr'],
  ['sca','Elevación de talones sentado','calves',[],'machine','wr'],
  ['add','Aductores (máquina)','adductors',[],'machine','wr'],
  ['abd','Abductores (máquina)','abductors',[],'machine','wr'],
  ['kb','Swing con kettlebell','full_body',['glutes','hamstrings'],'kettlebell','wr'],
  ['cr','Crunch abdominal','abdominals',[],'none','r'],
  ['ccr','Crunch en polea','abdominals',[],'cable','wr'],
  ['hlr','Elevación de piernas colgado','abdominals',[],'none','r'],
  ['abw','Rueda abdominal','abdominals',[],'other','r'],
  ['plk','Plancha','abdominals',[],'none','d'],
  ['tread','Caminadora','cardio',[],'machine','cd'],
  ['bike','Bicicleta estática','cardio',[],'machine','cd'],
  ['erg','Remo (máquina)','cardio',['full_body'],'machine','cd'],
  ['ell','Elíptica','cardio',[],'machine','cd'],
  ['rope','Saltar la cuerda','cardio',[],'other','d'],
  ['stair','Escaladora','cardio',[],'machine','d'],
].map(([id,name,m,sec,eq,type]) => ({id,name,m,sec,eq,type}));


let EXMAP = {};
function indexEx(){ EXMAP = {}; for (const e of LIB) EXMAP[e.id] = e; for (const e of S.custom) EXMAP[e.id] = e; }
const EX = id => EXMAP[id] || {id, name:'Ejercicio eliminado', m:'other', sec:[], eq:'other', type:'wr'};


/* ---------- series: campos por tipo de ejercicio ---------- */
function cols(type){
  switch(type){
    case 'bw': return [['kg','+'+U()],['reps','REPS']];
    case 'as': return [['kg','−'+U()],['reps','REPS']];
    case 'wd': return [['kg',U()],['secs','SEG']];
    case 'r':  return [['reps','REPS']];
    case 'd':  return [['secs','SEG']];
    case 'cd': return [['km','KM'],['min','MIN']];
    default:   return [['kg',U()],['reps','REPS']];
  }
}
function getF(o, f){
  if (!o) return null;
  if (f === 'kg')  return o.kg  == null ? null : r2(toU(o.kg));
  if (f === 'min') return o.secs == null ? null : r1(o.secs/60);
  return o[f] ?? null;
}
function setF(o, f, v){
  if (f === 'kg')  o.kg = v == null ? null : fromU(v);
  else if (f === 'min') o.secs = v == null ? null : Math.round(v*60);
  else o[f] = v;
}
const hasVal = (s, type) => type === 'wr' ? s.reps != null && s.kg != null
                         : type === 'bw' || type === 'r' || type === 'as' ? s.reps != null
                         : type === 'wd' ? s.kg != null && s.secs != null
                         : type === 'd' ? s.secs != null
                         : s.km != null || s.secs != null;
function setText(s, type){
  if (!s) return '—';
  switch(type){
    case 'wr': return `${wt(s.kg ?? 0)} ${u()} × ${s.reps ?? 0}`;
    case 'bw': return (s.kg ? `+${wt(s.kg)} ${u()} × ` : '') + `${s.reps ?? 0} reps`;
    case 'as': return (s.kg ? `−${wt(s.kg)} ${u()} × ` : '') + `${s.reps ?? 0} reps`;
    case 'wd': return `${wt(s.kg ?? 0)} ${u()} · ${clock(s.secs ?? 0)}`;
    case 'r':  return `${s.reps ?? 0} reps`;
    case 'd':  return clock(s.secs ?? 0);
    case 'cd': return [s.km != null ? nf(s.km,2)+' km' : null, s.secs != null ? clock(s.secs) : null].filter(Boolean).join(' · ');
  }
}
const setTextR = (s, type) => setText(s, type) + (s && s.rpe ? ` @${nf(s.rpe)}` : '');
// RPE: mismos valores que acepta la API de referencia
const RPE = [6, 7, 7.5, 8, 8.5, 9, 9.5, 10];
const RPE_TXT = {6:'Podías 4 más', 7:'Podías 3 más', 7.5:'2 o 3 más', 8:'Podías 2 más', 8.5:'1 o 2 más', 9:'Podías 1 más', 9.5:'Quizá 1 más', 10:'Esfuerzo máximo'};
// Volumen de una serie, con las mismas reglas que la app de referencia:
// peso corporal suma en los ejercicios de 100 % peso corporal, asistidos restan,
// y las mancuernas pueden contar doble (una por mano) si se activa en Ajustes.
function setVol(s, x, bw = 0){
  const k = (s.kg || 0) * (S.dbl && x.eq === 'dumbbell' && x.type === 'wr' ? 2 : 1), r = s.reps || 0, full = FULL_BW.has(x.id);
  switch(x.type){
    case 'wr': return k * r;
    case 'bw': return (k + (full ? bw : 0)) * r;
    case 'as': return full ? Math.max((bw - k) * r, 0) : 0;
    case 'r':  return full ? bw * r : 0;
    case 'wd': return k;
    default:   return 0;
  }
}
// 1RM estimado: peso / % del máximo que se levanta a esas reps (tabla porcentual; >30 reps = 50 %)
const PCT = [0, 1, .97, .94, .92, .89, .86, .83, .81, .78, .75, .73, .71, .7, .68, .67, .65, .64, .63, .61, .6, .59, .58, .57, .56, .55, .54, .53, .52, .51, .5];
const e1rm = (s, x) => x.type === 'wr' && s.kg > 0 && s.reps > 0 ? s.kg / (s.reps > 30 ? .5 : PCT[s.reps]) : 0;
// peso corporal registrado más cercano antes de la fecha; si no hay, el primero
function bwAt(t){
  const b = S.body.filter(b => b.kg).sort((a,c) => a.t - c.t);
  let v = b.length ? b[0].kg : 0; for (const e of b) if (e.t <= t) v = e.kg;
  return v;
}
function setLabel(sets, i){
  const s = sets[i];
  if (s.t === 'w') return 'C';
  if (s.t === 'f') return 'F';
  if (s.t === 'd') return 'D';
  let n = 0; for (let j = 0; j <= i; j++) if (sets[j].t !== 'w') n++;
  return String(n);
}
const SETT = {w:['C','Calentamiento','w'], n:['1','Normal',''], f:['F','Al fallo','f'], d:['D','Drop set','d']};

/* ---------- consultas sobre el historial ---------- */
const sorted = () => S.workouts.slice().sort((a,b) => b.start - a.start);
// los calentamientos no suman volumen
function workoutVol(w){ const bw = bwAt(w.start); let v = 0; for (const e of w.ex) for (const s of e.sets) if (s.t !== 'w') v += setVol(s, EX(e.id), bw); return v; }
const workoutSets = w => w.ex.reduce((n,e) => n + e.sets.length, 0);
// serie equivalente del entreno anterior: calentamientos con calentamientos, efectivas con efectivas
function prevFor(exId, sets, si){
  const rid = S.prevMode === 'routine' && S.active ? S.active.routineId : null;
  const prev = (rid && lastSetsFor(exId, Infinity, rid)) || lastSetsFor(exId); if (!prev) return null;
  const w = sets[si].t === 'w', k = sets.slice(0, si).filter(s => (s.t === 'w') === w).length;
  return prev.filter(s => (s.t === 'w') === w)[k] || null;
}
function lastSetsFor(exId, before = Infinity, rid = null){
  for (const w of sorted()) if (w.start < before && (!rid || w.routineId === rid)) { const e = w.ex.find(e => e.id === exId); if (e) return e.sets; }
  return null;
}
// métricas de récord por serie; f(serie, ejercicio, peso corporal)
const MET = {
  w:   {lbl:'Peso máximo',      f:(s,x) => ['wr','bw','wd'].includes(x.type) ? s.kg || 0 : 0, fmt:v => wt(v)+' '+u()},
  e1:  {lbl:'1RM estimado',     f:e1rm, fmt:v => wt(v)+' '+u()},
  sv:  {lbl:'Mejor serie',      f:setVol, fmt:v => vol(v)},
  reps:{lbl:'Más repeticiones', f:(s,x) => ['r','bw','as'].includes(x.type) ? s.reps || 0 : 0, fmt:v => v+' reps'},
  secs:{lbl:'Mayor duración',   f:(s,x) => ['d','cd','wd'].includes(x.type) ? s.secs || 0 : 0, fmt:v => clock(v)},
  km:  {lbl:'Mayor distancia',  f:(s,x) => x.type === 'cd' ? s.km || 0 : 0, fmt:v => nf(v,2)+' km'},
};
const metsFor = t => ({wr:['w','e1','sv'], bw:['reps','w','sv'], as:['reps'], r:['reps'], wd:['w','secs'], d:['secs'], cd:['km','secs']})[t];
// los calentamientos nunca cuentan como récord
function bests(exId, before = Infinity, skipWid = null){
  const x = EX(exId), b = {};
  for (const k of metsFor(x.type)) b[k] = 0;
  for (const w of S.workouts){
    if (w.start >= before || w.id === skipWid) continue;
    const bw = bwAt(w.start);
    for (const e of w.ex) if (e.id === exId) for (const s of e.sets) if (s.t !== 'w') for (const k in b) b[k] = Math.max(b[k], MET[k].f(s, x, bw));
  }
  return b;
}
// récords que rompió un entreno ya guardado, contra todo lo anterior
function workoutPRs(w){
  const out = [];
  for (const e of w.ex){
    const x = EX(e.id), b = bests(e.id, w.start, w.id), bw = bwAt(w.start);
    if (Object.values(b).every(v => !v)) continue;          // primera vez: no cuenta como récord
    const hit = new Set();
    for (const s of e.sets) if (s.t !== 'w') for (const k in b){ const v = MET[k].f(s, x, bw); if (v > b[k]){ b[k] = v; hit.add(k); s.pr = 1; } }
    for (const k of hit) out.push({ex:e.id, k});
  }
  return out;
}
const prCache = new Map();
function prCount(w){ if (!prCache.has(w.id)) prCache.set(w.id, workoutPRs(clone(w)).length); return prCache.get(w.id); }
function streakWeeks(){
  const weeks = new Set(S.workouts.map(w => weekStart(w.start)));
  let ws = weekStart(Date.now()), n = 0;
  if (!weeks.has(ws)) ws -= 7*DAY;                       // la semana en curso aún puede llegar
  while (weeks.has(ws)) { n++; ws = weekStart(ws - 3*DAY); }
  return n;
}



VIEWS.home = () => {
  const ws = sorted();
  const now = Date.now(), wk = weekStart(now);
  const thisWeek = ws.filter(w => w.start >= wk).length;
  const feed = ws.slice(0, 30).map(wCard).join('');
  return {
    mark:true,
    right:`<button class="ib" data-a="go" data-v="lib" aria-label="Ejercicios">${ic('search')}</button>`,
    body:`
      <div class="pad" style="padding-top:20px">
        <div class="lbl">${cap(DF.format(now))}</div>
        <h1 class="h1" style="margin-top:6px">${thisWeek ? `${thisWeek} ${thisWeek===1?'entreno':'entrenos'} esta semana` : 'Hoy toca moverse'}</h1>
        <p class="mut" style="margin:6px 0 0;font-size:14px">${streakWeeks() ? `Racha de <b style="color:var(--ink)">${streakWeeks()} ${streakWeeks()===1?'semana':'semanas'}</b> seguidas.` : 'Registra tu primer entreno para empezar la racha.'}</p>
      </div>
      <div class="pad" style="margin-top:16px"><button class="btn acc" data-a="startEmpty">${ic('plus')}Empezar entreno vacío</button></div>
      <div class="sec"><span class="lbl">Tus entrenos</span>${ws.length ? `<span class="mut" style="font-size:12.5px">${ws.length} en total</span>` : ''}</div>
      ${feed || `<div class="empty"><b>Aún no hay entrenos</b>Empieza uno vacío o desde una rutina en Entrenar.</div>`}
      <div class="foot">Todo se guarda en este teléfono. Sin cuenta, sin internet.</div>`
  };
};

function wCard(w){
  const prs = prCount(w);
  const exl = w.ex.slice(0,4).map(e => `<div class="li"><span class="n">${e.sets.length} ${e.sets.length===1?'serie':'series'}</span><span>${esc(EX(e.id).name)}</span></div>`).join('')
    + (w.ex.length > 4 ? `<div class="li mut" style="font-size:12.5px">y ${w.ex.length-4} más</div>` : '');
  return `<button class="card wcard" data-a="go" data-v="wv" data-id="${w.id}">
    <div class="hd"><div class="ttl">${esc(w.title)}</div><div class="when">${when(w.start)}</div></div>
    <div class="stats"><div><div class="lbl">Duración</div><div class="v">${dur((w.end-w.start)/1000)}</div></div>
      <div><div class="lbl">Volumen</div><div class="v">${vol(workoutVol(w))}</div></div>
      <div><div class="lbl">Récords</div><div class="v">${prs ? `<span class="pr">${ic('trophy','ico" style="width:12px;height:12px')}${prs}</span>` : '—'}</div></div></div>
    <div class="exl">${exl}</div></button>`;
}

VIEWS.train = () => {
  const rs = S.routines.map(r => `
    <div class="card">
      <div style="display:flex;align-items:flex-start;gap:8px;padding:14px 10px 0 14px">
        <div style="flex:1;min-width:0"><div class="h2">${esc(r.title)}</div><div class="lbl" style="margin-top:4px">${r.ex.length} ejercicios · ≈ ${dur(estDur(r))}</div>
          <div class="mut" style="font-size:13px;margin-top:4px;line-height:1.4">${esc(r.ex.map(e => EX(e.id).name).join(', ')) || 'Sin ejercicios'}</div></div>
        <button class="ib" data-a="routineMenu" data-id="${r.id}" aria-label="Opciones">${ic('more')}</button>
      </div>
      <div style="padding:12px 14px 14px"><button class="btn acc" data-a="startRoutine" data-id="${r.id}">${ic('play','ico" style="width:15px;height:15px;fill:currentColor')}Empezar rutina</button></div>
    </div>`).join('');
  return {
    title:'Entrenar',
    body:`
      <div class="pad" style="padding-top:16px"><button class="btn" data-a="startEmpty">${ic('plus')}Empezar entreno vacío</button></div>
      <div class="sec"><span class="lbl">Rutinas</span><button class="link" data-a="newRoutine">+ Nueva rutina</button></div>
      ${rs || `<div class="empty"><b>Sin rutinas</b>Arma una rutina para no pensar qué toca cada día.</div>`}
      <div class="pad" style="margin-top:16px"><button class="btn" data-a="go" data-v="lib">${ic('book')}Explorar ejercicios</button></div>
      <div style="height:16px"></div>`
  };
};

function estDur(r){
  let t = 0;
  for (const e of r.ex){ const x = EX(e.id); for (const s of e.sets) t += (['d','wd'].includes(x.type) && s.secs ? s.secs : 45) + (s.t === 'd' ? 0 : e.rest ?? S.rest); }
  return t;
}

/* ----- entreno activo y editor de rutina comparten la tarjeta de ejercicio ----- */
function exCard(e, ei, mode){
  const x = EX(e.id), cs = cols(x.type), live = mode === 'w';
  const grid = live ? `34px minmax(0,1fr) ${cs.map(() => '58px').join(' ')} 38px` : `34px minmax(0,1fr) ${cs.map(() => '64px').join(' ')} 32px`;
  const head = `<div class="tr h" style="grid-template-columns:${grid}"><span>SERIE</span><span>${live ? 'ANTERIOR' : ''}</span>${cs.map(c => `<span>${c[1]}</span>`).join('')}<span>${live ? ic('check','ico" style="width:12px;height:12px;margin:auto') : ''}</span></div>`;
  const rows = e.sets.map((s, si) => {
    const p = live ? prevFor(e.id, e.sets, si) : null;
    const ph = s.ph || p;
    const inputs = cs.map(([f]) => {
      const v = f === 'reps' && s.rr ? s.rr.join('-') : getF(s, f), pv = f === 'reps' && ph?.rr && ph.reps == null ? ph.rr.join('-') : getF(ph, f);
      return `<input inputmode="${f === 'reps' && !live ? 'text' : f === 'reps' || f === 'secs' ? 'numeric' : 'decimal'}" data-f="${f}" data-ei="${ei}" data-si="${si}" value="${v ?? ''}" placeholder="${pv ?? '–'}" aria-label="${f}">`;
    }).join('');
    return `<div class="tr${s.done ? ' done' : ''}" style="grid-template-columns:${grid};position:relative" data-row="${ei}-${si}">
      <button class="sn ${SETT[s.t][2]}" data-a="setType" data-ei="${ei}" data-si="${si}">${setLabel(e.sets, si)}${s.rpe ? `<small>@${nf(s.rpe)}</small>` : ''}</button>
      ${live ? `<button class="prev" data-a="usePrev" data-ei="${ei}" data-si="${si}">${p ? esc(setTextR(p, x.type)) : '—'}</button>` : '<span></span>'}
      ${inputs}
      ${live ? `<button class="ck" data-a="done" data-ei="${ei}" data-si="${si}" aria-label="Completar serie">${ic('check')}</button>${s.pr ? '<span class="medal">🏆</span>' : ''}`
             : `<button class="x" data-a="delSet" data-ei="${ei}" data-si="${si}" aria-label="Quitar serie">${ic('x','ico" style="width:14px;height:14px')}</button>`}
    </div>`;
  }).join('');
  return `<section class="exc">
    <div class="top"><div class="av sm">${initials(x.name)}</div>
      <button class="name" data-a="go" data-v="ex" data-id="${x.id}">${esc(x.name)}${e.ss != null ? '<span class="ss">SUPERSERIE</span>' : ''}</button>
      <button class="ib" data-a="exMenu" data-ei="${ei}" aria-label="Opciones">${ic('more')}</button></div>
    <div class="notes"><textarea rows="1" data-note="${ei}" placeholder="Agregar notas…">${esc(e.notes || '')}</textarea></div>
    <button class="rest" data-a="restMenu" data-ei="${ei}">${ic('timer')}Descanso: ${restLbl(e.rest)}</button>
    <div class="tbl">${head}${rows}</div>
    <button class="addset" data-a="addSet" data-ei="${ei}">+ Agregar serie</button>
  </section>`;
}

function liveStats(){
  const a = S.active; let v = 0, n = 0;
  const bw = bwAt(Date.now());
  for (const e of a.ex) for (const s of e.sets) if (s.done){ n++; if (s.t !== 'w') v += setVol(s, EX(e.id), bw); }
  return {v, n};
}
VIEWS.workout = () => {
  const a = S.active;
  if (!a) return {title:'', body:'<div class="empty"><b>No hay entreno en curso</b></div>'};
  const {v, n} = liveStats();
  return {
    title:`<span style="font-size:15px">${esc(a.title)}</span>`,
    right:`<button class="bb acc" data-a="finish">Terminar</button>`,
    body:`
      <div class="wstats">
        <div><div class="lbl">Duración</div><div class="v acc" data-clock>${clock((Date.now()-a.start)/1000)}</div></div>
        <div><div class="lbl">Volumen</div><div class="v" id="wvol">${vol(v)}</div></div>
        <div><div class="lbl">Series</div><div class="v" id="wsets">${n}</div></div>
      </div>
      ${a.ex.map((e,i) => exCard(e, i, 'w')).join('') || `<div class="empty"><b>Entreno vacío</b>Agrega tu primer ejercicio para empezar.</div>`}
      <div class="pad" style="margin-top:16px;display:grid;gap:8px">
        <button class="btn acc" data-a="addEx">${ic('plus')}Agregar ejercicio</button>
        <div class="row2"><button class="btn" data-a="go" data-v="cfg">Ajustes</button><button class="btn red" data-a="discard">Descartar</button></div>
      </div>`,
    after: autosize
  };
};

VIEWS.routine = t => {
  const d = t.draft;
  return {
    title: t.id ? 'Editar rutina' : 'Nueva rutina',
    right:`<button class="bb acc" data-a="saveRoutine">Guardar</button>`,
    body:`
      <div class="pad" style="padding-top:14px"><input class="field" id="rtitle" data-rf="title" placeholder="Nombre de la rutina" value="${esc(d.title)}" style="font-size:17px;font-weight:620"></div>
      <div class="pad" style="padding-top:8px"><textarea class="field" data-rf="notes" placeholder="Notas de la rutina (opcional)" rows="2">${esc(d.notes || '')}</textarea></div>
      <div style="margin-top:6px">${d.ex.map((e,i) => exCard(e, i, 'r')).join('') || `<div class="empty">Agrega ejercicios. Las series que pongas aquí serán el objetivo al empezar la rutina.</div>`}</div>
      <div class="pad" style="margin-top:16px"><button class="btn acc" data-a="addEx">${ic('plus')}Agregar ejercicio</button></div>
      <div style="height:20px"></div>`,
    after: autosize
  };
};

VIEWS.finish = t => {
  const a = S.active, {v, n} = liveStats();
  const tmp = Object.assign(clone(a), {end:Date.now(), ex:a.ex.map(e => ({...e, sets:e.sets.filter(s => s.done)})).filter(e => e.sets.length)});
  const prs = workoutPRs(tmp);
  return {
    title:'Guardar entreno',
    right:`<button class="bb acc" data-a="save">Guardar</button>`,
    body:`
      <div class="pad" style="padding-top:14px"><input class="field" id="ftitle" value="${esc(a.title)}" style="font-size:18px;font-weight:650"></div>
      <div class="card p"><div class="stats">
        <div><div class="lbl">Duración</div><div class="v">${dur((Date.now()-a.start)/1000)}</div></div>
        <div><div class="lbl">Volumen</div><div class="v">${vol(v)}</div></div>
        <div><div class="lbl">Series</div><div class="v">${n}</div></div></div></div>
      ${prs.length ? `<div class="card p"><div class="lbl" style="margin-bottom:8px">Récords nuevos</div>${prs.map(p => `<div class="kv"><span>${esc(EX(p.ex).name)}</span><span class="pr">🏆 ${MET[p.k].lbl}</span></div>`).join('')}</div>` : ''}
      <div class="pad" style="padding-top:12px"><textarea class="field" id="fdesc" placeholder="¿Cómo te fue? (opcional)" rows="3">${esc(a.desc || '')}</textarea></div>
      <div class="pad mut" style="font-size:12.5px;padding-top:10px">${tmp.ex.reduce((k,e)=>k+e.sets.length,0) < a.ex.reduce((k,e)=>k+e.sets.length,0) ? 'Las series sin marcar como completadas no se guardan.' : ''}</div>
      <div class="pad" style="margin-top:14px"><button class="btn red" data-a="discard">Descartar entreno</button></div>`
  };
};

VIEWS.wv = t => {
  const w = S.workouts.find(w => w.id === t.id);
  if (!w) return {title:'', body:'<div class="empty"><b>Entreno no encontrado</b></div>'};
  const pw = clone(w); const prs = workoutPRs(pw);
  const nth = sorted().reverse().findIndex(x => x.id === w.id) + 1;
  const body = pw.ex.map(e => {
    const x = EX(e.id);
    return `<div class="hist"><button class="link" style="font-size:15px" data-a="go" data-v="ex" data-id="${x.id}">${esc(x.name)}</button>
      ${e.notes ? `<div class="mut" style="font-size:13px;margin:3px 0 4px">${esc(e.notes)}</div>` : ''}
      <div style="margin-top:6px">${e.sets.map((s,i) => `<div class="s"><span class="k ${SETT[s.t][2]}">${setLabel(e.sets,i)}</span><span style="flex:1">${esc(setTextR(s, x.type))}</span>${s.pr ? '<span class="pr">🏆 Récord</span>' : ''}</div>`).join('')}</div></div>`;
  }).join('');
  return {
    title: t.fresh ? '' : esc(w.title),
    right:`<button class="ib" data-a="wvMenu" data-id="${w.id}" aria-label="Opciones">${ic('more')}</button>`,
    body:`
      ${t.fresh ? `<div class="done-hero"><div class="n">Entreno #${nth}</div><h1 class="h1" style="margin-top:8px">¡Bien hecho!</h1><p class="mut" style="margin:6px 0 0">${esc(w.title)}</p></div>`
                : `<div class="pad" style="padding-top:14px"><div class="mut" style="font-size:13px">${when(w.start)}</div></div>`}
      <div class="card p"><div class="stats">
        <div><div class="lbl">Duración</div><div class="v">${dur((w.end-w.start)/1000)}</div></div>
        <div><div class="lbl">Volumen</div><div class="v">${vol(workoutVol(w))}</div></div>
        <div><div class="lbl">Récords</div><div class="v">${prs.length || '—'}</div></div></div></div>
      ${w.desc ? `<div class="pad" style="padding-top:12px;font-size:14px;color:var(--ink-2)">${esc(w.desc)}</div>` : ''}
      <div class="card">${body}</div>
      <div class="pad" style="margin-top:14px;display:grid;gap:8px">
        <button class="btn" data-a="repeat" data-id="${w.id}">${ic('play','ico" style="width:15px;height:15px;fill:currentColor')}Repetir este entreno</button>
        <button class="btn" data-a="toRoutine" data-id="${w.id}">Guardar como rutina</button>
      </div><div style="height:20px"></div>`
  };
};

/* ----- biblioteca / selector ----- */
VIEWS.lib = t => {
  t.q = t.q || ''; t.m = t.m || ''; t.sel = t.sel || [];
  const ms = Object.keys(MUSCLE).filter(k => k !== 'other');
  return {
    title: t.replace != null ? 'Reemplazar ejercicio' : t.pick ? 'Agregar ejercicios' : 'Ejercicios',
    right:`<button class="bb ghost" data-a="newEx">Crear</button>`,
    body:`
      <div class="search">${ic('search','ico" style="color:var(--mut)')}<input id="q" placeholder="Buscar ejercicio" value="${esc(t.q)}" autocomplete="off"></div>
      <div class="chips"><button class="chip" data-a="libM" data-k="" aria-pressed="${!t.m}">Todos</button>${ms.map(k => `<button class="chip" data-a="libM" data-k="${k}" aria-pressed="${t.m===k}">${MUSCLE[k]}</button>`).join('')}</div>
      <div id="libList" style="margin-top:6px">${libList(t)}</div>
      ${t.pick && t.replace == null ? `<div style="height:80px"></div><div class="float"><button class="btn acc" data-a="pickDone" id="pickBtn" ${t.sel.length ? '' : 'disabled style="opacity:.5"'}>Agregar ${t.sel.length ? t.sel.length + ' ' + (t.sel.length===1?'ejercicio':'ejercicios') : 'ejercicios'}</button></div>` : ''}`
  };
};
function libList(t){
  const q = norm(t.q);
  const used = {}; for (const w of S.workouts) for (const e of w.ex) used[e.id] = (used[e.id] || 0) + 1;
  const all = [...S.custom, ...LIB].filter(e => (!t.m || e.m === t.m) && (!q || norm(e.name).includes(q) || norm(MUSCLE[e.m]).includes(q)));
  const recent = !q && !t.m ? all.filter(e => used[e.id]).sort((a,b) => used[b.id]-used[a.id]).slice(0,6) : [];
  const item = e => `<button class="exi" data-a="${t.pick ? 'pickEx' : 'go'}" data-v="ex" data-id="${e.id}" aria-selected="${t.sel.includes(e.id)}">
      <div class="av">${t.sel.includes(e.id) ? ic('check') : initials(e.name)}</div>
      <div style="flex:1;min-width:0"><div class="tt">${esc(e.name)}</div><div class="dd">${MUSCLE[e.m]} · ${EQUIP[e.eq] || ''}${e.custom ? ' · Personalizado' : ''}</div></div>
      ${used[e.id] ? `<span class="mut" style="font-size:12px">${used[e.id]}×</span>` : ''}</button>`;
  return (recent.length ? `<div class="sec" style="padding-top:8px"><span class="lbl">Más usados</span></div>${recent.map(item).join('')}<div class="sec"><span class="lbl">Todos</span></div>` : '')
    + (all.map(item).join('') || `<div class="empty"><b>Sin resultados</b>Prueba con otra palabra o crea el ejercicio.</div>`);
}

/* ----- detalle de ejercicio ----- */
VIEWS.ex = t => {
  const x = EX(t.id); t.tab = t.tab || 'res';
  const mets = metsFor(x.type);
  t.met = t.met || mets[0];
  const sess = sorted().filter(w => w.ex.some(e => e.id === x.id)).map(w => ({w, e:w.ex.find(e => e.id === x.id)}));
  const b = bests(x.id);
  const series = sess.slice().reverse().map(({w,e}) => ({t:w.start, v:Math.max(0, ...e.sets.filter(s => s.t !== 'w').map(s => MET[t.met].f(s, x, bwAt(w.start))))})).filter(p => p.v > 0);
  const toDisp = v => ['w','e1'].includes(t.met) ? toU(v) : t.met === 'sv' ? toU(v) : t.met === 'secs' ? v/60 : v;
  const res = `
    <div class="card p">
      <div class="lbl">${MET[t.met].lbl}</div>
      <div class="big" style="margin:4px 0 8px">${b[t.met] ? MET[t.met].fmt(b[t.met]) : '—'}</div>
      ${series.length > 1 ? lineChart(series.map(p => ({t:p.t, v:toDisp(p.v)}))) : `<div class="mut" style="font-size:13px;padding:18px 0">Registra al menos dos sesiones para ver la gráfica.</div>`}
      <div class="chips" style="padding:10px 0 0">${mets.map(k => `<button class="chip" data-a="exMet" data-k="${k}" aria-pressed="${t.met===k}">${MET[k].lbl}</button>`).join('')}</div>
    </div>
    <div class="sec"><span class="lbl">Récords personales</span></div>
    <div class="pad"><div class="recs">${mets.map(k => `<div><div class="lbl">${MET[k].lbl}</div><div style="font-weight:650;margin-top:3px">${b[k] ? MET[k].fmt(b[k]) : '—'}</div></div>`).join('')}
      <div><div class="lbl">Sesiones</div><div style="font-weight:650;margin-top:3px">${sess.length}</div></div></div></div>
    ${x.type === 'wr' && b.e1 ? `<div class="sec"><span class="lbl">Tabla de repeticiones máximas</span></div><div class="card p">${[1,2,3,5,8,10,12].map(r => `<div class="kv"><span>${r} ${r===1?'rep':'reps'}</span><span class="num">${nf(Math.round(toU(b.e1*PCT[r])*2)/2)} ${u()}</span></div>`).join('')}</div>` : ''}
    <div class="pad mut" style="font-size:12px;padding-top:12px">1RM estimado con tabla porcentual: 5 reps ≈ 89 %, 10 reps ≈ 75 % del máximo. Los calentamientos no cuentan como récord.</div>`;
  const hist = sess.map(({w,e}) => `<div class="hist"><button style="text-align:left" data-a="go" data-v="wv" data-id="${w.id}"><div style="font-weight:620">${esc(w.title)}</div><div class="mut" style="font-size:12.5px">${when(w.start)}</div></button>
     <div style="margin-top:6px">${e.sets.map((s,i) => `<div class="s"><span class="k ${SETT[s.t][2]}">${setLabel(e.sets,i)}</span><span>${esc(setTextR(s,x.type))}</span></div>`).join('')}</div></div>`).join('');
  return {
    title: esc(x.name),
    right: x.custom ? `<button class="ib" data-a="exDelete" data-id="${x.id}" aria-label="Opciones">${ic('more')}</button>` : '',
    body:`
      <div class="pad" style="padding-top:14px;display:flex;gap:12px;align-items:center"><div class="av">${initials(x.name)}</div>
        <div><div class="mut" style="font-size:13px">Principal: <b style="color:var(--ink)">${MUSCLE[x.m]}</b>${x.sec.length ? ' · Secundarios: ' + x.sec.map(m => MUSCLE[m]).join(', ') : ''}</div>
        <div class="mut" style="font-size:13px">${EQUIP[x.eq]} · ${TYPE[x.type]}</div></div></div>
      <div class="pad" style="margin-top:14px"><div class="seg"><button data-a="exTab" data-k="res" aria-pressed="${t.tab==='res'}">Resumen</button><button data-a="exTab" data-k="hist" aria-pressed="${t.tab==='hist'}">Historial</button></div></div>
      ${t.tab === 'res' ? res : (hist ? `<div class="card">${hist}</div>` : `<div class="empty"><b>Sin historial</b>Cuando registres este ejercicio aparecerá aquí.</div>`)}
      <div style="height:20px"></div>`
  };
};

/* ----- perfil y estadísticas ----- */
VIEWS.me = t => {
  t.met = t.met || 'dur';
  const ws = sorted(), now = Date.now();
  const totalVol = ws.reduce((v,w) => v + workoutVol(w), 0);
  // últimas 12 semanas
  const wk0 = weekStart(now), weeks = [];
  for (let i = 11; i >= 0; i--){
    const a = weekStart(wk0 - i*7*DAY + DAY), b = a + 7*DAY;
    const ww = ws.filter(w => w.start >= a && w.start < b);
    const v = t.met === 'dur' ? ww.reduce((s,w) => s + (w.end-w.start)/3600e3, 0)
            : t.met === 'vol' ? ww.reduce((s,w) => s + toU(workoutVol(w)), 0)
            : ww.reduce((s,w) => s + workoutSets(w), 0);
    weeks.push({label:DFS.format(a), v});
  }
  const fmtW = v => t.met === 'dur' ? (v ? nf(v,1)+' h' : '0') : t.met === 'vol' ? nf(Math.round(v)) + ' ' + u() : nf(v,0);
  // distribución muscular, 30 días: principal = 1 serie, secundario = 0.5
  const md = {};
  for (const w of ws.filter(w => w.start > now - 30*DAY)) for (const e of w.ex){
    const x = EX(e.id), n = e.sets.filter(s => s.t !== 'w').length;
    md[x.m] = (md[x.m] || 0) + n; for (const m of x.sec) md[m] = (md[m] || 0) + n/2;
  }
  const mdl = Object.entries(md).sort((a,b) => b[1]-a[1]); const mmax = mdl[0]?.[1] || 1;
  // calendario de las últimas 5 semanas
  const days = new Set(ws.map(w => new Date(w.start).setHours(0,0,0,0)));
  const cal0 = wk0 - 4*7*DAY, today = new Date().setHours(0,0,0,0);
  let cal = ['L','M','M','J','V','S','D'].map(d => `<span class="dw">${d}</span>`).join('');
  for (let i = 0; i < 35; i++){ const d = new Date(cal0 + i*DAY).setHours(0,0,0,0); cal += `<span class="${days.has(d)?'on':''}${d===today?' today':''}" title="${DFS.format(d)}"></span>`; }
  // peso corporal
  const body = S.body.slice().sort((a,b) => a.t - b.t);
  const lastB = body[body.length-1];
  return {
    title:'Perfil',
    right:`<button class="ib" data-a="go" data-v="cfg" aria-label="Ajustes">${ic('gear')}</button>`,
    body:`
      <div class="pad" style="padding-top:18px;display:flex;align-items:center;gap:14px">
        <div class="av" style="width:56px;height:56px;font-size:16px;background:var(--acc);color:var(--acc-ink);border-color:var(--acc)">TÚ</div>
        <div class="stats" style="flex:1"><div><div class="lbl">Entrenos</div><div class="v">${ws.length}</div></div>
          <div><div class="lbl">Racha</div><div class="v">${streakWeeks()} sem</div></div>
          <div><div class="lbl">Volumen</div><div class="v">${nf(Math.round(toU(totalVol)/1000),0)} t</div></div></div>
      </div>
      <div class="card p">
        <div style="display:flex;justify-content:space-between;align-items:baseline"><span class="lbl">Últimas 12 semanas</span><span class="num" style="font-weight:650">${fmtW(weeks[11].v)} <span class="mut" style="font-weight:400;font-size:12px">esta semana</span></span></div>
        ${barChart(weeks)}
        <div class="seg" style="margin-top:10px">${[['dur','Duración'],['vol','Volumen'],['sets','Series']].map(([k,l]) => `<button data-a="meMet" data-k="${k}" aria-pressed="${t.met===k}">${l}</button>`).join('')}</div>
      </div>
      <div class="card p"><div style="display:flex;justify-content:space-between;margin-bottom:10px"><span class="lbl">Calendario</span><span class="mut" style="font-size:12px">${[...days].filter(d => d >= cal0).length} días con entreno</span></div><div class="cal">${cal}</div></div>
      <div class="card p"><div class="lbl" style="margin-bottom:6px">Series por músculo · 30 días</div>
        ${mdl.length ? mdl.slice(0,10).map(([m,n]) => `<div class="mrow"><span>${MUSCLE[m]}</span><span class="bar2"><i style="width:${Math.round(n/mmax*100)}%"></i></span><span class="num mut" style="text-align:right">${nf(n,1)}</span></div>`).join('') : '<div class="mut" style="font-size:13px">Sin datos todavía.</div>'}
        <div class="mut" style="font-size:11.5px;margin-top:6px">Músculo principal cuenta 1 serie; secundario, media. Sin calentamientos.</div></div>
      <div class="card p"><div style="display:flex;justify-content:space-between;align-items:center"><span class="lbl">Peso corporal</span><button class="link" data-a="addBody">+ Registrar</button></div>
        <div class="big" style="margin:4px 0 8px">${lastB ? wt(lastB.kg)+' '+u() : '—'}</div>
        ${body.length > 1 ? lineChart(body.map(b => ({t:b.t, v:toU(b.kg)}))) : '<div class="mut" style="font-size:13px">Registra tu peso para ver la tendencia.</div>'}</div>
      <div class="pad" style="margin-top:14px"><button class="btn" data-a="go" data-v="lib">${ic('book')}Ejercicios y récords</button></div>
      <div style="height:20px"></div>`
  };
};

VIEWS.cfg = () => ({
  title:'Ajustes',
  body:`
    <div class="sec"><span class="lbl">Unidades</span></div>
    <div class="pad"><div class="seg"><button data-a="units" data-k="kg" aria-pressed="${S.units==='kg'}">Kilogramos</button><button data-a="units" data-k="lb" aria-pressed="${S.units==='lb'}">Libras</button></div></div>
    <div class="sec"><span class="lbl">Entreno</span></div>
    <div class="card" style="padding:0 14px">
      <button class="opt" data-a="restDefault"><span style="flex:1">Descanso por defecto</span><span class="mut">${restLbl(S.rest)}</span></button>
      <button class="opt" data-a="prevMode"><span style="flex:1">Columna «Anterior»</span><span class="mut">${S.prevMode === 'routine' ? 'Misma rutina' : 'Cualquier entreno'}</span></button>
      <button class="opt" data-a="dbl"><span style="flex:1">Contar doble el peso en mancuernas</span><span class="mut">${S.dbl ? 'Sí' : 'No'}</span></button>
      <button class="opt" data-a="sound"><span style="flex:1">Sonido y vibración al terminar el descanso</span><span class="mut">${S.sound ? 'Sí' : 'No'}</span></button>
    </div>
    <div class="sec"><span class="lbl">Datos</span></div>
    <div class="card" style="padding:0 14px">
      <button class="opt" data-a="export"><span style="flex:1">Exportar respaldo (JSON)</span></button>
      <label class="opt" style="cursor:pointer"><span style="flex:1">Importar respaldo</span><input type="file" accept="application/json,.json" id="imp" hidden></label>
      <button class="opt" data-a="exportCsv"><span style="flex:1">Exportar series (CSV)</span></button>
      <button class="opt" data-a="reseed"><span style="flex:1">Restaurar datos de ejemplo</span></button>
      <button class="opt red" data-a="wipe"><span style="flex:1">Borrar todo</span></button>
    </div>
    <div class="foot">Serie guarda todo en el almacenamiento de este navegador. No hay cuenta ni servidor: si borras los datos del navegador, se pierden. Exporta un respaldo de vez en cuando.</div>`
});


function startRest(secs){
  if (!secs || !S.active) return;
  S.active.restEnd = Date.now() + secs*1000; S.active.restTotal = secs; save(); renderRest();
}
function renderRest(){
  const a = S.active, el = $('#restbar');
  if (!a || !a.restEnd || cur().v !== 'workout'){ el.innerHTML = ''; return; }
  const left = (a.restEnd - Date.now())/1000;
  if (!el.firstChild) el.innerHTML = `<div class="restbar"><div class="in"><div class="prog"><i></i></div><div class="r">
      <div><div class="lbl">Descanso</div><div class="clock" id="rclock"></div></div><span style="flex:1"></span>
      <button class="btn sm" data-a="restAdd" data-k="-15">−15</button><button class="btn sm" data-a="restAdd" data-k="15">+15</button>
      <button class="btn sm acc" data-a="restSkip">Saltar</button></div></div></div>`;
  $('#rclock').textContent = clock(Math.ceil(left));
  $('.restbar .prog i').style.width = Math.max(0, Math.min(100, left / a.restTotal * 100)) + '%';
}
function tick(){
  const a = S.active; if (!a) return;
  document.querySelectorAll('[data-clock]').forEach(el => el.textContent = clock((Date.now()-a.start)/1000));
  if (a.restEnd){
    if (Date.now() >= a.restEnd){ a.restEnd = null; save(); beep(); toast(`${ic('timer')} Descanso terminado`); $('#restbar').innerHTML = ''; }
    else renderRest();
  }
}

/* ---------- acciones de entreno ---------- */
function newSet(t = 'n'){ return {t, kg:null, reps:null, secs:null, km:null, done:false}; }
function exEntry(id){ return {id, notes:'', rest:S.rest, sets:[newSet(), newSet(), newSet()]}; }
function partOfDay(t){ const h = new Date(t).getHours(); return h < 12 ? 'Entreno de la mañana' : h < 19 ? 'Entreno de la tarde' : 'Entreno de la noche'; }
function begin(a){
  const run = () => { S.active = a; save(); close(); nav([{v:TAB}, {v:'workout'}]); };
  if (S.active) confirmBox('Ya tienes un entreno en curso', 'Si empiezas otro, el actual se descarta.', 'Descartar y empezar', run);
  else run();
}
function fromTemplate(title, rid, ex){
  return {id:uid(), title, routineId:rid, start:Date.now(), restEnd:null, ex: ex.map(e => ({
    id:e.id, notes:e.notes || '', rest:e.rest ?? S.rest, ss:e.ss ?? null,
    sets:e.sets.map(s => ({...newSet(s.t === 'w' ? 'w' : s.t), ph:{kg:s.kg ?? null, reps:s.reps ?? null, secs:s.secs ?? null, km:s.km ?? null, rr:s.rr ?? null}}))
  }))};
}
const ctxList = () => cur().v === 'workout' ? S.active : cur().draft;

function markDone(ei, si, row){
  const a = S.active, e = a.ex[ei], s = e.sets[si], x = EX(e.id);
  if (s.done){ s.done = false; s.pr = 0; save(); render(); return; }
  // vacío: usa el objetivo o lo anterior
  const ph = s.ph || prevFor(e.id, e.sets, si);
  for (const [f] of cols(x.type)) if (getF(s, f) == null && ph && getF(ph, f) != null) setF(s, f, getF(ph, f));
  if (!hasVal(s, x.type)){
    row && row.classList.add('shake'); setTimeout(() => row && row.classList.remove('shake'), 320);
    if (ph?.rr && s.reps == null) return toast(`Objetivo ${ph.rr[0]}–${ph.rr[1]} reps: escribe cuántas hiciste`);
    toast(x.type === 'd' ? 'Escribe la duración' : x.type === 'cd' ? 'Escribe distancia o tiempo' : x.type === 'wr' ? 'Escribe peso y repeticiones' : 'Escribe las repeticiones');
    return;
  }
  s.done = true;
  // récord en vivo: contra el historial y las series previas de este mismo entreno
  const b = bests(e.id), bw = bwAt(Date.now()); s.pr = 0;
  if (s.t !== 'w' && Object.values(b).some(v => v > 0)){
    for (const o of e.sets) if (o !== s && o.done && o.t !== 'w') for (const k in b) b[k] = Math.max(b[k], MET[k].f(o, x, bw));
    const hit = Object.keys(b).filter(k => MET[k].f(s, x, bw) > b[k]);
    if (hit.length){ s.pr = 1; toast(`🏆 Récord · ${MET[hit[0]].lbl}${hit.length > 1 ? ` y ${hit.length-1} más` : ''}`, 3000); }
  }
  save(); render();
  startRest(e.rest);
}

/* ---------- datos de ejemplo ---------- */
SEEDS.push(seed);
function seed(){
  const R = rng(7), round = (v, st = 2.5) => Math.round(v/st)*st;
  const plan = {
    'Empuje': [['bp',60,4,8,true],['ohp',40,3,8],['idb',22,3,10],['lat',9,3,14],['tpd',25,3,12]],
    'Jalón':  [['pull',0,4,8,true],['row',55,3,8],['lpd',50,3,10],['fp',20,3,15],['dbc',12,3,10]],
    'Pierna': [['sq',80,4,6,true],['rdl',70,3,8],['lp',140,3,10],['lc',40,3,12],['scr',60,4,12],['plk',45,3,1]],
  };
  S.routines = Object.entries(plan).map(([title, list]) => ({id:uid(), title, notes:'', ex:list.map(([id,kg,n,reps]) => {
    const t = EX(id).type;
    return {id, notes:'', rest: t === 'wr' && ['bp','sq','row','ohp','rdl'].includes(id) ? 150 : 90,
      sets:Array.from({length:n}, () => t === 'd' ? {t:'n', secs:kg} : t === 'bw' ? {t:'n', reps} : {t:'n', kg, reps})};
  })}));
  const names = Object.keys(plan), ws = [];
  const now = Date.now(), first = now - 56*DAY;
  let k = 0;
  for (let d = first; d < now - DAY*0.6; d += DAY){
    const dow = new Date(d).getDay();
    if (![1,2,4,5].includes(dow) || R() < .12) continue;
    const title = names[k % 3], prog = 1 + .011 * Math.floor(k/3); k++;
    const st = new Date(d); st.setHours(R() < .5 ? 7 : 19, Math.floor(R()*40), 0, 0);
    let t = st.getTime() + 4*60e3;
    const ex = plan[title].map(([id,kg,n,reps,warm]) => {
      const x = EX(id), sets = [];
      if (warm && x.type === 'wr') sets.push({t:'w', kg:round(kg*.5), reps:10, secs:null, km:null});
      for (let i = 0; i < n; i++){
        const r = Math.max(1, reps + (i === n-1 ? -1 : 0) + Math.round(R()*2 - 1));
        if (x.type === 'd') sets.push({t:'n', kg:null, reps:null, secs:Math.round(kg*prog/5)*5, km:null});
        else if (x.type === 'bw') sets.push({t:'n', kg:k > 12 && i === 0 ? 5 : null, reps:r, secs:null, km:null});
        else sets.push({t: id === 'tpd' && i === n-1 ? 'f' : 'n', kg:round(kg*prog, kg < 15 ? 1 : 2.5), reps:r, secs:null, km:null});
      }
      if (id === 'lat') sets.push({t:'d', kg:round(kg*prog*.6,1), reps:12, secs:null, km:null});
      t += sets.length * (110 + R()*40) * 1000;
      return {id, notes:'', rest:90, sets};
    });
    ws.push({id:uid(), title, routineId:S.routines[names.indexOf(title)].id, desc:'', start:st.getTime(), end:t, ex});
  }
  ws[ws.length-1].desc = 'Buena sesión, la última serie costó.';
  S.workouts = ws;
  S.body = Array.from({length:8}, (_, i) => ({t:first + i*7*DAY + 8*3600e3, kg:r1(78.6 - i*.22 + (R()-.5)*.4)}));
  prCache.clear();
}

function csv(){
  const q = v => /[",\n]/.test(v) ? `"${String(v).replace(/"/g,'""')}"` : v;
  const rows = [['fecha','entreno','ejercicio','serie','tipo','peso_kg','reps','km','segundos','rpe']];
  for (const w of sorted().reverse()) for (const e of w.ex) e.sets.forEach((s,i) =>
    rows.push([new Date(w.start).toISOString(), w.title, EX(e.id).name, i+1, {w:'warmup',n:'normal',f:'failure',d:'dropset'}[s.t], s.kg ?? '', s.reps ?? '', s.km ?? '', s.secs ?? '', s.rpe ?? '']));
  return rows.map(r => r.map(v => q(String(v))).join(',')).join('\n');
}

/* ---------- acciones ---------- */
Object.assign(A, {
  resume: () => go('workout'),
  startEmpty: () => begin({id:uid(), title:partOfDay(Date.now()), routineId:null, start:Date.now(), restEnd:null, ex:[]}),
  startRoutine(el){ const r = S.routines.find(r => r.id === el.dataset.id); begin(fromTemplate(r.title, r.id, r.ex)); },
  repeat(el){ const w = S.workouts.find(w => w.id === el.dataset.id); begin(fromTemplate(w.title, w.routineId, w.ex)); },
  toRoutine(el){
    const w = S.workouts.find(w => w.id === el.dataset.id);
    go('routine', {draft:{id:uid(), title:w.title, notes:'', ex:w.ex.map(e => ({id:e.id, notes:e.notes, rest:e.rest ?? S.rest, ss:e.ss ?? null, sets:e.sets.map(s => ({t:s.t, kg:s.kg, reps:s.reps, secs:s.secs, km:s.km}))}))}});
  },
  finish(){
    const n = liveStats().n;
    if (!n) return toast('Marca al menos una serie como completada');
    go('finish');
  },
  save(){
    const a = S.active, title = $('#ftitle').value.trim() || a.title;
    const w = {id:a.id, title, routineId:a.routineId, desc:$('#fdesc').value.trim(), start:a.start, end:Date.now(),
      ex:a.ex.map(e => ({id:e.id, notes:e.notes, rest:e.rest, ss:e.ss ?? null, sets:e.sets.filter(s => s.done).map(({t,kg,reps,secs,km,rpe}) => ({t,kg,reps,secs,km,rpe:rpe ?? null}))})).filter(e => e.sets.length)};
    S.workouts.push(w); S.active = null; prCache.clear(); save();
    TAB = 'home'; nav([{v:'home'}, {v:'wv', id:w.id, fresh:true}]);
  },
  discard(){ confirmBox('¿Descartar entreno?', 'Se pierde todo lo que registraste en este entreno.', 'Descartar', () => { S.active = null; save(); NAV = [{v:TAB}]; render(true); }); },
  addEx(){ go('lib', {pick:true, sel:[]}); },
  replaceEx(el){ close(); go('lib', {pick:true, sel:[], replace:+el.dataset.ei}); },
  pickEx(el){
    const t = cur(), id = el.dataset.id, i = t.sel.indexOf(id);
    if (t.replace != null){
      // conserva cuántas series y de qué tipo; los valores ya no aplican al ejercicio nuevo
      NAV.pop(); const e = ctxList().ex[t.replace];
      e.id = id; e.sets = e.sets.map(s => newSet(s.t));
      save(); render(); return toast('Ejercicio reemplazado');
    }
    i < 0 ? t.sel.push(id) : t.sel.splice(i, 1);
    $('#libList').innerHTML = libList(t);
    const b = $('#pickBtn'); b.disabled = !t.sel.length; b.style.opacity = t.sel.length ? '' : '.5';
    b.textContent = `Agregar ${t.sel.length ? t.sel.length + ' ' + (t.sel.length===1?'ejercicio':'ejercicios') : 'ejercicios'}`;
  },
  pickDone(){
    const sel = cur().sel; NAV.pop();
    const L = ctxList(); for (const id of sel) L.ex.push(exEntry(id));
    save(); render(); setTimeout(() => window.scrollTo(0, document.body.scrollHeight), 30);
  },
  libM(el){ const t = cur(); t.m = el.dataset.k; render(); },
  addSet(el){
    const L = ctxList(), e = L.ex[+el.dataset.ei], last = e.sets[e.sets.length-1];
    const s = newSet(last && last.t !== 'w' ? last.t : 'n');
    if (cur().v === 'routine' && last) Object.assign(s, {kg:last.kg, reps:last.reps, secs:last.secs, km:last.km, rr:last.rr ?? null});
    e.sets.push(s); save(); render();
  },
  delSet(el){ const L = ctxList(); L.ex[+el.dataset.ei].sets.splice(+el.dataset.si, 1); save(); render(); },
  setType(el){
    const ei = +el.dataset.ei, si = +el.dataset.si, s = ctxList().ex[ei].sets[si];
    sheet('Tipo de serie', Object.entries(SETT).map(([k,[l,name,c]]) => `<button class="opt" data-a="setTypePick" data-k="${k}" data-ei="${ei}" data-si="${si}" aria-checked="${s.t===k}"><span class="k ${c}">${l}</span>${name}</button>`).join('')
      + (cur().v === 'workout' ? `<div class="lbl" style="margin:14px 0 8px">RPE · esfuerzo percibido</div><div class="rpe">${RPE.map(r => `<button class="chip" data-a="rpePick" data-k="${r}" data-ei="${ei}" data-si="${si}" aria-pressed="${s.rpe===r}">${nf(r)}</button>`).join('')}</div>
         <div class="mut" style="font-size:12.5px;margin:8px 0 6px;min-height:18px">${s.rpe ? `RPE ${nf(s.rpe)}: ${RPE_TXT[s.rpe]}. Tócalo otra vez para quitarlo.` : '10 = no podías hacer ni una repetición más.'}</div>` : '')
      + `<button class="opt red" data-a="setTypePick" data-k="del" data-ei="${ei}" data-si="${si}"><span class="k">${ic('x','ico" style="width:16px;height:16px;margin:auto')}</span>Eliminar serie</button>`);
  },
  setTypePick(el){
    const e = ctxList().ex[+el.dataset.ei], si = +el.dataset.si;
    if (el.dataset.k === 'del') e.sets.splice(si, 1); else e.sets[si].t = el.dataset.k;
    close(); save(); render();
  },
  rpePick(el){
    const s = ctxList().ex[+el.dataset.ei].sets[+el.dataset.si], v = +el.dataset.k;
    s.rpe = s.rpe === v ? null : v; save(); render(); A.setType(el);
  },
  usePrev(el){
    const ei = +el.dataset.ei, si = +el.dataset.si, e = S.active.ex[ei], p = prevFor(e.id, e.sets, si);
    if (!p) return;
    for (const [f] of cols(EX(e.id).type)) setF(e.sets[si], f, getF(p, f));
    save(); render();
  },
  done(el){ markDone(+el.dataset.ei, +el.dataset.si, el.closest('.tr')); },
  restMenu(el){
    const ei = +el.dataset.ei, cur = ctxList().ex[ei].rest;
    sheet('Descanso entre series', [0,30,45,60,75,90,120,150,180,240,300].map(s => `<button class="opt" data-a="restPick" data-k="${s}" data-ei="${ei}" aria-checked="${cur===s}">${restLbl(s)}</button>`).join(''));
  },
  restPick(el){ ctxList().ex[+el.dataset.ei].rest = +el.dataset.k; close(); save(); render(); },
  restAdd(el){ const a = S.active; a.restEnd += +el.dataset.k*1000; a.restTotal = Math.max(a.restTotal + +el.dataset.k, 1); if (a.restEnd <= Date.now()) a.restEnd = null; save(); renderRest(); if (!a.restEnd) $('#restbar').innerHTML = ''; },
  restSkip(){ S.active.restEnd = null; save(); $('#restbar').innerHTML = ''; },
  exMenu(el){
    const ei = +el.dataset.ei, L = ctxList(), e = L.ex[ei], x = EX(e.id), live = cur().v === 'workout';
    sheet(esc(x.name), [
      ['go', 'Ver récords e historial', `data-v="ex" data-id="${x.id}"`],
      live && x.type === 'wr' ? ['warmup', 'Calentamiento automático'] : null,
      x.eq === 'barbell' ? ['plates', 'Calculadora de discos'] : null,
      ['replaceEx', 'Reemplazar ejercicio'],
      ['superset', e.ss != null ? 'Quitar de la superserie' : 'Superserie con el siguiente'],
      ei > 0 ? ['move', 'Mover arriba', 'data-k="-1"'] : null,
      ei < L.ex.length-1 ? ['move', 'Mover abajo', 'data-k="1"'] : null,
      ['removeEx', 'Quitar ejercicio', '', 'red'],
    ].filter(Boolean).map(([a,l,extra='',cls='']) => `<button class="opt ${cls}" data-a="${a}" data-ei="${ei}" ${extra}>${l}</button>`).join(''));
  },
  move(el){ const L = ctxList(), i = +el.dataset.ei, j = i + +el.dataset.k; [L.ex[i], L.ex[j]] = [L.ex[j], L.ex[i]]; close(); save(); render(); },
  removeEx(el){ ctxList().ex.splice(+el.dataset.ei, 1); close(); save(); render(); },
  superset(el){
    const L = ctxList(), i = +el.dataset.ei, e = L.ex[i];
    if (e.ss != null){ e.ss = null; }
    else if (L.ex[i+1]){ const id = L.ex[i+1].ss ?? Date.now() % 1e6; e.ss = id; L.ex[i+1].ss = id; }
    else { close(); return toast('Agrega otro ejercicio debajo para hacer superserie'); }
    close(); save(); render();
  },
  warmup(el){
    const e = S.active.ex[+el.dataset.ei];
    const first = e.sets.find(s => s.t !== 'w'), kg = first && (first.kg ?? first.ph?.kg ?? (lastSetsFor(e.id) || []).find(s => s.t !== 'w')?.kg);
    close();
    if (!kg) return toast('Escribe el peso de tu primera serie efectiva');
    const st = S.units === 'lb' ? 5/LB : 2.5, rd = v => Math.max(st, Math.round(v/st)*st);
    e.sets = e.sets.filter(s => s.t !== 'w' || s.done);
    e.sets.unshift(...[[.4,5],[.6,5],[.8,3]].map(([p,r]) => ({...newSet('w'), kg:rd(kg*p), reps:r})));
    save(); render(); toast('Se agregaron 3 series de calentamiento');
  },
  plates(el){
    const e = ctxList().ex[+el.dataset.ei], s = e.sets.find(s => !s.done && (s.kg || s.ph?.kg)) || e.sets[0];
    plateSheet(r2(toU(s?.kg ?? s?.ph?.kg ?? 60)));
  },
  plateCalc(){ plateSheet(parseFloat($('#pw').value.replace(',','.')) || 0); },
  newRoutine: () => go('routine', {draft:{id:uid(), title:'', notes:'', ex:[]}}),
  routineMenu(el){
    const id = el.dataset.id;
    sheet(esc(S.routines.find(r => r.id === id).title), `
      <button class="opt" data-a="editRoutine" data-id="${id}">Editar rutina</button>
      <button class="opt" data-a="dupRoutine" data-id="${id}">Duplicar</button>
      <button class="opt red" data-a="delRoutine" data-id="${id}">Eliminar rutina</button>`);
  },
  editRoutine(el){ close(); const r = S.routines.find(r => r.id === el.dataset.id); go('routine', {id:r.id, draft:clone(r)}); },
  dupRoutine(el){ close(); const r = clone(S.routines.find(r => r.id === el.dataset.id)); r.id = uid(); r.title += ' (copia)'; S.routines.push(r); save(); render(); },
  delRoutine(el){ const id = el.dataset.id; confirmBox('¿Eliminar rutina?', 'Los entrenos que ya hiciste con ella se conservan.', 'Eliminar', () => { S.routines = S.routines.filter(r => r.id !== id); save(); render(); }); },
  saveRoutine(){
    const d = cur().draft;
    if (!d.title.trim()) { $('#rtitle').focus(); return toast('Ponle nombre a la rutina'); }
    if (!d.ex.length) return toast('Agrega al menos un ejercicio');
    d.title = d.title.trim();
    const i = S.routines.findIndex(r => r.id === d.id);
    i < 0 ? S.routines.push(d) : (S.routines[i] = d);
    save(); TAB = 'train'; NAV = [{v:'train'}]; render(true); toast('Rutina guardada');
  },
  wvMenu(el){
    const id = el.dataset.id;
    sheet('', `<button class="opt" data-a="repeat" data-id="${id}">Repetir este entreno</button>
      <button class="opt" data-a="toRoutine" data-id="${id}">Guardar como rutina</button>
      <button class="opt red" data-a="delWorkout" data-id="${id}">Eliminar entreno</button>`);
  },
  delWorkout(el){ const id = el.dataset.id; confirmBox('¿Eliminar entreno?', 'No se puede deshacer.', 'Eliminar', () => { S.workouts = S.workouts.filter(w => w.id !== id); prCache.clear(); save(); NAV = [{v:TAB}]; render(true); }); },
  exTab(el){ cur().tab = el.dataset.k; render(); },
  exMet(el){ cur().met = el.dataset.k; render(); },
  meMet(el){ cur().met = el.dataset.k; render(); },
  newEx(){
    sheet('Ejercicio personalizado', `
      <div style="display:grid;gap:10px">
        <input class="field" id="nx-name" placeholder="Nombre del ejercicio">
        <label class="lbl">Tipo</label><select class="field" id="nx-type">${Object.entries(TYPE).map(([k,v]) => `<option value="${k}">${v}</option>`).join('')}</select>
        <label class="lbl">Músculo principal</label><select class="field" id="nx-m">${Object.entries(MUSCLE).map(([k,v]) => `<option value="${k}">${v}</option>`).join('')}</select>
        <label class="lbl">Equipo</label><select class="field" id="nx-eq">${Object.entries(EQUIP).map(([k,v]) => `<option value="${k}">${v}</option>`).join('')}</select>
        <button class="btn acc" data-a="saveEx" style="margin-top:6px">Crear ejercicio</button>
      </div>`);
    setTimeout(() => $('#nx-name').focus(), 50);
  },
  saveEx(){
    const name = $('#nx-name').value.trim();
    if (!name) return $('#nx-name').focus();
    const e = {id:'c' + uid(), name, m:$('#nx-m').value, sec:[], eq:$('#nx-eq').value, type:$('#nx-type').value, custom:true};
    S.custom.push(e); indexEx(); save(); close();
    const t = cur(); if (t.pick) t.sel.push(e.id);
    render(); toast('Ejercicio creado');
  },
  exDelete(el){
    const id = el.dataset.id, used = S.workouts.some(w => w.ex.some(e => e.id === id));
    confirmBox('¿Eliminar ejercicio?', used ? 'Ya aparece en tu historial; esos registros quedarán como «Ejercicio eliminado».' : 'Es un ejercicio personalizado.', 'Eliminar', () => {
      S.custom = S.custom.filter(e => e.id !== id); indexEx(); save(); back();
    });
  },
  addBody(){
    const last = S.body[S.body.length-1];
    sheet('Peso corporal', `<div style="display:grid;gap:10px"><input class="field" id="bw" inputmode="decimal" placeholder="Peso en ${u()}" value="${last ? r1(toU(last.kg)) : ''}" style="font-size:20px;font-weight:650;text-align:center">
      <button class="btn acc" data-a="saveBody">Guardar</button></div>`);
    setTimeout(() => $('#bw').select(), 50);
  },
  saveBody(){
    const v = parseFloat($('#bw').value.replace(',','.'));
    if (!(v > 0)) return $('#bw').focus();
    const today = new Date().setHours(0,0,0,0);
    S.body = S.body.filter(b => new Date(b.t).setHours(0,0,0,0) !== today);
    S.body.push({t:Date.now(), kg:fromU(v)}); save(); close(); render();
  },
  units(el){ S.units = el.dataset.k; save(); render(); },
  prevMode(){ S.prevMode = S.prevMode === 'routine' ? 'any' : 'routine'; save(); render(); },
  dbl(){ S.dbl = !S.dbl; prCache.clear(); save(); render(); },
  sound(){ S.sound = !S.sound; save(); render(); if (S.sound) beep(); },
  restDefault(){ sheet('Descanso por defecto', [0,30,45,60,75,90,120,150,180,240,300].map(s => `<button class="opt" data-a="restDefPick" data-k="${s}" aria-checked="${S.rest===s}">${restLbl(s)}</button>`).join('')); },
  restDefPick(el){ S.rest = +el.dataset.k; close(); save(); render(); },
  export(){ download(`serie-respaldo-${stamp()}.json`, JSON.stringify({...S, active:null}, null, 1), 'application/json'); },
  exportCsv(){ download(`serie-series-${stamp()}.csv`, csv(), 'text/csv'); },
  reseed(){ confirmBox('¿Restaurar datos de ejemplo?', 'Reemplaza tus entrenos, rutinas, comidas, movilidad y peso por el ejemplo de 8 semanas.', 'Borrar y restaurar', () => { const k = S.custom, n = blank(); n.custom = k; resetState(n); SEEDS.forEach(f => f()); saveNow(); tab('home'); }); },
  wipe(){ confirmBox('¿Borrar todo?', 'Entrenos, rutinas, comidas, sesiones de movilidad, ejercicios personalizados y peso. No se puede deshacer.', 'Borrar todo', () => { resetState(blank()); saveNow(); tab('home'); }); },
});

function plateSheet(target){
  const kgMode = S.units === 'kg', barW = kgMode ? 20 : 45;
  const plates = kgMode ? [25,20,15,10,5,2.5,1.25] : [45,35,25,10,5,2.5];
  const color = {25:'#e5484d',20:'#3e7bfa',15:'#e0a83a',10:'#3fae6a',5:'#f2f0ec',2.5:'#8b9098',1.25:'#5f656e',45:'#3e7bfa',35:'#e0a83a'};
  let side = Math.max(0, (target - barW) / 2); const use = [];
  for (const p of plates) while (side >= p - 1e-9){ use.push(p); side = r2(side - p); }
  const total = barW + 2*use.reduce((a,b) => a+b, 0);
  const vis = use.map(p => `<span class="pl" style="background:${color[p]};height:${40 + p/plates[0]*60}px;width:${p >= 10 ? 16 : 11}px">${p}</span>`);
  sheet('Calculadora de discos', `
    <div style="display:flex;gap:8px"><input class="field" id="pw" inputmode="decimal" value="${target}" style="font-size:18px;font-weight:650"><button class="btn acc sm" data-a="plateCalc">Calcular</button></div>
    <div class="plates">${vis.slice().reverse().join('')}<span class="barr"></span>${vis.join('')}</div>
    <div class="kv"><span>Barra</span><span class="num">${barW} ${u()}</span></div>
    <div class="kv"><span>Por lado</span><span class="num">${use.length ? use.join(' + ') : '—'}</span></div>
    <div class="kv"><span>Total cargado</span><span class="num">${nf(total,2)} ${u()}${Math.abs(total-target) > .01 ? ' <span class="mut">(lo más cercano)</span>' : ''}</span></div>`);
}

document.addEventListener('input', ev => {
  const el = ev.target;
  if (el.id === 'q'){ const t = cur(); t.q = el.value; $('#libList').innerHTML = libList(t); return; }
  if (el.dataset.rf){ cur().draft[el.dataset.rf] = el.value; return; }
  if (el.dataset.note != null){ ctxList().ex[+el.dataset.note].notes = el.value; autosize(); save(); return; }
  if (el.dataset.f){
    const L = ctxList(), s = L.ex[+el.dataset.ei].sets[+el.dataset.si];
    const raw = el.value.replace(',', '.').trim(), v = raw === '' ? null : parseFloat(raw);
    // en rutinas, «8-12» es un rango objetivo de repeticiones
    const rr = el.dataset.f === 'reps' && cur().v === 'routine' && raw.match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (rr){ s.rr = [+rr[1], +rr[2]].sort((a,b) => a-b); s.reps = null; save(); return; }
    if (el.dataset.f === 'reps') s.rr = null;
    setF(s, el.dataset.f, v == null || isNaN(v) ? null : v);
    save();
    if (cur().v === 'workout' && s.done){ const {v:vv} = liveStats(); const w = $('#wvol'); if (w) w.textContent = vol(vv); }
  }
});
// Enter en un campo de serie salta al siguiente
document.addEventListener('keydown', ev => {
  if (ev.key !== 'Enter' || !ev.target.dataset.f) return;
  ev.preventDefault();
  const all = [...document.querySelectorAll('input[data-f]')], i = all.indexOf(ev.target);
  all[i+1] ? all[i+1].focus() : ev.target.blur();
});
function autosize(){ document.querySelectorAll('textarea[data-note]').forEach(t => { t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }); }

/* ---------- ganchos del núcleo ---------- */
HOOKS.reset.push(() => { indexEx(); prCache.clear(); });
HOOKS.tick.push(tick);
HOOKS.boot.push(() => { if (S.active){ NAV = [{v:'home'}]; nav([{v:'home'}, {v:'workout'}]); } });
HOOKS.render.push((t, root) => {
  $('#app').classList.toggle('wk', t.v === 'workout');
  $('#resume').innerHTML = S.active && root
    ? `<div class="resume"><button data-a="resume"><span class="pulse"></span><span style="flex:1"><b style="font-size:14px">Entreno en curso</b><br><span class="mut num" style="font-size:12.5px" data-clock>${clock((Date.now()-S.active.start)/1000)}</span><span class="mut" style="font-size:12.5px"> · ${esc(S.active.title)}</span></span><span class="link">Reanudar</span></button></div>` : '';
  renderRest();
});

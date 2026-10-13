'use strict';
/* =====================================================================
   MOVILIDAD — rutinas guiadas y test de movilidad con la cámara.
   El test sigue el protocolo descrito en docs/ANALISIS.md §7 (2 movimientos
   × 3 vistas, compensaciones de 0 a 1, puntaje por articulación) con
   medidas, umbrales y código propios. Detección de pose: MediaPipe
   (vendor/mediapipe, Apache-2.0), corre en el teléfono, sin red.
   ===================================================================== */

BLANKS.push(() => ({mov:{sessions:[], tests:[], custom:[], voice:true}}));
TABS.splice(3, 0, ['mov','Movilidad','flex']);
I.flex = '<circle cx="12" cy="4.5" r="2"/><path d="M12 7v6l-4 7M12 13l4 7M6 9.5l6-1 6 1"/>';
I.pause = '<path d="M8 5v14M16 5v14"/>';
I.skip = '<path d="M6 5l9 7-9 7zM18 5v14"/>';
I.prev = '<path d="M18 5l-9 7 9 7zM6 5v14"/>';
I.cam = '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>';
I.vol = '<path d="M4 9v6h4l5 4V5L8 9zM16.5 8.5a5 5 0 0 1 0 7"/>';

document.head.insertAdjacentHTML('beforeend', `<style>
  .zchip{display:inline-block;font-size:11px;padding:2px 7px;border-radius:6px;background:var(--card-2);color:var(--mut);margin:2px 4px 0 0}
  .rcard{display:flex;gap:12px;align-items:center;width:100%;text-align:left;padding:10px 14px;border-top:1px solid var(--line-2)}
  .rcard:first-child{border-top:0}
  .rcard .pose{background:var(--card-2);border-radius:10px}
  .play{position:fixed;inset:0;z-index:40;background:var(--bg);display:flex;flex-direction:column;align-items:center;
        padding:calc(12px + env(safe-area-inset-top)) 16px calc(16px + env(safe-area-inset-bottom))}
  .play .top{display:flex;align-items:center;gap:8px;width:100%;max-width:560px}
  .play .prog{display:flex;gap:3px;width:100%;max-width:560px;margin:10px 0 6px}
  .play .prog i{flex:1;height:4px;border-radius:2px;background:var(--line)}
  .play .prog i.on{background:var(--acc)} .play .prog i.cur{background:var(--ink-2)}
  .play .fig{flex:1;display:grid;place-items:center;width:100%;min-height:0}
  .play .fig svg{width:min(78vw,340px);height:auto}
  .play .clk{font-size:64px;font-weight:700;font-variant-numeric:tabular-nums;letter-spacing:-.03em;line-height:1}
  .play .ctl{display:flex;gap:18px;align-items:center;justify-content:center;margin-top:14px}
  .play .ctl button{width:56px;height:56px;border-radius:50%;display:grid;place-items:center;background:var(--card-2);border:1px solid var(--line)}
  .play .ctl button.big{width:74px;height:74px;background:var(--acc);color:var(--acc-ink);border-color:var(--acc)}
  .play .ctl .ico{width:24px;height:24px}
  .test{position:fixed;inset:0;z-index:40;background:#000;display:flex;flex-direction:column}
  .test video,.test canvas{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform:scaleX(-1)}
  .test .hud{position:relative;z-index:2;display:flex;flex-direction:column;height:100%;padding:calc(12px + env(safe-area-inset-top)) 14px calc(18px + env(safe-area-inset-bottom));pointer-events:none}
  .test .hud>*{pointer-events:auto}
  .test .msg{background:rgba(14,15,18,.82);border-radius:14px;padding:12px 14px;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
  .jrow{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .jbox{background:var(--card-2);border-radius:10px;padding:9px 11px}
  .jbox .v{font-size:18px;font-weight:700;font-variant-numeric:tabular-nums}
</style>`);

/* ---------- catálogo ---------- */
let PMAP = null;
function poseIndex(){ PMAP = {}; for (const [id,name,zones,secs,bi,txt,fig] of POSES) PMAP[id] = {id, name, zones, secs, bi, txt, fig}; }
const POSE = id => { if (!PMAP) poseIndex(); return PMAP[id]; };

const ROUTINES = [
  {id:'manana', title:'Despertar', desc:'Para empezar el día suelto.', items:[['gato_vaca',45],['perro',45],['zancada',35],['rotacion',30],['lateral',30],['brazos_arriba',30],['pinza_pie',40]]},
  {id:'cadera', title:'Cadera abierta', desc:'Flexores, glúteos y aductores.', items:[['zancada',45],['lagartija',40],['paloma',60],['p9090',45],['mariposa',60],['rana',45],['figura4',45]]},
  {id:'espalda', title:'Espalda baja', desc:'Alivio después de estar sentado o cargar.', items:[['rodillas_pecho',45],['torsion',40],['gato_vaca',45],['nino',60],['esfinge',45],['puente',40],['bebe',45]]},
  {id:'hombros', title:'Hombros y espalda alta', desc:'Postura y rango de movimiento por encima de la cabeza.', items:[['hilo_aguja',40],['rotacion',30],['marco',40],['cruzado',30],['triceps',30],['banco',45],['nino',45]]},
  {id:'sentadilla', title:'Mejor sentadilla', desc:'Tobillos y cadera para bajar más profundo.', items:[['tobillo',40],['pantorrilla',40],['cosaco',30],['rana',45],['sentadilla',60],['zancada',40]]},
  {id:'post_pierna', title:'Después de pierna', desc:'Recupera cuádriceps, isquios y glúteos.', items:[['cuadriceps_pie',40],['isquio_sentado',60],['paloma',50],['pantorrilla',40],['mariposa',45],['figura4',45]]},
  {id:'post_empuje', title:'Después de empuje', desc:'Pecho, hombros y tríceps.', items:[['marco',40],['triceps',30],['cruzado',30],['cobra',40],['nino',45],['munecas',30]]},
  {id:'post_jalon', title:'Después de jalón', desc:'Dorsales, espalda alta y antebrazos.', items:[['banco',45],['hilo_aguja',40],['lateral',30],['cuello_lateral',30],['rotacion',30],['munecas',30]]},
  {id:'correr', title:'Para correr', desc:'Pantorrillas, tobillos e isquios.', items:[['pantorrilla',40],['tobillo',35],['cuadriceps_pie',40],['isquio_pie',40],['zancada',40],['paloma',45]]},
  {id:'escritorio', title:'Pausa de escritorio', desc:'Cuello, pecho y muñecas en pocos minutos.', items:[['cuello_lateral',30],['cuello_flexion',30],['marco',30],['lateral',30],['munecas',30],['isquio_pie',30]]},
  {id:'noche', title:'Antes de dormir', desc:'Lento y en el piso para bajar revoluciones.', items:[['nino',60],['mariposa',60],['bebe',45],['figura4',45],['torsion',45],['rodillas_pecho',45]]},
  {id:'completo', title:'Cuerpo completo', desc:'Sesión larga de pies a cabeza.', items:[['gato_vaca',45],['perro',45],['zancada',40],['paloma',60],['isquio_sentado',60],['mariposa',45],['sentadilla',45],['hilo_aguja',35],['marco',35],['banco',45],['cuello_lateral',30],['nino',60]]},
];
const routineSecs = items => items.reduce((s,[id,sec]) => { const p = POSE(id); return s + (sec || p.secs) * (p.bi ? 2 : 1) + 5; }, 0);
const routineZones = items => { const c = {}; for (const [id] of items) for (const z of POSE(id).zones) c[z] = (c[z] || 0) + 1; return Object.entries(c).sort((a,b) => b[1]-a[1]).map(([z]) => z); };
const mins = s => Math.max(1, Math.round(s/60)) + ' min';

// arma una rutina con las posturas que más cubren las zonas pedidas (peso por zona)
function genRoutine(weights, n = 7){
  const used = new Set(), out = [];
  const score = p => p.zones.reduce((s,z) => s + (weights[z] || 0), 0);
  for (let i = 0; i < n; i++){
    let best = null, bs = 0;
    for (const p of Object.values(PMAP || (poseIndex(), PMAP))){ if (used.has(p.id)) continue; const s = score(p) - out.filter(([id]) => POSE(id).zones[0] === p.zones[0]).length * .6; if (s > bs){ bs = s; best = p; } }
    if (!best) break;
    used.add(best.id); out.push([best.id, best.secs]);
    for (const z of best.zones) weights[z] = (weights[z] || 0) * .7;        // variedad: baja el peso de lo ya cubierto
  }
  return out;
}
const MUSCLE_ZONE = {chest:'pecho', lats:'dorsales', upper_back:'espalda_alta', lower_back:'espalda_baja', shoulders:'hombros', biceps:'hombros', triceps:'hombros',
  forearms:'munecas', traps:'cuello', abdominals:'espalda_baja', quadriceps:'cuadriceps', hamstrings:'isquios', glutes:'gluteos', calves:'pantorrillas', adductors:'aductores', abductors:'cadera'};
function recommended(){
  const w = {}, why = [];
  const lt = S.mov.tests[S.mov.tests.length - 1];
  if (lt && Date.now() - lt.t < 45*DAY && lt.zones.length){ lt.zones.forEach((z,i) => w[z] = (w[z] || 0) + 3 - i*.4); why.push('tu test de movilidad'); }
  const lw = sorted()[0];
  if (lw && Date.now() - lw.start < 2.5*DAY){
    for (const e of lw.ex){ const x = EX(e.id), z = MUSCLE_ZONE[x.m]; if (z) w[z] = (w[z] || 0) + 1.5; for (const m of x.sec) if (MUSCLE_ZONE[m]) w[MUSCLE_ZONE[m]] = (w[MUSCLE_ZONE[m]] || 0) + .5; }
    why.push('tu entreno de ' + lw.title.toLowerCase());
  }
  if (!why.length) return null;
  return {id:'rec', title:'Rutina para ti', desc:'Según ' + why.join(' y ') + '.', items:genRoutine(w, 7)};
}
function getRoutine(id){
  if (id === 'rec') return recommended();
  if (id && id.startsWith('fix:')){ const t = S.mov.tests.find(t => t.id === id.slice(4)); if (!t) return null; const w = {}; t.zones.forEach((z,i) => w[z] = 4 - i*.5); return {id, title:'Para mejorar tu test', desc:'Zonas: ' + t.zones.map(z => ZONE[z]).join(', ') + '.', items:genRoutine(w, 8)}; }
  return ROUTINES.find(r => r.id === id) || S.mov.custom.find(r => r.id === id) || null;
}

/* ---------- vistas ---------- */
function routineCard(r){
  const sec = routineSecs(r.items), z = routineZones(r.items).slice(0, 3);
  return `<button class="rcard" data-a="go" data-v="mroutine" data-id="${esc(r.id)}">
    ${poseSvg(POSE(r.items[0][0]).fig, {size:64})}
    <div style="flex:1;min-width:0"><div class="tt" style="font-weight:640">${esc(r.title)}</div>
    <div class="dd" style="font-size:12.5px;color:var(--mut)">${mins(sec)} · ${r.items.length} posturas</div>
    <div>${z.map(k => `<span class="zchip">${ZONE[k]}</span>`).join('')}</div></div></button>`;
}
VIEWS.mov = () => {
  const m = S.mov, now = Date.now(), wk = weekStart(now);
  const weekMin = m.sessions.filter(s => s.t >= wk).reduce((a,s) => a + s.secs, 0) / 60;
  const weeks = []; for (let i = 7; i >= 0; i--){ const a = weekStart(wk - i*7*DAY + DAY), b = a + 7*DAY; weeks.push({label:DFS.format(a), v:m.sessions.filter(s => s.t >= a && s.t < b).reduce((x,s) => x + s.secs/60, 0)}); }
  let streak = 0, ws = wk; const wset = new Set(m.sessions.map(s => weekStart(s.t)));
  if (!wset.has(ws)) ws = weekStart(ws - 3*DAY); while (wset.has(ws)){ streak++; ws = weekStart(ws - 3*DAY); }
  const lt = m.tests[m.tests.length - 1], rec = recommended();
  return {
    title:'Movilidad',
    right:`<button class="ib" data-a="movCfg" aria-label="Ajustes">${ic('gear')}</button>`,
    body:`
      ${lt ? `<button class="card p" style="display:flex;width:calc(100% - 32px);gap:14px;align-items:center;text-align:left" data-a="go" data-v="mres" data-id="${lt.id}">
          ${scoreRing(lt.scores.overall)}
          <div style="flex:1;min-width:0"><div class="lbl">Tu movilidad</div><div class="h2" style="margin:2px 0">${scoreWord(lt.scores.overall)}</div>
          <div class="mut" style="font-size:12.5px">Test del ${DFS.format(lt.t)}${lt.demo ? ' (ejemplo)' : ''}. Trabajar: ${lt.zones.slice(0,3).map(z => ZONE[z]).join(', ') || '—'}</div></div></button>
        <div class="pad" style="margin-top:8px"><button class="btn sm" style="width:100%" data-a="go" data-v="mtest">${ic('cam')}Repetir el test</button></div>`
      : `<div class="card p" style="border-color:var(--acc)"><b>Mide tu movilidad</b><div class="mut" style="font-size:13.5px;margin:4px 0 10px">Un test de 3 minutos con la cámara: brazos arriba y sentadilla, de frente y de lado. Te da un puntaje por articulación y una rutina para lo que más necesitas.</div><button class="btn acc" data-a="go" data-v="mtest">${ic('cam')}Hacer el test</button></div>`}
      <div class="card p"><div class="stats"><div><div class="lbl">Esta semana</div><div class="v num">${Math.round(weekMin)} min</div></div>
        <div><div class="lbl">Racha</div><div class="v num">${streak} sem</div></div><div><div class="lbl">Sesiones</div><div class="v num">${m.sessions.length}</div></div></div>
        ${barChart(weeks)}</div>
      ${rec ? `<div class="sec"><span class="lbl">Recomendada</span></div><div class="card">${routineCard(rec)}</div>` : ''}
      <div class="sec"><span class="lbl">Rutinas</span><button class="link" data-a="go" data-v="mlib">Posturas</button></div>
      <div class="card">${ROUTINES.map(routineCard).join('')}</div>
      <div class="sec"><span class="lbl">Mis rutinas</span><button class="link" data-a="go" data-v="medit">+ Crear</button></div>
      ${m.custom.length ? `<div class="card">${m.custom.map(routineCard).join('')}</div>` : '<div class="mut pad" style="font-size:13px">Arma la tuya con las posturas que te sirven.</div>'}
      <div style="height:24px"></div>`
  };
};

VIEWS.mroutine = t => {
  const r = getRoutine(t.id);
  if (!r) return {title:'', body:'<div class="empty"><b>Rutina no encontrada</b></div>'};
  if (t.id === 'rec' || t.id.startsWith('fix:')) t.items = t.items || r.items;           // fija la rutina generada mientras la ves
  const items = t.items || r.items, custom = S.mov.custom.includes(r);
  return {
    title:esc(r.title),
    right: custom ? `<button class="bb ghost" data-a="go" data-v="medit" data-id="${r.id}">Editar</button>` : '',
    body:`
      <div class="pad" style="padding-top:14px"><div class="mut" style="font-size:14px">${esc(r.desc || '')}</div>
        <div class="stats" style="margin-top:12px"><div><div class="lbl">Duración</div><div class="v">${mins(routineSecs(items))}</div></div><div><div class="lbl">Posturas</div><div class="v">${items.length}</div></div><div><div class="lbl">Zonas</div><div class="v">${routineZones(items).length}</div></div></div>
        <div style="margin-top:8px">${routineZones(items).map(z => `<span class="zchip">${ZONE[z]}</span>`).join('')}</div></div>
      <div class="card" style="margin-top:14px">${items.map(([id,sec]) => { const p = POSE(id); return `<button class="rcard" data-a="go" data-v="pose" data-id="${id}">${poseSvg(p.fig, {size:58})}
        <div style="flex:1;min-width:0"><div style="font-weight:620">${p.name}</div><div class="mut" style="font-size:12.5px">${p.bi ? `${sec || p.secs} s por lado` : `${sec || p.secs} s`}</div></div></button>`; }).join('')}</div>
      <div style="height:90px"></div>
      <div class="float"><button class="btn acc" data-a="playStart">${ic('play')}Empezar</button></div>`
  };
};

VIEWS.pose = t => {
  const p = POSE(t.id);
  return {
    title:p.name,
    body:`<div style="display:grid;place-items:center;padding:20px 16px 6px">${poseSvg(p.fig, {size:260})}</div>
      <div class="pad"><div>${p.zones.map(z => `<span class="zchip">${ZONE[z]}</span>`).join('')}</div>
      <p style="font-size:15px;line-height:1.55;color:var(--ink-2)">${p.txt}</p>
      <div class="mut" style="font-size:13px">${p.bi ? `De un lado y luego del otro, ${p.secs} s cada uno.` : `Sostén ${p.secs} s.`} Respira lento; el estiramiento se siente, no duele.</div></div>`
  };
};

VIEWS.mlib = t => {
  t.z = t.z || '';
  const list = POSES.map(r => POSE(r[0])).filter(p => !t.z || p.zones.includes(t.z));
  const pick = t.pick || t.id === 'pick';
  return {
    title: pick ? 'Agregar postura' : 'Posturas',
    body:`<div class="chips" style="padding-top:12px"><button class="chip" data-a="mlibZ" data-k="" aria-pressed="${!t.z}">Todas</button>${Object.entries(ZONE).map(([k,l]) => `<button class="chip" data-a="mlibZ" data-k="${k}" aria-pressed="${t.z===k}">${l}</button>`).join('')}</div>
      <div class="card">${list.map(p => `<button class="rcard" data-a="${pick ? 'meditAdd' : 'go'}" data-v="pose" data-id="${p.id}" data-k="${p.id}">${poseSvg(p.fig, {size:58})}
        <div style="flex:1;min-width:0"><div style="font-weight:620">${p.name}</div><div>${p.zones.map(z => `<span class="zchip">${ZONE[z]}</span>`).join('')}</div></div>${pick ? `<span class="link">${ic('plus')}</span>` : ''}</button>`).join('')}</div>
      <div style="height:20px"></div>`
  };
};

VIEWS.medit = t => {
  if (!t.draft){ const r = t.id && S.mov.custom.find(r => r.id === t.id); t.draft = r ? clone(r) : {id:uid(), title:'Mi rutina', desc:'', items:[]}; }
  const d = t.draft;
  return {
    title: t.id ? 'Editar rutina' : 'Nueva rutina',
    right:`<button class="bb acc" data-a="meditSave">Guardar</button>`,
    body:`<div class="pad" style="padding-top:14px;display:grid;gap:10px">
        <input class="field" id="me_title" value="${esc(d.title)}" placeholder="Nombre" style="font-size:17px;font-weight:640">
        <div class="mut" style="font-size:12.5px">${d.items.length ? mins(routineSecs(d.items)) + ' · toca los segundos para cambiarlos' : 'Agrega posturas para armar tu rutina.'}</div></div>
      <div class="card">${d.items.map(([id,sec],i) => { const p = POSE(id); return `<div class="rcard">${poseSvg(p.fig, {size:50})}
        <div style="flex:1;min-width:0"><div style="font-weight:620;font-size:14px">${p.name}</div><button class="link" data-a="meditSec" data-k="${i}">${sec} s${p.bi ? ' por lado' : ''}</button></div>
        <button class="ib" data-a="meditMv" data-k="${i}" data-d="-1" aria-label="Subir" ${i ? '' : 'disabled style="opacity:.3"'}>${ic('back')}</button>
        <button class="ib" data-a="meditDel" data-k="${i}" aria-label="Quitar">${ic('x')}</button></div>`; }).join('') || '<div class="empty" style="padding:22px">Sin posturas</div>'}</div>
      <div class="pad" style="margin-top:12px;display:grid;gap:8px"><button class="btn" data-a="go" data-v="mlib" data-id="pick">${ic('plus')}Agregar postura</button>
      ${t.id ? `<button class="btn red" data-a="meditRm">Eliminar rutina</button>` : ''}</div><div style="height:20px"></div>`
  };
};

/* ---------- reproductor ---------- */
let PLAY = null, PLAYT = null, WAKE = null;
// en el APK la voz y la pantalla encendida van por plugins nativos; en la web, por el navegador
const NATIVE = () => (window.Capacitor && window.Capacitor.Plugins) || {};
function speak(txt){
  if (!S.mov.voice) return;
  const tts = NATIVE().TextToSpeech;
  if (tts){ tts.stop().catch(() => {}).finally(() => tts.speak({text:txt, lang:'es-MX', rate:1, category:'playback'}).catch(() => {})); return; }
  if (!window.speechSynthesis) return;
  try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(txt); u.lang = 'es-MX'; u.rate = 1; speechSynthesis.speak(u); } catch(e){}
}
function hush(){ const tts = NATIVE().TextToSpeech; if (tts) tts.stop().catch(() => {}); try { speechSynthesis.cancel(); } catch(e){} }
function tock(f = 660){
  if (!S.sound) return;
  try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); const o = audio.createOscillator(), g = audio.createGain(); o.frequency.value = f; o.connect(g); g.connect(audio.destination); const t0 = audio.currentTime; g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(.18, t0 + .01); g.gain.exponentialRampToValueAtTime(.0001, t0 + .12); o.start(t0); o.stop(t0 + .13); } catch(e){}
}
async function wake(on){
  const ka = NATIVE().KeepAwake;
  if (ka){ try { on ? await ka.keepAwake() : await ka.allowSleep(); } catch(e){} return; }
  try { if (on && navigator.wakeLock && !WAKE) WAKE = await navigator.wakeLock.request('screen'); else if (!on && WAKE){ await WAKE.release(); WAKE = null; } } catch(e){}
}
const PREP = 5;
function startPlay(r, items){
  const steps = [];
  for (const [id,sec] of items){ const p = POSE(id), s = sec || p.secs; if (p.bi){ steps.push({id, side:'Lado izquierdo', secs:s}); steps.push({id, side:'Lado derecho', secs:s}); } else steps.push({id, side:'', secs:s}); }
  PLAY = {title:r.title, rid:r.id, steps, i:0, phase:'prep', left:PREP, paused:false, start:Date.now(), active:0, last:Date.now(), said:-1};
  wake(true);
  go('play');
  announce();
  clearInterval(PLAYT); PLAYT = setInterval(playTick, 200);
}
function announce(){
  const st = PLAY.steps[PLAY.i], p = POSE(st.id);
  if (PLAY.phase === 'prep'){
    const sameAsPrev = PLAY.i > 0 && PLAY.steps[PLAY.i-1].id === st.id;
    speak(sameAsPrev ? 'Cambia de lado' : (PLAY.i ? 'Sigue: ' : 'Empezamos con ') + p.name + (st.side && !sameAsPrev ? ', ' + st.side.toLowerCase() : ''));
  }
}
function playTick(){
  if (!PLAY) return clearInterval(PLAYT);
  if (cur().v !== 'play'){ endPlay(false); return; }
  const now = Date.now(), dt = (now - PLAY.last) / 1000; PLAY.last = now;
  if (PLAY.paused) return;
  PLAY.left -= dt;
  if (PLAY.phase === 'hold') PLAY.active += dt;
  const s = Math.ceil(PLAY.left);
  if (s <= 3 && s > 0 && s !== PLAY.said){ PLAY.said = s; tock(PLAY.phase === 'prep' ? 520 : 660); }
  if (PLAY.left <= 0){
    PLAY.said = -1;
    if (PLAY.phase === 'prep'){ PLAY.phase = 'hold'; PLAY.left = PLAY.steps[PLAY.i].secs; tock(880); }
    else if (PLAY.i < PLAY.steps.length - 1){ PLAY.i++; PLAY.phase = 'prep'; PLAY.left = PREP; beep(); announce(); }
    else { beep(); speak('Terminaste. Buen trabajo'); return endPlay(true); }
    return render();
  }
  const c = $('#pclk'); if (c) c.textContent = clock(Math.max(0, Math.ceil(PLAY.left)));
  const ar = $('#parc'); if (ar){ const tot = PLAY.phase === 'prep' ? PREP : PLAY.steps[PLAY.i].secs; ar.style.strokeDashoffset = (2*Math.PI*46 * (1 - Math.max(0, PLAY.left)/tot)).toFixed(1); }
}
function endPlay(done){
  clearInterval(PLAYT); wake(false);
  if (!PLAY) return;
  const P = PLAY; PLAY = null;
  if (done || P.active > 60){
    const n = done ? P.steps.length : P.i;
    S.mov.sessions.push({id:uid(), t:P.start, title:P.title, rid:P.rid, secs:Math.round(P.active), n});
    save();
  }
  hush();
  if (done){ NAV[NAV.length-1] = {v:'mdone', secs:Math.round(P.active), title:P.title, n:P.steps.length}; render(true); }
}
VIEWS.play = () => {
  const P = PLAY;
  if (!P) return {title:'', body:'<div class="empty"><b>Sesión terminada</b></div>'};
  const st = P.steps[P.i], p = POSE(st.id), nx = P.steps[P.i + 1], prep = P.phase === 'prep';
  const tot = prep ? PREP : st.secs, C = 2*Math.PI*46;
  return {title:'', body:`<div class="play">
    <div class="top"><button class="ib" data-a="playX" aria-label="Terminar">${ic('x')}</button><div class="mut" style="flex:1;text-align:center;font-size:13px">${esc(P.title)} · ${P.i + 1} de ${P.steps.length}</div><button class="ib" data-a="playVoice" aria-label="Voz" style="opacity:${S.mov.voice ? 1 : .35}">${ic('vol')}</button></div>
    <div class="prog">${P.steps.map((_,i) => `<i class="${i < P.i ? 'on' : i === P.i ? 'cur' : ''}"></i>`).join('')}</div>
    <div class="lbl" style="margin-top:8px;color:${prep ? 'var(--warm)' : 'var(--acc)'}">${prep ? 'Prepárate' : 'Sostén'}</div>
    <div class="h1" style="text-align:center;margin-top:4px">${p.name}</div>
    <div class="mut" style="font-size:14px;margin-top:2px;min-height:20px">${st.side}</div>
    <div class="fig">${poseSvg(p.fig, {size:340})}</div>
    <div style="position:relative;width:120px;height:120px;display:grid;place-items:center">
      <svg viewBox="0 0 100 100" width="120" height="120" style="position:absolute;inset:0"><circle cx="50" cy="50" r="46" fill="none" stroke="var(--line)" stroke-width="5"/>
        <circle id="parc" cx="50" cy="50" r="46" fill="none" stroke="${prep ? 'var(--warm)' : 'var(--acc)'}" stroke-width="5" stroke-linecap="round" stroke-dasharray="${C.toFixed(1)}" style="stroke-dashoffset:${(C*(1 - P.left/tot)).toFixed(1)};transition:stroke-dashoffset .2s linear" transform="rotate(-90 50 50)"/></svg>
      <div class="clk" id="pclk" style="font-size:38px">${clock(Math.max(0, Math.ceil(P.left)))}</div></div>
    <div class="mut" style="font-size:13px;text-align:center;max-width:520px;margin-top:10px;line-height:1.45;min-height:38px">${prep ? p.txt : nx ? 'Después: ' + POSE(nx.id).name + (nx.side ? ' · ' + nx.side.toLowerCase() : '') : 'Última postura'}</div>
    <div class="ctl"><button data-a="playMv" data-k="-1" aria-label="Anterior">${ic('prev')}</button>
      <button class="big" data-a="playPause" aria-label="${P.paused ? 'Seguir' : 'Pausa'}">${ic(P.paused ? 'play' : 'pause')}</button>
      <button data-a="playMv" data-k="1" aria-label="Siguiente">${ic('skip')}</button></div>
  </div>`};
};
VIEWS.mdone = t => ({
  title:'',
  body:`<div class="done-hero"><div class="n">Sesión completa</div><div class="h1" style="margin-top:6px">${esc(t.title)}</div></div>
    <div class="card p"><div class="stats"><div><div class="lbl">Tiempo</div><div class="v">${clock(t.secs)}</div></div><div><div class="lbl">Posturas</div><div class="v">${t.n}</div></div><div><div class="lbl">Esta semana</div><div class="v">${S.mov.sessions.filter(s => s.t >= weekStart(Date.now())).length} sesiones</div></div></div></div>
    <div class="pad" style="margin-top:16px"><button class="btn acc" data-a="tab" data-k="mov">Listo</button></div>`
});

/* ---------- test de movilidad ---------- */
const TEST_STEPS = [
  {mv:'flex', dir:'front', title:'Brazos arriba · de frente', tip:'Párate de frente a la cámara con todo el cuerpo a la vista. Sube los brazos estirados por encima de la cabeza y quédate quieto.'},
  {mv:'flex', dir:'left', title:'Brazos arriba · lado izquierdo', tip:'Gira para que tu lado izquierdo quede hacia la cámara. Brazos estirados arriba, quieto.'},
  {mv:'flex', dir:'right', title:'Brazos arriba · lado derecho', tip:'Ahora tu lado derecho hacia la cámara. Brazos arriba, quieto.'},
  {mv:'squat', dir:'front', title:'Sentadilla · de frente', tip:'De frente, brazos arriba. Baja en sentadilla lo más profundo que puedas sin despegar los talones y sostén.'},
  {mv:'squat', dir:'left', title:'Sentadilla · lado izquierdo', tip:'Lado izquierdo hacia la cámara. Brazos arriba, baja en sentadilla y sostén.'},
  {mv:'squat', dir:'right', title:'Sentadilla · lado derecho', tip:'Lado derecho hacia la cámara. Brazos arriba, baja en sentadilla y sostén.'},
];
const HOLD_MS = 3500;
const LM = {nose:0, earL:7, earR:8, shL:11, shR:12, elL:13, elR:14, wrL:15, wrR:16, hipL:23, hipR:24, knL:25, knR:26, anL:27, anR:28, heL:29, heR:30, toL:31, toR:32};
const COMP = {
  head:['Cabeza adelantada', 'La cabeza se va al frente de los hombros: suele venir de pecho cerrado y espalda alta rígida.', ['cuello','pecho','espalda_alta']],
  shrug:['Hombros encogidos', 'Al subir los brazos los hombros se acercan a las orejas.', ['hombros','cuello','espalda_alta']],
  elbows:['Codos doblados', 'No logras estirar del todo los brazos por encima de la cabeza.', ['hombros','dorsales']],
  arch:['Espalda arqueada', 'Para subir los brazos arqueas la espalda baja en vez de mover los hombros.', ['cadera','cuadriceps','dorsales','espalda_baja']],
  armsFwd:['Brazos caen al frente', 'Los brazos no llegan a la vertical: falta movilidad de hombro y espalda alta.', ['dorsales','pecho','espalda_alta','hombros']],
  valgus:['Rodillas hacia dentro', 'En la sentadilla las rodillas se juntan.', ['tobillos','pantorrillas','aductores','gluteos','cadera']],
  varus:['Rodillas hacia fuera', 'En la sentadilla las rodillas se abren más que los pies.', ['gluteos','aductores','cadera']],
  shift:['Peso cargado a un lado', 'Al bajar, la cadera se desplaza hacia un lado.', ['cadera','pantorrillas','aductores']],
  lean:['Tronco inclinado al frente', 'El pecho cae al frente mucho más que las espinillas.', ['tobillos','pantorrillas','cuadriceps','cadera']],
  depth:['Sentadilla poco profunda', 'La cadera no llega cerca de la altura de las rodillas.', ['tobillos','cadera','gluteos','aductores']],
  heels:['Talones despegados', 'Los talones se levantan al bajar: falta movilidad de tobillo.', ['pantorrillas','tobillos']],
};
const JOINTS = {
  espalda:['Espalda', ['lean','arch','armsFwd','head']],
  hombro:['Hombro', ['arch','armsFwd','head','shrug','elbows']],
  codo:['Codo', ['armsFwd','elbows']],
  cadera:['Cadera', ['valgus','varus','shift','lean','arch','depth']],
  rodilla:['Rodilla', ['valgus','varus','shift','depth']],
  tobillo:['Tobillo', ['valgus','varus','shift','lean','heels','depth']],
};
const MT = {
  P: (lm, i, W, H) => ({x:lm[i].x*W, y:lm[i].y*H, v:lm[i].visibility ?? 1, z:lm[i].z}),
  dist: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
  mid: (a, b) => ({x:(a.x + b.x)/2, y:(a.y + b.y)/2}),
  ang(a, b, c){ const v1x = a.x-b.x, v1y = a.y-b.y, v2x = c.x-b.x, v2y = c.y-b.y, d = Math.hypot(v1x,v1y)*Math.hypot(v2x,v2y); return d ? Math.acos(Math.max(-1, Math.min(1, (v1x*v2x + v1y*v2y)/d))) * 180/Math.PI : null; },
  // grados respecto a la vertical; positivo = hacia donde mira la persona
  lean: (top, bot, facing) => Math.atan2((top.x - bot.x) * facing, bot.y - top.y) * 180/Math.PI,
  clamp: v => Math.max(0, Math.min(1, v)),

  // revisa encuadre, orientación y postura; devuelve {ok, msg, side}
  check(lm, W, H, step){
    const P = i => MT.P(lm, i, W, H);
    const need = [LM.nose, LM.shL, LM.shR, LM.hipL, LM.hipR, LM.knL, LM.knR, LM.anL, LM.anR];
    const pts = need.map(P);
    const vis = step.dir === 'front' ? pts.every(p => p.v > .5) : pts.filter(p => p.v > .3).length >= 6;
    if (!vis) return {ok:false, msg:'Muestra todo tu cuerpo, de la cabeza a los pies'};
    const ys = pts.map(p => p.y), xs = pts.map(p => p.x);
    const hgt = (Math.max(...ys) - Math.min(...ys)) / H;
    if (Math.min(...ys) < 0 || Math.max(...ys) > H || Math.min(...xs) < 0 || Math.max(...xs) > W) return {ok:false, msg:'Quédate dentro del cuadro'};
    if (hgt > 1) return {ok:false, msg:'Aléjate un poco'};
    if (hgt < (step.mv === 'squat' ? .28 : .4)) return {ok:false, msg:'Acércate un poco a la cámara'};
    const sh = MT.mid(P(LM.shL), P(LM.shR)), hp = MT.mid(P(LM.hipL), P(LM.hipR)), torso = MT.dist(sh, hp) || 1;
    const spread = Math.abs(P(LM.shL).x - P(LM.shR).x) / torso;
    if (step.dir === 'front' && spread < .4) return {ok:false, msg:'Ponte de frente a la cámara'};
    if (step.dir !== 'front'){
      if (spread > .35) return {ok:false, msg:`Gira: tu lado ${step.dir === 'left' ? 'izquierdo' : 'derecho'} hacia la cámara`};
      const nearL = (lm[LM.shL].z + lm[LM.hipL].z) < (lm[LM.shR].z + lm[LM.hipR].z);
      if ((step.dir === 'left') !== nearL) return {ok:false, msg:`Del otro lado: tu lado ${step.dir === 'left' ? 'izquierdo' : 'derecho'} hacia la cámara`};
    }
    const s = step.dir === 'right' ? 'R' : 'L';
    const wrists = step.dir === 'front' ? [P(LM.wrL), P(LM.wrR)] : [P(LM['wr'+s])];
    if (!wrists.every(w => w.y < P(LM.nose).y)) return {ok:false, msg:'Sube los brazos por encima de la cabeza'};
    if (step.mv === 'squat'){
      let down;
      if (step.dir === 'front'){ const an = MT.mid(P(LM.anL), P(LM.anR)); down = (an.y - hp.y) / ((an.y - sh.y) || 1) < .56; }
      else down = MT.ang(P(LM['hip'+s]), P(LM['kn'+s]), P(LM['an'+s])) < 125;
      if (!down) return {ok:false, msg:'Baja en sentadilla y sostén'};
    }
    return {ok:true, msg:'¡Así! Quédate quieto'};
  },

  // medidas de una toma
  measure(lm, W, H, step){
    const P = i => MT.P(lm, i, W, H), m = {};
    if (step.dir === 'front'){
      const shW = MT.dist(P(LM.shL), P(LM.shR)) || 1;
      m.elbowL = MT.ang(P(LM.shL), P(LM.elL), P(LM.wrL)); m.elbowR = MT.ang(P(LM.shR), P(LM.elR), P(LM.wrR));
      m.shrugL = (P(LM.shL).y - P(LM.earL).y) / shW; m.shrugR = (P(LM.shR).y - P(LM.earR).y) / shW;
      if (step.mv === 'squat'){
        const kW = MT.dist(P(LM.knL), P(LM.knR)), aW = MT.dist(P(LM.anL), P(LM.anR)) || 1, hW = MT.dist(P(LM.hipL), P(LM.hipR)) || 1;
        m.knee = kW / aW;
        m.shift = (MT.mid(P(LM.hipL), P(LM.hipR)).x - MT.mid(P(LM.anL), P(LM.anR)).x) / hW;
      }
    } else {
      const s = step.dir === 'left' ? 'L' : 'R';
      const sh = P(LM['sh'+s]), el = P(LM['el'+s]), wr = P(LM['wr'+s]), hip = P(LM['hip'+s]), kn = P(LM['kn'+s]), an = P(LM['an'+s]), ear = P(LM['ear'+s]), he = P(LM['he'+s]), to = P(LM['to'+s]);
      const facing = Math.sign(to.x - he.x) || Math.sign(P(LM.nose).x - ear.x) || 1;
            m.shoulder = MT.ang(hip, sh, wr); m.elbow = MT.ang(sh, el, wr);
      m.head = MT.lean(ear, sh, facing) - MT.lean(sh, hip, facing);   // grados que la cabeza se adelanta respecto al tronco
      m.back = -MT.lean(sh, hip, facing);                       // positivo = hombros detrás de la cadera
      if (step.mv === 'squat'){
        m.knee = MT.ang(hip, kn, an);
        m.torso = MT.lean(sh, hip, facing); m.shin = MT.lean(kn, an, facing);
        m.heel = (to.y - he.y) / (MT.dist(he, to) || 1);
      }
    }
    return m;
  },

  // compensaciones (0 a 1) a partir de las 6 tomas promediadas
  score(R){
    const C = MT.clamp, out = [];
    const add = (type, mv, side, v) => { if (v != null && !isNaN(v)) out.push({type, mv, side, v:+v.toFixed(3)}); };
    const ff = R['flex:front'], sf = R['squat:front'];
    for (const s of ['L','R']){
      const side = R['flex:' + (s === 'L' ? 'left' : 'right')], sq = R['squat:' + (s === 'L' ? 'left' : 'right')];
      add('shrug', 'flex', s, C((0.2 - ff['shrug'+s]) / 0.15));
      add('elbows', 'flex', s, C((165 - Math.min(ff['elbow'+s], side.elbow)) / 40));
      add('armsFwd', 'flex', s, C((170 - side.shoulder) / 50));
      add('arch', 'flex', s, C((side.back - 6) / 12));
      add('head', 'flex', s, C((side.head - 22) / 20));
      add('armsFwd', 'squat', s, C((165 - sq.shoulder) / 55));
      add('head', 'squat', s, C((sq.head - 25) / 20));
      add('depth', 'squat', s, C((sq.knee - 100) / 45));
      add('lean', 'squat', s, C((sq.torso - sq.shin - 12) / 25));
      add('heels', 'squat', s, C((sq.heel - 0.12) / 0.2));
    }
    add('valgus', 'squat', null, C((0.95 - sf.knee) / 0.25));
    add('varus', 'squat', null, C((sf.knee - 1.6) / 0.4));
    add('shift', 'squat', null, C((Math.abs(sf.shift) - 0.15) / 0.3));
    const mean = a => a.length ? a.reduce((s,x) => s + x, 0) / a.length : 0;
    const flex = 1 - mean(out.filter(c => c.mv === 'flex').map(c => c.v));
    const squat = 1 - mean(out.filter(c => c.mv === 'squat').map(c => c.v));
    const joints = {};
    for (const [j, [, types]] of Object.entries(JOINTS)) for (const s of j === 'espalda' ? [null] : ['L','R']){
      const rel = out.filter(c => types.includes(c.type) && (s == null || c.side == null || c.side === s));
      joints[j + (s || '')] = 1 - mean(rel.map(c => c.v));
    }
    // zonas a trabajar: de las compensaciones más marcadas
    const zc = {};
    for (const c of out) if (c.v > 0.2) for (const z of COMP[c.type][2]) zc[z] = (zc[z] || 0) + c.v;
    const zones = Object.entries(zc).sort((a,b) => b[1]-a[1]).slice(0, 4).map(([z]) => z);
    return {scores:{overall:(flex + squat)/2, flex, squat, joints}, comps:out, zones};
  }
};

const pct = v => Math.round(v * 100);
const scoreCol = v => v >= .8 ? 'var(--ok)' : v >= .6 ? 'var(--warm)' : 'var(--fail)';
const scoreWord = v => v >= .9 ? 'Excelente' : v >= .8 ? 'Muy buena' : v >= .65 ? 'Buena, con detalles' : v >= .5 ? 'Hay que trabajarla' : 'Necesita atención';
function scoreRing(v, size = 76){
  const R = 30, C = 2*Math.PI*R;
  return `<svg viewBox="0 0 76 76" width="${size}" height="${size}" style="flex:none"><circle cx="38" cy="38" r="${R}" fill="none" stroke="var(--line)" stroke-width="7"/>
    <circle cx="38" cy="38" r="${R}" fill="none" stroke="${scoreCol(v)}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${(C*v).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 38 38)"/>
    <text x="38" y="44" text-anchor="middle" style="font-size:19px;font-weight:700;fill:var(--ink)">${pct(v)}</text></svg>`;
}

let TEST = null;
function stopTest(){
  if (!TEST) return;
  TEST.stop = true;
  try { TEST.stream && TEST.stream.getTracks().forEach(t => t.stop()); } catch(e){}
  wake(false);
  TEST = null;
}
let LANDMARKER = null;
async function loadLandmarker(){
  if (LANDMARKER) return LANDMARKER;
  const base = new URL('vendor/mediapipe/', document.baseURI).href;
  const mp = await import(base + 'vision_bundle.js');
  const fs = await mp.FilesetResolver.forVisionTasks(base + 'wasm');
  const opts = d => ({baseOptions:{modelAssetPath:base + 'pose_landmarker_lite.task', delegate:d}, runningMode:'VIDEO', numPoses:1,
    minPoseDetectionConfidence:.5, minPosePresenceConfidence:.5, minTrackingConfidence:.5});
  try { LANDMARKER = await mp.PoseLandmarker.createFromOptions(fs, opts('GPU')); }
  catch(e){ LANDMARKER = await mp.PoseLandmarker.createFromOptions(fs, opts('CPU')); }
  return LANDMARKER;
}
VIEWS.mtest = t => {
  t.stage = t.stage || 'intro';
  if (t.stage === 'intro') return {title:'Test de movilidad', body:`
    <div style="display:grid;place-items:center;padding:18px 16px 0">${poseSvg(POSE('brazos_arriba').fig, {size:120})}</div>
    <div class="pad"><p style="font-size:15px;line-height:1.55;color:var(--ink-2)">Vas a hacer dos movimientos —<b>brazos arriba</b> y <b>sentadilla con brazos arriba</b>— de frente y de cada lado. Son 6 tomas de unos segundos.</p>
      <div class="card" style="margin:0;padding:4px 14px">
        <div class="kv"><span>1. Apoya el teléfono vertical a la altura de la cadera</span></div>
        <div class="kv"><span>2. Aléjate 2 a 3 metros: se debe ver todo tu cuerpo</span></div>
        <div class="kv"><span>3. Ropa ajustada y buena luz ayudan</span></div>
        <div class="kv"><span>4. Sigue la voz: te avisa cuándo girar</span></div></div>
      <p class="mut" style="font-size:12.5px;line-height:1.5">La cámara se procesa en el teléfono; no se guarda ni se envía ningún video. El resultado es una guía para entrenar, no un diagnóstico médico.</p>
      <button class="btn acc" data-a="testStart">${ic('cam')}Empezar test</button><div style="height:20px"></div></div>`};
  const st = TEST_STEPS[Math.min(t.step || 0, 5)];
  return {title:'', body:`<div class="test">
    <video id="tv" playsinline muted></video><canvas id="tc"></canvas>
    <div class="hud">
      <div style="display:flex;gap:8px;align-items:center"><button class="ib" data-a="testX" style="background:rgba(14,15,18,.7);color:#fff" aria-label="Salir">${ic('x')}</button>
        <div style="flex:1;display:flex;gap:4px">${TEST_STEPS.map((_,i) => `<i style="flex:1;height:4px;border-radius:2px;background:${i < (t.step||0) ? 'var(--acc)' : i === (t.step||0) ? '#fff' : 'rgba(255,255,255,.25)'}"></i>`).join('')}</div></div>
      <div style="flex:1"></div>
      <div class="msg"><div class="lbl" style="color:var(--acc)">Toma ${(t.step||0) + 1} de 6</div><div class="h2" style="margin:2px 0 4px">${st.title}</div>
        <div id="tmsg" style="font-size:14px;color:var(--ink-2)">${t.stage === 'loading' ? 'Cargando el detector de pose…' : st.tip}</div>
        <div style="height:6px;border-radius:3px;background:var(--line);margin-top:10px;overflow:hidden"><i id="thold" style="display:block;height:100%;width:0;background:var(--ok);transition:width .15s"></i></div></div>
    </div></div>`,
    after: () => { if (!TEST) runTest(t); }};
};
async function runTest(t){
  stopTest();
  TEST = {stop:false, res:{}, samples:[], hold:0, last:0, msg:''};
  const T = TEST;
  t.stage = 'loading'; t.step = 0;
  wake(true);
  try {
    T.stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'user', width:{ideal:720}, height:{ideal:1280}}, audio:false});
  } catch(e){ stopTest(); t.stage = 'intro'; render(); return toast('No se pudo abrir la cámara. Revisa el permiso.'); }
  const v = $('#tv'); if (!v || T.stop){ stopTest(); return; }
  v.srcObject = T.stream; await v.play().catch(() => {});
  let lmk;
  try { lmk = await loadLandmarker(); } catch(e){ stopTest(); t.stage = 'intro'; render(); return toast('No se pudo cargar el detector de pose'); }
  if (T.stop) return;
  t.stage = 'run'; $('#tmsg').textContent = TEST_STEPS[0].tip;
  speak(TEST_STEPS[0].tip);
  runLoopRebind(t, T, lmk);
}
// tras re-dibujar la vista (nueva toma) se reengancha a los elementos nuevos
function runLoopRebind(t, T, lmk){
  if (T.stop) return;
  const v = $('#tv'), cv = $('#tc'); if (!v || !cv) return stopTest();
  v.srcObject = T.stream; v.play().catch(() => {});
  const cx = cv.getContext('2d'); let lastT = -1, lastSpoken = performance.now();
  const loop = () => {
    if (T.stop) return;
    if (cur().v !== 'mtest'){ stopTest(); return; }
    const now = performance.now();
    if (v.readyState >= 2 && v.currentTime !== lastT){
      lastT = v.currentTime;
      const W = v.videoWidth, H = v.videoHeight;
      if (cv.width !== W){ cv.width = W; cv.height = H; }
      let r = null; try { r = lmk.detectForVideo(v, now); } catch(e){}
      const lm = r && r.landmarks && r.landmarks[0];
      cx.clearRect(0, 0, W, H);
      const step = TEST_STEPS[t.step];
      let chk = {ok:false, msg:'No te veo: colócate frente a la cámara'};
      if (lm){ chk = MT.check(lm, W, H, step); drawSkel(cx, lm, W, H, chk.ok); }
      const dt = T.last ? now - T.last : 0; T.last = now;
      if (chk.ok){ T.hold += dt; const m = MT.measure(lm, W, H, step); if (Object.values(m).every(x => x != null && isFinite(x))) T.samples.push(m); }
      else { T.hold = Math.max(0, T.hold - dt * 1.5); if (T.hold === 0) T.samples = []; }
      const el = $('#tmsg'), hb = $('#thold');
      if (el && chk.msg !== T.msg){ T.msg = chk.msg; el.textContent = chk.msg; if (!chk.ok && now - lastSpoken > 4000){ speak(chk.msg); lastSpoken = now; } }
      if (hb) hb.style.width = Math.min(100, T.hold / HOLD_MS * 100) + '%';
      if (T.hold >= HOLD_MS && T.samples.length >= 5){
        const keys = Object.keys(T.samples[0]), avg = {}, recent = T.samples.slice(-30);
        for (const k of keys){ const xs = recent.map(s => s[k]).sort((a,b) => a-b); avg[k] = xs[Math.floor(xs.length/2)]; }
        T.res[step.mv + ':' + step.dir] = avg;
        T.hold = 0; T.samples = []; T.msg = '';
        beep();
        if (t.step === 5) return finishTest(T);
        t.step++; render();
        speak(TEST_STEPS[t.step].tip);
        return requestAnimationFrame(() => runLoopRebind(t, T, lmk));
      }
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
function drawSkel(cx, lm, W, H, ok){
  const E = [[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28],[27,29],[29,31],[27,31],[28,30],[30,32],[28,32]];
  cx.lineWidth = Math.max(3, W/160); cx.strokeStyle = ok ? '#3fae6a' : '#d9822b'; cx.fillStyle = '#fff';
  cx.beginPath(); for (const [a,b] of E){ if ((lm[a].visibility ?? 1) < .3 || (lm[b].visibility ?? 1) < .3) continue; cx.moveTo(lm[a].x*W, lm[a].y*H); cx.lineTo(lm[b].x*W, lm[b].y*H); } cx.stroke();
  for (const i of [0,11,12,13,14,15,16,23,24,25,26,27,28]){ if ((lm[i].visibility ?? 1) < .3) continue; cx.beginPath(); cx.arc(lm[i].x*W, lm[i].y*H, Math.max(3, W/140), 0, 7); cx.fill(); }
}
function finishTest(T){
  const res = T.res;
  stopTest();
  const sc = MT.score(res);
  const test = {id:uid(), t:Date.now(), ...sc, raw:res};
  S.mov.tests.push(test); save();
  speak('Test completo. Tu puntaje es ' + pct(sc.scores.overall));
  NAV[NAV.length-1] = {v:'mres', id:test.id}; render(true);
}

VIEWS.mres = t => {
  const T = S.mov.tests.find(x => x.id === t.id);
  if (!T) return {title:'', body:'<div class="empty"><b>Resultado no encontrado</b></div>'};
  const J = T.scores.joints, hist = S.mov.tests.filter(x => x.t <= T.t);
  const jb = (k, lbl) => `<div class="jbox"><div class="lbl">${lbl}</div><div class="v" style="color:${scoreCol(J[k])}">${pct(J[k])}</div></div>`;
  const comps = {};
  for (const c of T.comps) if (c.v > 0.15){ comps[c.type] = comps[c.type] || {v:0, sides:new Set()}; comps[c.type].v = Math.max(comps[c.type].v, c.v); if (c.side) comps[c.type].sides.add(c.side); }
  const cl = Object.entries(comps).sort((a,b) => b[1].v - a[1].v);
  return {
    title:'Resultado del test',
    body:`
      <div class="card p" style="display:flex;gap:16px;align-items:center">${scoreRing(T.scores.overall, 96)}
        <div style="flex:1"><div class="h2">${scoreWord(T.scores.overall)}</div><div class="mut" style="font-size:12.5px;margin-top:2px">${DF.format(T.t)}${T.demo ? ' · ejemplo' : ''}</div>
        <div class="stats" style="grid-template-columns:1fr 1fr;margin-top:8px"><div><div class="lbl">Brazos arriba</div><div class="v" style="color:${scoreCol(T.scores.flex)}">${pct(T.scores.flex)}</div></div><div><div class="lbl">Sentadilla</div><div class="v" style="color:${scoreCol(T.scores.squat)}">${pct(T.scores.squat)}</div></div></div></div></div>
      <div class="sec"><span class="lbl">Por articulación</span><span class="mut" style="font-size:11.5px">izq. · der.</span></div>
      <div class="pad" style="display:grid;gap:8px">
        <div class="jrow">${jb('espalda','Espalda')}<div></div></div>
        ${['hombro','codo','cadera','rodilla','tobillo'].map(j => `<div class="jrow">${jb(j+'L', JOINTS[j][0] + ' izq.')}${jb(j+'R', JOINTS[j][0] + ' der.')}</div>`).join('')}
      </div>
      <div class="sec"><span class="lbl">Lo que vimos</span></div>
      <div class="card" style="padding:0 14px">${cl.length ? cl.map(([k,c]) => `<div class="kv" style="display:block"><div style="display:flex;justify-content:space-between;gap:10px"><b style="font-weight:620">${COMP[k][0]}${c.sides.size === 1 ? ` <span class="mut" style="font-weight:400">· ${[...c.sides][0] === 'L' ? 'izquierda' : 'derecha'}</span>` : ''}</b><span class="num" style="color:${c.v > .6 ? 'var(--fail)' : c.v > .3 ? 'var(--warm)' : 'var(--mut)'}">${c.v > .6 ? 'Marcada' : c.v > .3 ? 'Moderada' : 'Leve'}</span></div><div class="mut" style="font-size:12.5px;margin-top:2px">${COMP[k][1]}</div></div>`).join('') : '<div class="kv"><span>Sin compensaciones importantes. ¡Bien!</span></div>'}</div>
      ${T.zones.length ? `<div class="sec"><span class="lbl">Zonas a trabajar</span></div><div class="pad">${T.zones.map(z => `<span class="zchip" style="font-size:13px;padding:4px 10px">${ZONE[z]}</span>`).join('')}</div>
        <div class="pad" style="margin-top:12px"><button class="btn acc" data-a="go" data-v="mroutine" data-id="fix:${T.id}">${ic('play')}Rutina para mejorar</button></div>` : ''}
      ${hist.length > 1 ? `<div class="card p"><div class="lbl">Historial</div>${lineChart(hist.map(x => ({t:x.t, v:pct(x.scores.overall)})))}</div>` : ''}
      <div class="foot">Las medidas salen de la cámara en 2D: la luz, la ropa y el ángulo del teléfono influyen. Compara tus tests entre sí, hechos en condiciones parecidas. No es un diagnóstico médico.</div>`
  };
};

/* ---------- acciones ---------- */
document.addEventListener('input', ev => { if (ev.target.id === 'me_title'){ const t = cur(); if (t.draft) t.draft.title = ev.target.value; } });
Object.assign(A, {
  playStart(){ const t = cur(), r = getRoutine(t.id); if (r) startPlay(r, t.items || r.items); },
  playPause(){ PLAY.paused = !PLAY.paused; PLAY.last = Date.now(); if (!PLAY.paused) wake(true); render(); },
  playMv(el){
    const d = +el.dataset.k, P = PLAY;
    if (d < 0 && P.phase === 'hold' && P.steps[P.i].secs - P.left > 3){ P.left = P.steps[P.i].secs; return render(); }
    P.i = Math.max(0, Math.min(P.steps.length - 1, P.i + d)); P.phase = d > 0 ? 'hold' : 'prep'; P.left = d > 0 ? P.steps[P.i].secs : PREP; P.said = -1;
    if (d > 0) speak(POSE(P.steps[P.i].id).name); else announce();
    render();
  },
  playX(){
    const P = PLAY; P.paused = true;
    confirmBox('¿Terminar la sesión?', P.active > 60 ? 'Se guarda lo que llevas.' : 'Llevas menos de un minuto: no se guarda.', 'Terminar', () => { endPlay(false); back(); });
  },
  playVoice(){ S.mov.voice = !S.mov.voice; save(); render(); },
  movCfg(){ sheet('Movilidad', `<button class="opt" data-a="movVoice"><span style="flex:1">Voz que guía la sesión</span><span class="mut">${S.mov.voice ? 'Sí' : 'No'}</span></button>
    <button class="opt" data-a="movSound"><span style="flex:1">Sonidos de conteo</span><span class="mut">${S.sound ? 'Sí' : 'No'}</span></button>`); },
  movVoice(){ S.mov.voice = !S.mov.voice; save(); A.movCfg(); if (S.mov.voice) speak('Voz activada'); },
  movSound(){ S.sound = !S.sound; save(); A.movCfg(); },
  mlibZ(el){ cur().z = el.dataset.k; render(); },
  meditAdd(el){
    const id = el.dataset.k, p = POSE(id);
    const ed = NAV[NAV.length - 2]; if (ed && ed.draft) ed.draft.items.push([id, p.secs]);
    toast(p.name + ' agregada'); back();
  },
  meditSec(el){
    const i = +el.dataset.k, d = cur().draft;
    sheet('Segundos', [20,30,40,45,60,90,120].map(s => `<button class="opt" data-a="meditSecPick" data-k="${i}" data-s="${s}" aria-checked="${d.items[i][1]===s}">${s} s</button>`).join(''));
  },
  meditSecPick(el){ cur().draft.items[+el.dataset.k][1] = +el.dataset.s; close(); render(); },
  meditMv(el){ const i = +el.dataset.k, it = cur().draft.items; if (i > 0){ [it[i-1], it[i]] = [it[i], it[i-1]]; render(); } },
  meditDel(el){ cur().draft.items.splice(+el.dataset.k, 1); render(); },
  meditSave(){
    const t = cur(), d = t.draft;
    if (!d.items.length) return toast('Agrega al menos una postura');
    d.title = d.title.trim() || 'Mi rutina';
    const i = S.mov.custom.findIndex(r => r.id === d.id);
    i >= 0 ? S.mov.custom[i] = d : S.mov.custom.push(d);
    save(); toast('Rutina guardada'); back();
  },
  meditRm(){ const t = cur(); confirmBox('¿Eliminar rutina?', 'No se borran las sesiones que ya hiciste.', 'Eliminar', () => { S.mov.custom = S.mov.custom.filter(r => r.id !== t.draft.id); save(); tab('mov'); }); },
  testStart(){ const t = cur(); t.stage = 'loading'; t.step = 0; render(); },
  testX(){ stopTest(); const t = cur(); t.stage = 'intro'; render(); },
});
// al salir con el botón atrás del teléfono se apagan cámara y temporizador
window.addEventListener('popstate', () => setTimeout(() => { if (TEST && cur().v !== 'mtest') stopTest(); if (PLAY && cur().v !== 'play') endPlay(false); }, 0));

/* ---------- datos de ejemplo ---------- */
SEEDS.push(() => {
  const R = rng(23), m = S.mov, now = Date.now();
  const picks = ['manana','cadera','espalda','post_pierna','hombros','noche','escritorio'];
  m.sessions = [];
  for (let d = 50; d >= 1; d--){
    if (R() > .3) continue;
    const r = getRoutine(picks[Math.floor(R()*picks.length)]), t = new Date(now - d*DAY); t.setHours(R() < .5 ? 7 : 21, Math.floor(R()*50), 0, 0);
    m.sessions.push({id:uid(), t:t.getTime(), title:r.title, rid:r.id, secs:routineSecs(r.items) - r.items.length*5, n:r.items.length});
  }
  // un test de ejemplo con medidas plausibles
  const raw = {
    'flex:front':{elbowL:171, elbowR:166, shrugL:.17, shrugR:.15},
    'flex:left':{shoulder:158, elbow:168, head:31, back:11},
    'flex:right':{shoulder:162, elbow:169, head:28, back:9},
    'squat:front':{elbowL:168, elbowR:165, shrugL:.2, shrugR:.18, knee:.86, shift:.12},
    'squat:left':{shoulder:150, elbow:166, head:30, back:-30, knee:104, torso:44, shin:30, heel:.08},
    'squat:right':{shoulder:153, elbow:167, head:27, back:-28, knee:98, torso:41, shin:31, heel:.06},
  };
  m.tests = [{id:uid(), t:now - 12*DAY, demo:true, ...MT.score(raw), raw}];
});

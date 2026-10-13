'use strict';
/* =====================================================================
   SERIE — núcleo compartido por los módulos (gym, comida, movilidad):
   estado y almacenamiento, formato, navegación, render, gráficas,
   hojas y avisos, sonido, respaldo y despacho de acciones.
   Cada módulo agrega su estado (BLANKS), sus datos de ejemplo (SEEDS),
   su pestaña (TABS), sus vistas (VIEWS), sus acciones (A) y sus
   ganchos (HOOKS). Sin dependencias ni red.
   ===================================================================== */

const KEY = 'serie.v1';
const DAY = 864e5;
/* ---------- estado ---------- */
let S;
// los módulos (comida, movilidad) agregan su parte del estado, sus datos de ejemplo y sus pestañas
const BLANKS = [], SEEDS = [];
const blank = () => Object.assign({v:1, units:'kg', sound:true, body:[]}, ...BLANKS.map(f => f()));
// ganchos: reset (estado nuevo o importado), render (tras dibujar), tick (cada segundo), boot (al arrancar)
const HOOKS = {reset:[], render:[], tick:[], boot:[]};
function resetState(next){ S = next; HOOKS.reset.forEach(f => f()); }
const fill = d => { const b = blank(); for (const k in b) if (d[k] == null) d[k] = b[k]; return d; };
function load(){
  try { const raw = localStorage.getItem(KEY); if (raw) return fill(JSON.parse(raw)); } catch(e){}
  return null;
}
let saveT;
const save = () => { clearTimeout(saveT); saveT = setTimeout(saveNow, 200); };
function saveNow(){ try { localStorage.setItem(KEY, JSON.stringify(S)); } catch(e){} }

const uid = () => Math.random().toString(36).slice(2,10);
const $ = (s, r=document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone = o => JSON.parse(JSON.stringify(o));
/* ---------- unidades y formato ---------- */
const LB = 2.20462;
const U = () => S.units === 'lb' ? 'LB' : 'KG';
const u = () => S.units === 'lb' ? 'lb' : 'kg';
const toU = kg => S.units === 'lb' ? kg * LB : kg;
const fromU = v => S.units === 'lb' ? v / LB : v;
const r1 = n => Math.round(n * 10) / 10;
const r2 = n => Math.round(n * 100) / 100;
const nf = (n, d=1) => Number(n).toLocaleString('es-MX', {maximumFractionDigits:d});
const wt = kg => nf(r2(toU(kg)), 2);
const vol = kg => nf(Math.round(toU(kg))) + ' ' + u();
function dur(sec){
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec/3600), m = Math.floor(sec%3600/60);
  return h ? `${h} h ${String(m).padStart(2,'0')} min` : `${m} min`;
}
function clock(sec){
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec/3600), m = Math.floor(sec%3600/60), s = sec%60;
  return (h ? h + ':' + String(m).padStart(2,'0') : m) + ':' + String(s).padStart(2,'0');
}
const restLbl = s => !s ? 'Apagado' : clock(s);
const DF = new Intl.DateTimeFormat('es-MX', {weekday:'long', day:'numeric', month:'long'});
const DFS = new Intl.DateTimeFormat('es-MX', {day:'numeric', month:'short'});
const TF = new Intl.DateTimeFormat('es-MX', {hour:'numeric', minute:'2-digit'});
function when(t){
  const d0 = new Date(); d0.setHours(0,0,0,0);
  const diff = Math.floor((d0 - new Date(t).setHours(0,0,0,0)) / DAY);
  const day = diff === 0 ? 'Hoy' : diff === 1 ? 'Ayer' : cap(DF.format(t));
  return day + ' · ' + TF.format(t);
}
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const initials = name => name.replace(/\(.*?\)/g,'').trim().split(/\s+/).filter(w => w.length > 2).slice(0,2).map(w => w[0]).join('').toUpperCase() || name.slice(0,2).toUpperCase();
const weekStart = t => { const d = new Date(t); d.setHours(0,0,0,0); d.setDate(d.getDate() - (d.getDay()+6)%7); return d.getTime(); };
/* ---------- navegación ---------- */
let TAB = 'home';
let NAV = [{v:'home'}];
const cur = () => NAV[NAV.length-1];
// el botón atrás del teléfono recorre la pila de vistas
function go(v, o = {}){ NAV.push(Object.assign({v}, o)); try { history.pushState(null, ''); } catch(e){} render(true); }
function back(){ if (NAV.length > 1) history.back(); }
window.addEventListener('popstate', () => {
  if ($('#sheet').innerHTML){ close(); try { history.pushState(null, ''); } catch(e){} return; }
  if (NAV.length > 1){ NAV.pop(); render(true); }
});
function tab(t){ TAB = t; NAV = [{v:t}]; render(true); }

const I = {
  back:'<path d="M15 18l-6-6 6-6"/>', more:'<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  home:'<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  dumb:'<path d="M6 7v10M3 9.5v5M18 7v10M21 9.5v5M6 12h12"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>', plus:'<path d="M12 5v14M5 12h14"/>', x:'<path d="M6 6l12 12M18 6L6 18"/>',
  timer:'<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/>', search:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  play:'<path d="M7 5l12 7-12 7z"/>', book:'<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/>',
  trophy:'<path d="M8 4h8v5a4 4 0 0 1-8 0zM5 5h3v3a3 3 0 0 1-3-3zM19 5h-3v3a3 3 0 0 0 3-3zM12 13v4M8 21h8M9 17h6"/>',
};
const ic = (n, cls='ico') => `<svg class="${cls}" viewBox="0 0 24 24">${I[n]}</svg>`;
/* ---------- render ---------- */
function render(resetScroll){
  const t = cur(), V = VIEWS[t.v](t);
  const bar = $('#bar');
  const left = NAV.length > 1 ? `<button class="ib" data-a="back" aria-label="Atrás">${ic('back')}</button>` : '';
  bar.innerHTML = left + (V.mark ? `<div class="t"><span class="mark"><span class="dot"></span>Serie</span></div>` : `<div class="t">${V.title ?? ''}</div>`) + (V.right || '');
  $('#main').innerHTML = V.body;
  // barra de pestañas solo en las raíces
  const root = NAV.length === 1 && TABS.some(x => x[0] === t.v);
  const tb = $('#tabbar');
  tb.style.display = root ? '' : 'none';
  tb.firstElementChild.innerHTML = TABS
    .map(([k,l,i]) => `<button data-a="tab" data-k="${k}" ${TAB===k?'aria-current="page"':''}>${ic(i)}${l}</button>`).join('');
  HOOKS.render.forEach(f => f(t, root));
  if (resetScroll) window.scrollTo(0,0);
  V.after && V.after();
}

/* ---------- vistas ---------- */
const VIEWS = {};
const TABS = [];        // [vista, etiqueta, ícono]; las agrega cada módulo
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
/* ---------- gráficas SVG ---------- */
function lineChart(pts){
  const W = 320, H = 150, L = 34, R = 8, T = 10, B = 20;
  pts = pts.slice(-30);
  const vs = pts.map(p => p.v); let lo = Math.min(...vs), hi = Math.max(...vs);
  if (hi === lo){ hi += 1; lo -= 1; }
  const pad = (hi-lo)*.12; lo -= pad; hi += pad;
  const x = i => L + (W-L-R) * (pts.length === 1 ? .5 : i/(pts.length-1));
  const y = v => T + (H-T-B) * (1 - (v-lo)/(hi-lo));
  const d = pts.map((p,i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p.v).toFixed(1)).join(' ');
  const ticks = [lo + (hi-lo)*.15, (lo+hi)/2, hi - (hi-lo)*.15];
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">
    ${ticks.map(v => `<line class="grid" x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L-6}" y="${y(v)+3}" text-anchor="end">${nf(v, v < 20 ? 1 : 0)}</text>`).join('')}
    <path class="ar" d="${d} L${x(pts.length-1)} ${H-B} L${x(0)} ${H-B} Z"/>
    <path class="ln" d="${d}"/>
    ${pts.map((p,i) => `<circle class="pt" cx="${x(i)}" cy="${y(p.v)}" r="${i === pts.length-1 ? 3.5 : 2.2}"/>`).join('')}
    <text x="${L}" y="${H-5}">${DFS.format(pts[0].t)}</text><text x="${W-R}" y="${H-5}" text-anchor="end">${DFS.format(pts[pts.length-1].t)}</text>
  </svg>`;
}
function barChart(bars){
  const W = 320, H = 130, B = 18, T = 6, n = bars.length, gap = 6;
  const bw = (W - gap*(n-1)) / n, max = Math.max(...bars.map(b => b.v), 1e-9);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" style="margin-top:10px" role="img">
    <line class="grid" x1="0" x2="${W}" y1="${H-B}" y2="${H-B}"/>
    ${bars.map((b,i) => { const h = b.v ? Math.max(3, (H-B-T) * b.v/max) : 0; return `<rect class="br${i<n-1?' lo':''}" x="${i*(bw+gap)}" y="${H-B-h}" width="${bw}" height="${h}" rx="3"/>`; }).join('')}
    ${[0, Math.floor(n/2), n-1].map(i => `<text x="${i*(bw+gap)+bw/2}" y="${H-5}" text-anchor="middle">${bars[i].label}</text>`).join('')}
  </svg>`;
}

/* ---------- hoja inferior y avisos ---------- */
let OK = null;
function sheet(title, html){
  $('#sheet').innerHTML = `<div class="scrim" data-a="close"></div><div class="sh"><div class="in"><div class="grab"></div>${title ? `<div class="ttl">${title}</div>` : ''}${html}</div></div>`;
}
const close = () => { $('#sheet').innerHTML = ''; OK = null; };
function confirmBox(title, msg, okLbl, fn){
  OK = fn;
  sheet(title, `<p class="mut" style="margin:0 0 16px;font-size:14px">${msg}</p><div style="display:grid;gap:8px"><button class="btn acc" data-a="ok" ${/borrar|descartar|eliminar/i.test(okLbl) ? 'style="background:var(--fail);border-color:var(--fail);color:#fff"' : ''}>${okLbl}</button><button class="btn" data-a="close">Cancelar</button></div>`);
}
let toastT;
function toast(html, ms = 2400){
  clearTimeout(toastT);
  $('#toast').innerHTML = `<div class="toast">${html}</div>`;
  toastT = setTimeout(() => $('#toast').innerHTML = '', ms);
}
/* ---------- sonido ---------- */
let audio;
function beep(){
  if (!S.sound) return;
  try { navigator.vibrate && navigator.vibrate([180,80,180]); } catch(e){}
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    [0, .22].forEach(dt => {
      const o = audio.createOscillator(), g = audio.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(audio.destination);
      const t0 = audio.currentTime + dt;
      g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(.25, t0 + .02); g.gain.exponentialRampToValueAtTime(.0001, t0 + .18);
      o.start(t0); o.stop(t0 + .2);
    });
  } catch(e){}
}
function rng(seed){ return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
/* ---------- respaldo ---------- */
function download(name, text, type){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], {type})); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const stamp = () => new Date().toISOString().slice(0,10);
/* ---------- eventos ---------- */
const A = {
  back, close, tab: el => tab(el.dataset.k),
  ok(){ const f = OK; close(); f && f(); },
  go: el => go(el.dataset.v, {id: el.dataset.id}),
};
document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-a]');
  if (!el || !A[el.dataset.a]) return;
  if (el.disabled) return;
  if (audio && audio.state === 'suspended') audio.resume();
  A[el.dataset.a](el, ev);
});
document.addEventListener('change', ev => {
  if (ev.target.id !== 'imp' || !ev.target.files[0]) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (!Array.isArray(d.workouts)) throw 0;
      resetState(fill(Object.assign(d, {active:S.active}))); saveNow(); toast('Respaldo importado'); tab('home');
    } catch(e){ toast('Ese archivo no es un respaldo válido'); }
  };
  r.readAsText(ev.target.files[0]);
});
document.addEventListener('visibilitychange', () => { document.hidden ? saveNow() : HOOKS.tick.forEach(f => f()); });
window.addEventListener('pagehide', saveNow);

'use strict';
/* ---------- arranque: después de cargar todos los módulos ---------- */
S = load();
if (!S){ resetState(blank()); SEEDS.forEach(f => f()); saveNow(); }
HOOKS.reset.forEach(f => f());
HOOKS.boot.forEach(f => f());
render(true);
setInterval(() => HOOKS.tick.forEach(f => f()), 1000);
// sin internet: solo en la web (en el APK los archivos ya vienen dentro)
if ('serviceWorker' in navigator && location.protocol === 'https:' && !window.Capacitor) navigator.serviceWorker.register('sw.js').catch(() => {});

// Copia los archivos de la app web a www/, que es lo que Capacitor mete en el APK.
import { cpSync, rmSync, mkdirSync } from 'node:fs';
const out = 'www';
rmSync(out, { recursive: true, force: true });
mkdirSync(out);
for (const f of ['index.html', 'manifest.webmanifest', 'css', 'js', 'icons', 'vendor']) cpSync(f, `${out}/${f}`, { recursive: true });
console.log('www/ listo');

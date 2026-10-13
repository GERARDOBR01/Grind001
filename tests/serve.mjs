// Servidor estático mínimo para las pruebas (sin dependencias).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
const root = process.cwd(), port = +(process.env.PORT || 4173);
const TYPES = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.webmanifest':'application/manifest+json', '.svg':'image/svg+xml', '.png':'image/png', '.wasm':'application/wasm', '.task':'application/octet-stream' };
createServer(async (req, res) => {
  let p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  if (p.endsWith('/')) p += 'index.html';
  try { const body = await readFile(join(root, p)); res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' }); res.end(body); }
  catch { res.writeHead(404); res.end('no'); }
}).listen(port, () => console.log('http://localhost:' + port));

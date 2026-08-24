import { createServer } from 'node:http';
import { extname, isAbsolute, join, normalize, relative, resolve, sep } from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 4327);
if (host !== '127.0.0.1') throw new Error('Signal Grove server is loopback-only. HOST must be 127.0.0.1.');
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer between 1 and 65535.');

const types = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.css', 'text/css; charset=utf-8'], ['.mjs', 'text/javascript; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'], ['.json', 'application/json; charset=utf-8'], ['.webmanifest', 'application/manifest+json; charset=utf-8']
]);

const headers = {
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY'
};

const server = createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { ...headers, Allow: 'GET, HEAD' }); response.end(); return;
  }
  const url = new URL(request.url || '/', `http://${host}:${port}`);
  if (url.pathname === '/health') {
    const body = JSON.stringify({ service: 'signal-grove', status: 'READY', version: '0.3.0', mode: 'DEMO_REPLAY', externalConnections: false, publishable: false });
    response.writeHead(200, { ...headers, 'Content-Type': 'application/json; charset=utf-8' });
    response.end(request.method === 'HEAD' ? undefined : body); return;
  }
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { response.writeHead(400, headers); response.end('Bad request'); return; }
  const pathSegments = pathname.replaceAll('\\', '/').split('/');
  if (pathname.includes('\0')) { response.writeHead(400, headers); response.end('Bad request'); return; }
  if (pathSegments.includes('..')) { response.writeHead(403, headers); response.end('Forbidden'); return; }
  if (pathname === '/') pathname = '/index.html';
  const relativePath = normalize(pathname).replace(/^([/\\])+/, '');
  const filePath = resolve(join(root, relativePath));
  const boundary = relative(root, filePath);
  if (boundary === '..' || boundary.startsWith(`..${sep}`) || isAbsolute(boundary)) { response.writeHead(403, headers); response.end('Forbidden'); return; }
  try {
    const body = await readFile(filePath);
    response.writeHead(200, { ...headers, 'Content-Type': types.get(extname(filePath)) || 'application/octet-stream' });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch {
    response.writeHead(404, { ...headers, 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(request.method === 'HEAD' ? undefined : 'Not found');
  }
});

server.listen(port, host, () => console.log(`Signal Grove listening on http://${host}:${port}`));

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}

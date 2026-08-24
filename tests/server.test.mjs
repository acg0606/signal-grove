import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer as createNetServer } from 'node:net';
import { request } from 'node:http';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
let server;
let port;
let stderr = '';

async function availablePort() {
  const probe = createNetServer();
  await new Promise((accept, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', accept); });
  const value = probe.address().port;
  await new Promise((accept, reject) => probe.close((error) => error ? reject(error) : accept()));
  return value;
}

function call(method, path) {
  return new Promise((accept, reject) => {
    const req = request({ host: '127.0.0.1', port, method, path }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => accept({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.once('error', reject);
    req.end();
  });
}

before(async () => {
  port = await availablePort();
  server = spawn(process.execPath, [resolve(root, 'scripts/serve.mjs')], {
    cwd: root,
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port) },
    stdio: ['ignore', 'ignore', 'pipe']
  });
  server.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`server exited ${server.exitCode}: ${stderr}`);
    try { if ((await call('GET', '/health')).status === 200) return; } catch {}
    await new Promise((accept) => setTimeout(accept, 80));
  }
  throw new Error(`server did not become healthy: ${stderr}`);
});

after(async () => {
  if (!server || server.exitCode !== null) return;
  const exited = new Promise((accept) => server.once('exit', accept));
  server.kill('SIGTERM');
  await exited;
});

test('health and static responses carry the private security boundary', async () => {
  const health = await call('GET', '/health');
  assert.equal(health.status, 200);
  assert.deepEqual(JSON.parse(health.body), { service: 'signal-grove', status: 'READY', version: '0.3.0', mode: 'DEMO_REPLAY', externalConnections: false, publishable: false });
  assert.match(health.headers['content-security-policy'], /connect-src 'self'/);
  assert.equal(health.headers['x-frame-options'], 'DENY');
  assert.equal(health.headers['referrer-policy'], 'no-referrer');
  assert.equal(health.headers['cache-control'], 'no-store');
});

test('HEAD is bodyless and mutating methods are rejected', async () => {
  const head = await call('HEAD', '/index.html');
  assert.equal(head.status, 200);
  assert.equal(head.body, '');
  const post = await call('POST', '/');
  assert.equal(post.status, 405);
  assert.equal(post.headers.allow, 'GET, HEAD');
});

test('malformed, traversal and missing paths fail closed', async () => {
  assert.equal((await call('GET', '/%E0%A4%A')).status, 400);
  assert.equal((await call('GET', '/..%2F..%2Fpackage.json')).status, 403);
  assert.equal((await call('GET', '/not-present.txt')).status, 404);
});

test('non-loopback binding is refused before listen', async () => {
  const child = spawn(process.execPath, [resolve(root, 'scripts/serve.mjs')], {
    cwd: root,
    env: { ...process.env, HOST: '0.0.0.0', PORT: String(await availablePort()) },
    stdio: ['ignore', 'ignore', 'pipe']
  });
  let output = '';
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });
  const code = await new Promise((accept) => child.once('exit', accept));
  assert.notEqual(code, 0);
  assert.match(output, /loopback-only/);
});

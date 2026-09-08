const { test } = require('node:test');
const assert = require('node:assert/strict');

const { readFileSync } = require('node:fs');
const { proxiedResponseHeaders } = require('@dcl/sdk-commands/dist/linker-dapp/routes.js');

test('proxy strips decompressed-body framing and hop-by-hop headers', () => {
  const result = proxiedResponseHeaders(new Headers({
    'content-encoding': 'gzip', 'content-length': '100',
    'transfer-encoding': 'chunked', connection: 'keep-alive',
    'content-type': 'text/html'
  }));
  assert.deepEqual(result, { 'content-type': 'text/html' });
});

test('installed proxy keeps TLS enabled and auth assets unmodified', () => {
  const source = readFileSync(require.resolve('@dcl/sdk-commands/dist/linker-dapp/routes.js'), 'utf8');
  assert.doesNotMatch(source, /rejectUnauthorized:\s*false|AUTH_DEFAULT_ENV|AUTH_MAIN|searchParams\.set\('env'/);
});

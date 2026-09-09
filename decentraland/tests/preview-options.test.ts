import { test } from 'node:test'
import assert from 'node:assert/strict'
// @ts-ignore Plain Node launcher module is intentionally independent of the scene.
import { previewOptions } from '../scripts/preview-options.mjs'

test('preview defaults never launch a client and force loopback despite inherited settings', () => {
  const options = previewOptions([], { HTTP_SERVER_HOST: '0.0.0.0', HTTP_SERVER_PORT: '8000' })
  assert.ok(options.args.includes('--no-client'))
  assert.ok(options.args.includes('--no-browser'))
  assert.equal(options.env.HTTP_SERVER_HOST, '127.0.0.1')
  assert.equal(options.env.HTTP_SERVER_PORT, '8347')
})

test('native preview selects exactly one SDK launch path without auth bypass or multi-instance', () => {
  const options = previewOptions(['--native'])
  assert.ok(options.args.includes('--explorer-alpha'))
  assert.ok(!options.args.includes('--no-client'))
  for (const flag of ['--skip-auth-screen', '--multi-instance', '-n', '--mcp', '--landscape-terrain-enabled']) {
    assert.ok(!options.args.includes(flag))
  }
  assert.equal(options.env.HTTP_SERVER_HOST, '127.0.0.1')
})

test('launcher refuses unknown or repeated arguments rather than forwarding them', () => {
  for (const args of [['--port', '80'], ['--realm', 'https://example.org'], ['--native', '--native'], ['--mcp']]) {
    assert.throws(() => previewOptions(args), /Usage:/)
  }
})

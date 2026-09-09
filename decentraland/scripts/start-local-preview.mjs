import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { previewOptions } from './preview-options.mjs'

// Desktop-only preview: no LAN binding, browser launch, public tunnel or signer.
const project = fileURLToPath(new URL('../', import.meta.url))
const sdk = fileURLToPath(new URL('../node_modules/@dcl/sdk-commands/dist/index.js', import.meta.url))
const options = previewOptions(process.argv.slice(2), process.env)
const child = spawn(process.execPath, [sdk, ...options.args], {
  cwd: project,
  stdio: 'inherit',
  windowsHide: true,
  env: options.env
})
child.on('error', error => { console.error(error.message); process.exitCode = 1 })
child.on('exit', code => { process.exitCode = code ?? 1 })
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal))

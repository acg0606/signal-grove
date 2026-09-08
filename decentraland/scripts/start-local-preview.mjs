import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// Desktop-only preview: no LAN binding, browser launch, public tunnel or signer.
const project = fileURLToPath(new URL('../', import.meta.url))
const sdk = fileURLToPath(new URL('../node_modules/@dcl/sdk-commands/dist/index.js', import.meta.url))
const child = spawn(process.execPath, [sdk, 'start', '--skip-install', '--skip-build', '--no-watch', '--no-browser', '--no-client', '--port', '8347'], {
  cwd: project,
  stdio: 'inherit',
  windowsHide: true,
  env: { ...process.env, HTTP_SERVER_HOST: '127.0.0.1', HTTP_SERVER_PORT: '8347', DCL_DISABLE_ANALYTICS: 'true' }
})
child.on('error', error => { console.error(error.message); process.exitCode = 1 })
child.on('exit', code => { process.exitCode = code ?? 1 })
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal))

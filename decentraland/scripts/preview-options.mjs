// Explicit local-only launcher configuration; never forwards arbitrary CLI flags.
export function previewOptions(args = [], inheritedEnv = {}) {
  if (args.some(arg => arg !== '--native') || args.length > 1) {
    throw new Error('Usage: node scripts/start-local-preview.mjs [--native]')
  }
  return {
    args: ['start', '--skip-install', '--skip-build', '--no-watch', '--no-browser',
      args.includes('--native') ? '--explorer-alpha' : '--no-client', '--port', '8347'],
    env: { ...inheritedEnv, HTTP_SERVER_HOST: '127.0.0.1', HTTP_SERVER_PORT: '8347', DCL_DISABLE_ANALYTICS: 'true' }
  }
}

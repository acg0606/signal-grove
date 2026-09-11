/** Unlike SDK Storage.get's nullable return, preserve HTTP failure vs confirmed absence. */
export function decodeStorageRead(response: { ok: boolean; status: number; body?: string }): string | undefined {
  if (response.status === 404) return undefined
  if (!response.ok || response.status !== 200) throw Error(`Storage read failed (${response.status}); refusing to initialize`)
  const data = JSON.parse(response.body ?? '')
  if (!data || typeof data.value !== 'string') throw Error('Ambiguous storage read; refusing to initialize')
  return data.value
}

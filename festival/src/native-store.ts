import { Storage } from '@dcl/sdk/server'
import { isServer } from '@dcl/sdk/network'
import { getStorageServerUrl } from '@dcl/sdk/server/storage-url'
import { signedFetch } from '~system/SignedFetch'
import { decodeStorageRead } from './storage-response'
import type { Store } from './ledger'
// This internal resolver is pinned to the lab's exact SDK version. Re-audit on upgrade.
export const nativeStore: Store = {
  async get(key) {
    if (!isServer()) throw Error('Server storage only')
    const base = await getStorageServerUrl()
    return decodeStorageRead(await signedFetch({ url: `${base}/values/${encodeURIComponent(key)}` }))
  },
  async set(key, value) {
    if (!isServer()) throw Error('Server storage only')
    return Storage.set(key, value, { skipIfUnchanged: false })
  }
}

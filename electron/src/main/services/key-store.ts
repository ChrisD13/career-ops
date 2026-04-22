import { app, safeStorage } from 'electron'
import { existsSync, promises as fs } from 'fs'
import * as path from 'path'
import writeFileAtomic from 'write-file-atomic'

function keyPath(): string {
  return path.join(app.getPath('userData'), 'api-key.enc')
}

export const keyStore = {
  async hasKey(): Promise<boolean> {
    return existsSync(keyPath())
  },

  async get(): Promise<string | null> {
    const p = keyPath()
    if (!existsSync(p)) return null
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('safeStorage unavailable — cannot decrypt stored API key')
    }
    const buf = await fs.readFile(p)
    return safeStorage.decryptString(buf)
  },

  async save(raw: string): Promise<void> {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('safeStorage unavailable — cannot store API key securely')
    }
    const encrypted = safeStorage.encryptString(raw)
    await writeFileAtomic(keyPath(), encrypted)
  },

  async clear(): Promise<void> {
    const p = keyPath()
    if (existsSync(p)) await fs.unlink(p)
  },

  backendWarning(): string | null {
    if (process.platform !== 'linux') return null
    // safeStorage.getSelectedStorageBackend returns 'basic_text' when no keyring available.
    // Method exists on Electron 15+; guard for older versions just in case.
    const backend = (safeStorage as any).getSelectedStorageBackend?.()
    if (backend === 'basic_text') {
      return 'OS keyring unavailable — your API key is stored with weak protection. Install libsecret or kwallet to upgrade.'
    }
    return null
  },
}

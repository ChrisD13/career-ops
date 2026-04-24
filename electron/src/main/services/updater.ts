// IMPORTANT: import from 'electron-updater', NOT from 'electron'
// Electron's built-in autoUpdater uses Squirrel and does not support Linux AppImage.
import { autoUpdater, type UpdateInfo } from 'electron-updater'
import { app, type BrowserWindow } from 'electron'
import { existsSync, promises as fs } from 'fs'
import * as path from 'path'
import writeFileAtomic from 'write-file-atomic'

function dismissFilePath(): string {
  return path.join(app.getPath('userData'), 'dismissed-update.json')
}

async function getDismissedVersion(): Promise<string | null> {
  const p = dismissFilePath()
  if (!existsSync(p)) return null
  try {
    const raw = await fs.readFile(p, 'utf-8')
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed === 'object' && parsed !== null && 'version' in parsed) {
      return typeof (parsed as Record<string, unknown>).version === 'string'
        ? (parsed as Record<string, unknown>).version as string
        : null
    }
    return null
  } catch { return null }
}

export async function setDismissedVersion(version: string): Promise<void> {
  await writeFileAtomic(dismissFilePath(), JSON.stringify({ version }, null, 2))
}

export function installUpdate(): void {
  // isSilent=false (show dialog on macOS), isForceRunAfter=true (relaunch after install)
  autoUpdater.quitAndInstall(false, true)
}

export function initUpdater(win: BrowserWindow): void {
  if (!app.isPackaged) {
    console.log('[updater] skipped — not packaged')
    return
  }

  autoUpdater.autoDownload = true
  // CRITICAL: set false so "Later" does NOT install on normal app quit.
  // With true (default), any downloaded update installs on every app.quit() —
  // including when the user just closes the window. "Install Now" is the ONLY install path.
  autoUpdater.autoInstallOnAppQuit = false

  autoUpdater.on('checking-for-update', () => {
    console.log('[updater] checking for update...')
  })

  autoUpdater.on('update-not-available', () => {
    console.log('[updater] up to date')
  })

  autoUpdater.on('update-available', (_info: UpdateInfo) => {
    // Download begins automatically (autoDownload=true).
    // Do NOT show UI yet — wait for update-downloaded event.
    // Showing banner on update-available would enable "Install Now" before download completes
    // and result in a no-op click (Pitfall 3 in RESEARCH.md).
    console.log('[updater] update available, downloading...')
  })

  autoUpdater.on('update-downloaded', async (info: UpdateInfo) => {
    const dismissed = await getDismissedVersion()
    if (dismissed === info.version) {
      console.log('[updater] version', info.version, 'was dismissed — skipping banner')
      return
    }

    // releaseNotes is string | ReleaseNoteInfo[] | null when fullChangelog=false (default)
    const releaseNotes = typeof info.releaseNotes === 'string'
      ? info.releaseNotes.split('\n').slice(0, 3).join('\n')
      : null

    if (!win.isDestroyed()) {
      win.webContents.send('updater:status', {
        phase: 'downloaded',
        version: info.version,
        releaseNotes,
      })
    }
  })

  autoUpdater.on('error', (err: Error) => {
    // Fail silently — log only, no user-facing banner (per CONTEXT.md decisions)
    console.warn('[updater] error (silent):', err.message)
  })

  void autoUpdater.checkForUpdates()
}

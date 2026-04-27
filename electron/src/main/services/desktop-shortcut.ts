import { app } from 'electron'
import { existsSync, promises as fs } from 'fs'
import * as path from 'path'
import writeFileAtomic from 'write-file-atomic'

const SHORTCUT_NAME = 'jobengine'   // .desktop basename, stable across versions
const ICON_NAME     = 'jobengine'   // XDG icon-theme name, stable across versions

function shortcutPath(): string {
  return path.join(app.getPath('home'), '.local', 'share', 'applications', `${SHORTCUT_NAME}.desktop`)
}

function iconTargetPath(): string {
  return path.join(app.getPath('home'), '.local', 'share', 'icons', 'hicolor', '256x256', 'apps', `${ICON_NAME}.png`)
}

function buildDesktopEntry(appImagePath: string, version: string): string {
  return [
    '[Desktop Entry]',
    'Version=1.5',
    'Type=Application',
    'Name=JobEngine',
    'Comment=AI-powered job search — VC portfolio discovery and pipeline tracker',
    `Exec="${appImagePath}"`,
    `Icon=${ICON_NAME}`,
    'Terminal=false',
    'Categories=Utility;',
    'StartupWMClass=JobEngine',
    `X-JobEngine-Version=${version}`,
    '',
  ].join('\n')
}

export async function ensureDesktopShortcut(): Promise<void> {
  if (!app.isPackaged) return

  const appImagePath = process.env.APPIMAGE
  if (!appImagePath) {
    console.log('[desktop-shortcut] $APPIMAGE not set — skipping (packaged-but-not-AppImage build)')
    return
  }

  const target = shortcutPath()
  if (existsSync(target)) return // DESK-02: idempotent — never overwrite user's file

  const newEntry = buildDesktopEntry(appImagePath, app.getVersion())

  try {
    const appDir = process.env.APPDIR
    if (appDir) {
      const iconSrc = path.join(appDir, 'usr', 'share', 'icons', 'hicolor', '256x256', 'apps', 'jobengine-electron.png')
      const iconDst = iconTargetPath()
      if (existsSync(iconSrc) && !existsSync(iconDst)) {
        await fs.mkdir(path.dirname(iconDst), { recursive: true })
        const buf = await fs.readFile(iconSrc)
        await writeFileAtomic(iconDst, buf)
      }
    }

    await fs.mkdir(path.dirname(target), { recursive: true })
    await writeFileAtomic(target, newEntry, { mode: 0o644 })

    console.log('[desktop-shortcut] created/updated', target)
  } catch (err) {
    console.warn('[desktop-shortcut] failed (non-fatal):', (err as Error).message)
  }
}

import { app, BrowserWindow, session } from 'electron'
import { join, resolve } from 'path'
import { existsSync } from 'fs'
import { spawn } from 'child_process'
import { is } from '@electron-toolkit/utils'
import { registerIpcHandlers } from './ipc-handlers'
import { startFileWatcher } from './watcher'
import { MtimeCache } from './services/mtime-cache'
import { initScheduler, stopScheduler } from './services/scheduler'
import { initUpdater } from './services/updater'

async function ensureRootDeps(projectRoot: string): Promise<void> {
  const required = ['robots-parser', 'write-file-atomic', 'node-cron']
  const missing = required.filter(dep => !existsSync(join(projectRoot, 'node_modules', dep)))
  if (missing.length === 0) return
  console.log('[main] installing missing root deps:', missing.join(', '))
  await new Promise<void>((resolve) => {
    const proc = spawn('npm', ['install'], { cwd: projectRoot, stdio: 'inherit' })
    proc.on('close', () => resolve())
    proc.on('error', (err) => { console.warn('[main] npm install failed:', err.message); resolve() })
  })
}

function resolveProjectRoot(): string {
  if (!app.isPackaged) {
    return resolve(__dirname, '..', '..', '..')
  }
  return resolve(app.getAppPath(), '..')
}

function createWindow(projectRoot: string): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    backgroundColor: '#1e1e2e',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
    }
  })

  mainWindow.once('ready-to-show', () => mainWindow.show())

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

function installCspHeader(): void {
  const prod = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'"
  const dev = "default-src 'self' 'unsafe-inline' http://localhost:* ws://localhost:*; script-src 'self' 'unsafe-inline' http://localhost:*; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' http://localhost:* ws://localhost:*"
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [is.dev ? dev : prod],
      }
    })
  })
}

app.whenReady().then(async () => {
  const projectRoot = resolveProjectRoot()
  console.log('[main] project root:', projectRoot)

  installCspHeader()

  // Ensure scraper deps are installed (dev only — packaged builds bundle node_modules)
  if (!app.isPackaged) {
    await ensureRootDeps(projectRoot)
  }

  // Shared state across windows + services
  const pendingGuiWrites = new Set<string>()
  const mtimeCache = new MtimeCache(projectRoot)
  await mtimeCache.init()

  const mainWindow = createWindow(projectRoot)

  registerIpcHandlers({ projectRoot, pendingGuiWrites, mtimeCache, win: mainWindow })
  const stopWatcher = startFileWatcher(projectRoot, mainWindow, pendingGuiWrites)
  await initScheduler(projectRoot, mainWindow)
  // Phase 5 — auto-update: check after 5s so startup UX is not blocked
  // Called once here; NOT inside app.on('activate') — same idempotent-unsafe constraint as registerIpcHandlers
  setTimeout(() => { initUpdater(mainWindow) }, 5000)

  mainWindow.on('closed', () => {
    stopWatcher()
    stopScheduler()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const win = createWindow(projectRoot)
      startFileWatcher(projectRoot, win, pendingGuiWrites)
      // NOTE: registerIpcHandlers is idempotent-unsafe (would double-register); we do NOT
      // re-call it. The new window reuses the handlers registered on the first ready.
      // If cross-window IPC is needed later, move to a per-window handler registry.
    }
  })

  // Persist mtime sidecar on app shutdown (best-effort)
  app.on('before-quit', () => {
    stopScheduler()
    void mtimeCache.persist().catch(() => { /* non-fatal */ })
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

import chokidar, { type ChokidarOptions } from 'chokidar'
import { BrowserWindow } from 'electron'

function isWSL(): boolean {
  return !!process.env.WSL_DISTRO_NAME || !!process.env.WSLENV
}

export function startFileWatcher(projectRoot: string, win: BrowserWindow): () => void {
  const paths = [
    `${projectRoot}/data/applications.md`,
    `${projectRoot}/data/pipeline.md`,
    `${projectRoot}/reports`,
  ]

  const watchOpts: ChokidarOptions = {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
    usePolling: isWSL(),
    interval: isWSL() ? 1000 : 100,
  }

  const watcher = chokidar.watch(paths, watchOpts)
  let debounceTimer: NodeJS.Timeout | null = null

  watcher.on('all', () => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      if (!win.isDestroyed()) {
        win.webContents.send('files-changed')
      }
    }, 300)
  })

  watcher.on('error', (err) => {
    console.error('[watcher] error:', err)
    if (!win.isDestroyed()) {
      win.webContents.send('watcher-error', String(err))
    }
  })

  return () => {
    if (debounceTimer) clearTimeout(debounceTimer)
    void watcher.close()
  }
}

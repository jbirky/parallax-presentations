// Must be set before app is imported
process.env.ELECTRON_DISABLE_SANDBOX = '1'

const { app, BrowserWindow, shell, dialog, session } = require('electron')
const path = require('path')
const net = require('net')

app.commandLine.appendSwitch('no-sandbox')

// Electron names the user data folder after package.json's name. Keep the
// folder from before the package was renamed so existing desktop installs
// still find their presentations and uploads.
app.setPath('userData', path.join(app.getPath('appData'), 'revealjs-editor'))

let mainWindow
let serverInstance
let activePort

function getResourcePath(...parts) {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, ...parts)
  }
  return path.join(__dirname, '..', ...parts)
}

function findFreePort(preferred) {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.on('error', () => {
      // preferred is taken; let OS assign any free port
      const fallback = net.createServer()
      fallback.unref()
      fallback.listen(0, '127.0.0.1', () => {
        const port = fallback.address().port
        fallback.close(() => resolve(port))
      })
      fallback.on('error', reject)
    })
    server.listen(preferred, '127.0.0.1', () => {
      server.close(() => resolve(preferred))
    })
  })
}

async function startBackend() {
  const userData = app.getPath('userData')
  const dataDir = path.join(userData, 'data')
  const uploadsDir = path.join(userData, 'uploads')

  activePort = await findFreePort(3002)

  process.env.SLIDES_DATA_DIR = dataDir
  process.env.SLIDES_UPLOADS_DIR = uploadsDir
  process.env.NODE_ENV = 'production'
  process.env.PORT = String(activePort)

  const serverPath = getResourcePath('server', 'index.js')
  const { startServer } = require(serverPath)
  serverInstance = await startServer(activePort)

  console.log(`Backend started on port ${activePort}`)
  console.log(`Data: ${dataDir}`)
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    title: 'Parallax',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  mainWindow.loadURL(`http://localhost:${activePort}`)

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// Every window the app opens (the editor, and its Present, Presenter Mode and
// PDF windows) stays on the app: a deck runs its author's code, so what it can
// open or navigate to is only the app's own pages; web links go to the
// browser, and anything else is refused
const own = url => url.startsWith(`http://localhost:${activePort}/`) || url === `http://localhost:${activePort}` ||
  url.startsWith(`blob:http://localhost:${activePort}/`)
app.on('web-contents-created', (event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    if (own(url)) return { action: 'allow' }
    if (/^https?:\/\//i.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  contents.on('will-navigate', (e, url) => {
    if (own(url)) return
    e.preventDefault()
    if (/^https?:\/\//i.test(url)) shell.openExternal(url)
  })
})

// Only what the editor uses (copying, fullscreen presenting, and pointer lock
// for 3D embeds); a camera, microphone, location and the rest are refused
const ALLOWED_PERMISSIONS = new Set(['clipboard-sanitized-write', 'clipboard-read', 'fullscreen', 'pointerLock'])

app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback) => callback(ALLOWED_PERMISSIONS.has(permission)))
  session.defaultSession.setPermissionCheckHandler((contents, permission) => ALLOWED_PERMISSIONS.has(permission))
  try {
    await startBackend()
    createWindow()
  } catch (err) {
    dialog.showErrorBox('Startup Error', `Failed to start: ${err.message}`)
    app.quit()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  if (serverInstance) {
    serverInstance.close()
  }
})

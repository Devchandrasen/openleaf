import { app, BrowserWindow, ipcMain, Menu, shell, type MenuItemConstructorOptions } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import { IPC_CHANNELS } from '../shared/ipc'
import { registerCompilerHandlers } from './compiler'
import { registerFileHandlers } from './fileManager'
import { registerAIHandlers } from './aiService'

// ──── Globals ────

let mainWindow: BrowserWindow | null = null

function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

// ──── Recent Projects (for menu) ────

function getRecentProjectsPath(): string {
  const appData = process.env.APPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Roaming')
  const storageDir = path.join(appData, 'openleaf')
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true })
  }
  return path.join(storageDir, 'recent-projects.json')
}

interface RecentProject {
  name: string
  path: string
}

function loadRecentProjectsForMenu(): RecentProject[] {
  try {
    const raw = fs.readFileSync(getRecentProjectsPath(), 'utf-8')
    const data = JSON.parse(raw)
    if (!Array.isArray(data)) return []
    return data.slice(0, 10).map((p: { name: string; path: string }) => ({
      name: p.name,
      path: p.path
    }))
  } catch {
    return []
  }
}

// ──── Application Menu ────

function buildAppMenu(): void {
  const recentProjects = loadRecentProjectsForMenu()

  const recentSubmenu: MenuItemConstructorOptions[] =
    recentProjects.length > 0
      ? [
          ...recentProjects.map(
            (proj): MenuItemConstructorOptions => ({
              label: `${proj.name}  —  ${proj.path}`,
              click: () => {
                mainWindow?.webContents.send('menu:openRecent', proj.path)
              }
            })
          ),
          { type: 'separator' },
          {
            label: 'Clear Recent Projects',
            click: () => {
              try {
                fs.writeFileSync(getRecentProjectsPath(), '[]', 'utf-8')
                buildAppMenu() // Rebuild menu after clearing
              } catch {
                // noop
              }
            }
          }
        ]
      : [{ label: 'No Recent Projects', enabled: false }]

  const template: MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Project',
          accelerator: 'CmdOrCtrl+Shift+N',
          click: () => mainWindow?.webContents.send('menu:newProject')
        },
        {
          label: 'Open Project',
          accelerator: 'CmdOrCtrl+O',
          click: () => mainWindow?.webContents.send('menu:openProject')
        },
        {
          label: 'Open Recent',
          submenu: recentSubmenu
        },
        { type: 'separator' },
        {
          label: 'New File',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow?.webContents.send('menu:newFile')
        },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow?.webContents.send('menu:save')
        },
        {
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => mainWindow?.webContents.send('menu:saveAs')
        },
        { type: 'separator' },
        {
          label: 'Export as ZIP',
          click: () => mainWindow?.webContents.send('menu:exportZip')
        },
        { type: 'separator' },
        {
          label: 'Close Project',
          accelerator: 'CmdOrCtrl+W',
          click: () => mainWindow?.webContents.send('menu:closeProject')
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: 'Alt+F4',
          click: () => app.quit()
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo', accelerator: 'CmdOrCtrl+Z' },
        { role: 'redo', accelerator: 'CmdOrCtrl+Shift+Z' },
        { type: 'separator' },
        { role: 'cut', accelerator: 'CmdOrCtrl+X' },
        { role: 'copy', accelerator: 'CmdOrCtrl+C' },
        { role: 'paste', accelerator: 'CmdOrCtrl+V' },
        { role: 'selectAll', accelerator: 'CmdOrCtrl+A' },
        { type: 'separator' },
        {
          label: 'Find',
          accelerator: 'CmdOrCtrl+F',
          click: () => mainWindow?.webContents.send('menu:find')
        },
        {
          label: 'Find and Replace',
          accelerator: 'CmdOrCtrl+H',
          click: () => mainWindow?.webContents.send('menu:findReplace')
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Sidebar',
          accelerator: 'CmdOrCtrl+B',
          click: () => mainWindow?.webContents.send('menu:toggleSidebar')
        },
        {
          label: 'Toggle PDF Preview',
          accelerator: 'CmdOrCtrl+Shift+P',
          click: () => mainWindow?.webContents.send('menu:togglePreview')
        },
        {
          label: 'Toggle Console',
          accelerator: 'CmdOrCtrl+`',
          click: () => mainWindow?.webContents.send('menu:toggleConsole')
        },
        { type: 'separator' },
        {
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+=',
          click: () => mainWindow?.webContents.send('menu:zoomIn')
        },
        {
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+-',
          click: () => mainWindow?.webContents.send('menu:zoomOut')
        },
        {
          label: 'Reset Zoom',
          accelerator: 'CmdOrCtrl+0',
          click: () => mainWindow?.webContents.send('menu:zoomReset')
        },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { type: 'separator' },
        { role: 'toggleDevTools', accelerator: 'F12' }
      ]
    },
    {
      label: 'Build',
      submenu: [
        {
          label: 'Compile',
          accelerator: 'CmdOrCtrl+Shift+B',
          click: () => mainWindow?.webContents.send('menu:compile')
        },
        {
          label: 'Stop Compilation',
          accelerator: 'CmdOrCtrl+Shift+K',
          click: () => mainWindow?.webContents.send('menu:compileStop')
        },
        { type: 'separator' },
        {
          label: 'Clean Auxiliary Files',
          click: () => mainWindow?.webContents.send('menu:cleanAux')
        },
        { type: 'separator' },
        {
          label: 'Use pdfLaTeX',
          type: 'radio',
          checked: true,
          click: () => mainWindow?.webContents.send('menu:setEngine', 'pdflatex')
        },
        {
          label: 'Use XeLaTeX',
          type: 'radio',
          click: () => mainWindow?.webContents.send('menu:setEngine', 'xelatex')
        },
        {
          label: 'Use LuaLaTeX',
          type: 'radio',
          click: () => mainWindow?.webContents.send('menu:setEngine', 'lualatex')
        }
      ]
    },
    {
      label: 'Tools',
      submenu: [
        {
          label: 'Spell Check',
          accelerator: 'F7',
          click: () => mainWindow?.webContents.send('menu:spellCheck')
        },
        {
          label: 'Word Count',
          click: () => mainWindow?.webContents.send('menu:wordCount')
        },
        { type: 'separator' },
        {
          label: 'Insert Table Wizard',
          click: () => mainWindow?.webContents.send('menu:insertTable')
        },
        {
          label: 'Insert Figure',
          click: () => mainWindow?.webContents.send('menu:insertFigure')
        },
        {
          label: 'Insert Citation',
          click: () => mainWindow?.webContents.send('menu:insertCitation')
        },
        { type: 'separator' },
        {
          label: 'Settings',
          accelerator: 'CmdOrCtrl+,',
          click: () => mainWindow?.webContents.send('menu:settings')
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation',
          click: () => shell.openExternal('https://github.com/openleaf/openleaf/wiki')
        },
        {
          label: 'LaTeX Reference',
          click: () => shell.openExternal('https://www.latex-project.org/help/documentation/')
        },
        { type: 'separator' },
        {
          label: 'Report Issue',
          click: () => shell.openExternal('https://github.com/openleaf/openleaf/issues')
        },
        { type: 'separator' },
        {
          label: `About Openleaf`,
          click: () => mainWindow?.webContents.send('menu:about')
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

// ──── Window Creation ────

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    backgroundColor: '#0d1117',
    show: false,
    titleBarStyle: 'hidden',
    icon: path.join(__dirname, '../../resources/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: false,
      spellcheck: true
    }
  })

  // Show window once content is ready to avoid visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  // Track maximize state changes
  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window:maximizeChanged', true)
  })

  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window:maximizeChanged', false)
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Load the renderer
  if (process.env.ELECTRON_RENDERER_URL) {
    // Development: load from Vite dev server
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    // Production: load the built file
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

// ──── Window Control IPC ────

function registerWindowHandlers(): void {
  ipcMain.on(IPC_CHANNELS.WINDOW_MINIMIZE, () => {
    mainWindow?.minimize()
  })

  ipcMain.on(IPC_CHANNELS.WINDOW_MAXIMIZE, () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow?.maximize()
    }
  })

  ipcMain.on(IPC_CHANNELS.WINDOW_CLOSE, () => {
    mainWindow?.close()
  })

  ipcMain.handle(IPC_CHANNELS.WINDOW_IS_MAXIMIZED, () => {
    return mainWindow?.isMaximized() ?? false
  })
}

// ──── Settings IPC ────

function getSettingsPath(): string {
  const appData = process.env.APPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Roaming')
  const dir = path.join(appData, 'openleaf')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return path.join(dir, 'settings.json')
}

interface AppSettings {
  [key: string]: unknown
}

const DEFAULT_SETTINGS: AppSettings = {
  editorFontFamily: "'Fira Code', 'Cascadia Code', 'Consolas', monospace",
  editorFontSize: 14,
  editorTheme: 'dark',
  editorKeymap: 'default',
  editorTabSize: 4,
  editorWordWrap: true,
  editorLineNumbers: true,
  editorMinimap: false,
  defaultEngine: 'pdflatex',
  autoCompile: false,
  autoCompileDelay: 3000,
  compileTimeout: 60000,
  theme: 'dark',
  accentColor: '#58a6ff',
  sidebarPosition: 'left',
  spellCheckEnabled: true,
  spellCheckLanguage: 'en-US',
  latexPath: ''
}

function loadSettings(): AppSettings {
  try {
    const raw = fs.readFileSync(getSettingsPath(), 'utf-8')
    const saved = JSON.parse(raw)
    return { ...DEFAULT_SETTINGS, ...saved }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

function saveSettings(settings: AppSettings): void {
  try {
    fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2), 'utf-8')
  } catch {
    // noop
  }
}

function registerSettingsHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, (_event, key: string) => {
    const settings = loadSettings()
    return settings[key] ?? (DEFAULT_SETTINGS as AppSettings)[key] ?? null
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, (_event, key: string, value: unknown) => {
    const settings = loadSettings()
    settings[key] = value
    saveSettings(settings)
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET_ALL, () => {
    return loadSettings()
  })
}

// ──── App Lifecycle ────

app.whenReady().then(() => {
  // Register all IPC handlers before creating the window
  registerWindowHandlers()
  registerSettingsHandlers()
  registerCompilerHandlers(ipcMain, getMainWindow)
  registerFileHandlers(ipcMain, getMainWindow)
  registerAIHandlers()

  // Build the application menu
  buildAppMenu()

  // Create the main window
  createWindow()

  app.on('activate', () => {
    // macOS: re-create window when dock icon clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  app.quit()
})

// Security: prevent new window creation from the renderer
app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    // Allow external links to open in the system browser
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })
})

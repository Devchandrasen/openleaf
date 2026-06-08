// Shared IPC channel definitions and types between main and renderer processes

// ──── IPC Channel Names ────
export const IPC_CHANNELS = {
  // Compiler
  COMPILE_PROJECT: 'compiler:compile',
  COMPILE_STOP: 'compiler:stop',
  COMPILE_STATUS: 'compiler:status',
  COMPILE_LOG: 'compiler:log',

  // File System
  FS_READ_FILE: 'fs:readFile',
  FS_READ_FILE_BINARY: 'fs:readFileBinary',
  FS_WRITE_FILE: 'fs:writeFile',
  FS_CREATE_FILE: 'fs:createFile',
  FS_DELETE_FILE: 'fs:deleteFile',
  FS_RENAME_FILE: 'fs:renameFile',
  FS_READ_DIR: 'fs:readDir',
  FS_CREATE_DIR: 'fs:createDir',
  FS_DELETE_DIR: 'fs:deleteDir',
  FS_COPY_FILE: 'fs:copyFile',
  FS_SAVE_VERSION: 'fs:saveVersion',
  FS_GET_VERSIONS: 'fs:getVersions',
  FS_WATCH: 'fs:watch',
  FS_UNWATCH: 'fs:unwatch',
  FS_CHANGE: 'fs:change',

  // Git
  GIT_INIT: 'git:init',
  GIT_COMMIT: 'git:commit',
  GIT_GET_HISTORY: 'git:getHistory',
  GIT_CHECKOUT: 'git:checkout',
  GIT_SHOW: 'git:show',

  // SyncTeX
  SYNCTEX_FORWARD: 'synctex:forward',
  SYNCTEX_BACKWARD: 'synctex:backward',

  // Project
  PROJECT_OPEN: 'project:open',
  PROJECT_CREATE: 'project:create',
  PROJECT_CLOSE: 'project:close',
  PROJECT_GET_RECENT: 'project:getRecent',
  PROJECT_EXPORT_ZIP: 'project:exportZip',
  PROJECT_IMPORT_ZIP: 'project:importZip',
  PROJECT_SHARE: 'project:share',
  PROJECT_SHARE_STOP: 'project:shareStop',

  // Dialog
  DIALOG_OPEN_FOLDER: 'dialog:openFolder',
  DIALOG_OPEN_FILE: 'dialog:openFile',
  DIALOG_SAVE_FILE: 'dialog:saveFile',

  // Window
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',
  WINDOW_IS_MAXIMIZED: 'window:isMaximized',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_GET_ALL: 'settings:getAll',

  // AI
  AI_ASK: 'ai:ask',
} as const

// ──── Type Definitions ────

export interface FileEntry {
  name: string
  path: string
  relativePath: string
  isDirectory: boolean
  children?: FileEntry[]
  size?: number
  modified?: number
}

export interface CompileOptions {
  projectPath: string
  mainFile: string
  engine: 'pdflatex' | 'xelatex' | 'lualatex'
  flags?: string[]
}

export interface CompileResult {
  success: boolean
  pdfPath?: string
  log: string
  errors: CompileError[]
  warnings: CompileWarning[]
  duration: number
}

export interface CompileError {
  file: string
  line: number
  message: string
  type: 'error'
}

export interface CompileWarning {
  file: string
  line: number
  message: string
  type: 'warning'
}

export interface ProjectInfo {
  name: string
  path: string
  mainFile: string
  lastOpened: number
  created: number
  engine: 'pdflatex' | 'xelatex' | 'lualatex'
}

export interface AppSettings {
  // Editor
  editorFontFamily: string
  editorFontSize: number
  editorTheme: 'dark' | 'light'
  editorKeymap: 'default' | 'vim' | 'emacs'
  editorTabSize: number
  editorWordWrap: boolean
  editorLineNumbers: boolean
  editorMinimap: boolean

  // Compiler
  defaultEngine: 'pdflatex' | 'xelatex' | 'lualatex'
  autoCompile: boolean
  autoCompileDelay: number
  compileTimeout: number

  // Appearance
  theme: 'dark' | 'light' | 'system'
  accentColor: string
  sidebarPosition: 'left' | 'right'

  // Spell Check
  spellCheckEnabled: boolean
  spellCheckLanguage: string

  // LaTeX
  latexPath: string
}

// ──── Preload API Type ────
export interface OpenleafAPI {
  compiler: {
    compile: (options: CompileOptions) => Promise<CompileResult>
    stop: () => Promise<void>
    onLog: (callback: (log: string) => void) => void
  }
  fs: {
    readFile: (filePath: string) => Promise<string>
    readFileBinary: (filePath: string) => Promise<Uint8Array>
    writeFile: (filePath: string, content: string) => Promise<void>
    createFile: (filePath: string, content?: string) => Promise<void>
    deleteFile: (filePath: string) => Promise<void>
    renameFile: (oldPath: string, newPath: string) => Promise<void>
    readDir: (dirPath: string) => Promise<FileEntry[]>
    createDir: (dirPath: string) => Promise<void>
    deleteDir: (dirPath: string) => Promise<void>
    copyFile: (srcPath: string, destPath: string) => Promise<void>
    saveVersion: (projectPath: string, filePath: string, name: string) => Promise<void>
    getVersions: (projectPath: string) => Promise<{ id: string; name: string; timestamp: number; content: string }[]>
    onFileChange: (callback: (event: string, path: string) => void) => void
  }
  project: {
    open: (path: string) => Promise<ProjectInfo>
    create: (name: string, templateId?: string) => Promise<ProjectInfo>
    close: () => Promise<void>
    getRecent: () => Promise<ProjectInfo[]>
    exportZip: (destPath: string) => Promise<void>
    share: (projectPath: string) => Promise<string>
    stopSharing: () => Promise<void>
  }
  dialog: {
    openFolder: () => Promise<string | null>
    openFile: (filters?: { name: string; extensions: string[] }[]) => Promise<string | null>
    saveFile: (defaultName: string, filters?: { name: string; extensions: string[] }[]) => Promise<string | null>
  }
  window: {
    minimize: () => void
    maximize: () => void
    close: () => void
    isMaximized: () => Promise<boolean>
  }
  settings: {
    get: <K extends keyof AppSettings>(key: K) => Promise<AppSettings[K]>
    set: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>
    getAll: () => Promise<AppSettings>
  }
  menu: {
    onAction: (callback: (action: string, data?: any) => void) => void
  }
  git: {
    init: (projectPath: string) => Promise<void>
    commit: (projectPath: string, message: string) => Promise<boolean>
    getHistory: (projectPath: string) => Promise<{ hash: string; message: string; timestamp: number; author: string }[]>
    checkout: (projectPath: string, commitHash: string, fileRelativePath: string) => Promise<void>
    show: (projectPath: string, commitHash: string, fileRelativePath: string) => Promise<string>
  }
  synctex: {
    forward: (texPath: string, line: number, pdfPath: string) => Promise<{ page: number; x: number; y: number } | null>
    backward: (page: number, x: number, y: number, pdfPath: string) => Promise<{ path: string; line: number; column: number } | null>
  }
  ai: {
    ask: (prompt: string, context?: string) => Promise<string>
  }
}

declare global {
  interface Window {
    api: OpenleafAPI
  }
}

import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS, type OpenleafAPI } from '../shared/ipc'

const api: OpenleafAPI = {
  compiler: {
    compile: (options) => ipcRenderer.invoke(IPC_CHANNELS.COMPILE_PROJECT, options),
    stop: () => ipcRenderer.invoke(IPC_CHANNELS.COMPILE_STOP),
    onLog: (callback) => {
      // Remove any previous listeners to avoid stacking
      ipcRenderer.removeAllListeners(IPC_CHANNELS.COMPILE_LOG)
      ipcRenderer.on(IPC_CHANNELS.COMPILE_LOG, (_event, log: string) => {
        callback(log)
      })
    }
  },

  fs: {
    readFile: (filePath) => ipcRenderer.invoke(IPC_CHANNELS.FS_READ_FILE, filePath),
    readFileBinary: (filePath) => ipcRenderer.invoke(IPC_CHANNELS.FS_READ_FILE_BINARY, filePath),
    writeFile: (filePath, content) => ipcRenderer.invoke(IPC_CHANNELS.FS_WRITE_FILE, filePath, content),
    createFile: (filePath, content?) => ipcRenderer.invoke(IPC_CHANNELS.FS_CREATE_FILE, filePath, content),
    deleteFile: (filePath) => ipcRenderer.invoke(IPC_CHANNELS.FS_DELETE_FILE, filePath),
    renameFile: (oldPath, newPath) => ipcRenderer.invoke(IPC_CHANNELS.FS_RENAME_FILE, oldPath, newPath),
    readDir: (dirPath) => ipcRenderer.invoke(IPC_CHANNELS.FS_READ_DIR, dirPath),
    createDir: (dirPath) => ipcRenderer.invoke(IPC_CHANNELS.FS_CREATE_DIR, dirPath),
    deleteDir: (dirPath) => ipcRenderer.invoke(IPC_CHANNELS.FS_DELETE_DIR, dirPath),
    copyFile: (srcPath, destPath) => ipcRenderer.invoke(IPC_CHANNELS.FS_COPY_FILE, srcPath, destPath),
    saveVersion: (projectPath, filePath, name) => ipcRenderer.invoke(IPC_CHANNELS.FS_SAVE_VERSION, projectPath, filePath, name),
    getVersions: (projectPath) => ipcRenderer.invoke(IPC_CHANNELS.FS_GET_VERSIONS, projectPath),
    onFileChange: (callback) => {
      ipcRenderer.removeAllListeners(IPC_CHANNELS.FS_CHANGE)
      ipcRenderer.on(IPC_CHANNELS.FS_CHANGE, (_event, eventType: string, filePath: string) => {
        callback(eventType, filePath)
      })
    }
  },

  project: {
    open: (projectPath) => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_OPEN, projectPath),
    create: (name, templateId?) => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_CREATE, name, templateId),
    close: () => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_CLOSE),
    getRecent: () => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_GET_RECENT),
    exportZip: (destPath) => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_EXPORT_ZIP, destPath),
    share: (projectPath) => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_SHARE, projectPath),
    stopSharing: () => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_SHARE_STOP)
  },

  dialog: {
    openFolder: () => ipcRenderer.invoke(IPC_CHANNELS.DIALOG_OPEN_FOLDER),
    openFile: (filters?) => ipcRenderer.invoke(IPC_CHANNELS.DIALOG_OPEN_FILE, filters),
    saveFile: (defaultName, filters?) => ipcRenderer.invoke(IPC_CHANNELS.DIALOG_SAVE_FILE, defaultName, filters)
  },

  window: {
    minimize: () => { ipcRenderer.send(IPC_CHANNELS.WINDOW_MINIMIZE) },
    maximize: () => { ipcRenderer.send(IPC_CHANNELS.WINDOW_MAXIMIZE) },
    close: () => { ipcRenderer.send(IPC_CHANNELS.WINDOW_CLOSE) },
    isMaximized: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_IS_MAXIMIZED)
  },

  settings: {
    get: (key) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET, key),
    set: (key, value) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, key, value),
    getAll: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET_ALL)
  },

  menu: {
    onAction: (callback) => {
      const channels = [
        'menu:openRecent',
        'menu:newProject',
        'menu:openProject',
        'menu:newFile',
        'menu:save',
        'menu:saveAs',
        'menu:exportZip',
        'menu:closeProject',
        'menu:find',
        'menu:findReplace',
        'menu:toggleSidebar',
        'menu:togglePreview',
        'menu:toggleConsole',
        'menu:zoomIn',
        'menu:zoomOut',
        'menu:zoomReset',
        'menu:compile',
        'menu:compileStop',
        'menu:cleanAux',
        'menu:setEngine',
        'menu:spellCheck',
        'menu:wordCount',
        'menu:insertTable',
        'menu:insertFigure',
        'menu:insertCitation',
        'menu:settings',
        'menu:about'
      ]
      channels.forEach((channel) => {
        ipcRenderer.removeAllListeners(channel)
        ipcRenderer.on(channel, (_event, ...args) => {
          callback(channel, ...args)
        })
      })
    }
  },

  git: {
    init: (projectPath) => ipcRenderer.invoke(IPC_CHANNELS.GIT_INIT, projectPath),
    commit: (projectPath, message) => ipcRenderer.invoke(IPC_CHANNELS.GIT_COMMIT, projectPath, message),
    getHistory: (projectPath) => ipcRenderer.invoke(IPC_CHANNELS.GIT_GET_HISTORY, projectPath),
    checkout: (projectPath, commitHash, fileRelativePath) =>
      ipcRenderer.invoke(IPC_CHANNELS.GIT_CHECKOUT, projectPath, commitHash, fileRelativePath),
    show: (projectPath, commitHash, fileRelativePath) =>
      ipcRenderer.invoke(IPC_CHANNELS.GIT_SHOW, projectPath, commitHash, fileRelativePath)
  },

  synctex: {
    forward: (texPath, line, pdfPath) =>
      ipcRenderer.invoke(IPC_CHANNELS.SYNCTEX_FORWARD, texPath, line, pdfPath),
    backward: (page, x, y, pdfPath) =>
      ipcRenderer.invoke(IPC_CHANNELS.SYNCTEX_BACKWARD, page, x, y, pdfPath)
  },

  ai: {
    ask: (prompt, context?) => ipcRenderer.invoke(IPC_CHANNELS.AI_ASK, prompt, context)
  }
}

contextBridge.exposeInMainWorld('api', api)

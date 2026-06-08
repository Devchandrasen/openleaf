import { type IpcMain, type BrowserWindow, dialog, shell } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { exec } from 'child_process'
import {
  IPC_CHANNELS,
  type FileEntry,
  type ProjectInfo
} from '../shared/ipc'
import { shareManager } from './server'

let parentWindowGetter: () => BrowserWindow | null = () => null

function runGitCommand(cmd: string, cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(cmd, { cwd }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message))
        return
      }
      resolve(stdout.trim())
    })
  })
}

// ──── Recent Projects Storage ────

const RECENT_PROJECTS_FILENAME = 'recent-projects.json'
const MAX_RECENT_PROJECTS = 20

function getRecentProjectsPath(): string {
  const appData = process.env.APPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Roaming')
  const storageDir = path.join(appData, 'openleaf')
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true })
  }
  return path.join(storageDir, RECENT_PROJECTS_FILENAME)
}

function loadRecentProjects(): ProjectInfo[] {
  try {
    const filePath = getRecentProjectsPath()
    if (!fs.existsSync(filePath)) return []
    const raw = fs.readFileSync(filePath, 'utf-8')
    const data = JSON.parse(raw)
    if (!Array.isArray(data)) return []
    return data
  } catch {
    return []
  }
}

function saveRecentProjects(projects: ProjectInfo[]): void {
  try {
    const filePath = getRecentProjectsPath()
    fs.writeFileSync(filePath, JSON.stringify(projects, null, 2), 'utf-8')
  } catch {
    // Silently fail — non-critical
  }
}

function addToRecentProjects(project: ProjectInfo): void {
  const projects = loadRecentProjects()
  // Remove existing entry for same path to avoid duplicates
  const filtered = projects.filter((p) => p.path !== project.path)
  filtered.unshift(project)
  // Cap list size
  if (filtered.length > MAX_RECENT_PROJECTS) {
    filtered.length = MAX_RECENT_PROJECTS
  }
  saveRecentProjects(filtered)
}

// ──── Directory Tree Builder ────

function buildFileTree(dirPath: string, basePath: string): FileEntry[] {
  const entries: FileEntry[] = []

  let dirEntries: fs.Dirent[]
  try {
    dirEntries = fs.readdirSync(dirPath, { withFileTypes: true })
  } catch {
    return entries
  }

  // Sort: directories first, then alphabetically
  dirEntries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1
    if (!a.isDirectory() && b.isDirectory()) return 1
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })

  for (const entry of dirEntries) {
    // Skip hidden files/dirs and common generated artifacts
    if (entry.name.startsWith('.')) continue
    if (entry.name === 'node_modules') continue

    const fullPath = path.join(dirPath, entry.name)
    const relativePath = path.relative(basePath, fullPath)

    if (entry.isDirectory()) {
      const children = buildFileTree(fullPath, basePath)
      entries.push({
        name: entry.name,
        path: fullPath,
        relativePath,
        isDirectory: true,
        children
      })
    } else {
      let stats: fs.Stats | null = null
      try {
        stats = fs.statSync(fullPath)
      } catch {
        // Skip files we can't stat
      }
      entries.push({
        name: entry.name,
        path: fullPath,
        relativePath,
        isDirectory: false,
        size: stats?.size,
        modified: stats?.mtimeMs
      })
    }
  }

  return entries
}

// ──── Find Main .tex File ────

/**
 * Scans a project directory to find the "main" .tex file.
 * Priority:
 *  1. A file named main.tex
 *  2. The first .tex file containing \documentclass
 *  3. The first .tex file found
 */
function findMainTexFile(projectPath: string): string | null {
  let texFiles: string[] = []

  try {
    const entries = fs.readdirSync(projectPath)
    texFiles = entries.filter((e) => e.endsWith('.tex'))
  } catch {
    return null
  }

  if (texFiles.length === 0) return null

  // Priority 1: main.tex
  if (texFiles.includes('main.tex')) return 'main.tex'

  // Priority 2: file containing \documentclass
  for (const file of texFiles) {
    try {
      const content = fs.readFileSync(path.join(projectPath, file), 'utf-8')
      if (content.includes('\\documentclass')) return file
    } catch {
      continue
    }
  }

  // Priority 3: first .tex file
  return texFiles[0]
}

// ──── Default Template ────

const DEFAULT_TEX_TEMPLATE = `\\documentclass[12pt,a4paper]{article}

\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{amsmath,amssymb}
\\usepackage{graphicx}
\\usepackage{hyperref}
\\usepackage[margin=1in]{geometry}

\\title{Untitled Document}
\\author{Author}
\\date{\\today}

\\begin{document}

\\maketitle

\\section{Introduction}

Start writing here.

\\end{document}
`

// ──── Register IPC Handlers ────

export function registerFileHandlers(ipcMain: IpcMain, getMainWindow: () => BrowserWindow | null): void {
  parentWindowGetter = getMainWindow
  // ── File Operations ──

  ipcMain.handle(
    IPC_CHANNELS.FS_READ_FILE,
    async (_event, filePath: string): Promise<string> => {
      try {
        return fs.readFileSync(filePath, 'utf-8')
      } catch (err) {
        throw new Error(`Failed to read file "${filePath}": ${err instanceof Error ? err.message : err}`)
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.FS_READ_FILE_BINARY,
    async (_event, filePath: string): Promise<Uint8Array> => {
      try {
        const buffer = fs.readFileSync(filePath)
        return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
      } catch (err) {
        throw new Error(`Failed to read binary file "${filePath}": ${err instanceof Error ? err.message : err}`)
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.FS_COPY_FILE,
    async (_event, srcPath: string, destPath: string): Promise<void> => {
      try {
        const destDir = path.dirname(destPath)
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true })
        }
        fs.copyFileSync(srcPath, destPath)
      } catch (err) {
        throw new Error(`Failed to copy file: ${err instanceof Error ? err.message : err}`)
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.FS_SAVE_VERSION,
    async (_event, projectPath: string, filePath: string, name: string): Promise<void> => {
      try {
        const historyDir = path.join(projectPath, '.openleaf', 'history')
        if (!fs.existsSync(historyDir)) {
          fs.mkdirSync(historyDir, { recursive: true })
        }

        const timestamp = Date.now()
        const versionId = `version_${timestamp}`
        const versionFilePath = path.join(historyDir, `${versionId}.tex`)

        // Copy file content
        fs.copyFileSync(filePath, versionFilePath)

        // Update history index file history.json
        const indexPath = path.join(historyDir, 'history.json')
        let historyIndex: { id: string; name: string; timestamp: number; filename: string }[] = []
        if (fs.existsSync(indexPath)) {
          try {
            historyIndex = JSON.parse(fs.readFileSync(indexPath, 'utf-8'))
          } catch {
            // Ignore corrupted index
          }
        }

        historyIndex.unshift({
          id: versionId,
          name,
          timestamp,
          filename: `${versionId}.tex`
        })

        fs.writeFileSync(indexPath, JSON.stringify(historyIndex, null, 2), 'utf-8')
      } catch (err) {
        throw new Error(`Failed to save project version: ${err instanceof Error ? err.message : err}`)
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.FS_GET_VERSIONS,
    async (_event, projectPath: string): Promise<{ id: string; name: string; timestamp: number; content: string }[]> => {
      try {
        const historyDir = path.join(projectPath, '.openleaf', 'history')
        const indexPath = path.join(historyDir, 'history.json')
        if (!fs.existsSync(indexPath)) return []

        const raw = fs.readFileSync(indexPath, 'utf-8')
        const index = JSON.parse(raw) as { id: string; name: string; timestamp: number; filename: string }[]

        const list = index.map((item) => {
          let content = ''
          const itemPath = path.join(historyDir, item.filename)
          if (fs.existsSync(itemPath)) {
            content = fs.readFileSync(itemPath, 'utf-8')
          }
          return {
            id: item.id,
            name: item.name,
            timestamp: item.timestamp,
            content
          }
        })

        return list
      } catch (err) {
        throw new Error(`Failed to load project versions: ${err instanceof Error ? err.message : err}`)
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.FS_WRITE_FILE,
    async (_event, filePath: string, content: string): Promise<void> => {
      try {
        // Ensure parent directory exists
        const dir = path.dirname(filePath)
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true })
        }
        fs.writeFileSync(filePath, content, 'utf-8')
      } catch (err) {
        throw new Error(`Failed to write file "${filePath}": ${err instanceof Error ? err.message : err}`)
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.FS_CREATE_FILE,
    async (_event, filePath: string, content?: string): Promise<void> => {
      try {
        if (fs.existsSync(filePath)) {
          throw new Error(`File already exists: ${filePath}`)
        }
        const dir = path.dirname(filePath)
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true })
        }
        fs.writeFileSync(filePath, content || '', 'utf-8')
      } catch (err) {
        if (err instanceof Error && err.message.startsWith('File already exists')) throw err
        throw new Error(`Failed to create file "${filePath}": ${err instanceof Error ? err.message : err}`)
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.FS_DELETE_FILE,
    async (_event, filePath: string): Promise<void> => {
      try {
        // Move to system trash instead of permanent delete
        await shell.trashItem(filePath)
      } catch (err) {
        throw new Error(`Failed to delete file "${filePath}": ${err instanceof Error ? err.message : err}`)
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.FS_RENAME_FILE,
    async (_event, oldPath: string, newPath: string): Promise<void> => {
      try {
        const destDir = path.dirname(newPath)
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true })
        }
        fs.renameSync(oldPath, newPath)
      } catch (err) {
        throw new Error(
          `Failed to rename "${oldPath}" to "${newPath}": ${err instanceof Error ? err.message : err}`
        )
      }
    }
  )

  // ── Directory Operations ──

  ipcMain.handle(
    IPC_CHANNELS.FS_READ_DIR,
    async (_event, dirPath: string): Promise<FileEntry[]> => {
      try {
        if (!fs.existsSync(dirPath)) {
          throw new Error(`Directory does not exist: ${dirPath}`)
        }
        return buildFileTree(dirPath, dirPath)
      } catch (err) {
        if (err instanceof Error && err.message.startsWith('Directory does not exist')) throw err
        throw new Error(`Failed to read directory "${dirPath}": ${err instanceof Error ? err.message : err}`)
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.FS_CREATE_DIR,
    async (_event, dirPath: string): Promise<void> => {
      try {
        fs.mkdirSync(dirPath, { recursive: true })
      } catch (err) {
        throw new Error(`Failed to create directory "${dirPath}": ${err instanceof Error ? err.message : err}`)
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.FS_DELETE_DIR,
    async (_event, dirPath: string): Promise<void> => {
      try {
        await shell.trashItem(dirPath)
      } catch (err) {
        throw new Error(`Failed to delete directory "${dirPath}": ${err instanceof Error ? err.message : err}`)
      }
    }
  )

  // ── Native Dialogs ──

  ipcMain.handle(
    IPC_CHANNELS.DIALOG_OPEN_FOLDER,
    async (): Promise<string | null> => {
      const parent = parentWindowGetter()
      const result = await dialog.showOpenDialog(parent ? parent : undefined as any, {
        title: 'Open Project Folder',
        properties: ['openDirectory']
      })
      if (result.canceled || result.filePaths.length === 0) return null
      return result.filePaths[0]
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.DIALOG_OPEN_FILE,
    async (
      _event,
      filters?: { name: string; extensions: string[] }[]
    ): Promise<string | null> => {
      const parent = parentWindowGetter()
      const result = await dialog.showOpenDialog(parent ? parent : undefined as any, {
        title: 'Open File',
        properties: ['openFile'],
        filters: filters || [
          { name: 'TeX Files', extensions: ['tex', 'cls', 'sty', 'bib'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })
      if (result.canceled || result.filePaths.length === 0) return null
      return result.filePaths[0]
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.DIALOG_SAVE_FILE,
    async (
      _event,
      defaultName: string,
      filters?: { name: string; extensions: string[] }[]
    ): Promise<string | null> => {
      const parent = parentWindowGetter()
      const result = await dialog.showSaveDialog(parent ? parent : undefined as any, {
        title: 'Save File',
        defaultPath: defaultName,
        filters: filters || [
          { name: 'TeX Files', extensions: ['tex'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })
      if (result.canceled || !result.filePath) return null
      return result.filePath
    }
  )

  // ── Project Operations ──

  ipcMain.handle(
    IPC_CHANNELS.PROJECT_IMPORT_ZIP,
    async () => {
      // Stub for symmetry
      throw new Error('Not implemented')
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.PROJECT_SHARE,
    async (_event, projectPath: string): Promise<string> => {
      try {
        const url = await shareManager.startSharing({ projectPath })
        return url
      } catch (err) {
        throw new Error(`Failed to start sharing: ${err instanceof Error ? err.message : err}`)
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.PROJECT_SHARE_STOP,
    async (): Promise<void> => {
      try {
        await shareManager.stopSharing()
      } catch (err) {
        throw new Error(`Failed to stop sharing: ${err instanceof Error ? err.message : err}`)
      }
    }
  )

  // ── Project Settings / Meta ──
  ipcMain.handle(
    IPC_CHANNELS.PROJECT_OPEN,
    async (_event, projectPath: string): Promise<ProjectInfo> => {
      try {
        if (!fs.existsSync(projectPath)) {
          throw new Error(`Project path does not exist: ${projectPath}`)
        }

        const stat = fs.statSync(projectPath)
        if (!stat.isDirectory()) {
          throw new Error(`Project path is not a directory: ${projectPath}`)
        }

        const mainFile = findMainTexFile(projectPath)
        if (!mainFile) {
          throw new Error('No .tex file found in the project directory.')
        }

        const projectInfo: ProjectInfo = {
          name: path.basename(projectPath),
          path: projectPath,
          mainFile,
          lastOpened: Date.now(),
          created: stat.birthtimeMs,
          engine: 'pdflatex'
        }

        // Check for an existing project config that might store the engine preference
        const configPath = path.join(projectPath, '.openleaf.json')
        if (fs.existsSync(configPath)) {
          try {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
            if (config.engine) projectInfo.engine = config.engine
            if (config.mainFile) projectInfo.mainFile = config.mainFile
          } catch {
            // Ignore malformed config
          }
        }

        addToRecentProjects(projectInfo)
        return projectInfo
      } catch (err) {
        if (err instanceof Error) throw err
        throw new Error(`Failed to open project: ${err}`)
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.PROJECT_CREATE,
    async (_event, name: string, templateId?: string): Promise<ProjectInfo> => {
      try {
        // Show folder picker for project location
        const parent = parentWindowGetter()
        const result = await dialog.showOpenDialog(parent ? parent : undefined as any, {
          title: 'Select location for new project',
          properties: ['openDirectory']
        })

        if (result.canceled || result.filePaths.length === 0) {
          throw new Error('Project creation cancelled: no location selected.')
        }

        const parentDir = result.filePaths[0]
        const projectPath = path.join(parentDir, name)

        if (fs.existsSync(projectPath)) {
          throw new Error(`A folder named "${name}" already exists in the selected location.`)
        }

        fs.mkdirSync(projectPath, { recursive: true })

        // Create the main .tex file from template
        const mainFileName = 'main.tex'
        const mainFilePath = path.join(projectPath, mainFileName)

        let templateContent = DEFAULT_TEX_TEMPLATE
        if (templateId === 'beamer') {
          templateContent = `\\documentclass{beamer}

\\usepackage[utf8]{inputenc}
\\usepackage{amsmath,amssymb}
\\usepackage{graphicx}

\\title{Presentation Title}
\\author{Author}
\\date{\\today}

\\begin{document}

\\frame{\\titlepage}

\\begin{frame}{Introduction}
  Your content here.
\\end{frame}

\\end{document}
`
        } else if (templateId === 'report') {
          templateContent = `\\documentclass[12pt,a4paper]{report}

\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{amsmath,amssymb}
\\usepackage{graphicx}
\\usepackage{hyperref}
\\usepackage[margin=1in]{geometry}

\\title{Report Title}
\\author{Author}
\\date{\\today}

\\begin{document}

\\maketitle
\\tableofcontents

\\chapter{Introduction}

Start writing here.

\\end{document}
`
        } else if (templateId === 'letter') {
          templateContent = `\\documentclass{letter}

\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}

\\signature{Your Name}
\\address{Your Address}

\\begin{document}

\\begin{letter}{Recipient \\\\ Address}

\\opening{Dear Sir or Madam,}

Your letter content here.

\\closing{Yours faithfully,}

\\end{letter}

\\end{document}
`
        }

        fs.writeFileSync(mainFilePath, templateContent, 'utf-8')

        // Create a project config file
        const projectConfig = {
          engine: 'pdflatex',
          mainFile: mainFileName
        }
        fs.writeFileSync(
          path.join(projectPath, '.openleaf.json'),
          JSON.stringify(projectConfig, null, 2),
          'utf-8'
        )

        const projectInfo: ProjectInfo = {
          name,
          path: projectPath,
          mainFile: mainFileName,
          lastOpened: Date.now(),
          created: Date.now(),
          engine: 'pdflatex'
        }

        addToRecentProjects(projectInfo)
        return projectInfo
      } catch (err) {
        if (err instanceof Error) throw err
        throw new Error(`Failed to create project: ${err}`)
      }
    }
  )

  ipcMain.handle(IPC_CHANNELS.PROJECT_GET_RECENT, async (): Promise<ProjectInfo[]> => {
    const projects = loadRecentProjects()
    // Filter out projects whose directories no longer exist
    const valid = projects.filter((p) => {
      try {
        return fs.existsSync(p.path) && fs.statSync(p.path).isDirectory()
      } catch {
        return false
      }
    })
    // Persist the cleaned list
    if (valid.length !== projects.length) {
      saveRecentProjects(valid)
    }
    return valid
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_CLOSE, async (): Promise<void> => {
    // No-op in current implementation; can be extended for cleanup later
  })

  // ── Git IPC Handlers ──

  ipcMain.handle(IPC_CHANNELS.GIT_INIT, async (_event, projectPath: string): Promise<void> => {
    try {
      const gitDir = path.join(projectPath, '.git')
      if (!fs.existsSync(gitDir)) {
        await runGitCommand('git init', projectPath)
        // Configure local parameters so it does not error on lack of global configuration
        await runGitCommand('git config user.name "Openleaf User"', projectPath)
        await runGitCommand('git config user.email "user@openleaf.local"', projectPath)
      }
    } catch (err) {
      throw new Error(`Failed to initialize git repository: ${err instanceof Error ? err.message : err}`)
    }
  })

  ipcMain.handle(IPC_CHANNELS.GIT_COMMIT, async (_event, projectPath: string, message: string): Promise<boolean> => {
    try {
      await runGitCommand('git add .', projectPath)
      // Check if there are changes to commit first
      const status = await runGitCommand('git status --porcelain', projectPath)
      if (!status) {
        return false // No changes to commit
      }
      await runGitCommand(`git commit -m "${message.replace(/"/g, '\\"')}"`, projectPath)
      return true
    } catch (err) {
      throw new Error(`Failed to commit changes: ${err instanceof Error ? err.message : err}`)
    }
  })

  ipcMain.handle(IPC_CHANNELS.GIT_GET_HISTORY, async (_event, projectPath: string) => {
    try {
      const gitDir = path.join(projectPath, '.git')
      if (!fs.existsSync(gitDir)) return []
      
      const logOutput = await runGitCommand('git log --pretty=format:"%H|%s|%at|%an" -n 50', projectPath)
      if (!logOutput) return []
      
      return logOutput.split('\n').map((line) => {
        const cleaned = line.replace(/^"/, '').replace(/"$/, '')
        const [hash, message, timestampStr, author] = cleaned.split('|')
        return {
          hash,
          message: message || '',
          timestamp: parseInt(timestampStr, 10) * 1000,
          author: author || 'Unknown'
        }
      })
    } catch {
      return []
    }
  })

  ipcMain.handle(IPC_CHANNELS.GIT_CHECKOUT, async (_event, projectPath: string, commitHash: string, fileRelativePath: string): Promise<void> => {
    try {
      await runGitCommand(`git checkout ${commitHash} -- "${fileRelativePath}"`, projectPath)
    } catch (err) {
      throw new Error(`Failed to restore file from git commit: ${err instanceof Error ? err.message : err}`)
    }
  })

  ipcMain.handle(IPC_CHANNELS.GIT_SHOW, async (_event, projectPath: string, commitHash: string, fileRelativePath: string): Promise<string> => {
    try {
      return await runGitCommand(`git show ${commitHash}:"${fileRelativePath.replace(/\\/g, '/')}"`, projectPath)
    } catch (err) {
      throw new Error(`Failed to show file content from git commit: ${err instanceof Error ? err.message : err}`)
    }
  })
}

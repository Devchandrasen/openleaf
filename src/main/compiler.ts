import { type IpcMain, type BrowserWindow } from 'electron'
import { spawn, exec, type ChildProcess } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'
import {
  IPC_CHANNELS,
  type CompileOptions,
  type CompileResult,
  type CompileError,
  type CompileWarning
} from '../shared/ipc'

// Common Windows installation paths for LaTeX distributions
const WINDOWS_LATEX_SEARCH_PATHS = [
  'C:\\texlive\\2025\\bin\\windows',
  'C:\\texlive\\2024\\bin\\windows',
  'C:\\texlive\\2023\\bin\\windows',
  'C:\\texlive\\2022\\bin\\windows',
  'C:\\texlive\\2021\\bin\\windows',
  'C:\\texlive\\2025\\bin\\win32',
  'C:\\texlive\\2024\\bin\\win32',
  'C:\\texlive\\2023\\bin\\win32',
  'C:\\Program Files\\MiKTeX\\miktex\\bin\\x64',
  'C:\\Program Files\\MiKTeX\\miktex\\bin',
  'C:\\Program Files (x86)\\MiKTeX\\miktex\\bin\\x64',
  'C:\\Program Files (x86)\\MiKTeX\\miktex\\bin',
  path.join(process.env.LOCALAPPDATA || '', 'Programs', 'MiKTeX', 'miktex', 'bin', 'x64'),
  path.join(process.env.LOCALAPPDATA || '', 'Programs', 'MiKTeX', 'miktex', 'bin'),
  path.join(process.env.APPDATA || '', 'MiKTeX', 'miktex', 'bin', 'x64'),
  path.join(process.env.APPDATA || '', 'MiKTeX', 'miktex', 'bin')
]

let activeProcess: ChildProcess | null = null
let mainWindow: BrowserWindow | null = null

/**
 * Attempt to locate the LaTeX engine binary.
 * First checks if the engine is available on PATH, then searches common Windows install locations.
 */
function findEnginePath(engine: string): string {
  const exeName = process.platform === 'win32' ? `${engine}.exe` : engine

  // Check common Windows installation directories
  for (const searchDir of WINDOWS_LATEX_SEARCH_PATHS) {
    const candidate = path.join(searchDir, exeName)
    try {
      fs.accessSync(candidate, fs.constants.X_OK)
      return candidate
    } catch {
      // Not found here, continue searching
    }
  }

  // Fall back to engine name alone — relies on it being on PATH
  return engine
}

/**
 * Read and parse a LaTeX .log file to extract structured errors and warnings.
 */
function parseLogFile(logPath: string): { errors: CompileError[]; warnings: CompileWarning[] } {
  const errors: CompileError[] = []
  const warnings: CompileWarning[] = []

  let logContent: string
  try {
    logContent = fs.readFileSync(logPath, 'utf-8')
  } catch {
    return { errors, warnings }
  }

  const lines = logContent.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Match errors in the form: ./file.tex:42: error message
    const errorMatch = line.match(/^(.+?):(\d+):\s*(.+)/)
    if (errorMatch) {
      // Accumulate multi-line error messages
      let message = errorMatch[3].trim()
      let j = i + 1
      while (j < lines.length && lines[j].startsWith('l.')) {
        message += ' ' + lines[j].trim()
        j++
      }
      errors.push({
        file: errorMatch[1],
        line: parseInt(errorMatch[2], 10),
        message,
        type: 'error'
      })
      continue
    }

    // Match ! LaTeX Error: ...
    const latexErrorMatch = line.match(/^!\s*(.+)/)
    if (latexErrorMatch) {
      let errorFile = ''
      let errorLine = 0
      // Look ahead for line info (l.<number>)
      for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
        const lineRef = lines[j].match(/^l\.(\d+)\s*(.*)/)
        if (lineRef) {
          errorLine = parseInt(lineRef[1], 10)
          break
        }
      }
      // Look backwards for file context
      for (let j = i - 1; j >= Math.max(0, i - 20); j--) {
        const fileRef = lines[j].match(/\(([^()]*\.tex)/)
        if (fileRef) {
          errorFile = fileRef[1]
          break
        }
      }
      errors.push({
        file: errorFile,
        line: errorLine,
        message: latexErrorMatch[1].trim(),
        type: 'error'
      })
      continue
    }

    // Match warnings: LaTeX Warning: ...  or  Package <pkg> Warning: ...
    const warningMatch = line.match(
      /(?:LaTeX|Package\s+\S+)\s+Warning:\s*(.+)/
    )
    if (warningMatch) {
      let message = warningMatch[1].trim()
      // Some warnings span multiple lines ending with a period
      let j = i + 1
      while (j < lines.length && !lines[j].match(/^\s*$/) && !message.endsWith('.')) {
        message += ' ' + lines[j].trim()
        j++
      }
      const lineMatch = message.match(/on input line (\d+)/)
      warnings.push({
        file: '',
        line: lineMatch ? parseInt(lineMatch[1], 10) : 0,
        message,
        type: 'warning'
      })
      continue
    }

    // Match overfull/underfull hbox/vbox warnings
    const boxWarning = line.match(/((?:Over|Under)full\\[hv]box.+)/)
    if (boxWarning) {
      const lineMatch = line.match(/at lines? (\d+)/)
      warnings.push({
        file: '',
        line: lineMatch ? parseInt(lineMatch[1], 10) : 0,
        message: boxWarning[1].trim(),
        type: 'warning'
      })
    }
  }

  return { errors, warnings }
}

/**
 * Compute a simple hash of file contents for change detection.
 */
function fileHash(filePath: string): string | null {
  try {
    const content = fs.readFileSync(filePath)
    // Quick hash: just use length + a sample of bytes. Good enough for change detection.
    let hash = content.length.toString(36)
    for (let i = 0; i < content.length; i += 64) {
      hash += content[i].toString(36)
    }
    return hash
  } catch {
    return null
  }
}

/**
 * Run a single pass of the LaTeX engine and stream output to the renderer.
 */
function runLatexPass(
  enginePath: string,
  flags: string[],
  mainFile: string,
  cwd: string,
  sender: BrowserWindow
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    let stdout = ''
    let stderr = ''

    const proc = spawn(enginePath, [...flags, mainFile], {
      cwd,
      windowsHide: true,
      env: { ...process.env }
    })

    activeProcess = proc

    proc.stdout?.on('data', (data: Buffer) => {
      const text = data.toString('utf-8')
      stdout += text
      try {
        sender.webContents.send(IPC_CHANNELS.COMPILE_LOG, text)
      } catch {
        // Window may have been closed
      }
    })

    proc.stderr?.on('data', (data: Buffer) => {
      const text = data.toString('utf-8')
      stderr += text
      try {
        sender.webContents.send(IPC_CHANNELS.COMPILE_LOG, text)
      } catch {
        // Window may have been closed
      }
    })

    proc.on('error', (err) => {
      resolve({ code: -1, stdout, stderr: stderr + '\n' + err.message })
    })

    proc.on('close', (code) => {
      if (activeProcess === proc) {
        activeProcess = null
      }
      resolve({ code, stdout, stderr })
    })
  })
}

/**
 * Detect whether bibtex or biber should be run by checking the .aux file
 * for relevant commands.
 */
function detectBibProcessor(auxPath: string): 'bibtex' | 'biber' | null {
  try {
    const content = fs.readFileSync(auxPath, 'utf-8')
    if (content.includes('\\abx@aux@cite') || content.includes('\\abx@aux@refcontext')) {
      return 'biber'
    }
    if (content.includes('\\bibdata') || content.includes('\\citation')) {
      return 'bibtex'
    }
  } catch {
    // .aux doesn't exist yet
  }
  return null
}

/**
 * Run a bibliography processor (bibtex or biber).
 */
function runBibProcessor(
  processor: 'bibtex' | 'biber',
  jobName: string,
  cwd: string,
  sender: BrowserWindow
): Promise<void> {
  return new Promise((resolve) => {
    const proc = spawn(processor, [jobName], {
      cwd,
      windowsHide: true,
      env: { ...process.env }
    })

    proc.stdout?.on('data', (data: Buffer) => {
      try {
        sender.webContents.send(IPC_CHANNELS.COMPILE_LOG, data.toString('utf-8'))
      } catch {
        // noop
      }
    })

    proc.stderr?.on('data', (data: Buffer) => {
      try {
        sender.webContents.send(IPC_CHANNELS.COMPILE_LOG, data.toString('utf-8'))
      } catch {
        // noop
      }
    })

    proc.on('close', () => resolve())
    proc.on('error', () => resolve())
  })
}

export function registerCompilerHandlers(ipcMain: IpcMain, getMainWindow: () => BrowserWindow | null): void {
  mainWindow = null // will be fetched via getter

  ipcMain.handle(
    IPC_CHANNELS.COMPILE_PROJECT,
    async (_event, options: CompileOptions): Promise<CompileResult> => {
      const startTime = Date.now()

      const window = getMainWindow()
      if (!window) {
        return {
          success: false,
          log: 'No window available for log streaming.',
          errors: [{ file: '', line: 0, message: 'No active window', type: 'error' }],
          warnings: [],
          duration: 0
        }
      }

      const { projectPath, mainFile, engine, flags: userFlags } = options
      const enginePath = findEnginePath(engine)

      // Verify the main file exists
      const mainFilePath = path.resolve(projectPath, mainFile)
      if (!fs.existsSync(mainFilePath)) {
        return {
          success: false,
          log: `Main file not found: ${mainFilePath}`,
          errors: [{ file: mainFile, line: 0, message: `File not found: ${mainFile}`, type: 'error' }],
          warnings: [],
          duration: Date.now() - startTime
        }
      }

      const jobName = path.basename(mainFile, path.extname(mainFile))
      const auxPath = path.join(projectPath, `${jobName}.aux`)
      const logPath = path.join(projectPath, `${jobName}.log`)
      const pdfPath = path.join(projectPath, `${jobName}.pdf`)

      const baseFlags = [
        '-interaction=nonstopmode',
        '-file-line-error',
        '-synctex=1',
        `-output-directory=${projectPath}`,
        ...(userFlags || [])
      ]

      try {
        // Capture .aux hash before first pass
        const auxHashBefore = fileHash(auxPath)

        // ── First LaTeX pass ──
        window.webContents.send(IPC_CHANNELS.COMPILE_LOG, `[Openleaf] Running ${engine} (pass 1)...\n`)
        const firstPass = await runLatexPass(enginePath, baseFlags, mainFilePath, projectPath, window)

        if (firstPass.code === null) {
          // Process was killed
          return {
            success: false,
            log: 'Compilation was cancelled.',
            errors: [],
            warnings: [],
            duration: Date.now() - startTime
          }
        }

        // ── Bibliography pass ──
        const auxHashAfter = fileHash(auxPath)
        const bibProcessor = detectBibProcessor(auxPath)

        if (bibProcessor && auxHashBefore !== auxHashAfter) {
          window.webContents.send(
            IPC_CHANNELS.COMPILE_LOG,
            `[Openleaf] Running ${bibProcessor}...\n`
          )
          await runBibProcessor(bibProcessor, jobName, projectPath, window)

          // ── Second LaTeX pass (after bibliography) ──
          window.webContents.send(IPC_CHANNELS.COMPILE_LOG, `[Openleaf] Running ${engine} (pass 2)...\n`)
          await runLatexPass(enginePath, baseFlags, mainFilePath, projectPath, window)

          // ── Third LaTeX pass (resolve cross-references) ──
          window.webContents.send(IPC_CHANNELS.COMPILE_LOG, `[Openleaf] Running ${engine} (pass 3)...\n`)
          await runLatexPass(enginePath, baseFlags, mainFilePath, projectPath, window)
        } else if (auxHashBefore !== auxHashAfter) {
          // .aux changed but no bib processor needed — still need a second pass for cross-refs
          window.webContents.send(IPC_CHANNELS.COMPILE_LOG, `[Openleaf] Running ${engine} (pass 2)...\n`)
          await runLatexPass(enginePath, baseFlags, mainFilePath, projectPath, window)
        }

        // ── Parse results ──
        const { errors, warnings } = parseLogFile(logPath)

        let fullLog = ''
        try {
          fullLog = fs.readFileSync(logPath, 'utf-8')
        } catch {
          fullLog = firstPass.stdout + firstPass.stderr
        }

        const pdfExists = fs.existsSync(pdfPath)

        const duration = Date.now() - startTime
        window.webContents.send(
          IPC_CHANNELS.COMPILE_LOG,
          `[Openleaf] Compilation ${pdfExists ? 'succeeded' : 'failed'} in ${(duration / 1000).toFixed(1)}s\n`
        )

        const success = pdfExists && errors.length === 0
        if (success) {
          const gitDir = path.join(projectPath, '.git')
          if (fs.existsSync(gitDir)) {
            try {
              const { execSync } = require('child_process')
              execSync('git add .', { cwd: projectPath, windowsHide: true })
              const status = execSync('git status --porcelain', { cwd: projectPath, windowsHide: true }).toString().trim()
              if (status) {
                execSync('git commit -m "Auto-commit on successful compile"', { cwd: projectPath, windowsHide: true })
                window.webContents.send(IPC_CHANNELS.COMPILE_LOG, `[Openleaf] Auto-committed files to Git history.\n`)
              }
            } catch (gitErr) {
              // Ignore git failures during auto-commit
            }
          }
        }

        return {
          success,
          pdfPath: pdfExists ? pdfPath : undefined,
          log: fullLog,
          errors,
          warnings,
          duration
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return {
          success: false,
          log: message,
          errors: [{ file: '', line: 0, message: `Compiler error: ${message}`, type: 'error' }],
          warnings: [],
          duration: Date.now() - startTime
        }
      }
    }
  )

  ipcMain.handle(IPC_CHANNELS.COMPILE_STOP, async (): Promise<void> => {
    if (activeProcess && !activeProcess.killed) {
      activeProcess.kill('SIGTERM')
      // Give it a moment, then force kill
      setTimeout(() => {
        if (activeProcess && !activeProcess.killed) {
          activeProcess.kill('SIGKILL')
        }
      }, 2000)
    }
  })

  ipcMain.handle(IPC_CHANNELS.COMPILE_STATUS, async () => {
    return {
      compiling: activeProcess !== null && !activeProcess.killed
    }
  })

  // ── SyncTeX IPC Handlers ──

  ipcMain.handle(
    'synctex:forward',
    async (_event, texPath: string, line: number, pdfPath: string) => {
      return new Promise((resolve) => {
        const cmd = `synctex view -i ${line}:0:"${texPath}" -o "${pdfPath}"`
        exec(cmd, { cwd: path.dirname(pdfPath) }, (error, stdout, stderr) => {
          if (error) {
            console.error('synctex view failed:', error, stderr)
            resolve(null)
            return
          }
          
          const lines = stdout.split('\n')
          let page = 1
          let x = 0
          let y = 0
          let found = false
          
          for (const line of lines) {
            const pageMatch = line.match(/^Page:\s*(\d+)/i)
            const xMatch = line.match(/^x:\s*([\d.]+)/i)
            const yMatch = line.match(/^y:\s*([\d.]+)/i)
            
            if (pageMatch) {
              page = parseInt(pageMatch[1], 10)
              found = true
            }
            if (xMatch) {
              x = parseFloat(xMatch[1])
            }
            if (yMatch) {
              y = parseFloat(yMatch[1])
            }
          }
          
          if (found) {
            resolve({ page, x, y })
          } else {
            resolve(null)
          }
        })
      })
    }
  )

  ipcMain.handle(
    'synctex:backward',
    async (_event, page: number, x: number, y: number, pdfPath: string) => {
      return new Promise((resolve) => {
        const cmd = `synctex edit -o ${page}:${x}:${y}:"${pdfPath}"`
        exec(cmd, { cwd: path.dirname(pdfPath) }, (error, stdout, stderr) => {
          if (error) {
            console.error('synctex edit failed:', error, stderr)
            resolve(null)
            return
          }
          
          const lines = stdout.split('\n')
          let inputPath = ''
          let lineNum = 1
          let colNum = 0
          let found = false
          
          for (const line of lines) {
            const inputMatch = line.match(/^Input:\s*(.+)/i)
            const lineMatch = line.match(/^Line:\s*(\d+)/i)
            const colMatch = line.match(/^Column:\s*(-?\d+)/i)
            
            if (inputMatch) {
              inputPath = inputMatch[1].trim()
              found = true
            }
            if (lineMatch) {
              lineNum = parseInt(lineMatch[1], 10)
            }
            if (colMatch) {
              colNum = parseInt(colMatch[1], 10)
            }
          }
          
          if (found) {
            resolve({ path: inputPath, line: lineNum, column: colNum })
          } else {
            resolve(null)
          }
        })
      })
    }
  )
}

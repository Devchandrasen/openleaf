import React, { useMemo } from 'react'
import { useEditorStore } from '../../stores/editorStore'
import { useCompilerStore } from '../../stores/compilerStore'

function countWords(text: string): number {
  // Strip LaTeX commands, then count words
  const stripped = text
    .replace(/\\[a-zA-Z]+\*?(\{[^}]*\})?/g, ' ')
    .replace(/%.*$/gm, '')
    .replace(/[{}[\]$\\]/g, ' ')
    .trim()
  if (!stripped) return 0
  return stripped.split(/\s+/).filter(Boolean).length
}

export const StatusBar: React.FC = () => {
  const cursorLine = useEditorStore((s) => s.cursorLine)
  const cursorCol = useEditorStore((s) => s.cursorCol)
  const activeFileIndex = useEditorStore((s) => s.activeFileIndex)
  const openFiles = useEditorStore((s) => s.openFiles)
  const fileContents = useEditorStore((s) => s.fileContents)
  const isCompiling = useCompilerStore((s) => s.isCompiling)
  const lastResult = useCompilerStore((s) => s.lastResult)
  const engine = useCompilerStore((s) => s.engine)

  const activeFile = activeFileIndex >= 0 ? openFiles[activeFileIndex] : null
  const content = activeFile ? (fileContents[activeFile.path] ?? '') : ''
  const wordCount = useMemo(() => countWords(content), [content])

  let compileStatus: { label: string; icon: string; className: string }
  if (isCompiling) {
    compileStatus = { label: 'Compiling…', icon: '⟳', className: 'compiling' }
  } else if (lastResult?.success) {
    compileStatus = { label: 'Compiled', icon: '✓', className: 'success' }
  } else if (lastResult && !lastResult.success) {
    compileStatus = {
      label: `${lastResult.errors.length} Error${lastResult.errors.length !== 1 ? 's' : ''}`,
      icon: '✗',
      className: 'error',
    }
  } else {
    compileStatus = { label: 'Ready', icon: '○', className: 'idle' }
  }

  const engineLabel = engine === 'pdflatex' ? 'pdfLaTeX' : engine === 'xelatex' ? 'XeLaTeX' : 'LuaLaTeX'

  return (
    <div className="statusbar">
      {/* Left — Cursor position */}
      <div className="statusbar-section">
        <span className="statusbar-item">
          Ln {cursorLine}, Col {cursorCol}
        </span>
      </div>

      {/* Center — Compile status */}
      <div className="statusbar-section">
        <span className={`statusbar-compile-status ${compileStatus.className}`}>
          {compileStatus.icon} {compileStatus.label}
          {lastResult && !isCompiling && lastResult.duration > 0 && (
            <span style={{ marginLeft: 4, opacity: 0.7 }}>
              ({(lastResult.duration / 1000).toFixed(1)}s)
            </span>
          )}
        </span>
      </div>

      {/* Right — Engine, word count, encoding */}
      <div className="statusbar-section">
        <span className="statusbar-item" style={{ color: 'var(--accent-teal)', fontWeight: '600' }}>
          Developed By Dr Chandrasen Pandey
        </span>
        <span className="statusbar-item-separator" />
        <span className="statusbar-item">{engineLabel}</span>
        <span className="statusbar-item-separator" />
        <span className="statusbar-item">{wordCount.toLocaleString()} words</span>
        <span className="statusbar-item-separator" />
        <span className="statusbar-item">UTF-8</span>
      </div>
    </div>
  )
}

export default StatusBar

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useCompilerStore } from '../../stores/compilerStore'
import { useProjectStore } from '../../stores/projectStore'

export const CompileLog: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)
  const log = useCompilerStore((s) => s.log)
  const lastResult = useCompilerStore((s) => s.lastResult)
  const clearLog = useCompilerStore((s) => s.clearLog)
  const contentRef = useRef<HTMLDivElement>(null)

  const currentProject = useProjectStore((s) => s.currentProject)
  const refreshFileTree = useProjectStore((s) => s.refreshFileTree)
  const startCompile = useCompilerStore((s) => s.startCompile)
  const engine = useCompilerStore((s) => s.engine)

  const errorCount = lastResult?.errors?.length ?? 0
  const warningCount = lastResult?.warnings?.length ?? 0

  // Auto-scroll to bottom when log updates
  useEffect(() => {
    if (contentRef.current && isOpen) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight
    }
  }, [log, isOpen])

  // Auto-open on errors
  useEffect(() => {
    if (lastResult && !lastResult.success && errorCount > 0) {
      setIsOpen(true)
    }
  }, [lastResult, errorCount])

  // Scan for missing package
  const logMatch = lastResult?.log.match(/File\s+[`']([^`'\s]+)\.(sty|cls)'\s+not\s+found/i)
    || lastResult?.errors?.map(e => e.message).join('\n').match(/File\s+[`']([^`'\s]+)\.(sty|cls)'\s+not\s+found/i)
  const missingPkg = logMatch ? `${logMatch[1]}.${logMatch[2]}` : null

  const handleInstallPackage = async () => {
    if (!currentProject || !missingPkg) return
    try {
      const selectedPath = await window.api.dialog.openFile([
        { name: `LaTeX ${missingPkg.split('.').pop()?.toUpperCase()} File`, extensions: [missingPkg.split('.').pop() || 'sty'] }
      ])
      if (!selectedPath) return
      
      const fileName = selectedPath.split(/[/\\]/).pop()
      const destPath = `${currentProject.path}/${fileName}`
      
      await window.api.fs.copyFile(selectedPath, destPath)
      await refreshFileTree()
      alert(`Successfully copied ${fileName} to the project workspace.`)
      
      // Auto recompile
      startCompile({
        projectPath: currentProject.path,
        mainFile: currentProject.mainFile,
        engine
      })
    } catch (err) {
      console.error('Failed to copy missing package:', err)
      alert(`Failed to copy package file: ${err instanceof Error ? err.message : err}`)
    }
  }

  const classifyLine = useCallback(
    (line: string): 'error' | 'warning' | 'normal' => {
      const lower = line.toLowerCase()
      if (lower.includes('error') || lower.startsWith('!') || lower.startsWith('l.')) {
        return 'error'
      }
      if (lower.includes('warning') || lower.includes('overfull') || lower.includes('underfull')) {
        return 'warning'
      }
      return 'normal'
    },
    []
  )

  const handleLineClick = useCallback((line: string) => {
    // Try to extract line number from error format: "l.123" or "line 123"
    const lineMatch = line.match(/l\.(\d+)/) || line.match(/line\s+(\d+)/i)
    if (lineMatch) {
      const lineNum = parseInt(lineMatch[1], 10)
      console.log('Jump to line:', lineNum)
    }
  }, [])

  const logLines = log.split('\n')

  return (
    <div>
      {/* Toggle button */}
      <button
        className="compile-log-toggle"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>Logs {isOpen ? '▲' : '▼'}</span>
        {errorCount > 0 && (
          <span className="error-count">
            {errorCount} error{errorCount !== 1 ? 's' : ''}
          </span>
        )}
        {warningCount > 0 && (
          <span className="warning-count">
            {warningCount} warning{warningCount !== 1 ? 's' : ''}
          </span>
        )}
      </button>

      {/* Log panel */}
      {isOpen && (
        <div className="compile-log">
          <div className="compile-log-header">
            <span className="compile-log-header-title">Compilation Output</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(errorCount > 0 || warningCount > 0) && (
                <button
                  className="sidebar-action-btn"
                  onClick={() => window.dispatchEvent(new CustomEvent('open-ai-dialog'))}
                  data-tooltip="Ask AI to Fix Errors"
                  style={{ color: 'var(--accent-purple)' }}
                >
                  🤖 Ask AI
                </button>
              )}
              <button className="sidebar-action-btn" onClick={clearLog} data-tooltip="Clear">
                🗑
              </button>
            </div>
          </div>

          {missingPkg && (
            <div className="package-installer-alert" style={{
              background: 'var(--color-warning-subtle)',
              border: '1px solid var(--color-warning)',
              borderRadius: 'var(--radius-md)',
              padding: '12px',
              margin: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              color: 'var(--text-primary)',
              boxShadow: 'var(--shadow-md)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
                ⚠️ Missing LaTeX File: <code style={{ color: 'var(--accent-orange)' }}>{missingPkg}</code>
              </div>
              <div style={{ fontSize: '12px', opacity: 0.9 }}>
                Compilation failed because {missingPkg} was not found. If you have this package or class file offline, click below to copy it into your project directory.
              </div>
              <button className="btn btn-primary" style={{ alignSelf: 'flex-start', background: 'var(--accent-orange)', borderColor: 'var(--accent-orange)', height: '28px', fontSize: '11px', padding: '0 12px' }} onClick={handleInstallPackage}>
                📂 Browse & Copy to Project
              </button>
            </div>
          )}

          <div className="compile-log-content" ref={contentRef}>
            {logLines.length === 0 || (logLines.length === 1 && logLines[0] === '') ? (
              <span style={{ color: 'var(--text-muted)' }}>No output yet</span>
            ) : (
              logLines.map((line, index) => {
                const lineType = classifyLine(line)
                return (
                  <div
                    key={index}
                    className={`compile-log-line ${lineType}`}
                    onClick={lineType === 'error' ? () => handleLineClick(line) : undefined}
                  >
                    {line}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default CompileLog

import React, { useCallback } from 'react'
import { useCompilerStore } from '../../stores/compilerStore'
import { useProjectStore } from '../../stores/projectStore'
import { useEditorStore } from '../../stores/editorStore'

interface ToolbarProps {
  viewMode: 'source' | 'pdf' | 'split'
  onViewModeChange: (mode: 'source' | 'pdf' | 'split') => void
}

export const Toolbar: React.FC<ToolbarProps> = ({ viewMode, onViewModeChange }) => {
  const isCompiling = useCompilerStore((s) => s.isCompiling)
  const engine = useCompilerStore((s) => s.engine)
  const setEngine = useCompilerStore((s) => s.setEngine)
  const startCompile = useCompilerStore((s) => s.startCompile)
  const currentProject = useProjectStore((s) => s.currentProject)
  const activeFileIndex = useEditorStore((s) => s.activeFileIndex)
  const openFiles = useEditorStore((s) => s.openFiles)
  const fileContents = useEditorStore((s) => s.fileContents)
  const updateContent = useEditorStore((s) => s.updateContent)

  const handleCompile = useCallback(() => {
    if (!currentProject || isCompiling) return
    startCompile({
      projectPath: currentProject.path,
      mainFile: currentProject.mainFile,
      engine,
    })
  }, [currentProject, isCompiling, engine, startCompile])

  const insertSnippet = useCallback((before: string, after: string = '') => {
    window.dispatchEvent(
      new CustomEvent('insert-snippet', {
        detail: { before, after },
      })
    )
  }, [])

  return (
    <div className="toolbar">
      {/* Left group — Formatting */}
      <div className="toolbar-group">
        <button
          className="toolbar-btn"
          data-tooltip="Bold (Ctrl+B)"
          onClick={() => insertSnippet('\\textbf{', '}')}
        >
          <strong>B</strong>
        </button>
        <button
          className="toolbar-btn"
          data-tooltip="Italic (Ctrl+I)"
          onClick={() => insertSnippet('\\textit{', '}')}
        >
          <em>I</em>
        </button>
        <button
          className="toolbar-btn"
          data-tooltip="Inline Math"
          onClick={() => insertSnippet('$', '$')}
        >
          <span style={{ fontFamily: 'serif' }}>$</span>
        </button>
        <button
          className="toolbar-btn"
          data-tooltip="Display Math"
          onClick={() => insertSnippet('\\[\n', '\n\\]')}
        >
          <span style={{ fontFamily: 'serif' }}>$$</span>
        </button>
        <button
          className="toolbar-btn"
          data-tooltip="Equation Wizard"
          onClick={() => window.dispatchEvent(new CustomEvent('open-equation-wizard'))}
        >
          <span style={{ fontFamily: 'serif', fontWeight: 'bold', color: 'var(--accent-teal)' }}>∑ Wizard</span>
        </button>

        <span className="toolbar-separator" />

        <button
          className="toolbar-btn"
          data-tooltip="Section"
          onClick={() => insertSnippet('\\section{', '}')}
        >
          <span className="btn-label">§</span>
        </button>
        <button
          className="toolbar-btn"
          data-tooltip="Subsection"
          onClick={() => insertSnippet('\\subsection{', '}')}
        >
          <span className="btn-label">§§</span>
        </button>
      </div>

      {/* Center group — Insert */}
      <div className="toolbar-group">
        <button
          className="toolbar-btn"
          data-tooltip="Insert Figure"
          onClick={() => insertSnippet(
            '\\begin{figure}[htbp]\n  \\centering\n  \\includegraphics[width=0.8\\textwidth]{',
            '}\n  \\caption{}\n  \\label{fig:}\n\\end{figure}'
          )}
        >
          🖼️ <span className="btn-label">Figure</span>
        </button>
        <button
          className="toolbar-btn"
          data-tooltip="Table Wizard"
          onClick={() => window.dispatchEvent(new CustomEvent('open-table-wizard'))}
        >
          📊 <span className="btn-label">Table Wizard</span>
        </button>
        <button
          className="toolbar-btn"
          data-tooltip="Insert List"
          onClick={() => insertSnippet(
            '\\begin{itemize}\n  \\item ',
            '\n\\end{itemize}'
          )}
        >
          📋 <span className="btn-label">List</span>
        </button>
        <button
          className="toolbar-btn"
          data-tooltip="Insert Link"
          onClick={() => insertSnippet('\\href{', '}{text}')}
        >
          🔗 <span className="btn-label">Link</span>
        </button>
        <button
          className="toolbar-btn"
          data-tooltip="Insert Citation"
          onClick={() => insertSnippet('\\cite{', '}')}
        >
          📖 <span className="btn-label">Cite</span>
        </button>
      </div>

      {/* Right group — Compile & Settings */}
      <div className="toolbar-group">
        <select
          className="toolbar-select"
          value={engine}
          onChange={(e) => setEngine(e.target.value as 'pdflatex' | 'xelatex' | 'lualatex')}
          data-tooltip="LaTeX Engine"
        >
          <option value="pdflatex">pdfLaTeX</option>
          <option value="xelatex">XeLaTeX</option>
          <option value="lualatex">LuaLaTeX</option>
        </select>

        <button
          className="toolbar-btn"
          data-tooltip="Sync to PDF (Ctrl+Alt+J)"
          onClick={() => window.dispatchEvent(new CustomEvent('trigger-forward-sync'))}
          disabled={!currentProject}
          style={{ marginRight: 8 }}
        >
          🎯 <span className="btn-label">Sync PDF</span>
        </button>

        <button
          className={`toolbar-compile-btn${isCompiling ? ' compiling' : ''}`}
          onClick={handleCompile}
          disabled={isCompiling || !currentProject}
          data-tooltip="Compile Project (Ctrl+S)"
        >
          <span className="compile-icon">{isCompiling ? '⟳' : '▶'}</span>
          {isCompiling ? 'Compiling…' : 'Compile'}
        </button>

        <span className="toolbar-separator" />

        <div className="toolbar-view-toggle">
          <button
            className={viewMode === 'source' ? 'active' : ''}
            onClick={() => onViewModeChange('source')}
          >
            Source
          </button>
          <button
            className={viewMode === 'split' ? 'active' : ''}
            onClick={() => onViewModeChange('split')}
          >
            Split
          </button>
          <button
            className={viewMode === 'pdf' ? 'active' : ''}
            onClick={() => onViewModeChange('pdf')}
          >
            PDF
          </button>
        </div>

        <span className="toolbar-separator" />

        <button
          className="toolbar-btn"
          data-tooltip="Toggle Light/Dark Theme"
          onClick={() => {
            document.body.classList.toggle('light-theme')
          }}
        >
          <span className="btn-label">🌓</span>
        </button>

        <button
          className="toolbar-btn"
          data-tooltip="AI Assistant"
          onClick={() => window.dispatchEvent(new CustomEvent('open-ai-dialog'))}
        >
          <span className="btn-label" style={{ color: 'var(--accent-purple)' }}>🤖</span>
        </button>

        <button
          className="toolbar-btn"
          data-tooltip="Submit Feedback / Report Bug"
          onClick={() => window.dispatchEvent(new CustomEvent('open-feedback-dialog'))}
        >
          <span className="btn-label">🐞</span>
        </button>

        <button
          className="toolbar-btn"
          data-tooltip="About Openleaf"
          onClick={() => window.dispatchEvent(new CustomEvent('open-about-dialog'))}
        >
          <span className="btn-label">ℹ️</span>
        </button>
      </div>
    </div>
  )
}

export default Toolbar

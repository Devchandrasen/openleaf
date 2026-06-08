import React, { useState, useCallback, useRef, useEffect } from 'react'
import { Titlebar } from './components/Titlebar/Titlebar'
import { Toolbar } from './components/Toolbar/Toolbar'
import { FileTree } from './components/FileTree/FileTree'
import { DocumentOutline } from './components/Outline/DocumentOutline'
import { EditorTabs } from './components/Editor/EditorTabs'
import { LaTeXEditor } from './components/Editor/LaTeXEditor'
import { PDFViewer } from './components/PDFViewer/PDFViewer'
import { CompileLog } from './components/CompileLog/CompileLog'
import { StatusBar } from './components/StatusBar/StatusBar'
import { WelcomeScreen } from './components/WelcomeScreen/WelcomeScreen'
import { TableWizardModal } from './components/Wizards/TableWizardModal'
import { EquationWizardModal } from './components/Wizards/EquationWizardModal'
import { AboutDialog } from './components/Dialogs/AboutDialog'
import { FeedbackDialog } from './components/Dialogs/FeedbackDialog'
import ShareDialog from './components/Dialogs/ShareDialog'
import { AIAssistantDialog } from './components/Dialogs/AIAssistantDialog'

import { useProjectStore } from './stores/projectStore'
import { useEditorStore } from './stores/editorStore'
import { useCompilerStore } from './stores/compilerStore'

type ViewMode = 'source' | 'pdf' | 'split'

const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('split')
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [splitRatio, setSplitRatio] = useState(0.5) // 0..1, fraction for editor
  const [sidebarSplitRatio, setSidebarSplitRatio] = useState(0.6) // file tree vs outline
  const [sidebarTab, setSidebarTab] = useState<'files' | 'search' | 'history' | 'settings'>('files')
  const [isTableWizardOpen, setIsTableWizardOpen] = useState(false)
  const [isEquationWizardOpen, setIsEquationWizardOpen] = useState(false)
  const [isAboutOpen, setIsAboutOpen] = useState(false)
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false)
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [isAIOpen, setIsAIOpen] = useState(false)

  const mainRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const isSidebarDragging = useRef(false)

  // ── Store Accessors ──
  const currentProject = useProjectStore((s) => s.currentProject)
  const setProject = useProjectStore((s) => s.setProject)
  const refreshFileTree = useProjectStore((s) => s.refreshFileTree)
  const openFile = useEditorStore((s) => s.openFile)
  const openFiles = useEditorStore((s) => s.openFiles)
  const activeFileIndex = useEditorStore((s) => s.activeFileIndex)
  const fileContents = useEditorStore((s) => s.fileContents)
  const markSaved = useEditorStore((s) => s.markSaved)
  const isCompiling = useCompilerStore((s) => s.isCompiling)
  const startCompile = useCompilerStore((s) => s.startCompile)
  const engine = useCompilerStore((s) => s.engine)
  const setEngine = useCompilerStore((s) => s.setEngine)

  // ── Version History States & Actions ──
  const [historyVersions, setHistoryVersions] = useState<{ id: string; name: string; timestamp: number; content: string }[]>([])
  const [activeVersionPreview, setActiveVersionPreview] = useState<{ id: string; name: string; timestamp: number; content: string } | null>(null)
  const [newVersionName, setNewVersionName] = useState('')

  const loadVersions = useCallback(async () => {
    if (!currentProject) return
    try {
      if (window.api?.git?.getHistory) {
        const list = await window.api.git.getHistory(currentProject.path)
        setHistoryVersions(list.map((commit: any) => ({
          id: commit.hash,
          name: commit.message,
          timestamp: commit.timestamp,
          content: '' // Loaded on demand
        })))
      }
    } catch (err) {
      console.error('Failed to load history versions:', err)
    }
  }, [currentProject])

  useEffect(() => {
    if (currentProject) {
      window.api?.git?.init(currentProject.path).then(() => {
        loadVersions()
      }).catch((err) => {
        console.error('Failed to init git repository:', err)
        loadVersions()
      })
    } else {
      setHistoryVersions([])
    }
  }, [currentProject, loadVersions])

  const handleSaveVersion = useCallback(async () => {
    if (!currentProject || !newVersionName.trim()) return
    const activeFile = activeFileIndex >= 0 ? openFiles[activeFileIndex] : null
    if (!activeFile) {
      alert('Please open a file to save a version snapshot.')
      return
    }
    const currentContent = fileContents[activeFile.path] || ''
    try {
      await window.api.fs.writeFile(activeFile.path, currentContent)
      markSaved(activeFile.path)
      const committed = await window.api.git.commit(currentProject.path, newVersionName.trim())
      if (committed) {
        setNewVersionName('')
        await loadVersions()
      } else {
        alert('No changes to commit.')
      }
    } catch (err) {
      console.error('Failed to save version:', err)
      alert(`Failed to save version: ${err instanceof Error ? err.message : err}`)
    }
  }, [currentProject, activeFileIndex, openFiles, fileContents, newVersionName, loadVersions, markSaved])

  const handleViewVersion = useCallback(async (ver: { id: string; name: string; timestamp: number }) => {
    if (!currentProject) return
    const activeFile = activeFileIndex >= 0 ? openFiles[activeFileIndex] : null
    if (!activeFile) {
      alert('Please open a file to preview its version history.')
      return
    }
    const relativePath = activeFile.path.startsWith(currentProject.path)
      ? activeFile.path.slice(currentProject.path.length).replace(/^[/\\]+/, '')
      : activeFile.name

    try {
      const content = await window.api.git.show(currentProject.path, ver.id, relativePath)
      setActiveVersionPreview({
        id: ver.id,
        name: ver.name,
        timestamp: ver.timestamp,
        content
      })
    } catch (err) {
      console.error('Failed to show git content:', err)
      alert(`Failed to load version content: ${err instanceof Error ? err.message : err}`)
    }
  }, [currentProject, activeFileIndex, openFiles])

  const handleRestoreVersion = useCallback(async (version: { id: string; name: string }) => {
    if (!currentProject) return
    const activeFile = activeFileIndex >= 0 ? openFiles[activeFileIndex] : null
    if (!activeFile) {
      alert('Please open a file to restore the version to.')
      return
    }
    const relativePath = activeFile.path.startsWith(currentProject.path)
      ? activeFile.path.slice(currentProject.path.length).replace(/^[/\\]+/, '')
      : activeFile.name

    const confirmed = confirm(`Are you sure you want to restore the file to the version "${version.name}"?\nThis will overwrite the current content of "${activeFile.name}".`)
    if (!confirmed) return
    try {
      await window.api.git.checkout(currentProject.path, version.id, relativePath)
      const restoredContent = await window.api.fs.readFile(activeFile.path)
      useEditorStore.getState().updateContent(activeFile.path, restoredContent)
      useEditorStore.getState().markSaved(activeFile.path)
      setActiveVersionPreview(null)
      alert(`Successfully restored to version "${version.name}"!`)
    } catch (err) {
      console.error('Failed to restore version:', err)
      alert(`Failed to restore version: ${err instanceof Error ? err.message : err}`)
    }
  }, [currentProject, activeFileIndex, openFiles])

  // ── Horizontal split drag (editor ↔ PDF) ──
  const handleSplitMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current || !mainRef.current) return
      const mainRect = mainRef.current.getBoundingClientRect()
      const sidebarW = sidebarVisible ? 260 : 0
      const available = mainRect.width - sidebarW - 5 // 5px for handle
      const offset = ev.clientX - mainRect.left - sidebarW
      const ratio = Math.max(0.2, Math.min(0.8, offset / available))
      setSplitRatio(ratio)
    }

    const handleMouseUp = () => {
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [sidebarVisible])

  // ── Vertical sidebar split drag (FileTree ↔ Outline) ──
  const handleSidebarSplitMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isSidebarDragging.current = true
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'

    const sidebarEl = (e.target as HTMLElement).parentElement
    if (!sidebarEl) return

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isSidebarDragging.current || !sidebarEl) return
      const rect = sidebarEl.getBoundingClientRect()
      const offset = ev.clientY - rect.top
      const ratio = Math.max(0.2, Math.min(0.8, offset / rect.height))
      setSidebarSplitRatio(ratio)
    }

    const handleMouseUp = () => {
      isSidebarDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [])

  // ── Project & File Operations ──
  const handleOpenProject = useCallback(async (projectPath?: string) => {
    try {
      let path = projectPath
      if (!path && window.api?.dialog?.openFolder) {
        path = await window.api.dialog.openFolder()
      }
      if (!path) return

      const projectInfo = await window.api.project.open(path)
      setProject(projectInfo)
      await refreshFileTree()
      if (projectInfo.mainFile) {
        openFile({
          path: `${projectInfo.path}/${projectInfo.mainFile}`,
          name: projectInfo.mainFile,
          language: 'latex',
        })
      }
    } catch (err) {
      console.error('Failed to open project:', err)
      alert(`Failed to open project: ${err instanceof Error ? err.message : err}`)
    }
  }, [setProject, refreshFileTree, openFile])

  const handleNewProject = useCallback(async (name?: string, templateId?: string) => {
    try {
      let projectName = name
      if (!projectName) {
        projectName = prompt('Enter project name:') || ''
      }
      if (!projectName) return

      const projectInfo = await window.api.project.create(projectName, templateId)
      setProject(projectInfo)
      await refreshFileTree()
      if (projectInfo.mainFile) {
        openFile({
          path: `${projectInfo.path}/${projectInfo.mainFile}`,
          name: projectInfo.mainFile,
          language: 'latex',
        })
      }
    } catch (err) {
      console.error('Failed to create project:', err)
      alert(`Failed to create project: ${err instanceof Error ? err.message : err}`)
    }
  }, [setProject, refreshFileTree, openFile])

  const handleCloseProject = useCallback(async () => {
    try {
      await window.api?.project?.close()
      setProject(null)
    } catch (err) {
      console.error('Failed to close project:', err)
    }
  }, [setProject])

  const handleSave = useCallback(async () => {
    if (activeFileIndex < 0) return
    const activeFile = openFiles[activeFileIndex]
    if (!activeFile) return
    const currentContent = fileContents[activeFile.path] || ''
    try {
      await window.api.fs.writeFile(activeFile.path, currentContent)
      markSaved(activeFile.path)
    } catch (err) {
      console.error('Failed to save file:', err)
    }
  }, [activeFileIndex, openFiles, fileContents, markSaved])

  const handleCompile = useCallback(async () => {
    if (!currentProject || isCompiling) return
    await handleSave()
    startCompile({
      projectPath: currentProject.path,
      mainFile: currentProject.mainFile,
      engine,
    })
  }, [currentProject, isCompiling, engine, startCompile, handleSave])

  // ── Keyboard Shortcuts & Wizard Event Listeners ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'b') {
        e.preventDefault()
        setSidebarVisible((v) => !v)
      }
    }
    const handleOpenTable = () => setIsTableWizardOpen(true)
    const handleOpenEquation = () => setIsEquationWizardOpen(true)
    const handleOpenAbout = () => setIsAboutOpen(true)
    const handleOpenFeedback = () => setIsFeedbackOpen(true)
    const handleOpenShare = () => setIsShareOpen(true)
    const handleOpenAI = () => setIsAIOpen(true)

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('open-table-wizard', handleOpenTable)
    window.addEventListener('open-equation-wizard', handleOpenEquation)
    window.addEventListener('open-about-dialog', handleOpenAbout)
    window.addEventListener('open-feedback-dialog', handleOpenFeedback)
    window.addEventListener('open-share-dialog', handleOpenShare)
    window.addEventListener('open-ai-dialog', handleOpenAI)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('open-table-wizard', handleOpenTable)
      window.removeEventListener('open-equation-wizard', handleOpenEquation)
      window.removeEventListener('open-about-dialog', handleOpenAbout)
      window.removeEventListener('open-feedback-dialog', handleOpenFeedback)
      window.removeEventListener('open-share-dialog', handleOpenShare)
      window.removeEventListener('open-ai-dialog', handleOpenAI)
    }
  }, [])

  // ── Menu Action Listeners ──
  useEffect(() => {
    if (window.api?.menu?.onAction) {
      window.api.menu.onAction((action, data) => {
        switch (action) {
          case 'menu:newProject':
            handleNewProject()
            break
          case 'menu:openProject':
            handleOpenProject()
            break
          case 'menu:openRecent':
            if (typeof data === 'string') {
              handleOpenProject(data)
            }
            break
          case 'menu:closeProject':
            handleCloseProject()
            break
          case 'menu:save':
            handleSave()
            break
          case 'menu:compile':
            handleCompile()
            break
          case 'menu:toggleSidebar':
            setSidebarVisible((v) => !v)
            break
          case 'menu:togglePreview':
            setViewMode((m) => (m === 'pdf' ? 'split' : m === 'split' ? 'source' : 'split'))
            break
          case 'menu:setEngine':
            if (data === 'pdflatex' || data === 'xelatex' || data === 'lualatex') {
              setEngine(data)
            }
            break
          case 'menu:insertTable':
            setIsTableWizardOpen(true)
            break
          default:
            console.log('Unhandled menu action:', action, data)
        }
      })
    }
  }, [handleNewProject, handleOpenProject, handleCloseProject, handleSave, handleCompile, setEngine])

  // If no project is open, show the welcome screen dashboard
  if (!currentProject) {
    return (
      <div className="app-layout">
        <Titlebar />
        <WelcomeScreen
          onOpenProject={handleOpenProject}
          onNewProject={handleNewProject}
        />
        <StatusBar />
      </div>
    )
  }

  const showEditor = viewMode === 'source' || viewMode === 'split'
  const showPdf = viewMode === 'pdf' || viewMode === 'split'

  return (
    <div className="app-layout">
      {/* ── Titlebar ── */}
      <Titlebar />

      {/* ── Toolbar ── */}
      <Toolbar viewMode={viewMode} onViewModeChange={setViewMode} />

      {/* ── Main Content ── */}
      <div className="app-main" ref={mainRef}>
        {/* ── Left Sidebar Tabs ── */}
        {sidebarVisible && (
          <div className="left-sidebar-tabs">
            <div className="left-sidebar-tab-top">
              <button
                className={`left-sidebar-tab-btn${sidebarTab === 'files' ? ' active' : ''}`}
                onClick={() => setSidebarTab('files')}
                data-tooltip="Project Files"
              >
                📁
              </button>
              <button
                className={`left-sidebar-tab-btn${sidebarTab === 'search' ? ' active' : ''}`}
                onClick={() => setSidebarTab('search')}
                data-tooltip="Search in Files"
              >
                🔍
              </button>
              <button
                className={`left-sidebar-tab-btn${sidebarTab === 'history' ? ' active' : ''}`}
                onClick={() => setSidebarTab('history')}
                data-tooltip="History & Git"
              >
                ⏳
              </button>
            </div>
            <div className="left-sidebar-tab-bottom">
              <button
                className={`left-sidebar-tab-btn${sidebarTab === 'settings' ? ' active' : ''}`}
                onClick={() => setSidebarTab('settings')}
                data-tooltip="Settings"
              >
                ⚙️
              </button>
            </div>
          </div>
        )}

        {/* ── Sidebar ── */}
        {sidebarVisible && (
          <div className="sidebar">
            {sidebarTab === 'files' && (
              <>
                <div style={{ flex: sidebarSplitRatio, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <FileTree />
                </div>
                <div
                  className="split-handle-vertical"
                  onMouseDown={handleSidebarSplitMouseDown}
                />
                <div style={{ flex: 1 - sidebarSplitRatio, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <DocumentOutline />
                </div>
              </>
            )}

            {sidebarTab === 'search' && (
              <div className="sidebar-settings-panel">
                <div className="sidebar-section-title" style={{ padding: '0 0 var(--space-2) 0', borderBottom: '1px solid var(--border-subtle)', marginBottom: 12 }}>
                  Search in Files
                </div>
                <div className="sidebar-settings-group">
                  <span className="sidebar-settings-label">Find</span>
                  <input
                    type="text"
                    placeholder="Text to find..."
                    className="input-field"
                  />
                </div>
                <div className="sidebar-settings-group" style={{ marginTop: 12 }}>
                  <span className="sidebar-settings-label">Replace</span>
                  <input
                    type="text"
                    placeholder="Replace with..."
                    className="input-field"
                  />
                </div>
                <button
                  className="btn btn-primary"
                  style={{ width: '100%', height: 34, marginTop: 16 }}
                >
                  Search
                </button>
              </div>
            )}

            {sidebarTab === 'history' && (
              <div className="sidebar-settings-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                <div className="sidebar-section-title" style={{ padding: '0 0 var(--space-2) 0', borderBottom: '1px solid var(--border-subtle)', marginBottom: 12 }}>
                  History & Versions
                </div>
                
                {/* Save snapshot input group */}
                <div className="sidebar-settings-group" style={{ marginBottom: 16 }}>
                  <span className="sidebar-settings-label">New Snapshot Name</span>
                  <input
                    type="text"
                    placeholder="e.g. Before changing intro..."
                    className="input-field"
                    value={newVersionName}
                    onChange={(e) => setNewVersionName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveVersion()
                    }}
                  />
                  <button
                    className="btn btn-primary"
                    style={{ width: '100%', height: 32, marginTop: 8, fontSize: '12px' }}
                    onClick={handleSaveVersion}
                    disabled={!newVersionName.trim()}
                  >
                    💾 Save Version
                  </button>
                </div>

                <div className="sidebar-section-title" style={{ padding: '4px 0', fontSize: '11px', opacity: 0.8 }}>
                  Saved Snapshots
                </div>

                {/* Snapshots list */}
                <div style={{ flex: 1, overflowY: 'auto', marginTop: 8 }} className="history-list">
                  {historyVersions.length === 0 ? (
                    <div style={{ opacity: 0.5, fontSize: '11px', textAlign: 'center', marginTop: 20 }}>
                      ⏳ No snapshots saved yet
                    </div>
                  ) : (
                    historyVersions.map((ver) => (
                      <div key={ver.id} className="history-item">
                        <div className="history-item-details">
                          <span className="history-item-name" title={ver.name}>{ver.name}</span>
                          <span className="history-item-time">
                            {new Date(ver.timestamp).toLocaleString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        <div className="history-item-actions">
                          <button
                            className="history-action-btn"
                            onClick={() => handleViewVersion(ver)}
                            title="View Version Content"
                          >
                            👁️
                          </button>
                          <button
                            className="history-action-btn restore"
                            onClick={() => handleRestoreVersion(ver)}
                            title="Restore this Version"
                          >
                            🔄
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {sidebarTab === 'settings' && (
              <div className="sidebar-settings-panel">
                <div className="sidebar-section-title" style={{ padding: '0 0 var(--space-2) 0', borderBottom: '1px solid var(--border-subtle)', marginBottom: 12 }}>
                  Compiler Settings
                </div>
                <div className="sidebar-settings-group">
                  <span className="sidebar-settings-label">LaTeX Engine</span>
                  <select
                    className="toolbar-select"
                    value={engine}
                    onChange={(e) => setEngine(e.target.value as any)}
                    style={{ width: '100%', marginTop: 4 }}
                  >
                    <option value="pdflatex">pdfLaTeX</option>
                    <option value="xelatex">XeLaTeX</option>
                    <option value="lualatex">LuaLaTeX</option>
                  </select>
                </div>
                <div className="sidebar-settings-group" style={{ marginTop: 16 }}>
                  <span className="sidebar-settings-label">Font Size</span>
                  <select className="toolbar-select" defaultValue="14" style={{ width: '100%', marginTop: 4 }}>
                    <option value="12">12px</option>
                    <option value="14">14px</option>
                    <option value="16">16px</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Editor Area ── */}
        {showEditor && (
          <div
            className="app-editor-area"
            style={
              viewMode === 'split'
                ? { flex: `0 0 calc(${splitRatio * 100}% - ${sidebarVisible ? 0 : 0}px)` }
                : { flex: 1 }
            }
          >
            <EditorTabs />
            <LaTeXEditor />
          </div>
        )}

        {/* ── Split Handle ── */}
        {viewMode === 'split' && (
          <div
            className={`split-handle${isDragging.current ? ' dragging' : ''}`}
            onMouseDown={handleSplitMouseDown}
          />
        )}

        {/* ── PDF Area ── */}
        {showPdf && (
          <div
            className="app-pdf-area"
            style={
              viewMode === 'split'
                ? { flex: `0 0 calc(${(1 - splitRatio) * 100}%)` }
                : { flex: 1 }
            }
          >
            <PDFViewer />
            <CompileLog />
          </div>
        )}
      </div>

      {/* ── Version History Preview Modal ── */}
      {activeVersionPreview && (
        <div className="version-modal-overlay" onClick={() => setActiveVersionPreview(null)}>
          <div className="version-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="version-modal-header">
              <div>
                <h3 className="version-modal-title">Review Snapshot: {activeVersionPreview.name}</h3>
                <span className="version-modal-time">
                  Saved on {new Date(activeVersionPreview.timestamp).toLocaleString()}
                </span>
              </div>
              <button className="version-modal-close-btn" onClick={() => setActiveVersionPreview(null)}>
                ✕
              </button>
            </div>
            <div className="version-modal-body">
              <textarea
                readOnly
                value={activeVersionPreview.content}
                className="version-modal-textarea"
                placeholder="(Empty snapshot file)"
              />
            </div>
            <div className="version-modal-footer">
              <button className="btn btn-ghost" onClick={() => setActiveVersionPreview(null)}>
                Close
              </button>
              <button
                className="btn btn-primary"
                onClick={() => handleRestoreVersion(activeVersionPreview)}
              >
                🔄 Restore this Version
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Table Wizard Modal ── */}
      <TableWizardModal
        isOpen={isTableWizardOpen}
        onClose={() => setIsTableWizardOpen(false)}
        onInsert={(snippet) => {
          window.dispatchEvent(
            new CustomEvent('insert-snippet', {
              detail: { before: snippet, after: '' }
            })
          )
        }}
      />

      {/* ── Equation Wizard Modal ── */}
      <EquationWizardModal
        isOpen={isEquationWizardOpen}
        onClose={() => setIsEquationWizardOpen(false)}
        onInsert={(snippet) => {
          window.dispatchEvent(
            new CustomEvent('insert-snippet', {
              detail: { before: snippet, after: '' }
            })
          )
        }}
      />

      {/* ── About, Feedback, Share, and AI Dialogs ── */}
      <AboutDialog isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
      <FeedbackDialog isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
      <ShareDialog isOpen={isShareOpen} onClose={() => setIsShareOpen(false)} />
      <AIAssistantDialog isOpen={isAIOpen} onClose={() => setIsAIOpen(false)} />

      {/* ── Status Bar ── */}
      <StatusBar />
    </div>
  )
}

export default App

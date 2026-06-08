import React, { useState, useEffect, useCallback } from 'react'
import type { ProjectInfo } from '../../../shared/ipc'

interface WelcomeScreenProps {
  onOpenProject: (path: string) => void
  onNewProject: (name: string, templateId?: string) => void
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onOpenProject,
  onNewProject
}) => {
  const [recentProjects, setRecentProjects] = useState<ProjectInfo[]>([])
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const fetchRecentProjects = useCallback(async () => {
    try {
      if (window.api?.project?.getRecent) {
        const list = await window.api.project.getRecent()
        setRecentProjects(list)
      }
    } catch (err) {
      console.error('Failed to load recent projects:', err)
    }
  }, [])

  useEffect(() => {
    fetchRecentProjects()
  }, [fetchRecentProjects])

  const handleOpenFolder = async () => {
    try {
      if (window.api?.dialog?.openFolder) {
        const path = await window.api.dialog.openFolder()
        if (path) {
          onOpenProject(path)
        }
      }
    } catch (err) {
      console.error('Failed to open folder:', err)
    }
  }

  const handleCreateNewProject = (templateId?: string) => {
    setShowTemplateDropdown(false)
    const name = prompt('Enter project name:')
    if (!name) return
    onNewProject(name, templateId)
  }

  const filteredProjects = recentProjects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="welcome-screen">
      {/* Sidebar */}
      <div className="welcome-sidebar">
        <div className="welcome-logo-area">
          <span className="welcome-logo-icon">🍃</span>
          <span className="welcome-logo-text">Openleaf</span>
        </div>

        <div className="welcome-action-container">
          <button
            className="welcome-new-project-btn"
            onClick={() => setShowTemplateDropdown(!showTemplateDropdown)}
          >
            ➕ New Project
          </button>

          {showTemplateDropdown && (
            <div className="welcome-template-menu">
              <button onClick={() => handleCreateNewProject()}>
                📄 Blank Project
              </button>
              <button onClick={() => handleCreateNewProject('report')}>
                📚 Academic Report
              </button>
              <button onClick={() => handleCreateNewProject('beamer')}>
                🖼️ Presentation (Beamer)
              </button>
              <button onClick={() => handleCreateNewProject('letter')}>
                ✉️ Letter
              </button>
            </div>
          )}
        </div>

        <div className="welcome-sidebar-nav">
          <div className="welcome-nav-item active">📁 All Projects</div>
          <div className="welcome-nav-item" onClick={handleOpenFolder}>
            📂 Open Local Folder
          </div>
        </div>

        <div className="welcome-sidebar-footer">
          <div>Openleaf v1.0.0</div>
          <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', marginTop: 6 }}>
            Developed By Dr Chandrasen Pandey
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="welcome-main">
        <div className="welcome-header">
          <h1>My Projects</h1>
          <div className="welcome-search-box">
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="welcome-content">
          <div className="templates-gallery" style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: 'var(--font-size-md)', marginBottom: '16px', color: 'var(--text-secondary)' }}>Start from Template</h2>
            <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '8px' }}>
              <button 
                className="template-card" 
                onClick={() => handleCreateNewProject()}
                style={{ flex: '0 0 160px', height: '120px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-default)', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent-green)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.background = 'var(--bg-tertiary)' }}
              >
                <div style={{ fontSize: '32px' }}>📄</div>
                <div style={{ fontWeight: 500, fontSize: 'var(--font-size-sm)' }}>Blank Project</div>
              </button>
              <button 
                className="template-card" 
                onClick={() => handleCreateNewProject('report')}
                style={{ flex: '0 0 160px', height: '120px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-default)', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent-green)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.background = 'var(--bg-tertiary)' }}
              >
                <div style={{ fontSize: '32px' }}>📚</div>
                <div style={{ fontWeight: 500, fontSize: 'var(--font-size-sm)' }}>Academic Report</div>
              </button>
              <button 
                className="template-card" 
                onClick={() => handleCreateNewProject('beamer')}
                style={{ flex: '0 0 160px', height: '120px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-default)', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent-green)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.background = 'var(--bg-tertiary)' }}
              >
                <div style={{ fontSize: '32px' }}>🖼️</div>
                <div style={{ fontWeight: 500, fontSize: 'var(--font-size-sm)' }}>Presentation</div>
              </button>
              <button 
                className="template-card" 
                onClick={() => handleCreateNewProject('letter')}
                style={{ flex: '0 0 160px', height: '120px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-default)', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent-green)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.background = 'var(--bg-tertiary)' }}
              >
                <div style={{ fontSize: '32px' }}>✉️</div>
                <div style={{ fontWeight: 500, fontSize: 'var(--font-size-sm)' }}>Letter</div>
              </button>
            </div>
          </div>

          {recentProjects.length === 0 ? (
            <div className="welcome-empty-state" style={{ marginTop: '0' }}>
              <div className="welcome-empty-icon">📂</div>
              <h2>Create or Open a LaTeX Project</h2>
              <p>
                Get started by creating a new document from a template above or opening
                an existing project folder from your computer.
              </p>
              <div className="welcome-empty-actions">
                <button className="btn btn-primary" onClick={handleOpenFolder}>
                  Open Folder
                </button>
              </div>
            </div>
          ) : (
            <div className="project-list-container">
              <table className="project-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Last Modified</th>
                    <th>Compiler</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.map((project) => (
                    <tr key={project.path} className="project-row">
                      <td
                        className="project-cell-name"
                        onClick={() => onOpenProject(project.path)}
                      >
                        <span className="project-icon">📂</span>
                        <div className="project-meta">
                          <span className="project-title">{project.name}</span>
                          <span className="project-path">{project.path}</span>
                        </div>
                      </td>
                      <td>
                        {new Date(project.lastOpened).toLocaleString(undefined, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td>
                        <span className="project-engine-badge">
                          {project.engine}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn-icon"
                          onClick={() => onOpenProject(project.path)}
                          title="Open Project"
                        >
                          👁️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredProjects.length === 0 && (
                <div style={{ padding: 32, textAlign: 'center', opacity: 0.5 }}>
                  No matching projects found
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default WelcomeScreen

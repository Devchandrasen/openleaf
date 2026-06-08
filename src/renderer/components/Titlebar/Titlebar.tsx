import React from 'react'
import { useProjectStore } from '../../stores/projectStore'

export const Titlebar: React.FC = () => {
  const currentProject = useProjectStore((s) => s.currentProject)

  const handleMinimize = () => {
    window.api?.window?.minimize()
  }

  const handleMaximize = () => {
    window.api?.window?.maximize()
  }

  const handleClose = () => {
    window.api?.window?.close()
  }

  return (
    <div className="titlebar">
      <div className="titlebar-left">
        <span className="titlebar-icon">🍃</span>
        <span className="titlebar-app-name">Openleaf</span>
        {currentProject && (
          <>
            <span className="titlebar-separator" />
            <span className="titlebar-project-name">
              {currentProject.name}
            </span>
            <button
              className="titlebar-btn"
              style={{ width: 'auto', padding: '0 8px', marginLeft: '8px', fontSize: '11px', background: 'transparent' }}
              onClick={() => window.dispatchEvent(new CustomEvent('close-project'))}
              title="Close Project and Return to Home"
            >
              🏠 Home
            </button>
          </>
        )}
      </div>

      <div className="titlebar-center">
        Developed By Dr Chandrasen Pandey
      </div>

      <div className="titlebar-controls">
        <button
          className="titlebar-btn"
          style={{ width: 'auto', padding: '0 10px', fontSize: '12px', background: 'var(--accent-green-subtle)', color: 'var(--accent-green)' }}
          onClick={() => window.dispatchEvent(new CustomEvent('open-share-dialog'))}
        >
          Share
        </button>
        <button
          className="titlebar-btn"
          onClick={handleMinimize}
          aria-label="Minimize"
        >
          ─
        </button>
        <button
          className="titlebar-btn"
          onClick={handleMaximize}
          aria-label="Maximize"
        >
          □
        </button>
        <button
          className="titlebar-btn titlebar-btn-close"
          onClick={handleClose}
          aria-label="Close"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

export default Titlebar

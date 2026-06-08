import React, { useState, useEffect } from 'react'
import { useProjectStore } from '../../stores/projectStore'

interface ShareDialogProps {
  isOpen: boolean
  onClose: () => void
}

const ShareDialog: React.FC<ShareDialogProps> = ({ isOpen, onClose }) => {
  const currentProject = useProjectStore((state) => state.currentProject)
  const [isSharing, setIsSharing] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Listen for the custom event to open this dialog
  useEffect(() => {
    const handleOpen = () => {
      // The parent component manages the `isOpen` state, so this might not be needed
      // if we only trigger `onClose`.
    }
    window.addEventListener('open-share-dialog', handleOpen)
    return () => window.removeEventListener('open-share-dialog', handleOpen)
  }, [])

  if (!isOpen) return null

  const handleStartShare = async () => {
    if (!currentProject) return
    setIsLoading(true)
    setError(null)
    try {
      const url = await window.api.project.share(currentProject.path)
      setShareUrl(url)
      setIsSharing(true)
    } catch (err) {
      setError(String(err))
    } finally {
      setIsLoading(false)
    }
  }

  const handleStopShare = async () => {
    setIsLoading(true)
    try {
      await window.api.project.stopSharing()
      setIsSharing(false)
      setShareUrl(null)
    } catch (err) {
      setError(String(err))
    } finally {
      setIsLoading(false)
    }
  }

  const copyUrl = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ margin: 0 }}>Share Project via Internet</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div>
          {!currentProject ? (
            <p>Please open a project first to share it.</p>
          ) : (
            <div className="share-container">
              <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>Host your project on your local machine and expose it to the internet securely via LocalTunnel. Anyone with the link can view your project files.</p>
              
              {error && <div className="dialog-error" style={{ color: 'var(--color-error)', margin: '10px 0', padding: '10px', background: 'var(--color-error-subtle)', borderRadius: '6px' }}>{error}</div>}

              {!isSharing ? (
                <button 
                  className="btn btn-primary" 
                  onClick={handleStartShare} 
                  disabled={isLoading}
                  style={{ width: '100%', marginTop: '8px' }}
                >
                  {isLoading ? 'Starting Server...' : 'Start Sharing Session'}
                </button>
              ) : (
                <div className="share-active-panel" style={{ marginTop: 15, padding: 15, background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border-accent)' }}>
                  <p style={{ color: 'var(--color-success)', marginBottom: 10, fontWeight: 'bold' }}>✅ Sharing Active</p>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <input 
                      type="text" 
                      value={shareUrl || ''} 
                      readOnly 
                      style={{ flex: 1, padding: '8px', background: 'var(--bg-deep)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', borderRadius: 4 }}
                    />
                    <button className="btn btn-primary" onClick={copyUrl}>Copy</button>
                  </div>
                  <button 
                    className="btn btn-secondary" 
                    onClick={handleStopShare} 
                    disabled={isLoading}
                    style={{ marginTop: 15, width: '100%' }}
                  >
                    {isLoading ? 'Stopping...' : 'Stop Sharing'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ShareDialog

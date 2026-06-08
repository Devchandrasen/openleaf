import React from 'react'

interface AboutDialogProps {
  isOpen: boolean
  onClose: () => void
}

export const AboutDialog: React.FC<AboutDialogProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center' }}>
        <button className="modal-close" onClick={onClose}>×</button>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🍃</div>
        <h2 style={{ marginBottom: '8px' }}>Openleaf</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Version 1.0.0</p>
        
        <p style={{ marginBottom: '16px' }}>
          A free, open-source LaTeX editor with real-time PDF preview.
        </p>
        
        <div style={{ background: 'var(--bg-deep)', padding: '16px', borderRadius: '8px', marginBottom: '24px' }}>
          <p style={{ margin: 0, fontWeight: 'bold' }}>Developed By</p>
          <p style={{ margin: 0, color: 'var(--accent-teal)' }}>Dr Chandrasen Pandey</p>
        </div>

        <button className="btn btn-primary" onClick={onClose} style={{ width: '100%' }}>
          Close
        </button>
      </div>
    </div>
  )
}

export default AboutDialog

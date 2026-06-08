import React, { useState } from 'react'

interface FeedbackDialogProps {
  isOpen: boolean
  onClose: () => void
}

export const FeedbackDialog: React.FC<FeedbackDialogProps> = ({ isOpen, onClose }) => {
  const [feedback, setFeedback] = useState('')

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const subject = encodeURIComponent('Openleaf Feedback / Bug Report')
    const body = encodeURIComponent(feedback)
    const mailtoUrl = `mailto:developer.chandrasen@gmail.com?subject=${subject}&body=${body}`
    
    // Open default mail client
    window.location.href = mailtoUrl
    
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <button className="modal-close" onClick={onClose}>×</button>
        <h2 style={{ marginBottom: '16px' }}>Submit Feedback</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
          Encountered a bug or have a feature suggestion? Let us know! 
          This will open your default email client.
        </p>
        
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
              Message
            </label>
            <textarea
              className="welcome-search-box"
              style={{ width: '100%', minHeight: '150px', padding: '12px', background: 'var(--bg-deep)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', borderRadius: '4px', resize: 'vertical' }}
              placeholder="Describe the issue or suggestion..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              required
            />
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={!feedback.trim()}>
              Send via Email
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default FeedbackDialog

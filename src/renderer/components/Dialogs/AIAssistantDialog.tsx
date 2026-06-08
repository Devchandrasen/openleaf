import React, { useState, useEffect, useRef } from 'react'
import { useCompilerStore } from '../../stores/compilerStore'
interface AIAssistantDialogProps {
  isOpen: boolean
  onClose: () => void
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export const AIAssistantDialog: React.FC<AIAssistantDialogProps> = ({ isOpen, onClose }) => {
  const log = useCompilerStore((s) => s.log)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen && messages.length === 0 && log) {
      // Auto-analyze log on open if there are errors
      const errorContext = log.split('\\n').filter(line => line.toLowerCase().includes('error') || line.startsWith('!')).join('\\n')
      if (errorContext) {
        setMessages([{
          role: 'assistant',
          content: 'I noticed some errors in your compilation log. How can I help you fix them?'
        }])
      }
    }
  }, [isOpen, log, messages.length])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (!isOpen) return null

  const handleSend = async () => {
    if (!input.trim() || isLoading) return
    const userMsg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setIsLoading(true)

    try {
      // Pass the compilation log as context for the AI
      const response = await window.api.ai.ask(userMsg, `Compilation Log Snapshot:\n${log.substring(log.length - 2000)}`)
      setMessages(prev => [...prev, { role: 'assistant', content: response }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err instanceof Error ? err.message : String(err)}` }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ width: '600px', maxWidth: '90vw', height: '600px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ margin: 0 }}>🤖 AI Assistant</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '4px' }}>
            {messages.length === 0 && (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '20px' }}>
                Ask me anything about LaTeX or your current project!
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} style={{
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                background: msg.role === 'user' ? 'var(--accent-green-subtle)' : 'var(--bg-elevated)',
                border: msg.role === 'user' ? '1px solid var(--accent-green)' : '1px solid var(--border-default)',
                padding: '10px 14px',
                borderRadius: '8px',
                maxWidth: '85%',
                wordBreak: 'break-word',
                lineHeight: '1.5'
              }}>
                {msg.content}
              </div>
            ))}
            {isLoading && (
              <div style={{ alignSelf: 'flex-start', color: 'var(--text-muted)' }}>
                Thinking...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          <div style={{ paddingTop: '15px', borderTop: '1px solid var(--border-default)', display: 'flex', gap: '10px', marginTop: '10px' }}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSend() }}
              placeholder="Ask for suggestions or error fixes..."
              style={{
                flex: 1,
                padding: '10px',
                background: 'var(--bg-deep)',
                border: '1px solid var(--border-default)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                outline: 'none'
              }}
              disabled={isLoading}
            />
            <button className="btn btn-primary" onClick={handleSend} disabled={isLoading || !input.trim()}>
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

import React, { useState, useEffect, useRef } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'

interface EquationWizardModalProps {
  isOpen: boolean
  onClose: () => void
  onInsert: (snippet: string) => void
}

interface MathSymbol {
  label: string
  latex: string
  display: string
}

const GREEK_LETTERS: MathSymbol[] = [
  { label: 'α', latex: '\\alpha', display: 'α' },
  { label: 'β', latex: '\\beta', display: 'β' },
  { label: 'γ', latex: '\\gamma', display: 'γ' },
  { label: 'δ', latex: '\\delta', display: 'δ' },
  { label: 'ε', latex: '\\epsilon', display: 'ε' },
  { label: 'θ', latex: '\\theta', display: 'θ' },
  { label: 'λ', latex: '\\lambda', display: 'λ' },
  { label: 'μ', latex: '\\mu', display: 'μ' },
  { label: 'π', latex: '\\pi', display: 'π' },
  { label: 'σ', latex: '\\sigma', display: 'σ' },
  { label: 'φ', latex: '\\phi', display: 'φ' },
  { label: 'ψ', latex: '\\psi', display: 'ψ' },
  { label: 'ω', latex: '\\omega', display: 'ω' },
  { label: 'Δ', latex: '\\Delta', display: 'Δ' },
  { label: 'Θ', latex: '\\Theta', display: 'Θ' },
  { label: 'Λ', latex: '\\Lambda', display: 'Λ' },
  { label: 'Σ', latex: '\\Sigma', display: 'Σ' },
  { label: 'Φ', latex: '\\Phi', display: 'Φ' },
  { label: 'Ω', latex: '\\Omega', display: 'Ω' }
]

const OPERATORS: MathSymbol[] = [
  { label: '+/-', latex: '\\pm', display: '±' },
  { label: '-/+', latex: '\\mp', display: '∓' },
  { label: '×', latex: '\\times', display: '×' },
  { label: '÷', latex: '\\div', display: '÷' },
  { label: '·', latex: '\\cdot', display: '·' },
  { label: '∗', latex: '\\ast', display: '∗' },
  { label: '∩', latex: '\\cap', display: '∩' },
  { label: '∪', latex: '\\cup', display: '∪' },
  { label: '∨', latex: '\\vee', display: '∨' },
  { label: '∧', latex: '\\wedge', display: '∧' }
]

const RELATIONS: MathSymbol[] = [
  { label: '≤', latex: '\\le', display: '≤' },
  { label: '≥', latex: '\\ge', display: '≥' },
  { label: '≠', latex: '\\neq', display: '≠' },
  { label: '≈', latex: '\\approx', display: '≈' },
  { label: '≡', latex: '\\equiv', display: '≡' },
  { label: '∝', latex: '\\propto', display: '∝' },
  { label: '∈', latex: '\\in', display: '∈' },
  { label: '∉', latex: '\\notin', display: '∉' },
  { label: '⊂', latex: '\\subset', display: '⊂' },
  { label: '⊃', latex: '\\supset', display: '⊃' },
  { label: '⊆', latex: '\\subseteq', display: '⊆' },
  { label: '⊇', latex: '\\supseteq', display: '⊇' }
]

const ADVANCED_SYMBOLS: MathSymbol[] = [
  { label: '∞', latex: '\\infty', display: '∞' },
  { label: '∂', latex: '\\partial', display: '∂' },
  { label: '∇', latex: '\\nabla', display: '∇' },
  { label: '∀', latex: '\\forall', display: '∀' },
  { label: '∃', latex: '\\exists', display: '∃' },
  { label: '∅', latex: '\\emptyset', display: '∅' },
  { label: 'ℏ', latex: '\\hbar', display: 'ℏ' },
  { label: 'ℵ', latex: '\\aleph', display: 'ℵ' }
]

const LAYOUTS: MathSymbol[] = [
  { label: 'Fraction', latex: '\\frac{a}{b}', display: 'a/b' },
  { label: 'Square Root', latex: '\\sqrt{x}', display: '√x' },
  { label: 'Power', latex: 'x^{y}', display: 'x^y' },
  { label: 'Subscript', latex: 'x_{y}', display: 'x_y' },
  { label: 'Integral', latex: '\\int_{a}^{b} x \\, dx', display: '∫' },
  { label: 'Sum', latex: '\\sum_{i=1}^{n} x_i', display: '∑' },
  { label: 'Limit', latex: '\\lim_{x \\to \\infty}', display: 'lim' },
  { label: 'Vector', latex: '\\vec{v}', display: 'v⃗' },
  { label: 'Overline', latex: '\\overline{x}', display: 'x̄' }
]

export const EquationWizardModal: React.FC<EquationWizardModalProps> = ({ isOpen, onClose, onInsert }) => {
  const [equation, setEquation] = useState('f(x) = \\int_{-\\infty}^{\\infty} e^{-x^2} \\, dx')
  const [activeTab, setActiveTab] = useState<'greek' | 'operators' | 'relations' | 'symbols' | 'layouts'>('greek')
  const [eqType, setEqType] = useState<'inline' | 'display'>('display')
  
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen && previewRef.current) {
      try {
        katex.render(equation || '\\quad', previewRef.current, {
          displayMode: true,
          throwOnError: false
        })
      } catch (err) {
        console.error('KaTeX rendering error:', err)
      }
    }
  }, [equation, isOpen])

  if (!isOpen) return null

  const handleSymbolClick = (latex: string) => {
    const textarea = textareaRef.current
    if (!textarea) {
      setEquation((prev) => prev + latex)
      return
    }

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = textarea.value
    const before = text.substring(0, start)
    const after = text.substring(end, text.length)

    const nextEq = before + latex + after
    setEquation(nextEq)

    // Reset selection position after state update
    setTimeout(() => {
      textarea.focus()
      const newCursorPos = start + latex.length
      textarea.setSelectionRange(newCursorPos, newCursorPos)
    }, 50)
  }

  const handleInsert = () => {
    const formatted = eqType === 'display' 
      ? `\\begin{equation}\n  ${equation}\n\\end{equation}`
      : `$${equation}$`
    onInsert(formatted)
    onClose()
  }

  const getSymbolsForTab = () => {
    switch (activeTab) {
      case 'greek': return GREEK_LETTERS
      case 'operators': return OPERATORS
      case 'relations': return RELATIONS
      case 'symbols': return ADVANCED_SYMBOLS
      case 'layouts': return LAYOUTS
    }
  }

  return (
    <div className="version-modal-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
      <div className="version-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '750px', width: '90%' }}>
        <div className="version-modal-header">
          <div>
            <h3 className="version-modal-title" style={{ fontSize: '18px', fontWeight: 'bold' }}>∑ Equation Wizard</h3>
            <span className="version-modal-time">Build mathematical formulas with live visual rendering</span>
          </div>
          <button className="version-modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="version-modal-body" style={{ maxHeight: '70vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Real-time Math Preview Panel */}
          <div style={{
            background: 'var(--bg-deep)',
            border: '1px solid var(--border-emphasis)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
            minHeight: '100px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'auto',
            boxShadow: 'var(--shadow-inset)'
          }}>
            <div ref={previewRef} style={{ fontSize: '20px', color: 'var(--text-primary)' }} />
          </div>

          {/* Equation Input Editor */}
          <div className="sidebar-settings-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span className="sidebar-settings-label">LaTeX Formula Code</span>
              <div style={{ display: 'flex', gap: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '11px' }}>
                  <input
                    type="radio"
                    name="eqType"
                    checked={eqType === 'display'}
                    onChange={() => setEqType('display')}
                  />
                  Display (\[...\])
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '11px' }}>
                  <input
                    type="radio"
                    name="eqType"
                    checked={eqType === 'inline'}
                    onChange={() => setEqType('inline')}
                  />
                  Inline ($...$)
                </label>
              </div>
            </div>
            <textarea
              ref={textareaRef}
              rows={3}
              className="input-field"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
                resize: 'vertical',
                width: '100%',
                padding: '8px'
              }}
              value={equation}
              onChange={(e) => setEquation(e.target.value)}
              placeholder="Type or click symbols to build your equation..."
            />
          </div>

          {/* Categories Tab Selector */}
          <div>
            <div style={{
              display: 'flex',
              borderBottom: '1px solid var(--border-subtle)',
              marginBottom: '12px',
              gap: '4px'
            }}>
              {(['greek', 'operators', 'relations', 'symbols', 'layouts'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    background: 'none',
                    border: 'none',
                    borderBottom: activeTab === tab ? '2px solid var(--accent-teal)' : '2px solid transparent',
                    color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-secondary)',
                    padding: '8px 12px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: activeTab === tab ? 'bold' : 'normal',
                    outline: 'none',
                    textTransform: 'capitalize'
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Symbol Buttons Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))',
              gap: '8px',
              padding: '4px'
            }}>
              {getSymbolsForTab()?.map((sym, i) => (
                <button
                  key={i}
                  className="toolbar-btn"
                  onClick={() => handleSymbolClick(sym.latex)}
                  title={sym.latex}
                  style={{
                    height: '40px',
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: activeTab === 'layouts' ? '11px' : '15px',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-secondary)',
                    cursor: 'pointer'
                  }}
                >
                  <span style={{ fontSize: activeTab === 'layouts' ? '10px' : '15px', fontWeight: 'bold' }}>{sym.display}</span>
                  <span style={{ fontSize: '8px', color: 'var(--text-tertiary)', overflow: 'hidden', maxWidth: '100%', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {sym.latex.replace('\\', '')}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="version-modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleInsert}
          >
            Insert Equation
          </button>
        </div>
      </div>
    </div>
  )
}
export default EquationWizardModal

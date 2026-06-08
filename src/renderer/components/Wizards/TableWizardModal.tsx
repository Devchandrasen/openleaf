import React, { useState, useEffect } from 'react'

interface TableWizardModalProps {
  isOpen: boolean
  onClose: () => void
  onInsert: (snippet: string) => void
}

export const TableWizardModal: React.FC<TableWizardModalProps> = ({ isOpen, onClose, onInsert }) => {
  const [numRows, setNumRows] = useState(3)
  const [numCols, setNumCols] = useState(3)
  const [caption, setCaption] = useState('')
  const [label, setLabel] = useState('')
  const [alignment, setAlignment] = useState<'c' | 'l' | 'r'>('c')
  const [hasVertBorders, setHasVertBorders] = useState(true)
  const [hasHorizBorders, setHasHorizBorders] = useState(true)
  const [gridData, setGridData] = useState<string[][]>([
    ['', '', ''],
    ['', '', ''],
    ['', '', '']
  ])

  useEffect(() => {
    setGridData((prev) => {
      const newGrid = Array.from({ length: numRows }, (_, r) => {
        return Array.from({ length: numCols }, (_, c) => {
          return prev[r]?.[c] || ''
        })
      })
      return newGrid
    })
  }, [numRows, numCols])

  if (!isOpen) return null

  const handleCellChange = (r: number, c: number, val: string) => {
    setGridData((prev) => {
      const next = prev.map((row) => [...row])
      next[r][c] = val
      return next
    })
  }

  const handleInsert = () => {
    // Generate alignment string, e.g. |c|c|c| or ccc
    const colAlign = alignment
    const colSpec = hasVertBorders
      ? `|${Array(numCols).fill(colAlign).join('|')}|`
      : Array(numCols).fill(colAlign).join('')

    let tabularContent = ''
    for (let r = 0; r < numRows; r++) {
      const rowCells = gridData[r].map(cell => cell.trim() || ' ')
      tabularContent += `    ${rowCells.join(' & ')} \\\\\n`
      if (hasHorizBorders || r === 0) {
        tabularContent += '    \\hline\n'
      }
    }

    const snippet = `\\begin{table}[htbp]
  \\centering
  \\caption{${caption || 'Table Title'}}
  \\label{tab:${label || 'label'}}
  \\begin{tabular}{${colSpec}}
    \\hline
${tabularContent}  \\end{tabular}
\\end{table}`

    onInsert(snippet)
    onClose()
  }

  return (
    <div className="version-modal-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
      <div className="version-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', width: '90%' }}>
        <div className="version-modal-header">
          <div>
            <h3 className="version-modal-title" style={{ fontSize: '18px', fontWeight: 'bold' }}>📊 Table Wizard</h3>
            <span className="version-modal-time">Visually design and generate LaTeX tables</span>
          </div>
          <button className="version-modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="version-modal-body" style={{ maxHeight: '70vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Row/Col Settings Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div className="sidebar-settings-group">
              <span className="sidebar-settings-label">Rows</span>
              <input
                type="number"
                min={1}
                max={15}
                className="input-field"
                value={numRows}
                onChange={(e) => setNumRows(Math.max(1, Math.min(15, parseInt(e.target.value, 10) || 1)))}
              />
            </div>
            <div className="sidebar-settings-group">
              <span className="sidebar-settings-label">Columns</span>
              <input
                type="number"
                min={1}
                max={10}
                className="input-field"
                value={numCols}
                onChange={(e) => setNumCols(Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 1)))}
              />
            </div>
            <div className="sidebar-settings-group">
              <span className="sidebar-settings-label">Global Column Align</span>
              <select
                className="toolbar-select"
                style={{ width: '100%', marginTop: 4, height: 34 }}
                value={alignment}
                onChange={(e) => setAlignment(e.target.value as any)}
              >
                <option value="c">Center</option>
                <option value="l">Left</option>
                <option value="r">Right</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div className="sidebar-settings-group">
              <span className="sidebar-settings-label">Caption</span>
              <input
                type="text"
                placeholder="Table Caption..."
                className="input-field"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
              />
            </div>
            <div className="sidebar-settings-group">
              <span className="sidebar-settings-label">Label</span>
              <input
                type="text"
                placeholder="tab:my_table"
                className="input-field"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginTop: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px' }}>
                <input
                  type="checkbox"
                  checked={hasVertBorders}
                  onChange={(e) => setHasVertBorders(e.target.checked)}
                />
                Vert Borders
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px' }}>
                <input
                  type="checkbox"
                  checked={hasHorizBorders}
                  onChange={(e) => setHasHorizBorders(e.target.checked)}
                />
                Horiz Borders
              </label>
            </div>
          </div>

          {/* Grid Preview Editor */}
          <div>
            <span className="sidebar-settings-label" style={{ marginBottom: '8px', display: 'block' }}>Fill Table Cells</span>
            <div style={{
              overflowX: 'auto',
              padding: '10px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)'
            }}>
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <tbody>
                  {Array.from({ length: numRows }).map((_, r) => (
                    <tr key={r}>
                      {Array.from({ length: numCols }).map((_, c) => (
                        <td key={c} style={{
                          padding: '4px',
                          border: '1px solid var(--border-subtle)'
                        }}>
                          <input
                            type="text"
                            style={{
                              width: '100%',
                              minWidth: '80px',
                              background: 'var(--bg-primary)',
                              border: '1px solid var(--border-subtle)',
                              color: 'var(--text-primary)',
                              padding: '6px',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '12px'
                            }}
                            value={gridData[r]?.[c] || ''}
                            onChange={(e) => handleCellChange(r, c, e.target.value)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
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
            Insert Table
          </button>
        </div>
      </div>
    </div>
  )
}

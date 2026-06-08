import React, { useMemo } from 'react'
import { useEditorStore } from '../../stores/editorStore'

interface OutlineEntry {
  level: 'part' | 'chapter' | 'section' | 'subsection' | 'subsubsection'
  title: string
  line: number
}

const SECTION_REGEX = /\\(part|chapter|section|subsection|subsubsection)\*?\{([^}]*)\}/g

function parseOutline(content: string): OutlineEntry[] {
  const entries: OutlineEntry[] = []
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    let match: RegExpExecArray | null
    SECTION_REGEX.lastIndex = 0
    while ((match = SECTION_REGEX.exec(line)) !== null) {
      entries.push({
        level: match[1] as OutlineEntry['level'],
        title: match[2].trim(),
        line: i + 1,
      })
    }
  }

  return entries
}

function getLevelClassName(level: OutlineEntry['level']): string {
  switch (level) {
    case 'part':
      return 'outline-item outline-item-part'
    case 'chapter':
      return 'outline-item outline-item-chapter'
    case 'section':
      return 'outline-item outline-item-section'
    case 'subsection':
      return 'outline-item outline-item-subsection'
    case 'subsubsection':
      return 'outline-item outline-item-subsubsection'
  }
}

export const DocumentOutline: React.FC = () => {
  const activeFileIndex = useEditorStore((s) => s.activeFileIndex)
  const openFiles = useEditorStore((s) => s.openFiles)
  const fileContents = useEditorStore((s) => s.fileContents)

  const activeFile = activeFileIndex >= 0 ? openFiles[activeFileIndex] : null
  const content = activeFile ? (fileContents[activeFile.path] ?? '') : ''

  const outline = useMemo(() => parseOutline(content), [content])

  const handleClick = (_entry: OutlineEntry) => {
    // In a full implementation, this would scroll the CodeMirror editor to the line.
    // For now we can use the cursor position or a scroll-to-line API.
    // The editor rebuild mechanism handles this via EditorView.
  }

  return (
    <div className="sidebar-section" style={{ flex: 1, minHeight: 0 }}>
      <div className="sidebar-section-header">
        <span className="sidebar-section-title">Outline</span>
      </div>
      <div className="sidebar-section-content">
        {outline.length === 0 ? (
          <div className="outline-empty">
            No sections found
          </div>
        ) : (
          <div className="outline">
            {outline.map((entry, idx) => (
              <div
                key={`${entry.line}-${idx}`}
                className={getLevelClassName(entry.level)}
                onClick={() => handleClick(entry)}
                title={`Line ${entry.line}`}
              >
                <span className="outline-marker" />
                {entry.title || '(untitled)'}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default DocumentOutline

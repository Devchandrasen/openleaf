import React, { useRef, useCallback } from 'react'
import { useEditorStore } from '../../stores/editorStore'

export const EditorTabs: React.FC = () => {
  const openFiles = useEditorStore((s) => s.openFiles)
  const activeFileIndex = useEditorStore((s) => s.activeFileIndex)
  const modifiedFiles = useEditorStore((s) => s.modifiedFiles)
  const setActiveFile = useEditorStore((s) => s.setActiveFile)
  const closeFile = useEditorStore((s) => s.closeFile)
  const scrollRef = useRef<HTMLDivElement>(null)

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft += e.deltaY
    }
  }, [])

  const handleClose = useCallback((e: React.MouseEvent, index: number) => {
    e.stopPropagation()
    closeFile(index)
  }, [closeFile])

  if (openFiles.length === 0) return null

  return (
    <div className="editor-tabs" ref={scrollRef} onWheel={handleWheel}>
      {openFiles.map((file, index) => {
        const isActive = index === activeFileIndex
        const isModified = modifiedFiles.has(file.path)

        return (
          <div
            key={file.path}
            className={`editor-tab${isActive ? ' active' : ''}`}
            onClick={() => setActiveFile(index)}
            title={file.path}
          >
            {isModified && <span className="editor-tab-modified" />}
            <span className="editor-tab-name">{file.name}</span>
            <button
              className="editor-tab-close"
              onClick={(e) => handleClose(e, index)}
              aria-label={`Close ${file.name}`}
            >
              ✕
            </button>
          </div>
        )
      })}
    </div>
  )
}

export default EditorTabs

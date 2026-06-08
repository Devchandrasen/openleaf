import React, { useEffect, useRef, useCallback, useState } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, rectangularSelection } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { bracketMatching, foldGutter, foldKeymap, StreamLanguage, HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { autocompletion, CompletionContext } from '@codemirror/autocomplete'
import { tags } from '@lezer/highlight'
import { useEditorStore } from '../../stores/editorStore'
import { useCompilerStore } from '../../stores/compilerStore'
import { useProjectStore } from '../../stores/projectStore'

/* ── Custom LaTeX StreamLanguage Definition ── */
const latexLanguage = StreamLanguage.define({
  startState: () => ({
    inMathMode: false,
    inComment: false,
    inEnvironment: false,
  }),
  token(stream, state) {
    // Comment
    if (stream.match('%')) {
      stream.skipToEnd()
      return 'comment'
    }

    // Math delimiters: \[ \] \( \)
    if (stream.match(/\\[\[\]()]/)) {
      state.inMathMode = !state.inMathMode
      return 'bracket'
    }

    // Display math $$ ... $$
    if (stream.match('$$')) {
      state.inMathMode = !state.inMathMode
      return 'bracket'
    }

    // Inline math $
    if (stream.peek() === '$' && !stream.match('$$', false)) {
      stream.next()
      state.inMathMode = !state.inMathMode
      return 'bracket'
    }

    // Environment begin/end
    if (stream.match(/\\(begin|end)\b/)) {
      return 'keyword'
    }

    // Environment name inside braces after \begin or \end
    if (stream.match(/\{[a-zA-Z*]+\}/)) {
      return 'typeName'
    }

    // LaTeX commands
    if (stream.match(/\\[a-zA-Z@]+\*?/)) {
      return 'function'
    }

    // Curly braces
    if (stream.match(/[{}]/)) {
      return 'brace'
    }

    // Square brackets
    if (stream.match(/[\[\]]/)) {
      return 'squareBracket'
    }

    // Escape sequences
    if (stream.match(/\\./)) {
      return 'escape'
    }

    // In math mode, highlight content differently
    if (state.inMathMode) {
      stream.next()
      return 'number'
    }

    // Default text
    stream.next()
    return null
  },
})

/* ── Custom Dark Theme Highlight Style ── */
const latexHighlightStyle = HighlightStyle.define([
  { tag: tags.comment, color: '#6e7681', fontStyle: 'italic' },
  { tag: tags.function(tags.variableName), color: '#bc8cff' },
  { tag: tags.keyword, color: '#ff7b72' },
  { tag: tags.typeName, color: '#f0883e' },
  { tag: tags.bracket, color: '#1db1a0', fontWeight: 'bold' },
  { tag: tags.brace, color: '#e3b341' },
  { tag: tags.squareBracket, color: '#8b949e' },
  { tag: tags.number, color: '#79c0ff' },
  { tag: tags.escape, color: '#a5d6ff' },
  { tag: tags.string, color: '#a5d6ff' },
])

/* ── Custom LaTeX Autocomplete Source ── */
const latexAutocompleteSource = (context: CompletionContext) => {
  // Match citation: \cite{ or \cite[...]{
  const citeBefore = context.matchBefore(/\\cite(?:\[[^\]]*\])?\{[a-zA-Z0-9_-]*/)
  if (citeBefore) {
    const query = citeBefore.text.split('{').pop() || ''
    const bibKeys: any[] = []
    const fileContents = useEditorStore.getState().fileContents

    for (const filePath in fileContents) {
      if (filePath.toLowerCase().endsWith('.bib')) {
        const bibContent = fileContents[filePath] || ''
        const entries = bibContent.matchAll(/@([a-zA-Z]+)\s*\{\s*([a-zA-Z0-9_-]+)\s*,([^@]*)/g)
        for (const match of entries) {
          const type = match[1]
          const key = match[2]
          const fieldsText = match[3]

          const titleMatch = fieldsText.match(/title\s*=\s*[\"{](.*?)[\"}]/i)
          const authorMatch = fieldsText.match(/author\s*=\s*[\"{](.*?)[\"}]/i)

          const title = titleMatch ? titleMatch[1].replace(/[{}]/g, '') : ''
          const author = authorMatch ? authorMatch[1].replace(/[{}]/g, '') : ''

          if (key.toLowerCase().includes(query.toLowerCase())) {
            bibKeys.push({
              label: key,
              type: 'constant',
              detail: type,
              info: `${title}\nBy ${author}`
            })
          }
        }
      }
    }

    return {
      from: citeBefore.from + citeBefore.text.indexOf('{') + 1,
      options: bibKeys
    }
  }

  // Match reference: \ref{ or \eqref{
  const refBefore = context.matchBefore(/\\(?:eq)?ref\{[a-zA-Z0-9_-]*/)
  if (refBefore) {
    const query = refBefore.text.split('{').pop() || ''
    const refKeys: any[] = []
    const fileContents = useEditorStore.getState().fileContents

    for (const filePath in fileContents) {
      if (filePath.toLowerCase().endsWith('.tex') || filePath.toLowerCase().endsWith('.cls') || filePath.toLowerCase().endsWith('.sty')) {
        const texContent = fileContents[filePath] || ''
        const labels = texContent.matchAll(/\\label\s*\{\s*([a-zA-Z0-9_:-]+)\s*\}/g)
        for (const match of labels) {
          const label = match[1]
          if (label.toLowerCase().includes(query.toLowerCase())) {
            refKeys.push({
              label,
              type: 'variable',
              detail: 'label'
            })
          }
        }
      }
    }

    return {
      from: refBefore.from + refBefore.text.indexOf('{') + 1,
      options: refKeys
    }
  }

  return null
}


/* ── CodeMirror Dark Theme ── */
const editorDarkTheme = EditorView.theme({
  '&': {
    backgroundColor: '#0d1117',
    color: '#e6edf3',
  },
  '.cm-content': {
    caretColor: '#2ea44f',
    fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', monospace",
    fontSize: '15px',
    lineHeight: '1.65',
    padding: '8px 0',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: '#2ea44f',
    borderLeftWidth: '2px',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(110, 118, 129, 0.06)',
  },
  '.cm-selectionBackground, ::selection': {
    backgroundColor: 'rgba(46, 164, 79, 0.15) !important',
  },
  '.cm-gutters': {
    backgroundColor: '#161b22',
    color: '#484f58',
    borderRight: '1px solid #21262d',
    minWidth: '52px',
  },
  '.cm-activeLineGutter': {
    backgroundColor: '#1c2128',
    color: '#8b949e',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 12px 0 8px',
  },
  '.cm-foldGutter .cm-gutterElement': {
    padding: '0 4px',
    cursor: 'pointer',
    color: '#484f58',
    transition: 'color 120ms ease',
  },
  '.cm-foldGutter .cm-gutterElement:hover': {
    color: '#e6edf3',
  },
  '.cm-matchingBracket': {
    backgroundColor: 'rgba(46, 164, 79, 0.2)',
    outline: '1px solid rgba(46, 164, 79, 0.4)',
  },
  '.cm-panels': {
    backgroundColor: '#1c2128',
    borderBottom: '1px solid #30363d',
  },
  '.cm-panel input': {
    backgroundColor: '#21262d',
    border: '1px solid #30363d',
    color: '#e6edf3',
    borderRadius: '4px',
    padding: '2px 8px',
  },
  '.cm-panel input:focus': {
    borderColor: '#2ea44f',
    outline: 'none',
  },
  '.cm-panel button': {
    backgroundColor: '#21262d',
    border: '1px solid #30363d',
    color: '#8b949e',
    borderRadius: '4px',
    padding: '2px 8px',
    cursor: 'pointer',
  },
  '.cm-panel button:hover': {
    backgroundColor: '#30363d',
    color: '#e6edf3',
  },
  '.cm-tooltip': {
    backgroundColor: '#282e36',
    border: '1px solid #30363d',
    borderRadius: '6px',
  },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
    backgroundColor: 'rgba(46, 164, 79, 0.12)',
    color: '#e6edf3',
  },
}, { dark: true })

interface LaTeXEditorProps {
  className?: string
}

export const LaTeXEditor: React.FC<LaTeXEditorProps> = ({ className }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const isExternalUpdate = useRef(false)

  const activeFileIndex = useEditorStore((s) => s.activeFileIndex)
  const openFiles = useEditorStore((s) => s.openFiles)
  const fileContents = useEditorStore((s) => s.fileContents)
  const updateContent = useEditorStore((s) => s.updateContent)
  const setCursorPosition = useEditorStore((s) => s.setCursorPosition)
  const markSaved = useEditorStore((s) => s.markSaved)
  const startCompile = useCompilerStore((s) => s.startCompile)
  const engine = useCompilerStore((s) => s.engine)
  const currentProject = useProjectStore((s) => s.currentProject)

  const activeFile = activeFileIndex >= 0 ? openFiles[activeFileIndex] : null
  const content = activeFile ? (fileContents[activeFile.path] ?? '') : ''

  const [blobUrl, setBlobUrl] = useState<string | null>(null)

  const fileName = (activeFile?.name || '').trim()
  const filePath = (activeFile?.path || '').trim()
  const isImage = /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(fileName) || /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(filePath)
  const isPdfFile = /\.pdf$/i.test(fileName) || /\.pdf$/i.test(filePath)

  useEffect(() => {
    if (!activeFile) {
      setBlobUrl(null)
      return
    }
    const isImageFile = /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(activeFile.name)
    const isPdfFile = /\.pdf$/i.test(activeFile.name)

    let url: string | null = null

    if ((isImageFile || isPdfFile) && window.api?.fs?.readFileBinary) {
      window.api.fs.readFileBinary(activeFile.path).then((bytes) => {
        const mimeType = isPdfFile
          ? 'application/pdf'
          : activeFile.name.endsWith('.svg') ? 'image/svg+xml' : 'image/png'
        const blob = new Blob([bytes], { type: mimeType })
        url = URL.createObjectURL(blob)
        setBlobUrl(url)
      }).catch((err) => {
        console.error('Failed to load binary file:', err)
      })
    } else {
      setBlobUrl(null)
    }

    return () => {
      if (url) {
        URL.revokeObjectURL(url)
      }
    }
  }, [activeFile?.path])

  const handleSaveAndCompile = useCallback(() => {
    if (!activeFile || !currentProject) return
    const currentContent = fileContents[activeFile.path] || ''
    if (window.api?.fs) {
      window.api.fs.writeFile(activeFile.path, currentContent).then(() => {
        markSaved(activeFile.path)
        startCompile({
          projectPath: currentProject.path,
          mainFile: currentProject.mainFile,
          engine,
        })
      })
    }
  }, [activeFile, currentProject, fileContents, markSaved, startCompile, engine])

  const handleForwardSync = useCallback(async () => {
    const view = viewRef.current
    if (!view || !activeFile || !currentProject || !window.api?.synctex?.forward) return

    try {
      const head = view.state.selection.main.head
      const lineObj = view.state.doc.lineAt(head)
      const lineNum = lineObj.number

      const mainBase = currentProject.mainFile.replace(/\.tex$/i, '')
      const pdfPath = `${currentProject.path}/${mainBase}.pdf`

      const result = await window.api.synctex.forward(activeFile.path, lineNum, pdfPath)
      if (result) {
        window.dispatchEvent(new CustomEvent('pdf-goto-position', {
          detail: { page: result.page, x: result.x, y: result.y }
        }))
      }
    } catch (err) {
      console.error('Failed to forward sync:', err)
    }
  }, [activeFile, currentProject])

  // Listen for editor scroll-to-line requests (from backward SyncTeX)
  useEffect(() => {
    const handleGotoLine = (e: Event) => {
      const view = viewRef.current
      if (!view) return
      const { line } = (e as CustomEvent).detail
      try {
        const docLen = view.state.doc.lines
        const targetLine = Math.max(1, Math.min(line, docLen))
        const lineObj = view.state.doc.line(targetLine)

        view.dispatch({
          selection: { anchor: lineObj.from, head: lineObj.to },
          scrollIntoView: true
        })
        view.focus()
      } catch (err) {
        console.error('Failed to jump to editor line:', err)
      }
    }
    window.addEventListener('editor-goto-line', handleGotoLine)
    return () => {
      window.removeEventListener('editor-goto-line', handleGotoLine)
    }
  }, [activeFile])

  // Listen for Ctrl+Alt+J forward SyncTeX shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'j') {
        e.preventDefault()
        handleForwardSync()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleForwardSync])

  // Listen for trigger sync toolbar click
  useEffect(() => {
    const handleTriggerSync = () => {
      handleForwardSync()
    }
    window.addEventListener('trigger-forward-sync', handleTriggerSync)
    return () => {
      window.removeEventListener('trigger-forward-sync', handleTriggerSync)
    }
  }, [handleForwardSync])

  // Build / rebuild editor view when active file changes
  useEffect(() => {
    if (!containerRef.current) return

    // Destroy old view
    if (viewRef.current) {
      viewRef.current.destroy()
      viewRef.current = null
    }

    if (!activeFile) return

    const saveKeymap = keymap.of([{
      key: 'Ctrl-s',
      run: () => {
        handleSaveAndCompile()
        return true
      },
    }])

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged && !isExternalUpdate.current && activeFile) {
        const newContent = update.state.doc.toString()
        updateContent(activeFile.path, newContent)
      }
      if (update.selectionSet) {
        const pos = update.state.selection.main.head
        const line = update.state.doc.lineAt(pos)
        setCursorPosition(line.number, pos - line.from + 1)
      }
    })

    const state = EditorState.create({
      doc: content,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        history(),
        foldGutter(),
        drawSelection(),
        rectangularSelection(),
        bracketMatching(),
        highlightSelectionMatches(),
        latexLanguage,
        syntaxHighlighting(latexHighlightStyle),
        editorDarkTheme,
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...foldKeymap,
          ...searchKeymap,
          indentWithTab,
        ]),
        saveKeymap,
        updateListener,
        EditorView.lineWrapping,
        EditorState.tabSize.of(2),
        autocompletion({ override: [latexAutocompleteSource] }),
      ],
    })

    const view = new EditorView({
      state,
      parent: containerRef.current,
    })

    viewRef.current = view

    return () => {
      view.destroy()
    }
    // We intentionally depend on activeFile?.path so editor rebuilds on file switch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFile?.path])

  // Sync content from store into the editor when file content first loads
  useEffect(() => {
    const view = viewRef.current
    if (!view || !activeFile) return

    const currentEditorContent = view.state.doc.toString()
    if (content !== currentEditorContent) {
      isExternalUpdate.current = true
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: content,
        },
      })
      isExternalUpdate.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, activeFile?.path])

  // Listen for snippet insertion requests (e.g. from Toolbar buttons)
  useEffect(() => {
    const handleInsertSnippet = (e: Event) => {
      const view = viewRef.current
      if (!view || !activeFile) return

      const { before, after } = (e as CustomEvent).detail
      const selection = view.state.selection.main
      const selectedText = view.state.sliceDoc(selection.from, selection.to)
      const insertText = before + selectedText + after

      view.dispatch({
        changes: {
          from: selection.from,
          to: selection.to,
          insert: insertText,
        },
        selection: {
          anchor: selection.from + before.length + selectedText.length,
        },
        userEvent: 'input.type',
      })
      view.focus()
    }

    window.addEventListener('insert-snippet', handleInsertSnippet)
    return () => {
      window.removeEventListener('insert-snippet', handleInsertSnippet)
    }
  }, [activeFile])

  if (!activeFile) {
    return (
      <div className={`editor-container ${className || ''}`}>
        <div className="editor-empty-placeholder">
          <div className="placeholder-icon">🍃</div>
          <div className="placeholder-text">No file open</div>
          <div className="placeholder-hint">
            Open a file from the sidebar or create a new project
          </div>
        </div>
      </div>
    )
  }

  if (isImage) {
    return (
      <div key="image-viewer" className={`editor-container ${className || ''}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d1117', overflow: 'auto', padding: 20 }}>
        {blobUrl ? (
          <img src={blobUrl} alt={activeFile.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', boxShadow: '0 8px 24px rgba(0,0,0,0.5)', borderRadius: 4 }} />
        ) : (
          <div style={{ color: 'var(--text-secondary)' }}>Loading image...</div>
        )}
      </div>
    )
  }

  if (isPdfFile) {
    return (
      <div key="pdf-viewer" className={`editor-container ${className || ''}`} style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%', background: '#0d1117' }}>
        {blobUrl ? (
          <iframe src={blobUrl} style={{ width: '100%', height: '100%', border: 'none' }} title={activeFile.name} />
        ) : (
          <div style={{ padding: 20, color: 'var(--text-secondary)' }}>Loading PDF preview...</div>
        )}
      </div>
    )
  }

  return (
    <div key="codemirror-editor" className={`editor-container ${className || ''}`}>
      <div ref={containerRef} style={{ flex: 1, minHeight: 0, overflow: 'hidden' }} />
    </div>
  )
}

export default LaTeXEditor

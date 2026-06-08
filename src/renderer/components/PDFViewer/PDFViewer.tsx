import React, { useEffect, useRef, useState, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { useCompilerStore } from '../../stores/compilerStore'

// Configure pdf.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString()

interface PageInfo {
  pageNum: number
  rendered: boolean
}

export const PDFViewer: React.FC = () => {
  const pdfPath = useCompilerStore((s) => s.pdfPath)
  const isCompiling = useCompilerStore((s) => s.isCompiling)

  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [totalPages, setTotalPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [scale, setScale] = useState(1.2)
  const [isLoading, setIsLoading] = useState(false)
  const [pages, setPages] = useState<PageInfo[]>([])
  const [viewboxes, setViewboxes] = useState<Record<number, [number, number]>>({})
  const [highlightPoint, setHighlightPoint] = useState<{ page: number; x: number; y: number; id: number } | null>(null)
  const [pdfDarkMode, setPdfDarkMode] = useState(false)

  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map())
  const containerRef = useRef<HTMLDivElement>(null)
  const renderTasksRef = useRef<Map<number, pdfjsLib.RenderTask>>(new Map())

  // Load PDF when pdfPath changes
  useEffect(() => {
    if (!pdfPath) {
      setPdfDoc(null)
      setTotalPages(0)
      setCurrentPage(1)
      setPages([])
      setViewboxes({})
      setHighlightPoint(null)
      return
    }

    const loadPdf = async () => {
      setIsLoading(true)
      try {
        // Cancel any pending render tasks
        renderTasksRef.current.forEach((task) => task.cancel())
        renderTasksRef.current.clear()

        let loadingTask
        if (window.api?.fs?.readFileBinary) {
          const pdfBytes = await window.api.fs.readFileBinary(pdfPath)
          loadingTask = pdfjsLib.getDocument({
            data: pdfBytes,
            cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.9.155/cmaps/',
            cMapPacked: true,
          })
        } else {
          loadingTask = pdfjsLib.getDocument({
            url: pdfPath,
            cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.9.155/cmaps/',
            cMapPacked: true,
          })
        }
        const pdf = await loadingTask.promise
        setPdfDoc(pdf)
        setTotalPages(pdf.numPages)
        setCurrentPage(1)
        setPages(
          Array.from({ length: pdf.numPages }, (_, i) => ({
            pageNum: i + 1,
            rendered: false,
          }))
        )

        // Cache viewboxes for backward/forward SyncTeX
        const vBoxes: Record<number, [number, number]> = {}
        for (let i = 1; i <= pdf.numPages; i++) {
          const pageObj = await pdf.getPage(i)
          const vb = pageObj.viewBox
          vBoxes[i] = [vb[2] - vb[0], vb[3] - vb[1]]
        }
        setViewboxes(vBoxes)
      } catch (err) {
        console.error('Failed to load PDF:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadPdf()
  }, [pdfPath])

  // Listen for forward SyncTeX events
  useEffect(() => {
    const handleGotoPosition = (e: Event) => {
      const { page, x, y } = (e as CustomEvent).detail
      const canvas = canvasRefs.current.get(page)
      if (canvas) {
        canvas.scrollIntoView({ behavior: 'smooth', block: 'center' })
        setHighlightPoint({ page, x, y, id: Date.now() })
        setTimeout(() => {
          setHighlightPoint((curr) => curr && curr.page === page && curr.x === x && curr.y === y ? null : curr)
        }, 3000)
      }
    }

    window.addEventListener('pdf-goto-position', handleGotoPosition)
    return () => {
      window.removeEventListener('pdf-goto-position', handleGotoPosition)
    }
  }, [pdfDoc])

  const handleDoubleClickCanvas = useCallback(async (e: React.MouseEvent<HTMLCanvasElement>, pageNum: number) => {
    if (!pdfDoc || !pdfPath || !window.api?.synctex?.backward) return
    const canvas = e.currentTarget
    const rect = canvas.getBoundingClientRect()
    const xPx = e.clientX - rect.left
    const yPx = e.clientY - rect.top

    try {
      const box = viewboxes[pageNum] || [595, 842]
      const pdfX = (xPx / rect.width) * box[0]
      const pdfY = (yPx / rect.height) * box[1]

      const result = await window.api.synctex.backward(pageNum, Math.round(pdfX), Math.round(pdfY), pdfPath)
      if (result) {
        const basename = result.path.replace(/\\/g, '/').split('/').pop() || ''
        
        // Open file in store
        window.api.fs.readFile(result.path).then(() => {
          // Trigger file open in store
          useEditorStore.getState().openFile({
            path: result.path.replace(/\\/g, '/'),
            name: basename,
            language: result.path.toLowerCase().endsWith('.tex') ? 'latex' : 'text'
          })
          
          // Scroll and select line in CodeMirror
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('editor-goto-line', { detail: { line: result.line } }))
          }, 150)
        })
      }
    } catch (err) {
      console.error('Failed to backward sync:', err)
    }
  }, [pdfDoc, pdfPath, viewboxes])

  // Render pages
  useEffect(() => {
    if (!pdfDoc) return

    const renderPage = async (pageNum: number) => {
      const canvas = canvasRefs.current.get(pageNum)
      if (!canvas) return

      try {
        const page = await pdfDoc.getPage(pageNum)
        const viewport = page.getViewport({ scale })
        const context = canvas.getContext('2d')
        if (!context) return

        canvas.width = viewport.width
        canvas.height = viewport.height

        // Cancel previous render task for this page if any
        const prevTask = renderTasksRef.current.get(pageNum)
        if (prevTask) {
          prevTask.cancel()
        }

        const renderTask = page.render({
          canvasContext: context,
          viewport,
        })
        renderTasksRef.current.set(pageNum, renderTask)

        await renderTask.promise
        renderTasksRef.current.delete(pageNum)
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'RenderingCancelledException') {
          console.error(`Failed to render page ${pageNum}:`, err)
        }
      }
    }

    pages.forEach((p) => renderPage(p.pageNum))

    return () => {
      renderTasksRef.current.forEach((task) => task.cancel())
      renderTasksRef.current.clear()
    }
  }, [pdfDoc, pages, scale])

  // Update current page on scroll
  const handleScroll = useCallback(() => {
    if (!containerRef.current || totalPages === 0) return
    const container = containerRef.current
    const scrollTop = container.scrollTop
    const children = container.children
    for (let i = 0; i < children.length; i++) {
      const child = children[i] as HTMLElement
      const rect = child.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      if (rect.top >= containerRect.top - rect.height / 2) {
        setCurrentPage(i + 1)
        break
      }
    }
  }, [totalPages])

  const goToPrevPage = useCallback(() => {
    if (currentPage <= 1) return
    setCurrentPage(currentPage - 1)
    const canvas = canvasRefs.current.get(currentPage - 1)
    canvas?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [currentPage])

  const goToNextPage = useCallback(() => {
    if (currentPage >= totalPages) return
    setCurrentPage(currentPage + 1)
    const canvas = canvasRefs.current.get(currentPage + 1)
    canvas?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [currentPage, totalPages])

  const zoomIn = useCallback(() => {
    setScale((s) => Math.min(s + 0.2, 4.0))
  }, [])

  const zoomOut = useCallback(() => {
    setScale((s) => Math.max(s - 0.2, 0.4))
  }, [])

  const fitWidth = useCallback(() => {
    setScale(1.2)
  }, [])

  const handleDownload = useCallback(() => {
    if (pdfPath && window.api?.dialog) {
      window.api.dialog.saveFile('output.pdf', [
        { name: 'PDF Files', extensions: ['pdf'] },
      ])
    }
  }, [pdfPath])

  // No PDF placeholder
  if (!pdfPath && !isCompiling) {
    return (
      <div className="pdf-viewer">
        <div className="pdf-placeholder">
          <div className="pdf-placeholder-icon">📄</div>
          <div className="pdf-placeholder-text">Click Compile to generate PDF</div>
          <div className="pdf-placeholder-hint">
            Press Ctrl+S or click the Compile button
          </div>
        </div>
      </div>
    )
  }

  // Loading state
  if (isLoading || isCompiling) {
    return (
      <div className="pdf-viewer">
        <div className="pdf-loading">
          <div className="pdf-spinner" />
          <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
            {isCompiling ? 'Compiling…' : 'Loading PDF…'}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className={`pdf-viewer${pdfDarkMode ? ' dark-mode' : ''}`}>
      {/* PDF Toolbar */}
      <div className="pdf-toolbar">
        <div className="pdf-toolbar-group">
          <button
            className="pdf-toolbar-btn"
            onClick={goToPrevPage}
            disabled={currentPage <= 1}
            aria-label="Previous page"
          >
            ◀
          </button>
          <span className="pdf-page-info">
            {currentPage} / {totalPages}
          </span>
          <button
            className="pdf-toolbar-btn"
            onClick={goToNextPage}
            disabled={currentPage >= totalPages}
            aria-label="Next page"
          >
            ▶
          </button>
        </div>

        <div className="pdf-toolbar-group">
          <button className="pdf-toolbar-btn" onClick={zoomOut} aria-label="Zoom out">
            −
          </button>
          <span className="pdf-zoom-display">{Math.round(scale * 100)}%</span>
          <button className="pdf-toolbar-btn" onClick={zoomIn} aria-label="Zoom in">
            +
          </button>
          <button className="pdf-toolbar-btn" onClick={fitWidth} aria-label="Fit width" data-tooltip="Fit Width">
            ⬜
          </button>
        </div>

        <div className="pdf-toolbar-group">
          <button
            className={`pdf-toolbar-btn${pdfDarkMode ? ' active' : ''}`}
            onClick={() => setPdfDarkMode(!pdfDarkMode)}
            title="Toggle Dark Mode PDF"
            style={{ fontSize: '13px' }}
          >
            🌙
          </button>
          <button className="pdf-toolbar-btn" onClick={handleDownload} aria-label="Download PDF" data-tooltip="Download">
            ⬇
          </button>
        </div>
      </div>

      {/* PDF Canvas Area */}
      <div className="pdf-canvas-container" ref={containerRef} onScroll={handleScroll}>
        {pages.map((page) => {
          const box = viewboxes[page.pageNum] || [595, 842]
          return (
            <div key={page.pageNum} className="pdf-page-wrapper" style={{ position: 'relative' }}>
              <canvas
                ref={(el) => {
                  if (el) canvasRefs.current.set(page.pageNum, el)
                  else canvasRefs.current.delete(page.pageNum)
                }}
                onDoubleClick={(e) => handleDoubleClickCanvas(e, page.pageNum)}
                style={{ cursor: 'pointer' }}
                title="Double click to jump to LaTeX source"
              />
              
              {highlightPoint && highlightPoint.page === page.pageNum && (
                <div
                  className="synctex-highlight-dot"
                  style={{
                    position: 'absolute',
                    left: `${(highlightPoint.x / box[0]) * 100}%`,
                    top: `${(highlightPoint.y / box[1]) * 100}%`,
                  }}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default PDFViewer

import React, { useState, useCallback, useEffect, useRef } from 'react'
import type { FileEntry } from '../../../shared/ipc'
import { useProjectStore } from '../../stores/projectStore'
import { useEditorStore } from '../../stores/editorStore'

/* ── File icon mapping ── */
function getFileIcon(entry: FileEntry): string {
  if (entry.isDirectory) return '📁'
  const ext = entry.name.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'tex':
    case 'ltx':
    case 'sty':
    case 'cls':
      return '📄'
    case 'bib':
    case 'bbl':
      return '📚'
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
    case 'pdf':
    case 'eps':
      return '🖼️'
    default:
      return '📋'
  }
}

function getFileLanguage(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'tex':
    case 'ltx':
    case 'sty':
    case 'cls':
      return 'latex'
    case 'bib':
      return 'bibtex'
    default:
      return 'text'
  }
}

/* ── Context Menu ── */
interface ContextMenuState {
  visible: boolean
  x: number
  y: number
  entry: FileEntry | null
}

/* ── Tree Item ── */
interface TreeItemProps {
  entry: FileEntry
  depth: number
  mainFile: string
  expandedPaths: Set<string>
  activePath: string | null
  onToggle: (path: string) => void
  onClick: (entry: FileEntry) => void
  onContextMenu: (e: React.MouseEvent, entry: FileEntry) => void
}

const TreeItem: React.FC<TreeItemProps> = ({
  entry,
  depth,
  mainFile,
  expandedPaths,
  activePath,
  onToggle,
  onClick,
  onContextMenu,
}) => {
  const isExpanded = expandedPaths.has(entry.path)
  const isActive = entry.path === activePath
  const isMainFile = entry.relativePath === mainFile

  const handleClick = () => {
    if (entry.isDirectory) {
      onToggle(entry.path)
    } else {
      onClick(entry)
    }
  }

  return (
    <>
      <div
        className={`file-tree-item${isActive ? ' active' : ''}`}
        style={{ paddingLeft: depth * 20 + 12 }}
        onClick={handleClick}
        onContextMenu={(e) => onContextMenu(e, entry)}
      >
        {/* Indent lines */}
        {Array.from({ length: depth }).map((_, i) => (
          <span key={i} className="file-tree-indent-line" />
        ))}

        {/* Arrow for directories */}
        {entry.isDirectory ? (
          <span className={`file-tree-arrow${isExpanded ? ' expanded' : ''}`}>
            ▶
          </span>
        ) : (
          <span style={{ width: 20, flexShrink: 0 }} />
        )}

        {/* Icon */}
        <span className="file-tree-icon">{getFileIcon(entry)}</span>

        {/* Name */}
        <span className="file-tree-name">{entry.name}</span>

        {/* Main file indicator */}
        {isMainFile && <span className="file-tree-main-indicator">⭐</span>}
      </div>

      {/* Children */}
      {entry.isDirectory && isExpanded && entry.children && (
        <div style={{ animation: 'slideDown 0.15s ease' }}>
          {entry.children.map((child) => (
            <TreeItem
              key={child.path}
              entry={child}
              depth={depth + 1}
              mainFile={mainFile}
              expandedPaths={expandedPaths}
              activePath={activePath}
              onToggle={onToggle}
              onClick={onClick}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      )}
    </>
  )
}

/* ── FileTree ── */
export const FileTree: React.FC = () => {
  const fileTree = useProjectStore((s) => s.fileTree)
  const currentProject = useProjectStore((s) => s.currentProject)
  const refreshFileTree = useProjectStore((s) => s.refreshFileTree)
  const openFile = useEditorStore((s) => s.openFile)
  const openFiles = useEditorStore((s) => s.openFiles)
  const activeFileIndex = useEditorStore((s) => s.activeFileIndex)

  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    entry: null,
  })
  const contextMenuRef = useRef<HTMLDivElement>(null)

  const activePath = activeFileIndex >= 0 ? openFiles[activeFileIndex]?.path || null : null
  const mainFile = currentProject?.mainFile || 'main.tex'

  const handleToggle = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }, [])

  const handleFileClick = useCallback(
    (entry: FileEntry) => {
      if (entry.isDirectory) return
      openFile({
        path: entry.path,
        name: entry.name,
        language: getFileLanguage(entry.name),
      })
    },
    [openFile]
  )

  const handleContextMenu = useCallback((e: React.MouseEvent, entry: FileEntry) => {
    e.preventDefault()
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      entry,
    })
  }, [])

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu({ visible: false, x: 0, y: 0, entry: null })
  }, [])

  // Close context menu on outside click
  useEffect(() => {
    const handleClick = () => handleCloseContextMenu()
    if (contextMenu.visible) {
      document.addEventListener('click', handleClick)
      return () => document.removeEventListener('click', handleClick)
    }
  }, [contextMenu.visible, handleCloseContextMenu])

  const handleNewFile = useCallback(async () => {
    handleCloseContextMenu()
    const parent = contextMenu.entry?.isDirectory
      ? contextMenu.entry.path
      : currentProject?.path || ''
    const name = prompt('Enter file name:')
    if (!name || !parent) return
    const fullPath = `${parent}/${name}`
    try {
      await window.api?.fs?.createFile(fullPath, '')
      refreshFileTree()
    } catch (err) {
      console.error('Failed to create file:', err)
    }
  }, [contextMenu.entry, currentProject, handleCloseContextMenu, refreshFileTree])

  const handleNewFolder = useCallback(async () => {
    handleCloseContextMenu()
    const parent = contextMenu.entry?.isDirectory
      ? contextMenu.entry.path
      : currentProject?.path || ''
    const name = prompt('Enter folder name:')
    if (!name || !parent) return
    const fullPath = `${parent}/${name}`
    try {
      await window.api?.fs?.createDir(fullPath)
      refreshFileTree()
    } catch (err) {
      console.error('Failed to create folder:', err)
    }
  }, [contextMenu.entry, currentProject, handleCloseContextMenu, refreshFileTree])

  const handleRename = useCallback(async () => {
    handleCloseContextMenu()
    if (!contextMenu.entry) return
    const newName = prompt('Enter new name:', contextMenu.entry.name)
    if (!newName) return
    const parentPath = contextMenu.entry.path.substring(
      0,
      contextMenu.entry.path.lastIndexOf('/')
    )
    const newPath = `${parentPath}/${newName}`
    try {
      await window.api?.fs?.renameFile(contextMenu.entry.path, newPath)
      refreshFileTree()
    } catch (err) {
      console.error('Failed to rename:', err)
    }
  }, [contextMenu.entry, handleCloseContextMenu, refreshFileTree])

  const handleDelete = useCallback(async () => {
    handleCloseContextMenu()
    if (!contextMenu.entry) return
    const confirmed = confirm(`Delete "${contextMenu.entry.name}"?`)
    if (!confirmed) return
    try {
      if (contextMenu.entry.isDirectory) {
        await window.api?.fs?.deleteDir(contextMenu.entry.path)
      } else {
        await window.api?.fs?.deleteFile(contextMenu.entry.path)
      }
      refreshFileTree()
    } catch (err) {
      console.error('Failed to delete:', err)
    }
  }, [contextMenu.entry, handleCloseContextMenu, refreshFileTree])

  const handleAddFileButton = useCallback(async () => {
    const name = prompt('Enter file name:')
    if (!name || !currentProject) return
    const fullPath = `${currentProject.path}/${name}`
    try {
      await window.api?.fs?.createFile(fullPath, '')
      refreshFileTree()
    } catch (err) {
      console.error('Failed to create file:', err)
    }
  }, [currentProject, refreshFileTree])

  const handleUploadFile = useCallback(async () => {
    if (!currentProject) return
    try {
      const srcPath = await window.api?.dialog?.openFile([
        { name: 'All Files', extensions: ['*'] }
      ])
      if (!srcPath) return
      const fileName = srcPath.replace(/\\/g, '/').split('/').pop()
      if (!fileName) return
      const destPath = `${currentProject.path}/${fileName}`
      await window.api?.fs?.copyFile(srcPath, destPath)
      refreshFileTree()
    } catch (err) {
      console.error('Failed to upload file:', err)
      alert(`Failed to upload file: ${err instanceof Error ? err.message : err}`)
    }
  }, [currentProject, refreshFileTree])

  return (
    <div className="sidebar-section" style={{ flex: 1, minHeight: 0 }}>
      <div className="sidebar-section-header">
        <span className="sidebar-section-title">Files</span>
        <div className="sidebar-section-actions">
          <button
            className="sidebar-action-btn"
            onClick={handleAddFileButton}
            data-tooltip="New File"
          >
            +
          </button>
          <button
            className="sidebar-action-btn"
            onClick={handleUploadFile}
            data-tooltip="Upload File"
          >
            ↑
          </button>
          <button
            className="sidebar-action-btn"
            onClick={() => refreshFileTree()}
            data-tooltip="Refresh"
          >
            ↻
          </button>
        </div>
      </div>
      <div className="sidebar-section-content">
        <div className="file-tree">
          {fileTree.map((entry) => (
            <TreeItem
              key={entry.path}
              entry={entry}
              depth={0}
              mainFile={mainFile}
              expandedPaths={expandedPaths}
              activePath={activePath}
              onToggle={handleToggle}
              onClick={handleFileClick}
              onContextMenu={handleContextMenu}
            />
          ))}
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu.visible && (
        <div
          className="context-menu"
          ref={contextMenuRef}
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button className="context-menu-item" onClick={handleNewFile}>
            📄 New File
          </button>
          <button className="context-menu-item" onClick={handleNewFolder}>
            📁 New Folder
          </button>
          <button className="context-menu-item" onClick={handleUploadFile}>
            ↑ Upload File
          </button>
          <div className="context-menu-separator" />
          <button className="context-menu-item" onClick={handleRename}>
            ✏️ Rename
          </button>
          <button className="context-menu-item danger" onClick={handleDelete}>
            🗑️ Delete
          </button>
        </div>
      )}
    </div>
  )
}

export default FileTree

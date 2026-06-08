import { create } from 'zustand'

export interface OpenFile {
  path: string
  name: string
  language: string
}

interface EditorState {
  openFiles: OpenFile[]
  activeFileIndex: number
  fileContents: Record<string, string>
  modifiedFiles: Set<string>
  cursorLine: number
  cursorCol: number

  openFile: (file: OpenFile) => void
  closeFile: (index: number) => void
  setActiveFile: (index: number) => void
  updateContent: (path: string, content: string) => void
  markSaved: (path: string) => void
  setCursorPosition: (line: number, col: number) => void
}

export const useEditorStore = create<EditorState>((set, get) => ({
  openFiles: [],
  activeFileIndex: -1,
  fileContents: {},
  modifiedFiles: new Set(),
  cursorLine: 1,
  cursorCol: 1,

  openFile: (file) => {
    const { openFiles } = get()
    const existingIndex = openFiles.findIndex((f) => f.path === file.path)
    if (existingIndex >= 0) {
      set({ activeFileIndex: existingIndex })
      return
    }
    set({
      openFiles: [...openFiles, file],
      activeFileIndex: openFiles.length,
    })

    // Skip loading binary files as UTF-8 text strings
    const isBinary = /\.(png|jpg|jpeg|gif|svg|webp|pdf)$/i.test(file.name)
    if (isBinary) {
      set((state) => ({
        fileContents: { ...state.fileContents, [file.path]: '' },
      }))
      return
    }

    // Load file content from IPC
    if (window.api?.fs) {
      window.api.fs.readFile(file.path).then((content) => {
        set((state) => ({
          fileContents: { ...state.fileContents, [file.path]: content },
        }))
      }).catch((err) => {
        console.error('Failed to read file:', err)
      })
    }
  },

  closeFile: (index) => {
    const { openFiles, activeFileIndex, fileContents, modifiedFiles } = get()
    const closedFile = openFiles[index]
    const newOpenFiles = openFiles.filter((_, i) => i !== index)
    const newContents = { ...fileContents }
    if (closedFile) delete newContents[closedFile.path]
    const newModified = new Set(modifiedFiles)
    if (closedFile) newModified.delete(closedFile.path)

    let newActiveIndex = activeFileIndex
    if (newOpenFiles.length === 0) {
      newActiveIndex = -1
    } else if (index <= activeFileIndex) {
      newActiveIndex = Math.max(0, activeFileIndex - 1)
    }

    set({
      openFiles: newOpenFiles,
      activeFileIndex: newActiveIndex,
      fileContents: newContents,
      modifiedFiles: newModified,
    })
  },

  setActiveFile: (index) => {
    set({ activeFileIndex: index })
  },

  updateContent: (path, content) => {
    set((state) => ({
      fileContents: { ...state.fileContents, [path]: content },
      modifiedFiles: new Set(state.modifiedFiles).add(path),
    }))
  },

  markSaved: (path) => {
    set((state) => {
      const newModified = new Set(state.modifiedFiles)
      newModified.delete(path)
      return { modifiedFiles: newModified }
    })
  },

  setCursorPosition: (line, col) => {
    set({ cursorLine: line, cursorCol: col })
  },
}))

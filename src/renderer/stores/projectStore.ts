import { create } from 'zustand'
import type { ProjectInfo, FileEntry } from '../../shared/ipc'

interface ProjectState {
  currentProject: ProjectInfo | null
  fileTree: FileEntry[]
  isLoading: boolean

  setProject: (project: ProjectInfo | null) => void
  setFileTree: (tree: FileEntry[]) => void
  refreshFileTree: () => Promise<void>
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  currentProject: null,
  fileTree: [],
  isLoading: false,

  setProject: (project) => {
    set({ currentProject: project })
  },

  setFileTree: (tree) => {
    set({ fileTree: tree })
  },

  refreshFileTree: async () => {
    const { currentProject } = get()
    if (!currentProject) return

    set({ isLoading: true })
    try {
      if (window.api?.fs) {
        const tree = await window.api.fs.readDir(currentProject.path)
        set({ fileTree: tree, isLoading: false })
      }
    } catch (err) {
      console.error('Failed to refresh file tree:', err)
      set({ isLoading: false })
    }
  },
}))

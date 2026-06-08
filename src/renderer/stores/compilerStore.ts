import { create } from 'zustand'
import type { CompileResult, CompileOptions } from '../../shared/ipc'

interface CompilerState {
  isCompiling: boolean
  lastResult: CompileResult | null
  log: string
  pdfPath: string | null
  engine: CompileOptions['engine']

  startCompile: (options: CompileOptions) => Promise<void>
  setResult: (result: CompileResult) => void
  appendLog: (text: string) => void
  clearLog: () => void
  setEngine: (engine: CompileOptions['engine']) => void
}

export const useCompilerStore = create<CompilerState>((set, get) => ({
  isCompiling: false,
  lastResult: null,
  log: '',
  pdfPath: null,
  engine: 'pdflatex',

  startCompile: async (options) => {
    set({ isCompiling: true, log: '' })
    try {
      if (window.api?.compiler) {
        const result = await window.api.compiler.compile(options)
        set({
          isCompiling: false,
          lastResult: result,
          pdfPath: result.pdfPath || null,
          log: result.log,
        })
      }
    } catch (err) {
      console.error('Compilation failed:', err)
      set({
        isCompiling: false,
        lastResult: {
          success: false,
          log: String(err),
          errors: [{ file: '', line: 0, message: String(err), type: 'error' }],
          warnings: [],
          duration: 0,
        },
      })
    }
  },

  setResult: (result) => {
    set({
      lastResult: result,
      pdfPath: result.pdfPath || null,
      isCompiling: false,
    })
  },

  appendLog: (text) => {
    set((state) => ({ log: state.log + text }))
  },

  clearLog: () => {
    set({ log: '' })
  },

  setEngine: (engine) => {
    set({ engine })
  },
}))

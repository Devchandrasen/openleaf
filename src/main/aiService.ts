import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../shared/ipc'

const OLLAMA_URL = 'http://localhost:11434/api/generate'
const DEFAULT_MODEL = 'llama3' // Or deepseek-coder, mistral, etc.

export function registerAIHandlers(): void {
  ipcMain.handle('ai:ask', async (_event, prompt: string, context?: string) => {
    try {
      // Connect to local Ollama instance
      const response = await fetch(OLLAMA_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: DEFAULT_MODEL,
          prompt: context ? `Context:\n${context}\n\nQuestion: ${prompt}` : prompt,
          stream: false
        })
      })

      if (!response.ok) {
        throw new Error(`Ollama API Error: ${response.statusText}`)
      }

      const data = await response.json() as any
      return data.response
    } catch (err) {
      console.error('AI Error:', err)
      return `Failed to connect to local AI model. Ensure Ollama is installed and running on your machine, and you have pulled a model (e.g., 'ollama run llama3'). Error details: ${err instanceof Error ? err.message : String(err)}`
    }
  })
}

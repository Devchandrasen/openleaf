import express from 'express'
import cors from 'cors'
import localtunnel from 'localtunnel'
import path from 'path'
import { Server } from 'http'
import fs from 'fs'

let server: Server | null = null
let tunnel: localtunnel.Tunnel | null = null

export interface ShareOptions {
  projectPath: string
}

export const shareManager = {
  async startSharing(options: ShareOptions): Promise<string> {
    if (server) {
      await this.stopSharing()
    }

    const app = express()
    app.use(cors())
    app.use(express.json())

    // Serve static files from the project directory
    app.use('/files', express.static(options.projectPath))

    // API to list files
    app.get('/api/files', (req, res) => {
      try {
        const files = fs.readdirSync(options.projectPath)
        const fileList = files.map(file => {
          const stat = fs.statSync(path.join(options.projectPath, file))
          return {
            name: file,
            isDirectory: stat.isDirectory(),
            size: stat.size
          }
        })
        res.json({ files: fileList })
      } catch (err) {
        res.status(500).json({ error: String(err) })
      }
    })

    // API to get file content
    app.get('/api/file/:name', (req, res) => {
      try {
        const filePath = path.join(options.projectPath, req.params.name)
        if (!fs.existsSync(filePath)) {
           res.status(404).json({ error: 'File not found' })
           return
        }
        const content = fs.readFileSync(filePath, 'utf-8')
        res.send(content)
      } catch (err) {
        res.status(500).json({ error: String(err) })
      }
    })

    // API to save file content
    app.post('/api/file/:name', (req, res) => {
      try {
        const filePath = path.join(options.projectPath, req.params.name)
        fs.writeFileSync(filePath, req.body.content)
        res.json({ success: true })
      } catch (err) {
        res.status(500).json({ error: String(err) })
      }
    })

    // Simple landing page for the viewer
    app.get('/', (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Openleaf Shared Project</title>
          <style>
            body { font-family: system-ui, sans-serif; background: #0d1117; color: #e6edf3; padding: 2rem; }
            .container { max-width: 800px; margin: 0 auto; }
            .file-list { background: #161b22; padding: 1rem; border-radius: 8px; border: 1px solid #30363d; }
            .file-item { padding: 0.5rem; border-bottom: 1px solid #30363d; display: flex; justify-content: space-between; }
            .file-item:last-child { border-bottom: none; }
            a { color: #58a6ff; text-decoration: none; }
            a:hover { text-decoration: underline; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🍃 Openleaf Shared Project</h1>
            <p>You have been invited to view this LaTeX project.</p>
            <div class="file-list" id="fileList">Loading files...</div>
          </div>
          <script>
            fetch('/api/files').then(r => r.json()).then(data => {
              const html = data.files.map(f => 
                '<div class="file-item">' +
                '<span>' + (f.isDirectory ? '📁 ' : '📄 ') + f.name + '</span>' +
                (f.isDirectory ? '' : '<a href="/files/' + f.name + '" target="_blank">Download</a>') +
                '</div>'
              ).join('')
              document.getElementById('fileList').innerHTML = html
            })
          </script>
        </body>
        </html>
      `)
    })

    return new Promise((resolve, reject) => {
      server = app.listen(0, async () => {
        const port = (server?.address() as any).port
        try {
          tunnel = await localtunnel({ port })
          resolve(tunnel.url)
        } catch (err) {
          reject(err)
        }
      })
      server.on('error', reject)
    })
  },

  async stopSharing(): Promise<void> {
    if (tunnel) {
      tunnel.close()
      tunnel = null
    }
    if (server) {
      server.close()
      server = null
    }
  }
}

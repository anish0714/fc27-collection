import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const COLLECTION_FILE = resolve(import.meta.dirname, 'data', 'my-collection.json')

// Dev-server only: lets the app read/write data/my-collection.json directly.
// In a static build this endpoint doesn't exist and the app uses localStorage.
function collectionApi() {
  return {
    name: 'collection-api',
    apply: 'serve',
    // The app writes this file on every change. Don't hot-reload the page each time
    // (a reload mid-edit could drop unsaved state); the app already holds the latest data.
    handleHotUpdate({ file }) {
      if (resolve(file) === COLLECTION_FILE) return []
    },
    configureServer(server) {
      server.middlewares.use('/api/collection', async (req, res) => {
        const send = (status, body) => {
          res.statusCode = status
          res.setHeader('Content-Type', 'application/json')
          res.end(typeof body === 'string' ? body : JSON.stringify(body))
        }
        try {
          if (req.method === 'GET') {
            return send(200, await readFile(COLLECTION_FILE, 'utf8'))
          }
          if (req.method === 'PUT') {
            let raw = ''
            for await (const chunk of req) raw += chunk
            const data = JSON.parse(raw)
            if (!data || typeof data !== 'object' || Array.isArray(data)) {
              return send(400, { error: 'Collection must be a JSON object' })
            }
            await writeFile(COLLECTION_FILE, JSON.stringify(data, null, 2) + '\n')
            return send(200, { ok: true })
          }
          res.setHeader('Allow', 'GET, PUT')
          return send(405, { error: 'Method not allowed' })
        } catch (err) {
          return send(err instanceof SyntaxError ? 400 : 500, { error: err.message })
        }
      })
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [react(), collectionApi()],
})

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath } from 'url'
import { dirname, resolve, join, extname, basename } from 'path'
import fs from 'fs'
import { exec } from 'child_process'
import type { Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'http'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/* ─── File-system scanner Vite plugin ─────────────────────────────────────── */

const IGNORED = new Set([
  'node_modules', '.git', 'dist', '.next', '__pycache__',
  '.cache', 'vendor', '.vscode', 'coverage', '.turbo',
])

const EXT_COLOR: Record<string, string> = {
  '.ts': '#55E8FF', '.tsx': '#55E8FF',
  '.js': '#FFB84D', '.jsx': '#FFB84D',
  '.css': '#9A8CFF', '.scss': '#9A8CFF', '.sass': '#9A8CFF',
  '.html': '#FF4D6A',
  '.json': '#55FFD1', '.yaml': '#55FFD1', '.yml': '#55FFD1',
  '.md': '#6b8a99', '.mdx': '#6b8a99',
  '.py': '#3CB44B', '.rs': '#FF6B35',
  '.png': '#FF4D6A', '.jpg': '#FF4D6A', '.svg': '#FF4D6A', '.gif': '#FF4D6A',
}

interface FileNode {
  id: string; name: string; path: string; isDir: boolean
  ext: string; depth: number; size: number; color: string
}
interface FileLink { source: string; target: string }
interface ScanResult { nodes: FileNode[]; links: FileLink[] }

function scanDir(
  dirPath: string,
  parentId: string | null,
  depth: number,
  maxDepth: number,
  result: ScanResult,
  maxNodes: number,
) {
  if (depth > maxDepth || result.nodes.length >= maxNodes) return
  let entries: fs.Dirent[]
  try { entries = fs.readdirSync(dirPath, { withFileTypes: true }) }
  catch { return }

  // Dirs first, then files — makes the graph hierarchy cleaner
  entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1
    if (!a.isDirectory() && b.isDirectory()) return 1
    return a.name.localeCompare(b.name)
  })

  for (const entry of entries) {
    if (IGNORED.has(entry.name) || entry.name.startsWith('.')) continue
    if (result.nodes.length >= maxNodes) break

    const fullPath = join(dirPath, entry.name)
    const isDir = entry.isDirectory()
    const ext = isDir ? '' : extname(entry.name).toLowerCase()
    let size = 0
    try { if (!isDir) size = fs.statSync(fullPath).size } catch { /* ignore */ }

    result.nodes.push({
      id: fullPath,
      name: entry.name,
      path: fullPath,
      isDir,
      ext,
      depth,
      size,
      color: isDir ? '#FFB84D' : (EXT_COLOR[ext] ?? '#8899aa'),
    })

    if (parentId) {
      result.links.push({ source: parentId, target: fullPath })
    }

    if (isDir && depth < maxDepth) {
      scanDir(fullPath, fullPath, depth + 1, maxDepth, result, maxNodes)
    }
  }
}

function fsScannerPlugin(): Plugin {
  return {
    name: 'fs-scanner',
    configureServer(server) {
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next) => {
        const rawUrl = req.url ?? '/'
        let url: URL
        try { url = new URL(rawUrl, 'http://localhost') }
        catch { return next() }

        /* ── GET /api/scan?dir=<path>&depth=<n>&max=<n> ── */
        if (url.pathname === '/api/scan') {
          const dir = url.searchParams.get('dir') ||
            process.env['USERPROFILE'] || process.env['HOME'] || 'C:\\Users'
          const depth = Math.min(parseInt(url.searchParams.get('depth') ?? '2'), 4)
          const maxNodes = Math.min(parseInt(url.searchParams.get('max') ?? '250'), 500)

          const result: ScanResult = { nodes: [], links: [] }

          // Add root node
          result.nodes.push({
            id: dir,
            name: basename(dir) || dir,
            path: dir,
            isDir: true,
            ext: '',
            depth: 0,
            size: 0,
            color: '#FFB84D',
          })

          scanDir(dir, dir, 1, depth, result, maxNodes)

          res.setHeader('Content-Type', 'application/json')
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.end(JSON.stringify(result))
          return
        }

        /* ── GET /api/open?path=<filepath> ── */
        if (url.pathname === '/api/open') {
          const filePath = url.searchParams.get('path')
          if (filePath) {
            if (process.platform === 'win32') {
              try {
                const isDir = fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()
                if (isDir) {
                  exec(`explorer.exe "${filePath}"`, (err) => {
                    if (err) console.error('[fs-scanner] explorer error:', err)
                  })
                } else {
                  exec(`cmd.exe /c start "" "${filePath}"`, (err) => {
                    if (err) console.error('[fs-scanner] start error:', err)
                  })
                }
              } catch {
                exec(`cmd.exe /c start "" "${filePath}"`, (err) => {
                  if (err) console.error('[fs-scanner] fallback error:', err)
                })
              }
            } else if (process.platform === 'darwin') {
              exec(`open "${filePath}"`, (err) => { if (err) console.error(err) })
            } else {
              exec(`xdg-open "${filePath}"`, (err) => { if (err) console.error(err) })
            }
          }
          res.setHeader('Content-Type', 'application/json')
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.end(JSON.stringify({ ok: true, path: filePath }))
          return
        }

        next()
      })
    },
  }
}

/* ─── Vite config ──────────────────────────────────────────────────────────── */

export default defineConfig({
  plugins: [react(), fsScannerPlugin()],
  resolve: {
    alias: { '@': resolve(__dirname, './src') },
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
    cssCodeSplit: true,
  },
  optimizeDeps: {
    include: ['three', '@react-three/fiber', '@react-three/drei', '3d-force-graph', 'zustand'],
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api/chat': 'http://localhost:7915',
      '/api/router': 'http://localhost:7915',
      '/api/models': 'http://localhost:7915',
      '/api/system': 'http://localhost:7915',
      '/api/history': 'http://localhost:7915',
      '/api/credentials': 'http://localhost:7915',
    },
  },
})

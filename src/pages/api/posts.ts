import type { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import path from 'path'

// Changed to src/pages for flat structure
const PAGES_DIR = path.join(process.cwd(), 'src/pages')

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    if (process.env.NODE_ENV !== 'development') {
        return res.status(403).json({ error: 'Editor is development only' })
    }

    if (req.method === 'GET') {
        if (!fs.existsSync(PAGES_DIR)) {
            return res.status(200).json([])
        }

        const exclude = ['api', 'admin', 'img', 'node_modules', '.next']

        type FileNode = {
            name: string
            type: 'file' | 'directory'
            slug?: string
            path: string
            children?: FileNode[]
        }

        const buildTree = (dir: string, relativePath: string = ''): FileNode[] => {
            const items = fs.readdirSync(dir, { withFileTypes: true })
            const nodes: FileNode[] = []

            // Read _meta.json for sorting
            let metaKeys: string[] = []
            try {
                const metaPath = path.join(dir, '_meta.json')
                if (fs.existsSync(metaPath)) {
                    const metaContent = fs.readFileSync(metaPath, 'utf8')
                    // Manually extract keys from file content to preserve order (avoid V8 integer sorting)
                    // Heuristic: Top-level keys are indented by 2 spaces: '  "key":'
                    const regex = /^ {2}"((?:\\.|[^"\\])*)"\s*:/gm
                    let match
                    while ((match = regex.exec(metaContent)) !== null) {
                        metaKeys.push(match[1])
                    }

                    // Fallback: If no keys found via regex (maybe formatted differently), use JSON.parse
                    if (metaKeys.length === 0) {
                        try {
                            const meta = JSON.parse(metaContent)
                            metaKeys = Object.keys(meta)
                        } catch (e) { }
                    }
                }
            } catch (e) {
                // ignore error
            }

            for (const item of items) {
                const name = item.name.normalize('NFC')
                if (exclude.includes(name)) continue

                if (item.isDirectory()) {
                    const childRelativePath = relativePath ? path.join(relativePath, name) : name
                    const children = buildTree(path.join(dir, name), childRelativePath)
                    nodes.push({
                        name: name,
                        type: 'directory',
                        path: childRelativePath,
                        children
                    })
                } else if (/\.(md|mdx|json)$/.test(name)) {
                    let slug = relativePath
                    if (name === 'index.md' || name === 'index.mdx') {
                        slug = relativePath || 'home'
                    } else {
                        slug = relativePath ? path.join(relativePath, name) : name
                    }

                    nodes.push({
                        name: name,
                        type: 'file',
                        slug: slug,
                        path: relativePath ? path.join(relativePath, name) : name
                    })
                }
            }

            // Sort: _meta order -> directories -> files (index priorities handled inside fallback if needed, but usually meta dictates)
            return nodes.sort((a, b) => {
                const getKey = (name: string) => name.replace(/\.(md|mdx|json)$/, '')
                const keyA = getKey(a.name)
                const keyB = getKey(b.name)

                const idxA = metaKeys.indexOf(keyA)
                const idxB = metaKeys.indexOf(keyB)

                if (idxA !== -1 && idxB !== -1) return idxA - idxB
                if (idxA !== -1) return -1
                if (idxB !== -1) return 1

                // Fallback: Directories first, then alphabetical
                if (a.type !== b.type) return a.type === 'directory' ? -1 : 1

                // Prioritize index if not in meta
                if (a.name.startsWith('index.')) return -1
                if (b.name.startsWith('index.')) return 1

                return a.name.localeCompare(b.name)
            })
        }

        const tree = buildTree(PAGES_DIR)
        return res.status(200).json(tree)
    }

    if (req.method === 'POST') {
        const { title } = req.body
        if (!title) return res.status(400).json({ error: 'Title required' })
        const slug = title.trim().replace(/\s+/g, '-').replace(/[^\w\-\uAC00-\uD7A3]+/g, '')

        const dir = path.join(PAGES_DIR, slug)

        // Block creation of system names
        const reserved = ['api', 'admin', 'img', 'posts', 'home']
        if (reserved.includes(slug)) return res.status(400).json({ error: 'Reserved slug name' })

        if (fs.existsSync(dir)) return res.status(400).json({ error: 'Post with this slug already exists' })

        try {
            fs.mkdirSync(dir, { recursive: true })
            fs.mkdirSync(path.join(dir, 'img'))
            fs.writeFileSync(path.join(dir, 'index.md'), `# ${title}\n\nNew post.\n`)

            // Should also create a _meta.json for this new folder?
            fs.writeFileSync(path.join(dir, '_meta.json'), JSON.stringify({ index: title }, null, 4))

            return res.status(200).json({ slug })
        } catch (e) {
            console.error(e)
            return res.status(500).json({ error: 'Failed to create post' })
        }
    }

    return res.status(405).end()
}

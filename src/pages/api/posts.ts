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

            for (const item of items) {
                if (exclude.includes(item.name)) continue

                if (item.isDirectory()) {
                    const childRelativePath = relativePath ? path.join(relativePath, item.name) : item.name
                    const children = buildTree(path.join(dir, item.name), childRelativePath)
                    nodes.push({
                        name: item.name,
                        type: 'directory',
                        path: childRelativePath,
                        children
                    })
                } else if (/\.(md|mdx)$/.test(item.name)) {
                    // It's a markdown file
                    // Calculate slug for Nextra routing
                    let slug = relativePath
                    if (item.name === 'index.md' || item.name === 'index.mdx') {
                        slug = relativePath || 'home'
                    } else {
                        const baseName = item.name.replace(/\.(md|mdx)$/, '')
                        slug = relativePath ? path.join(relativePath, baseName) : baseName
                    }

                    nodes.push({
                        name: item.name,
                        type: 'file',
                        slug: slug,
                        path: relativePath ? path.join(relativePath, item.name) : item.name
                    })
                }
            }

            // Sort: directories first, then files
            return nodes.sort((a, b) => {
                if (a.type === b.type) {
                    // prioritized index files
                    if (a.name.startsWith('index.')) return -1
                    if (b.name.startsWith('index.')) return 1
                    return a.name.localeCompare(b.name)
                }
                return a.type === 'directory' ? -1 : 1
            })
        }

        const tree = buildTree(PAGES_DIR)
        return res.status(200).json(tree)
    }

    if (req.method === 'POST') {
        const { title } = req.body
        if (!title) return res.status(400).json({ error: 'Title required' })
        const slug = title.toLowerCase().replace(/ /g, '-').replace(/[^\w-]/g, '')

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

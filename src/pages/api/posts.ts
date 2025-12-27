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
            children?: FileNode[]
        }

        const buildTree = (dir: string, relativePath: string = ''): FileNode[] => {
            const items = fs.readdirSync(dir, { withFileTypes: true })
            const nodes: FileNode[] = []

            for (const item of items) {
                if (exclude.includes(item.name)) continue

                // Check for index files (render as file node)
                // If relativePath is empty, it's home. Otherwise it's the folder slug.
                if (item.isFile() && (item.name === 'index.mdx' || item.name === 'index.md')) {
                    nodes.push({
                        name: item.name,
                        type: 'file',
                        slug: relativePath || 'home'
                    })
                    continue
                }

                if (item.isDirectory()) {
                    const childRelativePath = relativePath ? path.join(relativePath, item.name) : item.name
                    const children = buildTree(path.join(dir, item.name), childRelativePath)

                    // Only add directory if it has content (or we can show empty dirs too)
                    // Let's show it anyway so user can see structure
                    nodes.push({
                        name: item.name,
                        type: 'directory',
                        children
                    })
                }
            }

            // Sort: directories first, then files, or alpha
            // Ideally: index.md should be somewhat prominent?
            // Let's sort alphabetically for now.
            return nodes.sort((a, b) => {
                // Keep index.md/mdx at the top if inside a folder?
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

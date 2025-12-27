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
        const files = fs.readdirSync(PAGES_DIR, { withFileTypes: true })

        // Exclude system directories and files
        const exclude = ['api', 'admin', 'posts', 'img', 'node_modules', '.next']

        const posts = files
            .filter(dirent => dirent.isDirectory() && !exclude.includes(dirent.name))
            .map(dirent => dirent.name)

        // Optionally add 'home' if we want to list index.mdx as a post in the list, 
        // but typically the list is for "folders". 
        // The editor frontend treats "home" separately or we can add it here.
        // Let's explicitly add 'home' to the list so it appears in the sidebar if not already handled.
        if (!posts.includes('home')) {
            posts.unshift('home')
        }

        return res.status(200).json(posts)
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

import type { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import path from 'path'

const POSTS_DIR = path.join(process.cwd(), 'src/pages/posts')

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    if (process.env.NODE_ENV !== 'development') {
        // In a real scenario, you might allow listing even in prod, but editing is dev only
        // But the prompt says "write ... only in local", "read only in prod".
        // This API is for the EDITOR which is local only.
        return res.status(403).json({ error: 'Editor is development only' })
    }

    if (req.method === 'GET') {
        if (!fs.existsSync(POSTS_DIR)) {
            return res.status(200).json([])
        }
        const files = fs.readdirSync(POSTS_DIR, { withFileTypes: true })
        const posts = files
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name)
        return res.status(200).json(posts)
    }

    if (req.method === 'POST') {
        const { title } = req.body
        if (!title) return res.status(400).json({ error: 'Title required' })
        const slug = title.toLowerCase().replace(/ /g, '-').replace(/[^\w-]/g, '')

        const dir = path.join(POSTS_DIR, slug)
        if (fs.existsSync(dir)) return res.status(400).json({ error: 'Post with this slug already exists' })

        try {
            fs.mkdirSync(dir, { recursive: true })
            fs.mkdirSync(path.join(dir, 'img'))
            fs.writeFileSync(path.join(dir, 'index.md'), `# ${title}\n\nNew post.\n`)
            return res.status(200).json({ slug })
        } catch (e) {
            return res.status(500).json({ error: 'Failed to create post' })
        }
    }

    return res.status(405).end()
}

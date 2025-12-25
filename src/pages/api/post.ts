import type { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import path from 'path'

const POSTS_DIR = path.join(process.cwd(), 'src/pages/posts')

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    if (process.env.NODE_ENV !== 'development') {
        return res.status(403).json({ error: 'Editor is development only' })
    }

    const { slug } = req.query
    if (!slug || Array.isArray(slug)) return res.status(400).json({ error: 'Invalid slug' })

    const dir = path.join(POSTS_DIR, slug)
    const filePath = path.join(dir, 'index.md')

    if (req.method === 'GET') {
        if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Post not found' })
        const content = fs.readFileSync(filePath, 'utf8')

        // Also list images
        const imgDir = path.join(dir, 'img')
        let images: string[] = []
        if (fs.existsSync(imgDir)) {
            images = fs.readdirSync(imgDir).filter(f => /\.(png|jpg|jpeg|gif)$/.test(f))
        }

        return res.status(200).json({ content, images })
    }

    if (req.method === 'PUT') {
        const { content } = req.body
        if (typeof content !== 'string') return res.status(400).json({ error: 'Content required' })
        if (!fs.existsSync(dir)) return res.status(404).json({ error: 'Post not found' })

        fs.writeFileSync(filePath, content)
        return res.status(200).json({ success: true })
    }

    if (req.method === 'DELETE') {
        if (fs.existsSync(dir)) {
            fs.rmSync(dir, { recursive: true, force: true })
        }
        return res.status(200).json({ success: true })
    }

    return res.status(405).end()
}

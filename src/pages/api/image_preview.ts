import fs from 'fs'
import path from 'path'
import type { NextApiRequest, NextApiResponse } from 'next'
import mime from 'gray-matter' // mime types not in gray-matter, use map

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    if (process.env.NODE_ENV !== 'development') {
        return res.status(403).end()
    }

    const { slug, file } = req.query
    if (!slug || !file || Array.isArray(slug) || Array.isArray(file)) return res.status(404).end()

    // Security: prevent traversal
    if (file.includes('..') || slug.includes('..')) return res.status(403).end()

    const filePath = path.join(process.cwd(), 'src/pages/posts', slug, 'img', file)
    if (!fs.existsSync(filePath)) return res.status(404).end()

    const ext = path.extname(filePath).toLowerCase()
    let contentType = 'image/png'
    if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg'
    if (ext === '.gif') contentType = 'image/gif'
    if (ext === '.svg') contentType = 'image/svg+xml'

    const img = fs.readFileSync(filePath)
    res.setHeader('Content-Type', contentType)
    res.send(img)
}

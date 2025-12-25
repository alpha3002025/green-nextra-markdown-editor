import type { NextApiRequest, NextApiResponse } from 'next'
import formidable from 'formidable'
import fs from 'fs'
import path from 'path'

export const config = {
    api: {
        bodyParser: false,
    },
}

const POSTS_DIR = path.join(process.cwd(), 'src/pages/posts')

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (process.env.NODE_ENV !== 'development') {
        return res.status(403).json({ error: 'Editor is development only' })
    }

    if (req.method !== 'POST') return res.status(405).end()

    const { slug } = req.query
    if (!slug || Array.isArray(slug)) return res.status(400).json({ error: 'Slug required' })

    const postDir = path.join(POSTS_DIR, slug)
    const imgDir = path.join(postDir, 'img')

    if (!fs.existsSync(imgDir)) {
        return res.status(404).json({ error: 'Post image directory not found' })
    }

    const form = formidable({})

    try {
        const [fields, files] = await form.parse(req)
        const file = files.file?.[0]
        if (!file) return res.status(400).json({ error: 'No file uploaded' })

        // Generate filename: yyyymmdd-hh-mm-ss-n.ext
        const now = new Date()
        const yyyy = now.getFullYear()
        const mm = String(now.getMonth() + 1).padStart(2, '0')
        const dd = String(now.getDate()).padStart(2, '0')
        const hh = String(now.getHours()).padStart(2, '0')
        const min = String(now.getMinutes()).padStart(2, '0')
        const ss = String(now.getSeconds()).padStart(2, '0')
        const timestamp = `${yyyy}${mm}${dd}-${hh}-${mm}-${ss}`

        const existing = fs.readdirSync(imgDir).filter(f => f.startsWith(timestamp))
        const seq = existing.length + 1

        const ext = path.extname(file.originalFilename || '.png')
        const filename = `${timestamp}-${seq}${ext}`

        fs.copyFileSync(file.filepath, path.join(imgDir, filename))

        return res.status(200).json({ filename })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ error: 'Internal server error during upload' })
    }
}

import type { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import path from 'path'

// Changed to src/pages for flat structure
const PAGES_DIR = path.join(process.cwd(), 'src/pages')

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    if (process.env.NODE_ENV !== 'development') {
        return res.status(403).json({ error: 'Editor is development only' })
    }

    const { slug } = req.query
    if (!slug || Array.isArray(slug)) return res.status(400).json({ error: 'Invalid slug' })

    let dir: string
    let filePath: string
    let imgDir: string

    if (slug === 'home') {
        dir = PAGES_DIR
        filePath = path.join(dir, 'index.mdx')
        imgDir = path.join(dir, 'img')
    } else {
        // If slug ends with .json, treat it as a file path relative to PAGES_DIR
        if (typeof slug === 'string' && slug.endsWith('.json')) {
            filePath = path.join(PAGES_DIR, slug)
            dir = path.dirname(filePath)
            imgDir = path.join(dir, 'img')
        }
        // If slug ends with .md or .mdx, treat it as a direct file path
        else if (typeof slug === 'string' && /\.(md|mdx)$/.test(slug)) {
            filePath = path.join(PAGES_DIR, slug)
            dir = path.dirname(filePath)
            imgDir = path.join(dir, 'img')
        }
        else {
            // Check if it matches a file directly (e.g. textblock/quotation -> textblock/quotation.mdx)
            const potentialMdx = path.join(PAGES_DIR, `${slug}.mdx`)
            const potentialMd = path.join(PAGES_DIR, `${slug}.md`)

            if (fs.existsSync(potentialMdx)) {
                filePath = potentialMdx
                dir = path.dirname(filePath)
            } else if (fs.existsSync(potentialMd)) {
                filePath = potentialMd
                dir = path.dirname(filePath)
            } else {
                // Determine if it is a directory with index
                dir = path.join(PAGES_DIR, slug as string)
                if (fs.existsSync(path.join(dir, 'index.mdx'))) {
                    filePath = path.join(dir, 'index.mdx')
                } else {
                    filePath = path.join(dir, 'index.md')
                }
            }
            imgDir = path.join(dir, 'img')
        }
    }

    if (req.method === 'GET') {
        if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Post not found' })
        const content = fs.readFileSync(filePath, 'utf8')

        // Also list images
        let images: string[] = []
        if (fs.existsSync(imgDir)) {
            images = fs.readdirSync(imgDir).filter(f => /\.(png|jpg|jpeg|gif)$/.test(f))
        }

        return res.status(200).json({ content, images })
    }

    if (req.method === 'PUT') {
        const { content } = req.body
        if (typeof content !== 'string') return res.status(400).json({ error: 'Content required' })
        // specific check for home to allow index.mdx overwrite even if "dir" check below might be weird
        if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Post not found' })

        fs.writeFileSync(filePath, content)
        return res.status(200).json({ success: true })
    }

    if (req.method === 'DELETE') {
        if (slug === 'home') return res.status(403).json({ error: 'Cannot delete home page' })
        if (fs.existsSync(dir)) {
            fs.rmSync(dir, { recursive: true, force: true })
        }
        return res.status(200).json({ success: true })
    }

    return res.status(405).end()
}

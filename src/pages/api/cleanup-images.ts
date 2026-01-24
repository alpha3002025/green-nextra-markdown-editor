import type { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import path from 'path'

// Changed to src/pages for flat structure
const PAGES_DIR = path.join(process.cwd(), 'src/pages')

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    if (process.env.NODE_ENV !== 'development') {
        return res.status(403).json({ error: 'Editor is development only' })
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    const { slug } = req.query
    if (!slug || Array.isArray(slug)) return res.status(400).json({ error: 'Invalid slug' })

    let dir: string
    let filePath: string
    let imgDir: string

    // Logic to resolve file path and image directory (similar to post.ts)
    if (slug === 'home') {
        dir = PAGES_DIR
        filePath = path.join(dir, 'index.mdx')
        imgDir = path.join(dir, 'img')
    } else {
        if (typeof slug === 'string' && slug.endsWith('.json')) {
            filePath = path.join(PAGES_DIR, slug)
            dir = path.dirname(filePath)
            imgDir = path.join(dir, 'img')
        }
        else if (typeof slug === 'string' && /\.(md|mdx)$/.test(slug)) {
            filePath = path.join(PAGES_DIR, slug)
            dir = path.dirname(filePath)
            imgDir = path.join(dir, 'img')
        }
        else {
            const potentialMdx = path.join(PAGES_DIR, `${slug}.mdx`)
            const potentialMd = path.join(PAGES_DIR, `${slug}.md`)

            if (fs.existsSync(potentialMdx)) {
                filePath = potentialMdx
                dir = path.dirname(filePath)
            } else if (fs.existsSync(potentialMd)) {
                filePath = potentialMd
                dir = path.dirname(filePath)
            } else {
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

    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Post not found' })

    try {
        const content = fs.readFileSync(filePath, 'utf8')
        let specificImgDir: string;
        let deletedCount = 0;

        // Determine specific image directory
        const fileName = path.basename(filePath);
        if (fileName === 'index.md' || fileName === 'index.mdx') {
            const dirName = path.basename(dir);
            specificImgDir = path.join(imgDir, dirName);
        } else {
            const docName = fileName.replace(/\.(md|mdx)$/, '');
            specificImgDir = path.join(imgDir, docName);
        }

        if (fs.existsSync(specificImgDir)) {
            const usedImages = new Set<string>();
            // Updated Regex to robustly find images
            // Matches !(text)[path] and <img src="path">
            // Simply matching filename in path context

            // Standard markdown image: ![](.../filename.ext)
            const regexMd = /img\/[^)]+\/([^/)]+)\)/g;
            let match;
            while ((match = regexMd.exec(content)) !== null) {
                usedImages.add(match[1]);
            }

            // Also check for simple filenames if user just started typing or similar?
            // Actually, let's stick to strict usage. If it's not in the markdown syntax, it's not "used".

            const allImages = fs.readdirSync(specificImgDir);
            allImages.forEach(file => {
                if (/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(file)) {
                    if (!usedImages.has(file)) {
                        try {
                            fs.unlinkSync(path.join(specificImgDir, file));
                            console.log(`Deleted unused image: ${file} from ${specificImgDir}`);
                            deletedCount++;
                        } catch (err) {
                            console.error(`Failed to delete unused image ${file}`, err);
                        }
                    }
                }
            });
        }

        return res.status(200).json({ success: true, deletedCount })

    } catch (e: any) {
        console.error(e)
        return res.status(500).json({ error: e.message })
    }
}

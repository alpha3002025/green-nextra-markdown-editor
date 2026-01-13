import type { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import path from 'path'

const PAGES_DIR = path.join(process.cwd(), 'src/pages')

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    if (process.env.NODE_ENV !== 'development') {
        return res.status(403).json({ error: 'Available only in development' })
    }

    const helpers = {
        getSafePath: (targetPath: string) => {
            const safe = path.join(PAGES_DIR, targetPath)
            if (!safe.startsWith(PAGES_DIR)) {
                throw new Error('Invalid path')
            }
            return safe
        }
    }

    try {
        if (req.method === 'POST') {
            const { type, path: targetPath } = req.body
            if (!targetPath || !type) return res.status(400).json({ error: 'Missing parameters' })

            const p = helpers.getSafePath(targetPath)

            if (fs.existsSync(p)) return res.status(400).json({ error: 'Path already exists' })

            if (type === 'directory') {
                fs.mkdirSync(p, { recursive: true })
            } else {
                // assume file
                const content = `# New File\n\nCreated at ${new Date().toISOString()}`
                fs.writeFileSync(p, content)
            }
            return res.status(200).json({ success: true })
        }

        if (req.method === 'PUT') {
            const { oldPath, newPath } = req.body
            if (!oldPath || !newPath) return res.status(400).json({ error: 'Missing parameters' })

            const src = helpers.getSafePath(oldPath)
            const dest = helpers.getSafePath(newPath)

            if (!fs.existsSync(src)) return res.status(404).json({ error: 'Source not found' })
            if (fs.existsSync(dest)) return res.status(400).json({ error: 'Destination already exists' })

            fs.renameSync(src, dest)

            // Handle Image Folder Migration
            try {
                const isMarkdown = /\.(md|mdx)$/.test(src);
                if (isMarkdown) {
                    const ext = path.extname(src);
                    const oldName = path.basename(src, ext);
                    const newName = path.basename(dest, ext);
                    const oldDir = path.dirname(src);
                    const newDir = path.dirname(dest);

                    // Check for standard file-based image directory: ./img/{docName}
                    // Note: For index.md, the logic might be different (directory based), but handling non-index files first.
                    if (oldName !== 'index') {
                        const oldImgDir = path.join(oldDir, 'img', oldName);
                        // We expect the new structure to be ./img/{newName} relative to new location
                        const newImgDir = path.join(newDir, 'img', newName);

                        if (fs.existsSync(oldImgDir)) {
                            // Ensure destination 'img' container folder exists
                            const newImgParent = path.dirname(newImgDir);
                            if (!fs.existsSync(newImgParent)) {
                                fs.mkdirSync(newImgParent, { recursive: true });
                            }

                            // Move the directory
                            fs.renameSync(oldImgDir, newImgDir);

                            // Update content references if name changed or just to be safe
                            // The reference format is typically `./img/oldName/file` or `img/oldName/file`
                            if (oldName !== newName) {
                                const content = fs.readFileSync(dest, 'utf8');
                                // Replace `img/oldName/` with `img/newName/`
                                // We use a regex that matches `img/oldName/` strictly to avoid false positives
                                // escaped oldName just in case
                                const escapedOldName = oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                const regex = new RegExp(`img/${escapedOldName}/`, 'g');
                                const newContent = content.replace(regex, `img/${newName}/`);
                                fs.writeFileSync(dest, newContent);
                            }
                        }
                    } else {
                        // Case for index.md (renaming the folder containing it usually handles it, but if moving index.md alone?)
                        // If we move index.md, we are likely changing its context entirely.
                        // But the user prompt "Drag and drop... move associated images".
                        // Usually we drag folders.
                        // If we drag a folder, fs.renameSync(src, dest) moves the folder and its contents (including index.md and img folder).
                        // So we don't need to do anything for Folders.
                        // Only for single Markdown files.
                        // So ignoring index.md is correct/safer unless user moves index.md specifically (which is rare/weird).
                    }
                }
            } catch (imgErr) {
                console.error('Error moving associated images:', imgErr);
                // Don't fail the request if image move fails, but log it.
            }

            return res.status(200).json({ success: true })
        }

        if (req.method === 'DELETE') {
            const { path: targetPath } = req.body
            if (!targetPath) return res.status(400).json({ error: 'Missing parameters' })

            const p = helpers.getSafePath(targetPath)
            if (!fs.existsSync(p)) return res.status(404).json({ error: 'Not found' })

            const stats = fs.statSync(p)
            if (stats.isDirectory()) {
                fs.rmSync(p, { recursive: true, force: true })
            } else {
                fs.unlinkSync(p)
            }
            return res.status(200).json({ success: true })
        }

    } catch (e: any) {
        console.error(e)
        return res.status(500).json({ error: e.message || 'Server error' })
    }

    return res.status(405).end()
}

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

            if (type === 'duplicate') {
                if (!fs.existsSync(p)) return res.status(404).json({ error: 'Source not found' })
            } else {
                if (fs.existsSync(p)) return res.status(400).json({ error: 'Path already exists' })
            }

            if (type === 'directory') {
                fs.mkdirSync(p, { recursive: true })
                return res.status(200).json({ success: true })
            } else if (type === 'duplicate') {
                // Determine destination path
                const ext = path.extname(p);
                const dir = path.dirname(p);
                const name = path.basename(p, ext);

                let newName = `${name}-copy`;
                let newFilename = `${newName}${ext}`;
                let destPath = path.join(dir, newFilename);

                // Auto-increment rename if exists
                let counter = 1;
                while (fs.existsSync(destPath)) {
                    newName = `${name}-copy${counter}`;
                    newFilename = `${newName}${ext}`;
                    destPath = path.join(dir, newFilename);
                    counter++;
                }

                // Copy File
                // If it is a directory, use cpSync with recursive
                const stats = fs.statSync(p);
                if (stats.isDirectory()) {
                    fs.cpSync(p, destPath, { recursive: true });
                } else {
                    fs.copyFileSync(p, destPath);

                    // Handle Markdown Image Directory Duplication
                    if (/\.(md|mdx)$/.test(p)) {
                        let oldImgDirName = name;
                        if (name === 'index') {
                            oldImgDirName = path.basename(dir);
                        }

                        const oldImgDir = path.join(dir, 'img', oldImgDirName);
                        const newImgDir = path.join(dir, 'img', newName);

                        if (fs.existsSync(oldImgDir)) {
                            // Ensure parent img dir exists
                            const imgParent = path.dirname(newImgDir);
                            if (!fs.existsSync(imgParent)) {
                                fs.mkdirSync(imgParent, { recursive: true });
                            }

                            // Copy images
                            const copyWithRename = (srcDir: string, destDir: string) => {
                                fs.mkdirSync(destDir, { recursive: true });
                                const entries = fs.readdirSync(srcDir, { withFileTypes: true });

                                for (const entry of entries) {
                                    const srcPath = path.join(srcDir, entry.name);
                                    if (entry.isDirectory()) {
                                        copyWithRename(srcPath, path.join(destDir, entry.name));
                                    } else {
                                        const fExt = path.extname(entry.name);
                                        const fBase = path.basename(entry.name, fExt);
                                        const newBase = `${fBase}-copy${fExt}`;
                                        fs.copyFileSync(srcPath, path.join(destDir, newBase));
                                    }
                                }
                            };
                            try { copyWithRename(oldImgDir, newImgDir); } catch (e) { }

                            // Update Content paths
                            const content = fs.readFileSync(destPath, 'utf8');
                            // Replace `img/oldImgDirName/` with `img/newName/`
                            const escapedName = oldImgDirName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                            const regex = new RegExp(`img/${escapedName}/([^)\\s"]+)`, 'g');

                            const newContent = content.replace(regex, (match, filename) => {
                                const parts = filename.split('/');
                                const filePart = parts.pop();
                                if (!filePart) return match;
                                const fExt = path.extname(filePart);
                                const fBase = path.basename(filePart, fExt);
                                const newBase = `${fBase}-copy${fExt}`;
                                const newPath = parts.length > 0 ? parts.join('/') + '/' + newBase : newBase;
                                return `img/${newName}/${newPath}`;
                            });

                            fs.writeFileSync(destPath, newContent);
                        }
                    }
                }
                return res.status(200).json({ success: true, newName: newName })
            } else {
                // assume file
                const content = `# New File\n\nCreated at ${new Date().toISOString()}`
                fs.writeFileSync(p, content)
                return res.status(200).json({ success: true })
            }

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

                // Remove associated image folder if it exists
                if (/\.(md|mdx)$/.test(p)) {
                    const ext = path.extname(p);
                    const name = path.basename(p, ext);
                    const dir = path.dirname(p);
                    const imgDir = path.join(dir, 'img', name);

                    if (fs.existsSync(imgDir)) {
                        try {
                            fs.rmSync(imgDir, { recursive: true, force: true });
                        } catch (imgErr) {
                            console.error('Failed to remove image directory:', imgErr);
                        }
                    }
                }
            }
            return res.status(200).json({ success: true })
        }

    } catch (e: any) {
        console.error(e)
        return res.status(500).json({ error: e.message || 'Server error' })
    }

    return res.status(405).end()
}

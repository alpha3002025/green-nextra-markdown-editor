import type { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import path from 'path'

const PAGES_DIR = path.join(process.cwd(), 'src/pages')

// Helper function to find the nearest _meta.json file based on the provided path
const findMetaFile = (targetPath: string) => {
    let currentDir = targetPath

    // Check if the currentPath is a file, if so get the directory
    if (fs.existsSync(currentDir) && fs.statSync(currentDir).isFile()) {
        currentDir = path.dirname(currentDir)
    }

    const metaPath = path.join(currentDir, '_meta.json')
    if (fs.existsSync(metaPath)) {
        return metaPath
    }

    return null
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    if (process.env.NODE_ENV !== 'development') {
        return res.status(403).json({ error: 'Editor is development only' })
    }

    if (req.method === 'GET') {
        const { path: queryPath } = req.query

        if (!queryPath || typeof queryPath !== 'string') {
            return res.status(400).json({ error: 'Path is required' })
        }

        const fullPath = path.join(PAGES_DIR, queryPath)

        // Safety check
        if (!fullPath.startsWith(PAGES_DIR)) {
            return res.status(400).json({ error: 'Invalid path' })
        }

        const metaFilePath = findMetaFile(fullPath)

        if (metaFilePath) {
            try {
                const content = fs.readFileSync(metaFilePath, 'utf-8')
                return res.status(200).json(JSON.parse(content))
            } catch (e) {
                return res.status(500).json({ error: 'Failed to read _meta.json' })
            }
        } else {
            return res.status(200).json({}) // Return empty object if no meta file found
        }
    }

    if (req.method === 'POST') {
        const { path: targetPath, key, title } = req.body

        if (targetPath === undefined || !key || !title) {
            return res.status(400).json({ error: 'Missing parameters' })
        }

        const fullPath = path.join(PAGES_DIR, targetPath)
        if (!fullPath.startsWith(PAGES_DIR)) {
            return res.status(400).json({ error: 'Invalid path' })
        }

        let metaDir = fullPath
        if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
            metaDir = path.dirname(fullPath)
        } else if (!fs.existsSync(fullPath)) {
            metaDir = path.dirname(fullPath)
        }
        if (targetPath === '') metaDir = PAGES_DIR

        const metaFilePath = path.join(metaDir, '_meta.json')

        // Read existing meta
        let metaContent: any = {}
        let orderedKeys: string[] = []

        if (fs.existsSync(metaFilePath)) {
            try {
                const raw = fs.readFileSync(metaFilePath, 'utf-8')
                metaContent = JSON.parse(raw)

                // Extract keys in order
                const regex = /^ {2}"((?:\\.|[^"\\])*)"\s*:/gm
                let match
                while ((match = regex.exec(raw)) !== null) {
                    orderedKeys.push(match[1])
                }

                // Fallback if regex failed
                if (orderedKeys.length === 0 && Object.keys(metaContent).length > 0) {
                    orderedKeys = Object.keys(metaContent)
                }
                // Ensure all keys in content are in orderedKeys
                Object.keys(metaContent).forEach(k => {
                    if (!orderedKeys.includes(k)) orderedKeys.push(k)
                })

            } catch (e) {
                console.error('Error reading existing _meta.json', e)
            }
        }

        metaContent[key] = title
        if (!orderedKeys.includes(key)) {
            orderedKeys.push(key)
        }

        // Write
        const jsonParts: string[] = ['{'];
        orderedKeys.forEach((k, index) => {
            const val = metaContent[k];
            if (val === undefined) return;
            let valStr = JSON.stringify(val, null, 2);
            if (valStr.includes('\n')) {
                valStr = valStr.split('\n').map((line, i) => i === 0 ? line : `  ${line}`).join('\n');
            }
            const isLast = index === orderedKeys.length - 1;
            jsonParts.push(`  "${k}": ${valStr}${isLast ? '' : ','}`);
        });
        jsonParts.push('}');

        try {
            fs.writeFileSync(metaFilePath, jsonParts.join('\n'))
            return res.status(200).json({ success: true, meta: metaContent })
        } catch (e) {
            return res.status(500).json({ error: 'Failed to write _meta.json' })
        }
    }

    if (req.method === 'PUT') {
        const { folderPath, oldKey, newKey } = req.body

        if (folderPath === undefined || !oldKey || !newKey) {
            return res.status(400).json({ error: 'Missing parameters' })
        }

        const fullDir = path.join(PAGES_DIR, folderPath === '/' ? '' : folderPath)
        if (!fullDir.startsWith(PAGES_DIR)) {
            return res.status(400).json({ error: 'Invalid path' })
        }

        const metaFilePath = path.join(fullDir, '_meta.json')
        if (!fs.existsSync(metaFilePath)) {
            return res.status(404).json({ error: '_meta.json not found' })
        }

        let metaContent: any = {}
        let orderedKeys: string[] = []

        try {
            const raw = fs.readFileSync(metaFilePath, 'utf-8')
            metaContent = JSON.parse(raw)
            // Extract keys in order
            const regex = /^ {2}"((?:\\.|[^"\\])*)"\s*:/gm
            let match
            while ((match = regex.exec(raw)) !== null) {
                orderedKeys.push(match[1])
            }
            if (orderedKeys.length === 0 && Object.keys(metaContent).length > 0) {
                orderedKeys = Object.keys(metaContent)
            }
            Object.keys(metaContent).forEach(k => {
                if (!orderedKeys.includes(k)) orderedKeys.push(k)
            })

            if (metaContent[oldKey]) {
                metaContent[newKey] = metaContent[oldKey]
                delete metaContent[oldKey]

                // Rename in place
                const idx = orderedKeys.indexOf(oldKey)
                if (idx !== -1) {
                    orderedKeys[idx] = newKey
                } else {
                    orderedKeys.push(newKey)
                }

                // Write
                const jsonParts: string[] = ['{'];
                orderedKeys.forEach((k, index) => {
                    const val = metaContent[k];
                    if (val === undefined) return;
                    let valStr = JSON.stringify(val, null, 2);
                    if (valStr.includes('\n')) {
                        valStr = valStr.split('\n').map((line, i) => i === 0 ? line : `  ${line}`).join('\n');
                    }
                    const isLast = index === orderedKeys.length - 1;
                    jsonParts.push(`  "${k}": ${valStr}${isLast ? '' : ','}`);
                });
                jsonParts.push('}');

                fs.writeFileSync(metaFilePath, jsonParts.join('\n'))
                return res.status(200).json({ success: true, meta: metaContent })
            } else {
                return res.status(200).json({ success: true, message: 'Key not found in meta' })
            }
        } catch (e) {
            console.error('Error', e)
            return res.status(500).json({ error: 'Failed to write _meta.json' })
        }
    }


    if (req.method === 'DELETE') {
        const { folderPath, key } = req.body

        if (folderPath === undefined || !key) {
            return res.status(400).json({ error: 'Missing parameters' })
        }

        const fullDir = path.join(PAGES_DIR, folderPath === '/' ? '' : folderPath)
        if (!fullDir.startsWith(PAGES_DIR)) {
            return res.status(400).json({ error: 'Invalid path' })
        }

        const metaFilePath = path.join(fullDir, '_meta.json')

        if (!fs.existsSync(metaFilePath)) {
            // If no meta file, nothing to delete from
            return res.status(200).json({ success: true })
        }

        let metaContent: any = {}
        let orderedKeys: string[] = []

        try {
            const raw = fs.readFileSync(metaFilePath, 'utf-8')
            metaContent = JSON.parse(raw)

            // Extract keys in order
            const regex = /^ {2}"((?:\\.|[^"\\])*)"\s*:/gm
            let match
            while ((match = regex.exec(raw)) !== null) {
                orderedKeys.push(match[1])
            }
            if (orderedKeys.length === 0 && Object.keys(metaContent).length > 0) {
                orderedKeys = Object.keys(metaContent)
            }
            Object.keys(metaContent).forEach(k => {
                if (!orderedKeys.includes(k)) orderedKeys.push(k)
            })

        } catch (e) {
            return res.status(500).json({ error: 'Corrupt _meta.json' })
        }

        if (metaContent[key]) {
            delete metaContent[key]
            orderedKeys = orderedKeys.filter(k => k !== key)

            // Write
            const jsonParts: string[] = ['{'];
            orderedKeys.forEach((k, index) => {
                const val = metaContent[k];
                if (val === undefined) return;
                let valStr = JSON.stringify(val, null, 2);
                if (valStr.includes('\n')) {
                    valStr = valStr.split('\n').map((line, i) => i === 0 ? line : `  ${line}`).join('\n');
                }
                const isLast = index === orderedKeys.length - 1;
                jsonParts.push(`  "${k}": ${valStr}${isLast ? '' : ','}`);
            });
            jsonParts.push('}');

            try {
                fs.writeFileSync(metaFilePath, jsonParts.join('\n'))
                return res.status(200).json({ success: true, meta: metaContent })
            } catch (e) {
                return res.status(500).json({ error: 'Failed to write _meta.json' })
            }
        }

        return res.status(200).json({ success: true })
    }


    if (req.method === 'PATCH') {
        const { folderPath, order } = req.body

        if (folderPath === undefined || !Array.isArray(order)) {
            return res.status(400).json({ error: 'Missing parameters or invalid order' })
        }

        const fullDir = path.join(PAGES_DIR, folderPath === '/' ? '' : folderPath)
        if (!fullDir.startsWith(PAGES_DIR)) {
            return res.status(400).json({ error: 'Invalid path' })
        }

        const metaFilePath = path.join(fullDir, '_meta.json')

        if (!fs.existsSync(metaFilePath)) {
            return res.status(404).json({ error: '_meta.json not found' })
        }

        let metaContent: any = {}
        try {
            metaContent = JSON.parse(fs.readFileSync(metaFilePath, 'utf-8'))
        } catch (_e) {
            return res.status(500).json({ error: 'Corrupt _meta.json' })
        }

        // Create new object with ordered keys for reference/return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const newMeta: any = {}
        order.forEach((key: string) => {
            if (metaContent[key] !== undefined) {
                newMeta[key] = metaContent[key]
            } else {
                newMeta[key] = key
            }
        })
        // Append remaining keys to newMeta object as well
        Object.keys(metaContent).forEach(key => {
            if (newMeta[key] === undefined) {
                newMeta[key] = metaContent[key]
            }
        })

        // Helper to manually stringify with order preservation
        const orderedKeys = [...order];
        Object.keys(metaContent).forEach(key => {
            if (!orderedKeys.includes(key)) {
                orderedKeys.push(key);
            }
        });

        const jsonParts: string[] = ['{'];
        orderedKeys.forEach((key, index) => {
            const val = newMeta[key];
            if (val === undefined) return;

            let valStr = JSON.stringify(val, null, 2);
            // If the value spans multiple lines (object/array), indent it correctly
            if (valStr.includes('\n')) {
                valStr = valStr.split('\n').map((line, i) => i === 0 ? line : `  ${line}`).join('\n');
            }

            const isLast = index === orderedKeys.length - 1;
            jsonParts.push(`  "${key}": ${valStr}${isLast ? '' : ','}`);
        });
        jsonParts.push('}');

        try {
            fs.writeFileSync(metaFilePath, jsonParts.join('\n'))
            return res.status(200).json({ success: true, meta: newMeta })
        } catch (_e) {
            return res.status(500).json({ error: 'Failed to write _meta.json' })
        }
    }

    return res.status(405).end()
}

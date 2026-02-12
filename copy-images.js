const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src/pages');
const outDir = path.join(__dirname, 'out');

function copyDir(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (let entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

function findAndCopyImages(dir, relativePath = '') {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (let entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const nextRelativePath = path.join(relativePath, entry.name);

        if (entry.isDirectory()) {
            if (entry.name === 'img') {
                // Found an 'img' directory, copy it to 'out'
                const destImgDir = path.join(outDir, relativePath, 'img');
                console.log(`Copying images from ${fullPath} to ${destImgDir}`);
                try {
                    copyDir(fullPath, destImgDir);
                } catch (e) {
                    console.error(`Error copying ${fullPath}:`, e);
                }
            } else {
                // Recurse
                findAndCopyImages(fullPath, nextRelativePath);
            }
        }
    }
}

console.log('Starting image copy process...');
if (fs.existsSync(srcDir)) {
    findAndCopyImages(srcDir);
    console.log('Image copy complete.');
} else {
    console.error('Source directory src/pages not found!');
    process.exit(1);
}

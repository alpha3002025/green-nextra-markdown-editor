git clone https://github.com/alpha3002025/green-nextra-markdown-editor.git upstream

## Copy files from upstream (code)
rsync -av --delete upstream/src/components/ src/components/
rsync -av --delete upstream/src/styles/ src/styles/
rsync -av --delete upstream/src/pages/admin/ src/pages/admin/
rsync -av --delete upstream/src/pages/api/ src/pages/api/
rsync -av --delete upstream/src/pages/api/ src/pages/_app.tsx
rsync -av --delete upstream/src/pages/api/ src/pages/_document.tsx


## Copy files from upstream (environment)
cp -a upstream/package.json package.json
cp -a upstream/package-lock.json package-lock.json 
cp -a upstream/next.config.js next.config.js
cp -a upstream/eslint.config.mjs eslint.config.mjs
cp -a upstream/theme.config.tsx theme.config.tsx
cp -a upstream/site.config.js site.config.js


## Copy files from upstream (scripts)
cp -a upstream/update-from-release.sh update-from-release.sh
cp -a upstream/update-from-specific-release.sh update-from-specific-release.sh
cp -a upstream/patch-upstream.sh patch-upstream.sh

rm -rf upstream

## npm i
npm i
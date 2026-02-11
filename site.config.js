const CONFIG = {
    // ⚙️ Github Configuration (Change these!)
    username: 'alpha3002025',
    repoName: 'green-nextra-markdown-editor',

    // ⚙️ Site Configuration    
    title: 'Vue-like Docs',
    description: 'Minimalistic and elegant documentation template',
    author: 'My Name',
    footerText: 'Vue-like Docs Style',
}

const SITE_CONFIG = {
    ...CONFIG,
    // Automatically generate GitHub URL
    github: `https://github.com/${CONFIG.username}/${CONFIG.repoName}`,

    // ⚙️ Base Path (Leave empty '' for Custom Domain / S3, set to `/${CONFIG.repoName}` for GitHub Pages)
    basePath: `/${CONFIG.repoName}`,
    // basePath: '', // <--- Uncomment this if you are using a Custom Domain (S3)
}

module.exports = { SITE_CONFIG }

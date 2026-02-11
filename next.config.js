const withNextra = require('nextra')({
    theme: 'nextra-theme-docs',
    themeConfig: './theme.config.tsx',
    latex: true,
    staticImage: false,
})

const isProd = process.env.NODE_ENV === 'production'
const repoName = 'green-nextra-markdown-editor'

module.exports = withNextra({
    reactStrictMode: false,
    output: 'export',
    images: {
        unoptimized: true
    },
    basePath: isProd ? `/${repoName}` : '',
})

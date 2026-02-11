const withNextra = require('nextra')({
    theme: 'nextra-theme-docs',
    themeConfig: './theme.config.tsx',
    latex: true,
    staticImage: false,
})

const { SITE_CONFIG } = require('./site.config')

const isProd = process.env.NODE_ENV === 'production'

module.exports = withNextra({
    reactStrictMode: false,
    output: 'export',
    images: {
        unoptimized: true
    },
    basePath: isProd ? `/${SITE_CONFIG.repoName}` : '',
})

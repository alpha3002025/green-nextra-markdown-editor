const withNextra = require('nextra')({
    theme: 'nextra-theme-docs',
    themeConfig: './theme.config.tsx',
    latex: true,
})

const { SITE_CONFIG } = require('./site.config')

const isProd = process.env.NODE_ENV === 'production'
const isVercel = process.env.VERCEL === '1'

module.exports = withNextra({
    reactStrictMode: false,
    output: isProd ? 'export' : undefined,
    images: {
        unoptimized: true
    },
    basePath: (isProd && !isVercel) ? SITE_CONFIG.basePath : '',
})

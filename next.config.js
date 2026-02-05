const withNextra = require('nextra')({
    theme: 'nextra-theme-docs',
    themeConfig: './theme.config.tsx',
    latex: true,
    staticImage: false,
})

module.exports = withNextra({
    reactStrictMode: false,
    // Optional: assetPrefix, basePath, etc.
})

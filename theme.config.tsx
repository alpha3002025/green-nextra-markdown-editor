import React from 'react'
import { DocsThemeConfig } from 'nextra-theme-docs'

const config: DocsThemeConfig = {
    // (1)
    logo: <span style={{ fontWeight: 800 }}>Vue-like Docs</span>,
    project: {
        // (2)
        link: 'https://github.com/alpha3002025/green-nextra-markdown-editor',
    },
    // (2)
    docsRepositoryBase: 'https://github.com/alpha3002025/green-nextra-markdown-editor',
    footer: {
        text: 'Vue-like Docs Style',
    },
    head: (
        <>
            <link rel="icon" type="image/png" href="/favicon.png" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            {/* (1) */}
            <meta property="og:title" content="Vue-like Docs" />
        </>
    ),
    useNextSeoProps() {
        return {
            titleTemplate: '%s – Vue-like Docs'
        }
    },
    sidebar: {
        defaultMenuCollapseLevel: 1,
        toggleButton: true
    },
    primaryHue: 153,
    primarySaturation: 47,
    // banner: {
    //   key: '2.0-release',
    //   text: <a href="https://nextra.site">Nextra 2.0 is released. Read more →</a>
    // }
}

export default config

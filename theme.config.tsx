import React from 'react'
import { DocsThemeConfig } from 'nextra-theme-docs'

const config: DocsThemeConfig = {
    logo: <span style={{ fontWeight: 800 }}>Vue-like Docs</span>,
    project: {
        link: 'https://github.com/shuding/nextra',
    },
    docsRepositoryBase: 'https://github.com/shuding/nextra',
    footer: {
        text: 'Vue-like Docs Style',
    },
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

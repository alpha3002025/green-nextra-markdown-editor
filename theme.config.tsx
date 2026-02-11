import React from 'react'
import { DocsThemeConfig } from 'nextra-theme-docs'
import { ThemeSelector } from '@/components/ThemeSelector'

import { SITE_CONFIG } from './site.config'

const config: DocsThemeConfig = {
    navbar: {
        extraContent: <ThemeSelector />
    },
    // (1)
    logo: <span style={{ fontWeight: 800 }}>{SITE_CONFIG.title}</span>,
    project: {
        // (2)
        link: SITE_CONFIG.github,
    },
    // (2)
    docsRepositoryBase: SITE_CONFIG.github,
    footer: {
        text: SITE_CONFIG.footerText,
    },
    head: (
        <>
            <link rel="icon" type="image/png" href="/favicon.png" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            {/* (1) */}
            <meta property="og:title" content={SITE_CONFIG.title} />
        </>
    ),
    useNextSeoProps() {
        return {
            titleTemplate: `%s – ${SITE_CONFIG.title}`
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

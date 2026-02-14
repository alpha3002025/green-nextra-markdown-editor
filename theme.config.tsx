import React, { useState } from 'react'
import { DocsThemeConfig } from 'nextra-theme-docs'
import { AtSign } from 'lucide-react'
import { ThemeSelector } from '@/components/ThemeSelector'

import { SITE_CONFIG } from './site.config'

const SidebarTitle = ({ title, type, route }: { title: string; type: string; route: string }) => {
    const [isHovered, setIsHovered] = useState(false)

    if (process.env.NODE_ENV !== 'development' || type === 'separator') {
        return <>{title}</>
    }

    const handleCopy = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()

        let path = route
        if (path === '/') path = '/index'

        // Handle trailing slash if present (though route usually doesn't have it for files)
        if (path.endsWith('/')) path = path.slice(0, -1);

        const cliPath = `@src/pages${path}.md`

        navigator.clipboard.writeText(cliPath).then(() => {
            console.log('Copied:', cliPath)
            // Ideally dispatch toast event like in editor, but window might not have listener here or different scope
            // For now console log is enough as per previous request context
        })
    }

    return (
        <div
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
            <span
                role="button"
                onClick={handleCopy}
                style={{
                    opacity: isHovered ? 1 : 0,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '2px',
                    marginLeft: '4px',
                    color: '#aaa',
                    transition: 'opacity 0.2s',
                    display: 'flex',
                    alignItems: 'center'
                }}
                title="Copy path for CLI"
                onMouseEnter={(e) => e.currentTarget.style.color = '#42b883'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#aaa'}
            >
                <AtSign size={14} />
            </span>
        </div>
    )
}

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
        toggleButton: true,
        titleComponent: SidebarTitle
    },
    primaryHue: 153,
    primarySaturation: 47,
    // banner: {
    //   key: '2.0-release',
    //   text: <a href="https://nextra.site">Nextra 2.0 is released. Read more →</a>
    // }
}

export default config

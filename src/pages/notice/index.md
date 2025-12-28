# etc

## Logo 

You can customize the `Vue-like Docs` logo in the top-left corner by reinforcing the text into `Vue-like Docs` within (1) in the code below in the `theme.config.tsx` file.<br/>

`theme.config.tsx`
```jsx
const config: DocsThemeConfig = {
    // (1)
    logo: <span style={{ fontWeight: 800 }}>Vue-like Docs</span>,
    // ...
    footer: { ... },
    head: (
        <>
            <link rel="icon" type="image/png" href="/favicon.png" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
           {/* (2) */}
            <meta property="og:title" content="Vue-like Docs" />
        </>
    ),
}
```

## github link modification
To modify the `Github` link shortcut at the top right of the screen, you can update the github repository links indicated by (2) in the code below within `theme.config.tsx`.<br/>

`theme.config.tsx`
```jsx
import React from 'react'
import { DocsThemeConfig } from 'nextra-theme-docs'

const config: DocsThemeConfig = {
    // ...
    project: {
        // (2)
        link: 'https://github.com/alpha3002025/green-nextra-markdown-editor',
    },
    // (2)
    docsRepositoryBase: 'https://github.com/alpha3002025/green-nextra-markdown-editor',
    // ...
}

export default config
```

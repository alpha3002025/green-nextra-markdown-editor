# etc

You can customize the `Vue-like Docs` logo in the top-left corner by reinforcing the text into `Vue-like Docs` within (1) and (2) in the code below in the `theme.config.tsx` file.

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
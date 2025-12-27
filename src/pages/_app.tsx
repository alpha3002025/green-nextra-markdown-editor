import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// Standard SVG paths for icons
const COPY_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
const CHECK_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#42b883" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

function Toast({ message }: { message: string }) {
  if (!message) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div style={{
      position: 'fixed',
      bottom: '2rem',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: '#42b883',
      color: 'white',
      padding: '0.5rem 1rem',
      borderRadius: '4px',
      fontSize: '0.9rem',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      zIndex: 2000,
      animation: 'fadeInOut 2s ease-in-out forwards'
    }}>
      {message}
    </div>,
    document.body
  );
}

function CodeBlockEnhancer() {
  const router = useRouter();

  useEffect(() => {
    const enhance = () => {
      const preElements = document.querySelectorAll('pre');
      preElements.forEach((pre: any) => {
        if (pre.getAttribute('data-enhanced')) return;

        // Nextra wraps pre in a div usually, or we look for code inside
        const code = pre.querySelector('code');
        if (!code) return;

        let language = '';
        // Check code class
        let match = code.className.match(/language-(\w+)/);
        if (match) language = match[1];

        // Check pre class (some themes put it there)
        if (!language) {
          match = pre.className.match(/language-(\w+)/);
          if (match) language = match[1];
        }

        // Check data attributes
        if (!language) {
          language = pre.getAttribute('data-language') || code.getAttribute('data-language') || '';
        }

        // Find the wrapper (relative container)
        // Nextra structure: div (relative) > div (actions) + div (scroll) > pre > code
        // Or sometimes just div > pre
        const wrapper = pre.closest('.nextra-code-block') || pre.parentElement;
        if (!wrapper) return;

        // Ensure wrapper is relative for positioning
        if (window.getComputedStyle(wrapper).position === 'static') {
          wrapper.style.position = 'relative';
        }

        // Create Container for our controls
        const controls = document.createElement('div');
        controls.className = 'enhanced-controls';
        controls.style.position = 'absolute';
        controls.style.top = '0.5rem';
        controls.style.right = '0.5rem';
        controls.style.display = 'flex';
        controls.style.alignItems = 'center';
        controls.style.gap = '0.5rem';
        controls.style.zIndex = '10';
        wrapper.appendChild(controls);

        // Language Label
        if (language) {
          const label = document.createElement('div');
          label.innerText = language;
          label.style.fontSize = '0.75rem';
          label.style.color = '#888';
          label.style.fontWeight = '600';
          label.style.textTransform = 'uppercase';
          label.style.userSelect = 'none';
          label.style.pointerEvents = 'none';
          label.style.transition = 'opacity 0.2s';

          controls.appendChild(label);

          // Reference for hover logic
          (wrapper as any)._langLabel = label;
        }

        // Copy Button
        const btn = document.createElement('button');
        btn.innerHTML = COPY_ICON;
        btn.style.background = 'rgba(255,255,255,0.1)';
        btn.style.border = '1px solid rgba(255,255,255,0.2)';
        btn.style.borderRadius = '4px';
        btn.style.padding = '4px';
        btn.style.cursor = 'pointer';
        btn.style.display = 'flex';
        btn.style.alignItems = 'center';
        btn.style.justifyContent = 'center';
        btn.style.color = '#ccc';
        btn.style.transition = 'all 0.2s';
        btn.style.opacity = '0'; // Hidden by default
        btn.title = 'Copy code';

        btn.onclick = () => {
          const text = pre.innerText;
          navigator.clipboard.writeText(text).then(() => {
            btn.innerHTML = CHECK_ICON;
            btn.style.borderColor = '#42b883';
            window.dispatchEvent(new CustomEvent('show-viewer-toast', { detail: 'Copied to clipboard' }));
            setTimeout(() => {
              btn.innerHTML = COPY_ICON;
              btn.style.borderColor = 'rgba(255,255,255,0.2)';
            }, 2000);
          });
        };

        controls.appendChild(btn);
        (wrapper as any)._copyBtn = btn;

        // Hover Logic
        wrapper.addEventListener('mouseenter', () => {
          if ((wrapper as any)._langLabel) (wrapper as any)._langLabel.style.opacity = '0';
          if ((wrapper as any)._copyBtn) (wrapper as any)._copyBtn.style.opacity = '1';
        });
        wrapper.addEventListener('mouseleave', () => {
          if ((wrapper as any)._langLabel) (wrapper as any)._langLabel.style.opacity = '1';
          if ((wrapper as any)._copyBtn) (wrapper as any)._copyBtn.style.opacity = '0';
        });

        pre.setAttribute('data-enhanced', 'true');
      });
    };

    // Run on mount and changes
    const observer = new MutationObserver(enhance);
    if (typeof document !== 'undefined') {
      observer.observe(document.body, { childList: true, subtree: true });
      enhance();
    }

    return () => observer.disconnect();
  }, [router.asPath]); // Re-run on route change just in case

  return null;
}

function EditButton() {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check path.
    // Root is home.
    // Anything else under / (e.g. /hello-next) is a post, unless it's /admin.
    if (router.pathname.startsWith('/admin')) {
      setSlug("");
      return;
    }

    if (router.pathname === '/') {
      setSlug('home');
    } else {
      // Extract slug from /slug
      const parts = router.pathname.split('/').filter(Boolean);
      if (parts.length > 0) {
        setSlug(parts[0]);
      } else {
        setSlug("");
      }
    }
  }, [router]);

  if (!mounted || !slug) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '2rem',
      right: '2rem',
      zIndex: 100
    }}>
      <Link
        href={`/admin/editor?open=${slug}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '3.5rem',
          height: '3.5rem',
          backgroundColor: '#42b883', // Vue Green background
          color: 'white',
          borderRadius: '50%',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          transition: 'all 0.2s',
          textDecoration: 'none'
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
        }}
        title="Edit this post"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
      </Link>
    </div>
  );
}

export default function App({ Component, pageProps }: AppProps) {
  const [toastMsg, setToastMsg] = useState('');

  useEffect(() => {
    const handleToast = (e: any) => {
      setToastMsg(e.detail);
      setTimeout(() => setToastMsg(''), 2000);
    };
    window.addEventListener('show-viewer-toast', handleToast);
    return () => window.removeEventListener('show-viewer-toast', handleToast);
  }, []);

  return (
    <>
      <CodeBlockEnhancer />
      <EditButton />
      <Toast message={toastMsg} />
      <Component {...pageProps} />
    </>
  );
}

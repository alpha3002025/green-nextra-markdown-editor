import "@/styles/globals.css";
import "@/styles/theme.css";
import 'katex/dist/katex.min.css';

import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { YouTubeEmbed, getYouTubeId } from "@/components/YouTubeEmbed";
import { LinkPreview } from "@/components/LinkPreview";
import Mermaid from "@/components/Mermaid";

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

// Enhanced CodeBlockEnhancer (Lines 37-164 replacement)
function CodeBlockEnhancer() {
  const router = useRouter();

  useEffect(() => {
    const enhance = () => {
      const preElements = document.querySelectorAll('pre');
      preElements.forEach((pre: any) => {
        if (pre.getAttribute('data-enhanced-interact')) return;

        // Basic Structure Check
        const code = pre.querySelector('code');
        if (!code) return;

        // Ensure Pre is relative
        if (window.getComputedStyle(pre).position === 'static') {
          pre.style.position = 'relative';
        }

        // --- 1. Overlay Container for Highlights ---
        // We render this BEHIND the text if possible, or using mix-blend-mode if on top?
        // Code blocks usually have a background color.
        // We can place this container absolutely.
        // To ensure it's behind text but above bg, we might need z-index tricks.
        // Easier: render on top with semi-transparent color and pointer-events: none.
        const overlay = document.createElement('div');
        overlay.className = 'code-interaction-overlay';
        overlay.style.position = 'absolute';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.pointerEvents = 'none'; // Pass through clicks to text selection
        overlay.style.zIndex = '1';
        pre.appendChild(overlay);

        // Hover Highlight Element
        const hoverEl = document.createElement('div');
        hoverEl.style.position = 'absolute';
        hoverEl.style.left = '0';
        hoverEl.style.right = '0'; // Full width
        hoverEl.style.height = '1.5em'; // Default, will update
        hoverEl.style.backgroundColor = 'rgba(66, 184, 131, 0.1)';
        hoverEl.style.borderLeft = '3px solid #42b883';
        hoverEl.style.display = 'none';
        hoverEl.style.pointerEvents = 'none';
        overlay.appendChild(hoverEl);

        // Active (Clicked) Highlight Element
        const activeEl = document.createElement('div');
        activeEl.style.position = 'absolute';
        activeEl.style.left = '0';
        activeEl.style.right = '0';
        activeEl.style.height = '1.5em';
        activeEl.style.backgroundColor = 'rgba(66, 184, 131, 0.2)';
        activeEl.style.borderLeft = '3px solid #33a06f';
        activeEl.style.display = 'none';
        activeEl.style.pointerEvents = 'none';
        overlay.appendChild(activeEl);

        // State
        let activeLineIndex: number | null = null;
        let lineHeight = 24; // Default guess

        // Measure line height from code element
        const computedStyle = window.getComputedStyle(code);
        const lhStr = computedStyle.lineHeight;
        if (lhStr && lhStr !== 'normal') {
          lineHeight = parseFloat(lhStr);
        } else {
          // Fallback measurement
          const fontSize = parseFloat(computedStyle.fontSize);
          lineHeight = fontSize * 1.5;
        }

        // Event Handler
        const handleMouseMove = (e: MouseEvent) => {
          const rect = pre.getBoundingClientRect();
          const padding = parseFloat(window.getComputedStyle(pre).paddingTop);
          const relY = e.clientY - rect.top - padding;
          // Calculate index
          // Adjust for scroll? Pre usually scrolls.
          const scrollY = pre.scrollTop;
          const actualY = relY + scrollY;

          const index = Math.floor(actualY / lineHeight);
          if (index < 0) return;

          // Move Hover Element
          hoverEl.style.display = 'block';
          // Visual position must account for padding
          hoverEl.style.top = `${(index * lineHeight) + padding}px`;
          hoverEl.style.height = `${lineHeight}px`;
        };

        const handleMouseLeave = () => {
          hoverEl.style.display = 'none';
        };

        const handleClick = (e: MouseEvent) => {
          const rect = pre.getBoundingClientRect();
          const padding = parseFloat(window.getComputedStyle(pre).paddingTop);
          const relY = e.clientY - rect.top - padding;
          const scrollY = pre.scrollTop;
          const actualY = relY + scrollY;
          const index = Math.floor(actualY / lineHeight);

          // Toggle active
          if (activeLineIndex === index) {
            activeLineIndex = null;
            activeEl.style.display = 'none';
          } else {
            activeLineIndex = index;
            activeEl.style.display = 'block';
            activeEl.style.top = `${(index * lineHeight) + padding}px`;
            activeEl.style.height = `${lineHeight}px`;
          }
        };

        // Attach Refined Listeners
        // We attach to PRE because it contains everything.
        pre.addEventListener('mousemove', handleMouseMove);
        pre.addEventListener('mouseleave', handleMouseLeave);
        pre.addEventListener('click', handleClick);

        // Copy Button Logic (Restoring previous simplified logic but appending to wrapper usually)
        // ... (We keep your existing Copy Button logic simpler or integrated? 
        // User didn't complain about copy button, but we overwrote the whole function.
        // Let's bring back the copy button part quickly.)

        // Finding wrapper for Copy Button (Nextra usually wraps pre)
        const wrapper = pre.closest('.nextra-code-block') || pre.parentElement;
        if (wrapper && window.getComputedStyle(wrapper).position === 'static') {
          wrapper.style.position = 'relative';
        }

        if (wrapper && !wrapper.querySelector('.enhanced-controls')) {
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

          // Determine Language
          let language = '';
          // Check code class
          let match = code.className.match(/language-(\w+)/);
          if (match) language = match[1];

          // Check pre class
          if (!language) {
            match = pre.className.match(/language-(\w+)/);
            if (match) language = match[1];
          }

          // Check data attributes
          if (!language) {
            language = pre.getAttribute('data-language') || code.getAttribute('data-language') || '';
          }

          // Render Language Label
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

            // attach to wrapper for hover handling
            (wrapper as any)._langLabel = label;
          }

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
          btn.style.opacity = '0';
          btn.style.transition = 'all 0.2s';
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

          wrapper.addEventListener('mouseenter', () => { btn.style.opacity = '1'; });
          wrapper.addEventListener('mouseleave', () => { btn.style.opacity = '0'; });
        }


        pre.setAttribute('data-enhanced-interact', 'true');
      });
    };

    const observer = new MutationObserver(enhance);
    if (typeof document !== 'undefined') {
      observer.observe(document.body, { childList: true, subtree: true });
      enhance();
    }
    return () => observer.disconnect();
  }, [router.asPath]);

  return null;
}

function CopyTokenEnhancer() {
  const router = useRouter();

  useEffect(() => {
    const enhance = () => {
      // Target inline code elements
      document.querySelectorAll('code').forEach((code) => {
        // Skip if inside pre (Code Block)
        if (code.closest('pre')) return;
        // Skip if already processed
        if (code.getAttribute('data-inline-copy')) return;
        // Skip if it looks like a wrapper or internal element
        if (code.closest('.inline-copy-btn')) return;

        code.setAttribute('data-inline-copy', 'true');

        // Force relative position for anchoring
        // We use classList to avoid overwriting style attribute if possible, 
        // but inline style is safest for immediate effect without CSS conflicts.
        code.style.position = 'relative';

        // Create Text Button
        const btn = document.createElement('button');
        btn.className = 'inline-copy-btn';
        btn.textContent = 'Copy';
        // Prevent button text from being selected/copied by user selection
        btn.style.userSelect = 'none';
        btn.contentEditable = 'false'; // Ensure it doesn't interfere with editing if any

        btn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();

          // Extract text only (exclude button)
          // Clone node to safely remove children without affecting DOM
          const clone = code.cloneNode(true) as HTMLElement;
          const buttons = clone.querySelectorAll('button');
          buttons.forEach(b => b.remove());
          const text = clone.textContent || '';

          navigator.clipboard.writeText(text).then(() => {
            btn.textContent = 'Copied!';
            btn.classList.add('copied');
            window.dispatchEvent(new CustomEvent('show-viewer-toast', { detail: 'Copied to clipboard' }));
            setTimeout(() => {
              btn.textContent = 'Copy';
              btn.classList.remove('copied');
            }, 2000);
          });
        };

        code.appendChild(btn);
      });
    };

    const observer = new MutationObserver((mutations) => {
      let shouldProcess = false;
      mutations.forEach(m => {
        if (m.type === 'childList') {
          m.addedNodes.forEach(n => {
            if (n.nodeType === Node.ELEMENT_NODE) {
              const el = n as Element;
              // Check if potentially contains code or is code
              // Avoid reacting to our own button additions
              if ((el.tagName === 'CODE' || el.querySelector('code')) && !el.classList.contains('inline-copy-btn')) {
                shouldProcess = true;
              }
            }
          });
        }
      });
      if (shouldProcess) setTimeout(enhance, 100);
    });

    if (typeof document !== 'undefined') {
      enhance();
      observer.observe(document.body, { childList: true, subtree: true });
    }
    return () => observer.disconnect();
  }, [router.asPath]);

  return null;
}

function SafeImage(props: any) {
  const [error, setError] = useState(false);
  const router = useRouter();

  let src = props.src;

  // Transform relative paths to API calls for public viewer (Development Only)
  if (process.env.NODE_ENV === 'development' && src && src.startsWith('./img/') && !router.pathname.startsWith('/admin')) {
    let slug = router.asPath.split('?')[0].split('#')[0].replace(/^\//, '').replace(/\/$/, '');
    if (slug === '') slug = 'index';
    src = `/api/image_preview?slug=${slug}&file=${src.replace('./img/', '')}`;
  }

  if (error) {
    return (
      <div style={{
        padding: '0.75rem',
        backgroundColor: '#fafafa',
        border: '1px dashed #ddd',
        borderRadius: '6px',
        color: '#888',
        fontSize: '0.85rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        margin: '1rem 0'
      }}>
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
        <span>{props.alt || 'Image not found'}</span>
      </div>
    );
  }

  // eslint-disable-next-line jsx-a11y/alt-text
  return <img {...props} src={src} onError={() => setError(true)} style={{ maxWidth: '100%', height: 'auto', borderRadius: '6px', ...props.style }} />;
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
        setSlug(parts.join('/'));
      } else {
        setSlug("");
      }
    }
  }, [router]);

  // Hide in production
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

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

function BreadcrumbEnhancer() {
  const router = useRouter();

  useEffect(() => {
    const enhance = () => {
      // Find the breadcrumb container - Nextra structure varies
      const breadcrumbList = document.querySelector('.nextra-breadcrumb ul, nav[aria-label="breadcrumb"] ol');

      // Fallback: Try finding the container directly if list not found
      const breadcrumbContainer = breadcrumbList || document.querySelector('.nextra-breadcrumb');

      if (breadcrumbContainer) {
        // Remove existing button if it's attached anywhere nearby (to prevent duplicates and update path)
        const existingBtn = document.querySelector('.bc-copy-btn');
        if (existingBtn) existingBtn.remove();

        const btn = document.createElement('button');
        btn.className = 'bc-copy-btn';
        btn.innerHTML = COPY_ICON;
        btn.style.background = 'transparent';
        btn.style.border = 'none';
        btn.style.cursor = 'pointer';
        btn.style.marginLeft = '8px';
        btn.style.padding = '4px';
        btn.style.color = '#aaa';
        btn.style.borderRadius = '4px';
        btn.style.display = 'inline-flex';
        btn.style.alignItems = 'center';
        btn.title = 'Copy relative path';
        btn.style.transition = 'all 0.2s';

        // Ensure it doesn't shrink
        btn.style.flexShrink = '0';

        btn.onmouseenter = () => {
          btn.style.color = '#42b883';
          btn.style.backgroundColor = 'rgba(66, 184, 131, 0.1)';
        };
        btn.onmouseleave = () => {
          btn.style.color = '#aaa';
          btn.style.backgroundColor = 'transparent';
        };

        btn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();

          // Use router.asPath directly
          let path = router.asPath.split('?')[0].split('#')[0];

          // Decode URI component to handle Korean/Special chars
          path = decodeURIComponent(path);

          // Remove leading slash
          path = path.replace(/^\//, '');

          if (!path) path = 'index';

          navigator.clipboard.writeText(path).then(() => {
            btn.innerHTML = CHECK_ICON;
            window.dispatchEvent(new CustomEvent('show-viewer-toast', { detail: 'Path copied: ' + path }));
            setTimeout(() => {
              btn.innerHTML = COPY_ICON;
            }, 2000);
          });
        };

        // Append logic: Find the best place to put it.
        // If it's a list (ul/ol), we usually want it AFTER the list, inside the nav wrapper.
        if ((breadcrumbContainer.tagName === 'UL' || breadcrumbContainer.tagName === 'OL') && breadcrumbContainer.parentElement) {
          // Make sure parent is flex to align them
          const parent = breadcrumbContainer.parentElement;
          if (window.getComputedStyle(parent).display !== 'flex') {
            parent.style.display = 'flex';
            parent.style.alignItems = 'center';
          }
          parent.appendChild(btn);
        } else {
          // If it's just a div or nav, append directly
          breadcrumbContainer.appendChild(btn);
        }
      }
    };

    if (typeof document !== 'undefined') {
      // Run immediately and after short delays to catch render updates
      enhance();
      setTimeout(enhance, 200);
      setTimeout(enhance, 500);

      const observer = new MutationObserver(() => {
        if (!document.querySelector('.bc-copy-btn')) {
          enhance();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });

      return () => observer.disconnect();
    }
  }, [router.asPath]);

  return null;
}

function HeaderCopyEnhancer() {
  const router = useRouter();

  useEffect(() => {
    const enhance = () => {
      // Viewer H1 usually has a specific class or just is an H1 in the main content
      // Nextra content is usually in <main> or .nextra-content
      const main = document.querySelector('main');
      if (!main) return;

      const h1s = main.querySelectorAll('h1');
      h1s.forEach((h1: any) => {
        if (h1.querySelector('.header-copy-btn')) return;

        // Ensure clean layout
        if (window.getComputedStyle(h1).display !== 'flex') {
          h1.style.display = 'flex';
          h1.style.alignItems = 'center';
          h1.style.gap = '8px';
        }

        const btn = document.createElement('button');
        btn.className = 'header-copy-btn';
        btn.innerHTML = COPY_ICON;
        btn.style.background = 'transparent';
        btn.style.border = 'none';
        btn.style.cursor = 'pointer';
        btn.style.color = '#ccc'; // Default dim
        btn.style.padding = '4px';
        btn.style.display = 'flex';
        btn.style.alignItems = 'center';
        btn.style.transition = 'all 0.2s';
        btn.title = 'Copy title';

        // Hover effects
        btn.onmouseenter = () => {
          btn.style.color = '#42b883';
          btn.style.transform = 'scale(1.1)';
        };
        btn.onmouseleave = () => {
          btn.style.color = '#ccc';
          btn.style.transform = 'scale(1)';
        };

        btn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();

          // Extract text without the button itself
          const clone = h1.cloneNode(true) as HTMLElement;
          const buttons = clone.querySelectorAll('button');
          buttons.forEach(b => b.remove());
          // Also remove potential anchor links if Nextra adds them (like #)
          const anchors = clone.querySelectorAll('a.anchor');
          anchors.forEach(a => a.remove());

          const text = clone.textContent?.trim() || '';

          navigator.clipboard.writeText(text).then(() => {
            btn.innerHTML = CHECK_ICON;
            window.dispatchEvent(new CustomEvent('show-viewer-toast', { detail: 'Title copied' }));
            setTimeout(() => {
              btn.innerHTML = COPY_ICON;
            }, 2000);
          });
        };

        h1.appendChild(btn);
      });
    };

    if (typeof document !== 'undefined') {
      enhance();
      // Observe for changes (e.g. client-side navigation)
      const observer = new MutationObserver(enhance);
      observer.observe(document.body, { childList: true, subtree: true });
      return () => observer.disconnect();
    }
  }, [router.asPath]);

  return null;
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
      <CopyTokenEnhancer />
      <HeaderCopyEnhancer />
      <EditButton />
      <BreadcrumbEnhancer />
      <Toast message={toastMsg} />
      <Component {...pageProps} components={{
        a: ({ href, children }: any) => {
          const url = href || '';
          const videoId = getYouTubeId(url);

          // Flexible raw link detection
          const linkText = Array.isArray(children)
            ? children.map(c => typeof c === 'string' ? c : '').join('')
            : String(children || '');

          const isRawLink = linkText.trim().replace(/\/$/, '') === url.trim().replace(/\/$/, '');

          if (videoId && isRawLink) {
            return (
              <>
                <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: '#42b883', textDecoration: 'underline' }}>{children}</a>
                <YouTubeEmbed url={url} />
              </>
            );
          }

          if (isRawLink && (url.startsWith('http://') || url.startsWith('https://'))) {
            return (
              <>
                <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: '#42b883', textDecoration: 'underline' }}>{children}</a>
                <LinkPreview url={url} />
              </>
            );
          }

          return <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: '#42b883', textDecoration: 'underline' }}>{children}</a>;
        },
        code: ({ className, children, ...props }: any) => {
          const match = /language-(\w+)/.exec(className || '');
          const language = match ? match[1] : (props['data-language'] || '');

          if (language === 'mermaid') {
            // Attempt to extract text content
            let codeText = '';
            if (typeof children === 'string') {
              codeText = children;
            } else if (Array.isArray(children)) {
              // If children are mixed (strings/elements), join valid strings
              // But typically if it's highlighted, it's spans. 
              // However, mermaid is often NOT highlighted by standard highlighters.
              // We'll try to extract text from React children if possible or fallback.
              React.Children.forEach(children, child => {
                if (typeof child === 'string') codeText += child;
                // else if child has props.children... it gets complex.
              });
            }

            // If we didn't get simple text, we might need a Ref or DOM lookup 
            // but simpler is to assume if it wasn't highlighted, it's text.
            if (codeText) {
              return <Mermaid chart={codeText.trim()} />;
            }
          }
          return <code className={className} {...props}>{children}</code>;
        },
        img: SafeImage
      }} />
    </>
  );
}

import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

function EditButton() {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check if path is /posts/...
    if (router.pathname.startsWith('/posts/')) {
      // Extract slug
      const parts = router.pathname.split('/');
      if (parts.length >= 3) {
        setSlug(parts[2]);
      }
    } else {
      setSlug("");
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
  return (
    <>
      <EditButton />
      <Component {...pageProps} />
    </>
  );
}

import React, { useState, useEffect, useCallback, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import Head from 'next/head'
import { useRouter } from 'next/router'
import styles from '../../styles/Editor.module.css'
import {
    Bold, Italic, Heading1, Heading2, List, ListOrdered,
    Quote, Link as LinkIcon, Image as ImageIcon, Code,
    FileText, Menu, ChevronLeft, Save, Plus, Copy
} from 'lucide-react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism'
import LiveEditor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-markdown';
import 'prismjs/themes/prism.css'; // Import base Prism styles

// Toast Component
function Toast({ message }: { message: string }) {
    if (!message) return null;
    return <div className={styles.toast}>{message}</div>;
}

// CodeBlock Helper Component
function CodeBlock({ language, value, children }: { language: string, value: string, children: React.ReactNode }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Copied to clipboard' }));
        });
    }

    return (
        <div className={styles.codeBlockWrapper}>
            {!copied ? (
                <div className={styles.codeBlockHeader}>{language}</div>
            ) : null}
            <button className={styles.copyBtn} onClick={handleCopy} title="Copy code">
                {copied ? <div style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>✓</div> : <Copy size={16} />}
            </button>
            {children}
        </div>
    )
}

// function to generate slug from text
const generateSlug = (text: string) => {
    return text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
};

export default function Editor() {
    const router = useRouter()
    const { open } = router.query

    const [posts, setPosts] = useState<string[]>([])
    const [currentPost, setCurrentPost] = useState<string | null>(null)
    const [content, setContent] = useState('')
    const [status, setStatus] = useState('')
    const [newPostTitle, setNewPostTitle] = useState('')
    const [isSidebarOpen, setSidebarOpen] = useState(true)
    const [toastMsg, setToastMsg] = useState('')
    const [toc, setToc] = useState<{ id: string, text: string, level: number }[]>([]);
    const [viewMode, setViewMode] = useState<'source' | 'preview' | 'both' | 'live'>('both')
    const [tocWidth, setTocWidth] = useState(250);
    const [isResizing, setIsResizing] = useState(false);

    const textareaRef = useRef<HTMLTextAreaElement>(null)

    useEffect(() => {
        const handleToast = (e: any) => {
            setToastMsg(e.detail);
            setTimeout(() => setToastMsg(''), 2000);
        };
        window.addEventListener('show-toast', handleToast);
        return () => window.removeEventListener('show-toast', handleToast);
    }, []);

    useEffect(() => {
        fetchPosts()
    }, [])

    useEffect(() => {
        if (open && typeof open === 'string') {
            if (!currentPost) {
                loadPost(open)
            }
        }
    }, [open])

    // Extract headers when content changes
    useEffect(() => {
        const lines = content.split('\n');
        const headers: { id: string, text: string, level: number }[] = [];
        let inCodeBlock = false;

        lines.forEach(line => {
            if (line.trim().startsWith('```')) {
                inCodeBlock = !inCodeBlock;
            }
            if (inCodeBlock) return;

            const match = line.match(/^(#{1,3})\s+(.+)$/);
            if (match) {
                const level = match[1].length;
                const text = match[2];
                const id = generateSlug(text);
                headers.push({ id, text, level });
            }
        });
        setToc(headers);
    }, [content]);

    // Resizing Logic
    const startResizing = useCallback((mouseDownEvent: React.MouseEvent) => {
        mouseDownEvent.preventDefault();
        setIsResizing(true);
    }, []);

    const stopResizing = useCallback(() => {
        setIsResizing(false);
    }, []);

    const resize = useCallback(
        (mouseMoveEvent: MouseEvent) => {
            if (isResizing) {
                // Calculate new width based on mouse position from the right edge of the viewport
                const newWidth = document.body.clientWidth - mouseMoveEvent.clientX;
                if (newWidth > 150 && newWidth < 600) { // Min and Max constraints
                    setTocWidth(newWidth);
                }
            }
        },
        [isResizing]
    );

    useEffect(() => {
        window.addEventListener("mousemove", resize);
        window.addEventListener("mouseup", stopResizing);
        return () => {
            window.removeEventListener("mousemove", resize);
            window.removeEventListener("mouseup", stopResizing);
        };
    }, [resize, stopResizing]);

    const fetchPosts = async () => {
        try {
            const res = await fetch('/api/posts')
            if (res.status === 403) {
                setStatus('Read Only Mode (Production)')
                return
            }
            const data = await res.json()
            setPosts(data)
        } catch (e) {
            console.error(e)
        }
    }

    const createPost = async () => {
        if (!newPostTitle) return
        const res = await fetch('/api/posts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: newPostTitle })
        })
        if (res.ok) {
            const { slug } = await res.json()
            setNewPostTitle('')
            await fetchPosts()
            loadPost(slug)
        } else {
            alert('Failed to create post')
        }
    }

    const loadPost = async (slug: string) => {
        setCurrentPost(slug)
        const res = await fetch(`/api/post?slug=${slug}`)
        if (res.ok) {
            const data = await res.json()
            setContent(data.content)
            router.push(`/admin/editor?open=${slug}`, undefined, { shallow: true })
        }
    }

    const savePost = useCallback(async () => {
        if (!currentPost) return
        setStatus('Saving...')
        const res = await fetch(`/api/post?slug=${currentPost}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
        })
        if (res.ok) {
            setStatus('Saved')
            setTimeout(() => setStatus(''), 2000)
        } else {
            setStatus('Error saving')
        }
    }, [currentPost, content])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault()
                savePost()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [savePost])

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !e.target.files[0] || !currentPost) return
        const file = e.target.files[0]
        const formData = new FormData()
        formData.append('file', file)

        setStatus('Uploading...')
        const res = await fetch(`/api/upload?slug=${currentPost}`, {
            method: 'POST',
            body: formData
        })

        if (res.ok) {
            const { filename } = await res.json()
            insertText(`![](./img/${filename})`)
            setStatus('Image uploaded')
        } else {
            setStatus('Upload failed')
        }
        e.target.value = ''
    }

    const insertText = (textToInsert: string) => {
        const textarea = textareaRef.current
        if (!textarea) {
            setContent(prev => prev + textToInsert)
            return
        }

        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const text = content
        const before = text.substring(0, start)
        const after = text.substring(end, text.length)

        const newText = before + textToInsert + after
        setContent(newText)

        setTimeout(() => {
            textarea.focus()
            textarea.setSelectionRange(start + textToInsert.length, start + textToInsert.length)
        }, 0)
    }

    const formatText = (type: string) => {
        const textarea = textareaRef.current
        if (!textarea) return

        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const text = content
        const selectedText = text.substring(start, end)

        let newText = ''
        let newCursorPos = end

        switch (type) {
            case 'bold':
                newText = text.substring(0, start) + `**${selectedText}**` + text.substring(end)
                newCursorPos = end + 4
                break
            case 'italic':
                newText = text.substring(0, start) + `*${selectedText}*` + text.substring(end)
                newCursorPos = end + 2
                break
            case 'h1':
                newText = text.substring(0, start) + `# ${selectedText}` + text.substring(end)
                newCursorPos = end + 2
                break
            case 'h2':
                newText = text.substring(0, start) + `## ${selectedText}` + text.substring(end)
                newCursorPos = end + 3
                break
            case 'quote':
                newText = text.substring(0, start) + `> ${selectedText}` + text.substring(end)
                newCursorPos = end + 2
                break
            case 'code':
                newText = text.substring(0, start) + `\`\`\`\n${selectedText}\n\`\`\`` + text.substring(end)
                newCursorPos = end + 8
                break
            case 'link':
                const linkText = selectedText || 'link'
                newText = text.substring(0, start) + `[${linkText}](url)` + text.substring(end)
                newCursorPos = end + 3 + (selectedText ? 0 : 4)
                break
            case 'list':
                newText = text.substring(0, start) + `- ${selectedText}` + text.substring(end)
                newCursorPos = end + 2
                break
        }

        if (newText) {
            setContent(newText)
            setTimeout(() => {
                textarea.focus()
                // textarea.setSelectionRange(newCursorPos, newCursorPos) 
            }, 0)
        }
    }

    // Helper to scroll to element
    const scrollToHeader = (id: string) => {
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
    };

    return (
        <div className={styles.container}>
            <Head>
                <title>Editor - Green Nextra</title>
            </Head>

            <Toast message={toastMsg} />

            {/* Sidebar (File Explorer) */}
            <div className={`${styles.sidebar} ${!isSidebarOpen ? styles.closed : ''}`}>
                <div className={styles.sidebarHeader}>
                    <FileText size={20} />
                    <span>Explorer</span>
                </div>
                <div className={styles.newPostForm}>
                    <div className={styles.inputGroup}>
                        <input
                            className={styles.input}
                            placeholder="New File..."
                            value={newPostTitle}
                            onChange={e => setNewPostTitle(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && createPost()}
                        />
                        <button className={styles.btnPrimary} onClick={createPost}>
                            <Plus size={16} />
                        </button>
                    </div>
                </div>
                <div className={styles.postList}>
                    {posts.map(slug => (
                        <div
                            key={slug}
                            onClick={() => loadPost(slug)}
                            className={`${styles.postItem} ${currentPost === slug ? styles.active : ''}`}
                        >
                            <FileText size={16} />
                            <span>{slug}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Content */}
            <div className={styles.main}>
                {/* Top Bar */}
                <div className={styles.topBar}>
                    <div className={styles.topBarLeft}>
                        <button className={styles.toggleBtn} onClick={() => setSidebarOpen(!isSidebarOpen)}>
                            {isSidebarOpen ? <ChevronLeft size={20} /> : <Menu size={20} />}
                        </button>
                        <span className={styles.currentTitle}>{currentPost || 'Welcome to Editor'}</span>
                        <span className={styles.status}>{status}</span>
                    </div>
                    <div className={styles.topBarRight}>
                        {currentPost && (
                            <>
                                <select
                                    className={styles.viewModeSelect}
                                    value={viewMode}
                                    onChange={(e) => setViewMode(e.target.value as 'source' | 'preview' | 'both' | 'live')}
                                >
                                    <option value="source">Source Mode</option>
                                    <option value="preview">Preview Mode</option>
                                    <option value="both">Both Mode</option>
                                    <option value="live">Live Mode</option>
                                </select>
                                <button className={styles.saveBtn} onClick={savePost}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Save size={16} /> Save
                                    </span>
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Toolbar */}
                {currentPost && (
                    <div className={styles.toolbar}>
                        <button className={styles.toolBtn} onClick={() => formatText('bold')} title="Bold">
                            <Bold size={18} />
                        </button>
                        <button className={styles.toolBtn} onClick={() => formatText('italic')} title="Italic">
                            <Italic size={18} />
                        </button>
                        <button className={styles.toolBtn} onClick={() => formatText('h1')} title="Heading 1">
                            <Heading1 size={18} />
                        </button>
                        <button className={styles.toolBtn} onClick={() => formatText('h2')} title="Heading 2">
                            <Heading2 size={18} />
                        </button>
                        <div className={styles.toolSeparator} />
                        <button className={styles.toolBtn} onClick={() => formatText('list')} title="List">
                            <List size={18} />
                        </button>
                        <button className={styles.toolBtn} onClick={() => formatText('quote')} title="Quote">
                            <Quote size={18} />
                        </button>
                        <button className={styles.toolBtn} onClick={() => formatText('code')} title="Code Block">
                            <Code size={18} />
                        </button>
                        <div className={styles.toolSeparator} />
                        <button className={styles.toolBtn} onClick={() => formatText('link')} title="Link">
                            <LinkIcon size={18} />
                        </button>
                        <label className={styles.toolBtn} title="Upload Image">
                            <ImageIcon size={18} />
                            <input type="file" className="hidden" onChange={handleImageUpload} accept="image/*" style={{ display: 'none' }} />
                        </label>
                    </div>
                )}

                {/* Editor Workspace */}
                <div className={styles.workspace}>
                    {currentPost ? (
                        <>
                            <div
                                className={`${styles.pane} ${styles.editorPane}`}
                                style={{
                                    display: (viewMode === 'preview' || viewMode === 'live') ? 'none' : 'flex',
                                    borderRight: viewMode === 'both' ? '1px solid #e9ecef' : 'none'
                                }}
                            >
                                <textarea
                                    ref={textareaRef}
                                    className={styles.textarea}
                                    value={content}
                                    onChange={e => setContent(e.target.value)}
                                    placeholder="Start writing..."
                                />
                            </div>
                            <div
                                className={`${styles.pane} ${styles.previewPane}`}
                                style={{
                                    display: (viewMode === 'source' || viewMode === 'live') ? 'none' : 'flex'
                                }}
                            >
                                <div className={`${styles.previewContent} prose max-w-none`}>
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        urlTransform={(url) => {
                                            if (url.startsWith('./img/') && currentPost) {
                                                return `/api/image_preview?slug=${currentPost}&file=${url.replace('./img/', '')}`
                                            }
                                            return url
                                        }}
                                        components={{
                                            pre: ({ children }: any) => <>{children}</>,
                                            code({ node, inline, className, children, ...props }: any) {
                                                const match = /language-(\w+)/.exec(className || '')
                                                const codeContent = String(children).replace(/\n$/, '')
                                                if (!inline) {
                                                    return (
                                                        <CodeBlock language={match ? match[1] : 'text'} value={codeContent}>
                                                            <SyntaxHighlighter
                                                                style={vscDarkPlus}
                                                                language={match ? match[1] : 'text'}
                                                                PreTag="div"
                                                                {...props}
                                                            >
                                                                {codeContent}
                                                            </SyntaxHighlighter>
                                                        </CodeBlock>
                                                    )
                                                }
                                                return (
                                                    <code className={className} {...props}>
                                                        {children}
                                                    </code>
                                                )
                                            },
                                            h1: ({ children }) => <h1 id={generateSlug(String(children))}>{children}</h1>,
                                            h2: ({ children }) => <h2 id={generateSlug(String(children))}>{children}</h2>,
                                            h3: ({ children }) => <h3 id={generateSlug(String(children))}>{children}</h3>
                                        }}
                                    >
                                        {content}
                                    </ReactMarkdown>
                                </div>
                            </div>

                            {/* Live Mode Editor */}
                            <div
                                className={`${styles.pane} ${styles.livePane}`}
                                style={{ display: viewMode === 'live' ? 'block' : 'none' }}
                            >
                                <div className={styles.liveEditorContainer}>
                                    <LiveEditor
                                        value={content}
                                        onValueChange={code => setContent(code)}
                                        highlight={code => Prism.highlight(code, Prism.languages.markdown, 'markdown')}
                                        padding={30}
                                        className={styles.liveEditor}
                                        textareaClassName={styles.liveEditorTextarea}
                                        style={{
                                            fontFamily: '"Fira Code", "Fira Mono", monospace',
                                            fontSize: 16,
                                            backgroundColor: '#ffffff',
                                            minHeight: '100%'
                                        }}
                                    />
                                </div>
                            </div>

                            {/* TOC Sidebar */}
                            <div className={styles.tocSidebar} style={{ width: tocWidth }}>
                                <div className={styles.resizer} onMouseDown={startResizing} />
                                <div className={styles.tocHeader}>
                                    <List size={18} />
                                    <span>Outline</span>
                                </div>
                                <div className={styles.tocList}>
                                    {toc.map((item, index) => (
                                        <a
                                            key={index}
                                            className={`${styles.tocItem} ${styles['h' + item.level]}`}
                                            onClick={() => scrollToHeader(item.id)}
                                        >
                                            {item.text}
                                        </a>
                                    ))}
                                    {toc.length === 0 && (
                                        <div style={{ padding: '1rem', color: '#999', fontSize: '0.9rem' }}>
                                            No headers found
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className={styles.emptyState}>
                            <FileText size={48} />
                            <p>Select a file from the sidebar to edit</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

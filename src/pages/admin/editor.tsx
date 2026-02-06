import React, { useState, useEffect, useCallback, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import Head from 'next/head'
import { useRouter } from 'next/router'
import styles from '../../styles/Editor.module.css'
import {
    Bold, Italic, Heading1, Heading2, List, ListOrdered,
    Quote, Link as LinkIcon, Image as ImageIcon, Code, Strikethrough, Braces,
    FileText, Menu, ChevronLeft, ChevronRight, ChevronDown, Save, Plus, Copy, X, ArrowLeft, Folder, FolderOpen,
    Trash, Recycle
} from 'lucide-react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism'
import CodeMirrorEditor, { toggleWrapper, insertTextAtCursor } from '@/components/CodeMirrorEditor';
import { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { EditorView } from '@codemirror/view';
import rehypeRaw from 'rehype-raw'; // Support HTML in markdown
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

import { YouTubeEmbed, getYouTubeId } from '@/components/YouTubeEmbed';
import { LinkPreview } from '@/components/LinkPreview';
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

// Toast Component
function Toast({ message }: { message: string }) {
    if (!message) return null;
    return <div className={styles.toast}>{message}</div>;
}

// CodeBlock Helper Component
function CodeBlock({ language, value }: { language: string, value: string }) {
    const [copied, setCopied] = useState(false);
    const [selectedLine, setSelectedLine] = useState<number | null>(null);

    const handleCopy = () => {
        navigator.clipboard.writeText(value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Copied to clipboard' }));
        });
    }

    const codeRef = useRef<HTMLDivElement>(null);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
            e.preventDefault();
            const selection = window.getSelection();
            if (codeRef.current && selection) {
                const range = document.createRange();
                range.selectNodeContents(codeRef.current);
                selection.removeAllRanges();
                selection.addRange(range);
            }
        }
    };

    return (
        <div
            className={styles.codeBlockWrapper}
            tabIndex={0}
            onKeyDown={handleKeyDown}
            style={{ outline: 'none' }} // Avoid default outline, keydown handles selection
        >
            {!copied ? (
                <div className={styles.codeBlockHeader}>{language}</div>
            ) : null}
            <button className={styles.copyBtn} onClick={handleCopy} title="Copy code">
                {copied ? <div style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>✓</div> : <Copy size={16} />}
            </button>
            <div ref={codeRef} style={{ width: '100%' }}>
                <SyntaxHighlighter
                    style={vscDarkPlus}
                    language={language}
                    PreTag="div"
                    wrapLines={true}
                    wrapLongLines={true}
                    showLineNumbers={true}
                    lineNumberStyle={{ minWidth: '2.5em', paddingRight: '1em', color: '#6e7681', textAlign: 'right', userSelect: 'none' }} // Prevent selecting line numbers
                    customStyle={{ userSelect: 'text', margin: 0, borderRadius: 0 }} // Ensure code text is selectable
                    lineProps={(lineNumber: number) => {
                        const isSelected = selectedLine === lineNumber;
                        return {
                            style: { display: 'block' }, // Removed cursor: pointer to act like text
                            className: isSelected ? `${styles.codeLine} ${styles.codeLineClicked}` : styles.codeLine,
                            onClick: () => setSelectedLine(isSelected ? null : lineNumber)
                        } as React.HTMLAttributes<HTMLElement>;
                    }}
                >
                    {value}
                </SyntaxHighlighter>
            </div>
        </div>
    )
}

// function to generate slug from text
const generateSlug = (text: string) => {
    return text
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        // Allow alphanumeric, Korean (Hangul syllables, Jamo), hyphens. Remove others.
        .replace(/[^\w\-\uAC00-\uD7A3]+/g, '');
};

// Helper to safely extract text from ReactNode for ID generation
const extractText = (node: any): string => {
    if (typeof node === 'string') return node;
    if (typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(extractText).join('');
    if (node && typeof node === 'object' && 'props' in node) return extractText(node.props.children);
    return '';
};

// Tree Node Type (Updated)
type FileNode = {
    name: string
    type: 'file' | 'directory'
    slug?: string
    path: string
    children?: FileNode[]
}

// Recursive Tree Item Component
const FileTreeItem = ({
    node,
    level,
    onLoadPost,
    currentPost,
    selectedPaths,
    onSelect,
    onContextMenu,
    onDragStart,
    onDragOver,
    onDrop,
    onDragLeave
}: {
    node: FileNode,
    level: number,
    onLoadPost: (slug: string) => void,
    currentPost: string | null,
    selectedPaths: Set<string>,
    onSelect: (node: FileNode, multi: boolean, listSelect: boolean) => void,
    onContextMenu: (e: React.MouseEvent, node: FileNode) => void,
    onDragStart: (e: React.DragEvent, node: FileNode) => void,
    onDragOver: (e: React.DragEvent, node: FileNode) => void,
    onDrop: (e: React.DragEvent, node: FileNode) => void,
    onDragLeave: (e: React.DragEvent) => void
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [dragState, setDragState] = useState<'none' | 'top' | 'bottom' | 'inside'>('none');

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent bubbling to parent items
        const isMulti = e.metaKey || e.ctrlKey;
        const isListSelect = e.shiftKey;

        // Call select handler
        onSelect(node, isMulti, isListSelect);

        if (node.type === 'directory') {
            setIsOpen(!isOpen);
        } else if (node.slug) {
            // Only load post if standard click (not multi-select operation)
            // But usually we want to see what we click.
            // Let's load only if single click without modifiers?
            if (!isMulti && !isListSelect) onLoadPost(node.slug);
        }
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onDragOver(e, node);

        const rect = e.currentTarget.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const height = rect.height;

        if (node.type === 'directory') {
            if (y < height * 0.25) setDragState('top');
            else if (y > height * 0.75) setDragState('bottom');
            else setDragState('inside');
        } else {
            if (y < height * 0.5) setDragState('top');
            else setDragState('bottom');
        }
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragState('none');
        onDragLeave(e);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragState('none');
        onDrop(e, node);
    };

    const isActive = node.slug === currentPost;
    const isSelected = selectedPaths.has(node.path);

    let borderStyle = {};
    if (dragState === 'top') borderStyle = { borderTop: '2px solid #42b883' };
    if (dragState === 'bottom') borderStyle = { borderBottom: '2px solid #42b883' };
    if (dragState === 'inside') borderStyle = { backgroundColor: 'rgba(66, 184, 131, 0.2)' };

    return (
        <div>
            <div
                draggable
                onDragStart={(e) => onDragStart(e, node)}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={styles.postItem}
                style={{
                    paddingLeft: `${1 + level * 0.8}rem`,
                    backgroundColor: dragState !== 'none' ? (dragState === 'inside' ? 'rgba(66, 184, 131, 0.2)' : 'transparent') :
                        (isSelected ? 'rgba(66, 184, 131, 0.3)' : (isActive ? 'rgba(66, 184, 131, 0.1)' : 'transparent')),
                    color: (isActive || isSelected) ? '#42b883' : 'inherit',
                    transition: 'all 0.1s',
                    ...borderStyle
                }}
                onClick={handleClick}
                onContextMenu={(e) => onContextMenu(e, node)}
            >
                {node.type === 'directory' ? (
                    <>
                        <span style={{ marginRight: 4, transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block', transition: 'transform 0.2s' }}>▶</span>
                        {isOpen ? <FolderOpen size={16} style={{ opacity: 0.7 }} /> : <Folder size={16} style={{ opacity: 0.7 }} />}
                    </>
                ) : (
                    <FileText size={16} />
                )}
                <span style={{ marginLeft: 8 }}>{node.name}</span>
            </div>
            {node.type === 'directory' && isOpen && node.children && (
                <div>
                    {node.children.map((child, i) => (
                        <FileTreeItem
                            key={i}
                            node={child}
                            level={level + 1}
                            onLoadPost={onLoadPost}
                            currentPost={currentPost}
                            selectedPaths={selectedPaths}
                            onSelect={onSelect}
                            onContextMenu={onContextMenu}
                            onDragStart={onDragStart}
                            onDragOver={onDragOver}
                            onDrop={onDrop}
                            onDragLeave={onDragLeave}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

// Modal Component
function Modal({ isOpen, type, title, message, defaultValue, onClose }: {
    isOpen: boolean,
    type: 'prompt' | 'confirm' | 'alert',
    title: string,
    message?: string,
    defaultValue?: string,
    onClose: (val: any) => void
}) {
    const [inputValue, setInputValue] = useState(defaultValue || '');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setInputValue(defaultValue || '');
            if (type === 'prompt') {
                setTimeout(() => inputRef.current?.focus(), 100);
            }
        }
    }, [isOpen, defaultValue, type]);

    const handleConfirm = () => {
        if (type === 'prompt') onClose(inputValue);
        else if (type === 'confirm') onClose(true);
        else onClose(null);
    }

    const handleCancel = () => {
        if (type === 'prompt') onClose(null);
        else if (type === 'confirm') onClose(false);
        else onClose(null);
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleConfirm();
        if (e.key === 'Escape') handleCancel();
    };

    if (!isOpen) return null;

    return (
        <div className={styles.modalOverlay} onMouseDown={handleCancel}>
            <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    {type === 'alert' && <span style={{ color: '#42b883' }}>ℹ</span>}
                    {type === 'confirm' && <span style={{ color: '#eab308' }}>?</span>}
                    {type === 'prompt' && <span style={{ color: '#42b883' }}>✎</span>}
                    {title}
                </div>
                <div className={styles.modalBody}>
                    {message && <p style={{ fontSize: '0.95rem', color: '#555', lineHeight: '1.5' }}>{message}</p>}
                    {type === 'prompt' && (
                        <div>

                            <input
                                ref={inputRef}
                                className={styles.modalInput}
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Enter value..."
                            />
                        </div>
                    )}
                </div>
                <div className={styles.modalFooter}>
                    {type !== 'alert' && (
                        <button className={`${styles.modalBtn} ${styles.modalBtnSecondary}`} onClick={handleCancel}>
                            Cancel
                        </button>
                    )}
                    <button
                        className={`${styles.modalBtn} ${type === 'confirm' && message?.includes('delete') ? styles.modalBtnDanger : styles.modalBtnPrimary}`}
                        onClick={handleConfirm}
                    >
                        {type === 'alert' ? 'OK' : (type === 'confirm' ? 'Confirm' : 'Submit')}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function Editor() {
    const router = useRouter()
    const { open } = router.query

    // --- State Declarations ---
    const [posts, setPosts] = useState<FileNode[]>([])
    const [currentPost, setCurrentPost] = useState<string | null>(null)
    const [content, setContent] = useState('')
    const [debouncedContent, setDebouncedContent] = useState('')
    const [initialContent, setInitialContent] = useState('')
    const [editorValue, setEditorValue] = useState('') // Separate state for editor default value

    const [status, setStatus] = useState('')
    const [isSidebarOpen, setSidebarOpen] = useState(true)
    const [toastMsg, setToastMsg] = useState('')
    const [viewMode, setViewMode] = useState<'source' | 'preview' | 'both' | 'live'>('both')
    const [isDuplicating, setIsDuplicating] = useState(false);
    const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());

    // --- Modal State ---
    const [modalConfig, setModalConfig] = useState<{
        isOpen: boolean;
        type: 'prompt' | 'confirm' | 'alert';
        title: string;
        message?: string;
        defaultValue?: string;
        resolve?: (value: any) => void;
    }>({ isOpen: false, type: 'alert', title: '' });

    const showPrompt = useCallback((title: string, defaultValue: string = ''): Promise<string | null> => {
        return new Promise((resolve) => {
            setModalConfig({ isOpen: true, type: 'prompt', title, defaultValue, resolve });
        });
    }, []);

    const showConfirm = useCallback((message: string): Promise<boolean> => {
        return new Promise((resolve) => {
            setModalConfig({ isOpen: true, type: 'confirm', title: 'Confirm Action', message, resolve });
        });
    }, []);

    const showAlert = useCallback((message: string): Promise<void> => {
        return new Promise((resolve) => {
            setModalConfig({ isOpen: true, type: 'alert', title: 'System Message', message, resolve: () => resolve() });
        });
    }, []);

    const handleModalClose = (value: any) => {
        if (modalConfig.resolve) {
            modalConfig.resolve(value);
        }
        setModalConfig(prev => ({ ...prev, isOpen: false }));
    };

    // Layout States
    const [tocWidth, setTocWidth] = useState(250);
    const [isResizing, setIsResizing] = useState(false);
    const [sidebarWidth, setSidebarWidth] = useState(260);
    const [isSidebarResizing, setIsSidebarResizing] = useState(false);
    const [editorRatio, setEditorRatio] = useState(0.5);
    const [isPaneResizing, setIsPaneResizing] = useState(false);

    // TOC States
    const [toc, setToc] = useState<{ id: string, text: string, level: number }[]>([]);
    const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
    const [tocInitialized, setTocInitialized] = useState(false);
    const [activeHeaderId, setActiveHeaderId] = useState<string | null>(null);

    // Drag & Drop / Context Menu States
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, node: FileNode } | null>(null);
    const [draggedNode, setDraggedNode] = useState<FileNode | null>(null);
    const [draggedHeaderIndex, setDraggedHeaderIndex] = useState<number | null>(null);
    const [dragOverHeaderIndex, setDragOverHeaderIndex] = useState<number | null>(null);
    const [dragHeaderPosition, setDragHeaderPosition] = useState<'top' | 'bottom' | null>(null);

    // --- Refs ---
    const contentRef = useRef('')
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
    const editorViewRef = useRef<ReactCodeMirrorRef>(null);
    const currentPostRef = useRef(currentPost);

    const scrollToHeader = useCallback((id: string) => {
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
    }, []);

    // --- Effects ---
    useEffect(() => {
        currentPostRef.current = currentPost;
    }, [currentPost]);

    // Restore cursor position from localStorage after load/reload
    useEffect(() => {
        if (!currentPost || !editorValue) return;

        const timer = setTimeout(() => {
            const savedPos = localStorage.getItem(`cursor-${currentPost}`);
            if (savedPos && editorViewRef.current?.view) {
                const pos = parseInt(savedPos, 10);
                const view = editorViewRef.current.view;
                if (pos <= view.state.doc.length) {
                    // Set selection first
                    view.dispatch({
                        selection: { anchor: pos, head: pos }
                    });

                    // Force scroll to center after a short delay to ensure layout is ready
                    setTimeout(() => {
                        view.dispatch({
                            effects: EditorView.scrollIntoView(pos, { y: 'center' })
                        });
                        view.focus();
                    }, 50);
                }
            }
        }, 300); // Wait for CodeMirror to initialize
        return () => clearTimeout(timer);
    }, [currentPost, editorValue]);

    useEffect(() => {
        fetchPosts()
    }, [])

    useEffect(() => {
        if (open && typeof open === 'string') {
            if (open !== currentPost) {
                loadPost(open)
            }
        }
    }, [open, currentPost])

    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    useEffect(() => {
        const handleToast = (e: any) => {
            setToastMsg(e.detail);
            setTimeout(() => setToastMsg(''), 2000);
        };
        window.addEventListener('show-toast', handleToast);
        return () => window.removeEventListener('show-toast', handleToast);
    }, []);

    // Initial TOC Collapse Logic
    useEffect(() => {
        if (toc.length > 0 && !tocInitialized) {
            const nonTitleHeaders = toc.filter(h => h.level > 1);
            if (nonTitleHeaders.length === 0) return;

            const newCollapsed = new Set<string>();
            nonTitleHeaders.forEach(h => {
                newCollapsed.add(h.id);
            });

            setCollapsedIds(newCollapsed);
            setTocInitialized(true);
        }
    }, [toc, tocInitialized]);

    // --- Handlers ---

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

    const loadPost = async (slug: string) => {
        setStatus('Loading...')
        const res = await fetch(`/api/post?slug=${slug}&t=${Date.now()}`)
        if (res.ok) {
            const data = await res.json()
            setContent(data.content)
            setDebouncedContent(data.content)
            contentRef.current = data.content
            setInitialContent(data.content)
            setEditorValue(data.content) // Set editorValue only once on load
            setCurrentPost(slug)
            setStatus('')
        }
    }

    const handleContentChange = useCallback((val: string) => {
        contentRef.current = val;

        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
            setContent(val);
            setDebouncedContent(val);
        }, 150);
    }, []);

    // Extract headers
    useEffect(() => {
        const lines = debouncedContent.split('\n');
        const headers: { id: string, text: string, level: number }[] = [];
        let inCodeBlock = false;

        lines.forEach(line => {
            if (line.trim().startsWith('```')) {
                inCodeBlock = !inCodeBlock;
            }
            if (inCodeBlock) return;

            const match = line.match(/^(#{1,6})\s+(.+)$/);
            if (match) {
                const level = match[1].length;
                const text = match[2];
                const id = generateSlug(text);
                headers.push({ id, text, level });
            }
        });
        setToc(prev => {
            if (JSON.stringify(prev) === JSON.stringify(headers)) return prev;
            return headers;
        });
    }, [debouncedContent]);

    const updateActiveHeaderFromSelection = useCallback(() => {
        const editor = editorViewRef.current;
        if (!editor || !editor.view) return;

        const state = editor.view.state;
        const cursor = state.selection.main.head;
        const doc = state.doc;

        const lineBlock = doc.lineAt(cursor);
        let currentLineNum = lineBlock.number;

        for (let i = currentLineNum; i >= 1; i--) {
            const line = doc.line(i);
            const text = line.text;
            const match = text.match(/^(#{1,6})\s+(.+)$/);
            if (match) {
                const headerText = match[2];
                setActiveHeaderId(generateSlug(headerText));
                return;
            }
        }
        setActiveHeaderId(null);
    }, []);

    const processFileUpload = useCallback(async (file: File, view?: EditorView) => {
        const slug = currentPostRef.current;
        if (!slug) return;

        const formData = new FormData();
        formData.append('file', file);
        setStatus('Uploading...');

        try {
            const res = await fetch(`/api/upload?slug=${slug}`, {
                method: 'POST',
                body: formData
            });

            if (res.ok) {
                const { filename } = await res.json();
                const docName = slug.split('/').pop()?.replace(/\.(md|mdx)$/, '') || '';
                const imagePath = (slug === 'home' || !docName) ? `./img/${filename}` : `./img/${docName}/${filename}`;

                if (view) {
                    insertTextAtCursor(view, `![](${imagePath})`);
                } else {
                    // fallback if needed
                }

                setStatus('Image uploaded');
                window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Image uploaded successfully' }));
            } else {
                setStatus('Upload failed');
                window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Upload failed' }));
            }
        } catch (e) {
            console.error(e);
            setStatus('Upload failed');
        }
    }, []);

    const cleanUnusedImages = async () => {
        if (!currentPost) return;
        if (!confirm('Are you sure you want to delete unused images for this post?\nThis action cannot be undone.')) return;

        setStatus('Cleaning...');
        try {
            const res = await fetch(`/api/cleanup-images?slug=${currentPost}`, {
                method: 'POST'
            });

            if (res.ok) {
                const data = await res.json();
                setStatus('Cleaned');
                window.dispatchEvent(new CustomEvent('show-toast', { detail: `Deleted ${data.deletedCount} unused images` }));
            } else {
                throw new Error('Cleanup failed');
            }
        } catch (e) {
            console.error(e);
            setStatus('Error cleaning');
            window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Cleanup failed' }));
        }
        setTimeout(() => setStatus(''), 2000);
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !e.target.files[0]) return;
        processFileUpload(e.target.files[0]);
        e.target.value = '';
    }

    const savePost = useCallback(async () => {
        if (!currentPost) return
        setStatus('Saving...')

        const editor = editorViewRef.current?.view;
        let savedSelection: any = null;
        if (editor) {
            savedSelection = editor.state.selection;
            // Save to localStorage for persistence across reloads
            const cursorPos = savedSelection.main.head;
            localStorage.setItem(`cursor-${currentPost}`, cursorPos.toString());
        }

        const latestContent = editor?.state.doc.toString() ?? contentRef.current ?? content;

        const res = await fetch(`/api/post?slug=${currentPost}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: latestContent })
        })
        if (res.ok) {
            setStatus('Saved')
            // Sync initialContent to mark as clean. 
            // DO NOT update editorValue here to prevent re-initialization of CodeMirror.
            setInitialContent(latestContent);
            contentRef.current = latestContent;

            if (savedSelection) {
                // Restore cursor - although with stable 'value' prop, this might be less critical, 
                // but good for safety if React does re-render.
                setTimeout(() => {
                    const currentEditor = editorViewRef.current?.view;
                    if (currentEditor) {
                        currentEditor.focus();
                        currentEditor.dispatch({
                            selection: savedSelection
                        });
                    }
                }, 10);
            }

            setTimeout(() => setStatus(''), 2000)
            window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Saved successfully' }))
        } else {
            setStatus('Error saving')
        }
    }, [currentPost, content]);

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

    const insertText = (textToInsert: string) => {
        if (!editorViewRef.current?.view) return;
        insertTextAtCursor(editorViewRef.current.view, textToInsert);
    }

    const formatText = (type: string) => {
        const view = editorViewRef.current?.view;
        if (!view) return;

        switch (type) {
            case 'bold': toggleWrapper(view, "**"); break;
            case 'italic': toggleWrapper(view, "*"); break;
            case 'strikethrough': toggleWrapper(view, "~~"); break;
            case 'inline-code': toggleWrapper(view, "`"); break;
            case 'h1': insertTextAtCursor(view, '# '); break;
            case 'h2': insertTextAtCursor(view, '## '); break;
            case 'quote': insertTextAtCursor(view, '> '); break;
            case 'code': insertTextAtCursor(view, '```\n\n```'); break;
            case 'link': insertTextAtCursor(view, '[link](url)'); break;
            case 'list': insertTextAtCursor(view, '- '); break;
        }
    }

    // --- Resizing Handlers ---
    const startResizing = useCallback((e: React.MouseEvent) => { e.preventDefault(); setIsResizing(true); }, []);
    const stopResizing = useCallback(() => { setIsResizing(false); }, []);
    const resize = useCallback((e: MouseEvent) => {
        if (isResizing) {
            const newWidth = document.body.clientWidth - e.clientX;
            if (newWidth > 150 && newWidth < 600) setTocWidth(newWidth);
        }
    }, [isResizing]);

    const startSidebarResizing = useCallback((e: React.MouseEvent) => { e.preventDefault(); setIsSidebarResizing(true); }, []);
    const stopSidebarResizing = useCallback(() => { setIsSidebarResizing(false); }, []);
    const resizeSidebar = useCallback((e: MouseEvent) => {
        if (isSidebarResizing) {
            const newWidth = e.clientX;
            if (newWidth > 150 && newWidth < 600) setSidebarWidth(newWidth);
        }
    }, [isSidebarResizing]);

    const startPaneResizing = useCallback((e: React.MouseEvent) => { e.preventDefault(); setIsPaneResizing(true); }, []);
    const stopPaneResizing = useCallback(() => { setIsPaneResizing(false); }, []);
    const resizePane = useCallback((e: MouseEvent) => {
        if (isPaneResizing) {
            const workspace = document.getElementById('workspace-container');
            if (workspace) {
                const rect = workspace.getBoundingClientRect();
                const relativeX = e.clientX - rect.left;
                const newRatio = relativeX / rect.width;
                if (newRatio > 0.2 && newRatio < 0.8) setEditorRatio(newRatio);
            }
        }
    }, [isPaneResizing]);

    useEffect(() => {
        window.addEventListener("mousemove", resize);
        window.addEventListener("mouseup", stopResizing);
        window.addEventListener("mousemove", resizeSidebar);
        window.addEventListener("mouseup", stopSidebarResizing);
        window.addEventListener("mousemove", resizePane);
        window.addEventListener("mouseup", stopPaneResizing);
        return () => {
            window.removeEventListener("mousemove", resize);
            window.removeEventListener("mouseup", stopResizing);
            window.removeEventListener("mousemove", resizeSidebar);
            window.removeEventListener("mouseup", stopSidebarResizing);
            window.removeEventListener("mousemove", resizePane);
            window.removeEventListener("mouseup", stopPaneResizing);
        };
    }, [resize, stopResizing, resizeSidebar, stopSidebarResizing, resizePane, stopPaneResizing]);


    // --- File System Handlers ---
    const handleNodeSelect = (node: FileNode, multi: boolean, listSelect: boolean) => {
        setSelectedPaths(prev => {
            const next = new Set(multi ? prev : []);
            if (multi) {
                if (next.has(node.path)) next.delete(node.path);
                else next.add(node.path);
            } else {
                next.add(node.path);
            }
            return next;
        });
    };

    const handleNodeDragStart = (e: React.DragEvent, node: FileNode) => {
        setDraggedNode(node);
        e.dataTransfer.setData('text/plain', node.path);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleNodeDragOver = (e: React.DragEvent, node: FileNode) => {
        e.preventDefault();
        if (draggedNode && (draggedNode.path === node.path || node.path.startsWith(draggedNode.path + '/'))) {
            e.dataTransfer.dropEffect = 'none';
        } else {
            e.dataTransfer.dropEffect = 'move';
        }
    };

    const handleNodeDrop = async (e: React.DragEvent, targetNode: FileNode) => {
        e.preventDefault();
        if (!draggedNode) return;

        const targets = selectedPaths.has(draggedNode.path)
            ? Array.from(selectedPaths).map(p => ({ path: p, name: p.split('/').pop() || '', type: 'file' } as FileNode))
            : [draggedNode];

        // Filter invalid targets (self or moving parent into child)
        const validTargets = targets.filter(t => t.path !== targetNode.path && !targetNode.path.startsWith(t.path + '/'));
        if (validTargets.length === 0) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const height = rect.height;
        let position: 'before' | 'after' | 'inside' = 'inside';

        if (targetNode.type === 'directory') {
            if (y < height * 0.25) position = 'before';
            else if (y > height * 0.75) position = 'after';
            else position = 'inside';
        } else {
            if (y < height * 0.5) position = 'before';
            else position = 'after';
        }

        if (position === 'inside') {
            for (const t of validTargets) {
                await moveNode(t, targetNode.path);
            }
        } else {
            const parts = targetNode.path.split('/');
            parts.pop();
            const parentPath = parts.join('/');

            for (const t of validTargets) {
                const tParts = t.path.split('/');
                tParts.pop();
                const tParent = tParts.join('/');

                if (parentPath === tParent) {
                    await reorderNode(t, targetNode, parentPath, position);
                } else {
                    const moveSuccess = await moveNode(t, parentPath || '/');
                    if (moveSuccess) {
                        const updatedNode = { ...t, path: parentPath ? `${parentPath}/${t.name}` : t.name };
                        await reorderNode(updatedNode, targetNode, parentPath, position);
                    }
                }
            }
        }
        setSelectedPaths(new Set());
    };

    const moveNode = async (node: FileNode, newParentPath: string) => {
        const parentPath = newParentPath === '/' ? '' : newParentPath;
        const newPath = parentPath ? `${parentPath}/${node.name}` : node.name;
        if (node.path === newPath) return false;

        try {
            const res = await fetch('/api/fs', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ oldPath: node.path, newPath })
            });
            if (!res.ok) throw new Error('Failed to move file');

            const oldParts = node.path.split('/');
            oldParts.pop();
            const oldParent = oldParts.join('/');
            const key = node.name.replace(/\.(md|mdx)$/, '');

            await fetch('/api/meta', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folderPath: oldParent || '/', key })
            });
            const oldMeta = oldParent ? `${oldParent}/_meta.json` : '_meta.json';
            if (currentPost === oldMeta || currentPost === `/${oldMeta}`) setTimeout(() => loadPost(oldMeta), 300);

            await fetch('/api/meta', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: parentPath, key, title: key })
            });
            const newMeta = parentPath ? `${parentPath}/_meta.json` : '_meta.json';
            if (currentPost === newMeta || currentPost === `/${newMeta}`) setTimeout(() => loadPost(newMeta), 300);

            window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Moved successfully' }));
            await fetchPosts();
            return true;
        } catch (e: any) {
            console.error(e);
            window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Move failed: ' + e.message }));
            return false;
        }
    };

    const reorderNode = async (movedNode: FileNode, targetNode: FileNode, parentPath: string, position: 'before' | 'after') => {
        try {
            const findChildren = (nodes: FileNode[], path: string): FileNode[] => {
                if (path === '') return nodes;
                for (const n of nodes) {
                    if (n.path === path && n.children) return n.children;
                    if (n.children) {
                        const found = findChildren(n.children, path);
                        if (found.length > 0) return found;
                    }
                }
                return [];
            };

            const siblings = findChildren(posts, parentPath);
            if (!siblings.length) return;

            const getKey = (n: FileNode) => n.name.replace(/\.(md|mdx|json)$/, '');
            let keys = siblings.map(getKey).filter(k => k !== '_meta');
            const movedKey = getKey(movedNode);
            const targetKey = getKey(targetNode);

            keys = keys.filter(k => k !== movedKey);
            const targetIndex = keys.indexOf(targetKey);
            if (targetIndex === -1) {
                keys.push(movedKey);
            } else {
                if (position === 'before') keys.splice(targetIndex, 0, movedKey);
                else keys.splice(targetIndex + 1, 0, movedKey);
            }

            const res = await fetch('/api/meta', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folderPath: parentPath || '/', order: keys })
            });
            if (!res.ok) throw new Error('Reorder failed');

            const metaPath = parentPath ? `${parentPath}/_meta.json` : '_meta.json';
            if (currentPost === metaPath || currentPost === `/${metaPath}`) setTimeout(() => loadPost(metaPath), 300);

            await fetchPosts();
        } catch (e: any) {
            console.error(e);
            window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Reorder failed' }));
        }
    };

    const handleNodeDragLeave = (_e: React.DragEvent) => { };

    // Context Menu & FS Actions
    const handleContextMenu = (e: React.MouseEvent, node: FileNode) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY, node });
    };

    const handleMetaAction = async () => {
        if (!contextMenu) return;
        const { node } = contextMenu;
        setContextMenu(null);

        const newTitle = await showPrompt('Enter new title for sidebar (updates _meta.json):');
        if (!newTitle) return;

        let key = node.name.replace(/\.(md|mdx)$/, '');
        const parts = node.path.split('/');
        parts.pop();
        const parentPath = parts.join('/');

        try {
            const res = await fetch('/api/meta', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: parentPath, key, title: newTitle })
            });
            if (!res.ok) throw new Error('Failed to update title');
            window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Title updated' }));

            const metaFile = parentPath ? `${parentPath}/_meta.json` : '_meta.json';
            if (currentPost === metaFile) loadPost(metaFile);
        } catch (e: any) {
            await showAlert(e.message);
        }
    }

    const handleFSAction = async (action: 'new_file' | 'new_folder' | 'rename' | 'delete' | 'duplicate') => {
        if (!contextMenu) return;
        const { node } = contextMenu;
        setContextMenu(null);

        const getParentDir = (n: FileNode) => {
            if (n.type === 'directory') return n.path;
            const parts = n.path.split('/');
            parts.pop();
            return parts.join('/');
        }
        const creationBase = node.type === 'directory' ? node.path : getParentDir(node);

        try {
            if (action === 'new_file') {
                let name = await showPrompt('Enter new file name (e.g. hello.md):');
                if (!name) return;
                if (!/\.(md|mdx)$/.test(name)) name += '.md';
                const path = creationBase ? `${creationBase}/${name}` : name;

                const res = await fetch('/api/fs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'file', path })
                });
                if (!res.ok) throw new Error('Failed to create file');

                try {
                    const key = name.replace(/\.(md|mdx)$/, '');
                    await fetch('/api/meta', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ path: creationBase || '', key, title: key })
                    });
                    const metaPath = creationBase ? `${creationBase}/_meta.json` : '_meta.json';
                    if (currentPost === metaPath || currentPost === `/${metaPath}`) setTimeout(() => loadPost(metaPath), 300);
                } catch { }

                fetchPosts();
                setTimeout(() => loadPost(path), 200);

            } else if (action === 'new_folder') {
                const name = await showPrompt('Enter new folder name:');
                if (!name) return;
                const path = creationBase ? `${creationBase}/${name}` : name;

                const res = await fetch('/api/fs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'directory', path })
                });
                if (!res.ok) throw new Error('Failed to create folder');

                try {
                    await fetch('/api/meta', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ path: creationBase || '', key: name, title: name })
                    });
                    const metaPath = creationBase ? `${creationBase}/_meta.json` : '_meta.json';
                    if (currentPost === metaPath || currentPost === `/${metaPath}`) setTimeout(() => loadPost(metaPath), 300);
                } catch { }

                fetchPosts();
            } else if (action === 'rename') {
                const newName = await showPrompt('Enter new name:', node.name);
                if (!newName || newName === node.name) return;
                const parts = node.path.split('/');
                parts.pop();
                const parent = parts.join('/');
                const newPath = parent ? `${parent}/${newName}` : newName;

                const res = await fetch('/api/fs', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ oldPath: node.path, newPath })
                });
                if (!res.ok) throw new Error('Failed to rename');

                try {
                    const getMetaKey = (name: string) => name.replace(/\.(md|mdx)$/, '');
                    await fetch('/api/meta', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ folderPath: parent, oldKey: getMetaKey(node.name), newKey: getMetaKey(newName) })
                    });
                    const metaPath = parent ? `${parent}/_meta.json` : '_meta.json';
                    if (currentPost === metaPath || currentPost === `/${metaPath}`) setTimeout(() => loadPost(metaPath), 300);
                } catch { }

                await fetchPosts();
                if (currentPost && (currentPost === node.path || currentPost.startsWith(node.path + '/'))) {
                    const suffix = currentPost.substring(node.path.length);
                    const newCurrentPost = newPath + suffix;
                    setCurrentPost(newCurrentPost);
                    router.replace({ query: { ...router.query, open: newCurrentPost } }, undefined, { shallow: true });
                    setTimeout(() => loadPost(newCurrentPost), 100);
                }

            } else if (action === 'delete') {
                const targetPaths = selectedPaths.has(node.path) ? Array.from(selectedPaths) : [node.path];
                const confirmed = await showConfirm(`Are you sure you want to delete ${targetPaths.length > 1 ? `${targetPaths.length} items` : node.name}?`);
                if (!confirmed) return;

                for (const p of targetPaths) {
                    try {
                        const res = await fetch('/api/fs', {
                            method: 'DELETE',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ path: p })
                        });
                        if (!res.ok) {
                            console.error(`Failed to delete ${p}`);
                            continue;
                        }

                        const parts = p.split('/');
                        const name = parts.pop() || '';
                        const parent = parts.join('/');

                        const key = name.replace(/\.(md|mdx)$/, '');
                        await fetch('/api/meta', {
                            method: 'DELETE',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ folderPath: parent, key })
                        });
                        const metaPath = parent ? `${parent}/_meta.json` : '_meta.json';
                        if (currentPost === metaPath || currentPost === `/${metaPath}`) setTimeout(() => loadPost(metaPath), 300);

                        const deletedPath = p.replace(/^\//, '');
                        const current = currentPost ? currentPost.replace(/^\//, '') : '';
                        if (current && (current === deletedPath || current.startsWith(deletedPath + '/'))) {
                            setCurrentPost('');
                            setEditorValue('');
                            setContent('');
                            router.push('/admin/editor', undefined, { shallow: true });
                        }
                    } catch (e) {
                        console.error(e);
                    }
                }

                await fetchPosts();
                setSelectedPaths(new Set()); // Clear selection
                // Check if current post is deleted? We might need to handle redirection if needed.
            } else if (action === 'duplicate') {
                setIsDuplicating(true);
                try {
                    const res = await fetch('/api/fs', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ type: 'duplicate', path: node.path })
                    });
                    if (!res.ok) throw new Error('Failed to duplicate');

                    const data = await res.json();

                    try {
                        const newKey = data.newName;
                        const parts = node.path.split('/');
                        parts.pop(); // remove file

                        const parent = parts.join('/');

                        await fetch('/api/meta', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ path: parent || '', key: newKey, title: newKey })
                        });
                        const metaPath = parent ? `${parent}/_meta.json` : '_meta.json';
                        if (currentPost === metaPath || currentPost === `/${metaPath}`) setTimeout(() => loadPost(metaPath), 300);
                    } catch { }

                    await fetchPosts();
                } finally {
                    setIsDuplicating(false);
                }
            }
        } catch (e: any) {
            await showAlert(e.message);
            setIsDuplicating(false);
        }
    }

    const handleHeaderDrop = (e: React.DragEvent, targetIndex: number) => {
        e.preventDefault();
        (e.currentTarget as HTMLElement).style.background = 'transparent';
        const sourceIndexStr = e.dataTransfer.getData('text/plain');
        if (!sourceIndexStr) return;

        const sourceIndex = parseInt(sourceIndexStr, 10);
        if (sourceIndex === targetIndex || isNaN(sourceIndex)) return;

        let adjustedTargetIndex = targetIndex;
        if (dragHeaderPosition === 'bottom') adjustedTargetIndex = targetIndex + 1;

        const headers = toc;

        // Use live editor content as source of truth to prevent stale state issues
        let currentContent = content;
        if (editorViewRef.current?.view) {
            currentContent = editorViewRef.current.view.state.doc.toString();
        } else {
            currentContent = contentRef.current || content;
        }

        const lines = currentContent.split('\n');
        const headerLineIndices: number[] = [];
        let headerCount = 0;
        let inCodeBlock = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.trim().startsWith('```')) inCodeBlock = !inCodeBlock;
            if (inCodeBlock) continue;
            if (line.match(/^(#{1,6})\s+(.+)$/)) {
                if (headerCount < headers.length) {
                    headerLineIndices.push(i);
                    headerCount++;
                }
            }
        }

        if (headerLineIndices.length !== headers.length) return;

        const sourceStartLine = headerLineIndices[sourceIndex];
        const sourceLevel = headers[sourceIndex].level;
        let sourceEndIndex = sourceIndex + 1;
        while (sourceEndIndex < headers.length && headers[sourceEndIndex].level > sourceLevel) {
            sourceEndIndex++;
        }
        const sourceEndLine = sourceEndIndex < headerLineIndices.length ? headerLineIndices[sourceEndIndex] : lines.length;
        const sourceBlock = lines.slice(sourceStartLine, sourceEndLine);

        const linesWithoutSource = [...lines.slice(0, sourceStartLine), ...lines.slice(sourceEndLine)];

        let insertAt = 0;
        if (adjustedTargetIndex >= headerLineIndices.length) {
            insertAt = linesWithoutSource.length;
        } else {
            const targetOriginalStart = headerLineIndices[adjustedTargetIndex];
            insertAt = targetOriginalStart;
            if (targetOriginalStart > sourceStartLine) insertAt -= (sourceEndLine - sourceStartLine);
        }

        linesWithoutSource.splice(insertAt, 0, ...sourceBlock);
        const newContent = linesWithoutSource.join('\n');

        // Sync CodeMirror Editor
        if (editorViewRef.current?.view) {
            const view = editorViewRef.current.view;
            view.dispatch({
                changes: { from: 0, to: view.state.doc.length, insert: newContent }
            });
        }

        contentRef.current = newContent;
        setContent(newContent);
        setDebouncedContent(newContent);
        setDraggedHeaderIndex(null);
        window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Section moved' }));
    };

    return (
        <div className={`${styles.container} ${inter.className}`}>
            <Head>
                <title>Editor - Green Nextra</title>
            </Head>

            <Toast message={toastMsg} />
            <Modal {...modalConfig} onClose={handleModalClose} />

            {/* Sidebar */}
            {isDuplicating && (
                <div className={styles.loadingOverlay}>
                    <div className={styles.spinner}></div>
                    <div className={styles.loadingText}>Duplicating...</div>
                </div>
            )}
            <div
                className={styles.sidebar}
                style={{
                    width: sidebarWidth,
                    marginLeft: isSidebarOpen ? 0 : -sidebarWidth,
                    position: 'relative',
                    transition: isSidebarResizing ? 'none' : 'margin-left 0.3s ease'
                }}
                onContextMenu={(e) => {
                    if (e.defaultPrevented) return;
                    handleContextMenu(e, { name: 'Root', type: 'directory', path: '' } as FileNode)
                }}
            >
                <div className={styles.resizer} style={{ left: 'auto', right: 0 }} onMouseDown={startSidebarResizing} />
                <div className={styles.sidebarHeader}>
                    <FileText size={20} />
                    <span>Explorer</span>
                </div>
                <div className={styles.postList}>
                    {posts.map((node, i) => (
                        <FileTreeItem
                            key={i}
                            node={node}
                            level={0}
                            onLoadPost={(slug) => router.push(`/admin/editor?open=${slug}`, undefined, { shallow: true })}
                            currentPost={currentPost}
                            selectedPaths={selectedPaths}
                            onSelect={handleNodeSelect}
                            onContextMenu={handleContextMenu}
                            onDragStart={handleNodeDragStart}
                            onDragOver={handleNodeDragOver}
                            onDrop={handleNodeDrop}
                            onDragLeave={handleNodeDragLeave}
                        />
                    ))}
                    <div style={{ flex: 1, minHeight: '50px' }} onContextMenu={(e) => handleContextMenu(e, { name: 'Root', type: 'directory', path: '' } as FileNode)} />
                </div>
            </div>

            {/* Context Menu */}
            {contextMenu && (
                <div className={styles.contextMenu} style={{ top: contextMenu.y, left: contextMenu.x }}>
                    <div className={styles.contextMenuHeader}>{contextMenu.node.name || 'Root'}</div>
                    <div className={styles.contextMenuItem} onClick={() => handleFSAction('new_file')}><FileText size={14} /> New File</div>
                    <div className={styles.contextMenuItem} onClick={() => handleFSAction('new_folder')}><Plus size={14} /> New Folder</div>
                    <div className={styles.contextMenuItem} onClick={() => handleFSAction('duplicate')}><Copy size={14} /> Duplicate File</div>
                    {contextMenu.node.path !== '' && (
                        <>
                            <div className={styles.contextMenuDivider} />
                            <div className={styles.contextMenuItem} onClick={() => handleFSAction('rename')}><FileText size={14} /> Rename</div>
                            <div className={styles.contextMenuItem} onClick={() => handleMetaAction()}><FileText size={14} /> Rename Title (_meta)</div>
                            <div className={styles.contextMenuItem} onClick={() => handleFSAction('delete')} style={{ color: '#e53e3e' }}>
                                <X size={14} />
                                Delete{selectedPaths.has(contextMenu.node.path) && selectedPaths.size > 1 ? ` (${selectedPaths.size})` : ''}
                            </div>
                        </>
                    )}
                </div>
            )}

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
                                    onChange={(e) => {
                                        setInitialContent(contentRef.current);
                                        setViewMode(e.target.value as 'source' | 'preview' | 'both' | 'live');
                                    }}
                                >
                                    <option value="both">Both Mode</option>
                                    <option value="live">Live Mode</option>
                                    <option value="preview">Preview Mode</option>
                                    <option value="source">Source Mode</option>
                                </select>
                                <button className={styles.cancelBtn} onClick={cleanUnusedImages} title="Remove unused image file">
                                    <Recycle size={18} />
                                </button>
                                <button className={styles.saveBtn} onClick={savePost}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Save size={16} /> Save</span>
                                </button>
                                <button className={styles.cancelBtn} onClick={async () => {
                                    if (!currentPost) return;
                                    if (initialContent !== content) {
                                        await fetch(`/api/post?slug=${currentPost}`, {
                                            method: 'PUT',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ content: initialContent })
                                        });
                                    } else {
                                        await fetch(`/api/post?slug=${currentPost}`, {
                                            method: 'PUT',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ content: initialContent })
                                        });
                                    }
                                    try {
                                        const res = await fetch(`/api/post?slug=${currentPost}`);
                                        if (res.status === 404) { router.push('/'); return; }
                                    } catch { router.push('/'); return; }

                                    if (currentPost.endsWith('.json')) {
                                        router.push('/');
                                    } else {
                                        const viewerPath = currentPost.replace(/\.(md|mdx)$/, '');
                                        router.push(viewerPath === 'home' || viewerPath === 'index' ? '/' : `/${viewerPath}`);
                                    }
                                }}>
                                    <ArrowLeft size={16} /> Back
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Toolbar */}
                {currentPost && (
                    <div className={styles.toolbar}>
                        <button className={styles.toolBtn} onClick={() => formatText('bold')}><Bold size={18} /></button>
                        <button className={styles.toolBtn} onClick={() => formatText('italic')}><Italic size={18} /></button>
                        <button className={styles.toolBtn} onClick={() => formatText('strikethrough')}><Strikethrough size={18} /></button>
                        <button className={styles.toolBtn} onClick={() => formatText('inline-code')}><Braces size={18} /></button>
                        <button className={styles.toolBtn} onClick={() => formatText('h1')}><Heading1 size={18} /></button>
                        <button className={styles.toolBtn} onClick={() => formatText('h2')}><Heading2 size={18} /></button>
                        <div className={styles.toolSeparator} />
                        <button className={styles.toolBtn} onClick={() => formatText('list')}><List size={18} /></button>
                        <button className={styles.toolBtn} onClick={() => formatText('quote')}><Quote size={18} /></button>
                        <button className={styles.toolBtn} onClick={() => formatText('code')}><Code size={18} /></button>
                        <div className={styles.toolSeparator} />
                        <button className={styles.toolBtn} onClick={() => formatText('link')}><LinkIcon size={18} /></button>
                        <label className={styles.toolBtn}>
                            <ImageIcon size={18} />
                            <input type="file" className="hidden" onChange={handleImageUpload} accept="image/*" style={{ display: 'none' }} />
                        </label>
                    </div>
                )}

                {/* Editor Workspace */}
                <div id="workspace-container" className={styles.workspace}>
                    {currentPost ? (
                        <>
                            <div className={`${styles.pane} ${styles.editorPane}`} style={{ display: (viewMode === 'preview' || viewMode === 'live') ? 'none' : 'flex', flex: viewMode === 'both' ? `${editorRatio}` : '1', borderRight: viewMode === 'both' ? 'none' : '1px solid #e9ecef' }}>
                                <div className={styles.liveEditorContainer} onKeyUp={updateActiveHeaderFromSelection} onClick={updateActiveHeaderFromSelection}>
                                    {viewMode !== 'live' && (
                                        <CodeMirrorEditor
                                            ref={editorViewRef}
                                            key={currentPost}
                                            value={editorValue} // Use stable editorValue!
                                            onChange={handleContentChange}
                                            onImageUpload={processFileUpload}
                                            className={styles.liveEditor}
                                        />
                                    )}
                                </div>
                            </div>

                            {viewMode === 'both' && (<div className={styles.paneResizer} onMouseDown={startPaneResizing} />)}

                            <div className={`${styles.pane} ${styles.previewPane}`} style={{ display: (viewMode === 'source' || viewMode === 'live') ? 'none' : 'flex', flex: viewMode === 'both' ? `${1 - editorRatio}` : '1' }}>
                                <div className={`${styles.previewContent} prose max-w-none`}>
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm, remarkMath]}
                                        rehypePlugins={[rehypeRaw, rehypeKatex]}
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
                                                if (!inline && match) return <CodeBlock language={match[1]} value={codeContent} />
                                                else if (!inline && codeContent.includes('\n')) return <CodeBlock language="text" value={codeContent} />
                                                return <code className={className} {...props}>{children}</code>
                                            },
                                            h1: ({ children }) => <h1 id={generateSlug(extractText(children))}>{children}</h1>,
                                            h2: ({ children }) => <h2 id={generateSlug(extractText(children))}>{children}</h2>,
                                            h3: ({ children }) => <h3 id={generateSlug(extractText(children))}>{children}</h3>,
                                            h4: ({ children }) => <h4 id={generateSlug(extractText(children))}>{children}</h4>,
                                            h5: ({ children }) => <h5 id={generateSlug(extractText(children))}>{children}</h5>,
                                            h6: ({ children }) => <h6 id={generateSlug(extractText(children))}>{children}</h6>,
                                            a: ({ href, children }: any) => {
                                                const url = href || '';
                                                const videoId = getYouTubeId(url);
                                                const linkText = Array.isArray(children) ? children.map(c => typeof c === 'string' ? c : '').join('') : String(children || '');
                                                const isRawLink = linkText.trim().includes(url.trim());
                                                if (videoId && isRawLink) return <><a href={url} target="_blank" rel="noopener noreferrer" style={{ color: '#42b883', textDecoration: 'underline' }}>{children}</a><YouTubeEmbed url={url} /></>;
                                                if (isRawLink && (url.startsWith('http') || url.startsWith('https'))) return <><a href={url} target="_blank" rel="noopener noreferrer" style={{ color: '#42b883', textDecoration: 'underline' }}>{children}</a><LinkPreview url={url} /></>;
                                                return <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: '#42b883', textDecoration: 'underline' }}>{children}</a>;
                                            }
                                        }}
                                    >
                                        {debouncedContent}
                                    </ReactMarkdown>
                                </div>
                            </div>

                            <div className={`${styles.pane} ${styles.livePane}`} style={{ display: viewMode === 'live' ? 'block' : 'none' }}>
                                <div className={styles.liveEditorContainer}>
                                    {viewMode === 'live' && (
                                        <CodeMirrorEditor
                                            ref={editorViewRef}
                                            key={currentPost}
                                            value={editorValue} // Use stable editorValue
                                            onChange={handleContentChange}
                                            onImageUpload={processFileUpload}
                                            className={styles.liveEditor}
                                        />
                                    )}
                                </div>
                            </div>

                            <div className={styles.tocSidebar} style={{ width: tocWidth }}>
                                <div className={styles.resizer} onMouseDown={startResizing} />
                                <div className={styles.tocHeader}><List size={18} /><span>Outline</span></div>
                                <div className={styles.tocList}>
                                    {(() => {
                                        const visibleStack: { level: number, collapsed: boolean, id: string }[] = [];
                                        return toc.map((item, index) => {
                                            while (visibleStack.length > 0 && visibleStack[visibleStack.length - 1].level >= item.level) visibleStack.pop();
                                            const isVisible = !visibleStack.some(p => p.collapsed);
                                            const isCollapsed = collapsedIds.has(item.id);
                                            visibleStack.push({ level: item.level, collapsed: isCollapsed, id: item.id });
                                            if (!isVisible) return null;
                                            const hasChildren = index + 1 < toc.length && toc[index + 1].level > item.level;

                                            return (
                                                <div
                                                    key={index} draggable
                                                    onDragStart={(e) => { e.dataTransfer.setData('text/plain', index.toString()); setDraggedHeaderIndex(index); e.currentTarget.style.opacity = '0.5'; }}
                                                    onDragEnd={(e) => { e.currentTarget.style.opacity = '1'; setDraggedHeaderIndex(null); setDragOverHeaderIndex(null); setDragHeaderPosition(null); }}
                                                    onDragOver={(e) => {
                                                        e.preventDefault();
                                                        const rect = e.currentTarget.getBoundingClientRect();
                                                        const y = e.clientY - rect.top;
                                                        const height = rect.height;
                                                        setDragOverHeaderIndex(index);
                                                        setDragHeaderPosition(y < height / 2 ? 'top' : 'bottom');
                                                    }}
                                                    onDragLeave={() => { if (dragOverHeaderIndex === index) setDragOverHeaderIndex(null); }}
                                                    onDrop={(e) => handleHeaderDrop(e, index)}
                                                    className={styles.tocItem}
                                                    style={{
                                                        paddingLeft: `${(item.level - 1) * 12}px`,
                                                        borderTop: dragOverHeaderIndex === index && dragHeaderPosition === 'top' ? '2px solid #42b883' : 'none',
                                                        borderBottom: dragOverHeaderIndex === index && dragHeaderPosition === 'bottom' ? '2px solid #42b883' : 'none',
                                                        opacity: draggedHeaderIndex === index ? 0.5 : 1,
                                                        display: 'flex', alignItems: 'center',
                                                        backgroundColor: item.id === activeHeaderId ? 'rgba(66, 184, 131, 0.1)' : 'transparent',
                                                        color: item.id === activeHeaderId ? '#42b883' : 'inherit'
                                                    }}
                                                >
                                                    <span style={{ width: 16, height: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginRight: 4, color: '#888' }}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const newSet = new Set(collapsedIds);
                                                            if (newSet.has(item.id)) newSet.delete(item.id);
                                                            else newSet.add(item.id);
                                                            setCollapsedIds(newSet);
                                                        }}>
                                                        {hasChildren ? (isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />) : <span style={{ width: 12 }}></span>}
                                                    </span>
                                                    <a href={`#${item.id}`} onClick={(e) => { e.preventDefault(); scrollToHeader(item.id); }} style={{ textDecoration: 'none', color: 'inherit', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {item.text}
                                                    </a>
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>
                                {toc.length === 0 && <div style={{ padding: '1rem', color: '#999', fontSize: '0.9rem' }}>No headers found</div>}
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

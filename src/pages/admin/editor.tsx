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
                // Select the code content specifically. 
                // SyntaxHighlighter with PreTag="div" renders a parent div. We select its text contents.
                // We exclude the header which is a sibling. Code is the 3rd child (Header, Button, SyntaxHighlighter).
                // But better to wrap SyntaxHighlighter in a ref-ed div.
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

// YouTube helper components moved to @/components/YouTubeEmbed


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
    onContextMenu: (e: React.MouseEvent, node: FileNode) => void,
    onDragStart: (e: React.DragEvent, node: FileNode) => void,
    onDragOver: (e: React.DragEvent, node: FileNode) => void,
    onDrop: (e: React.DragEvent, node: FileNode) => void,
    onDragLeave: (e: React.DragEvent) => void
}) => {
    // Default to closed (false), unless current post is inside (can be improved later)
    const [isOpen, setIsOpen] = useState(false);
    const [dragState, setDragState] = useState<'none' | 'top' | 'bottom' | 'inside'>('none');

    const handleClick = () => {
        if (node.type === 'directory') {
            setIsOpen(!isOpen);
        } else if (node.slug) {
            onLoadPost(node.slug);
        }
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onDragOver(e, node);

        // Local visual feedback
        const rect = e.currentTarget.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const height = rect.height;

        if (node.type === 'directory') {
            // Top 25% -> before, Bottom 25% -> after, Middle 50% -> inside
            if (y < height * 0.25) setDragState('top');
            else if (y > height * 0.75) setDragState('bottom');
            else setDragState('inside');
        } else {
            // Top 50% -> before, Bottom 50% -> after
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

    // Determine border style based on dragState
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
                    backgroundColor: dragState === 'inside' ? 'rgba(66, 184, 131, 0.2)' : (isActive ? 'rgba(66, 184, 131, 0.1)' : 'transparent'),
                    color: isActive ? '#42b883' : 'inherit',
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

export default function Editor() {
    const router = useRouter()
    const { open } = router.query

    const [posts, setPosts] = useState<FileNode[]>([])
    const [currentPost, setCurrentPost] = useState<string | null>(null)
    const [content, setContent] = useState('')
    const [debouncedContent, setDebouncedContent] = useState('') // Debounced content for heavy tasks
    const [initialContent, setInitialContent] = useState('')
    const contentRef = useRef('')
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
    const [status, setStatus] = useState('')
    const [isSidebarOpen, setSidebarOpen] = useState(true)
    const [toastMsg, setToastMsg] = useState('')
    const [toc, setToc] = useState<{ id: string, text: string, level: number }[]>([]);
    const [viewMode, setViewMode] = useState<'source' | 'preview' | 'both' | 'live'>('both')
    const [tocWidth, setTocWidth] = useState(250);
    const [isResizing, setIsResizing] = useState(false);

    const [sidebarWidth, setSidebarWidth] = useState(260);
    const [isSidebarResizing, setIsSidebarResizing] = useState(false);

    const [editorRatio, setEditorRatio] = useState(0.5);
    const [isPaneResizing, setIsPaneResizing] = useState(false);

    // TOC Collapse State
    const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
    const [tocInitialized, setTocInitialized] = useState(false); // Track if we set initial fold

    // Context Menu State
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, node: FileNode } | null>(null);

    // Drag and Drop State
    const [draggedNode, setDraggedNode] = useState<FileNode | null>(null);

    // Active Header State for TOC
    const [activeHeaderId, setActiveHeaderId] = useState<string | null>(null);

    const updateActiveHeaderFromSelection = useCallback(() => {
        // Use editorViewRef (CodeMirror)
        const editor = editorViewRef.current;
        if (!editor || !editor.view) return;

        const state = editor.view.state;
        const cursor = state.selection.main.head;
        const doc = state.doc;

        // Scan backwards from cursor line
        const lineBlock = doc.lineAt(cursor);
        let currentLineNum = lineBlock.number;

        // Check current line and previous lines
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

    const handleNodeDragStart = (e: React.DragEvent, node: FileNode) => {
        setDraggedNode(node);
        e.dataTransfer.setData('text/plain', node.path);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleNodeDragOver = (e: React.DragEvent, node: FileNode) => {
        e.preventDefault();
        // Prevent dropping on self or children
        if (draggedNode && (draggedNode.path === node.path || node.path.startsWith(draggedNode.path + '/'))) {
            e.dataTransfer.dropEffect = 'none';
        } else {
            e.dataTransfer.dropEffect = 'move';
        }
    };

    const handleNodeDrop = async (e: React.DragEvent, targetNode: FileNode) => {
        e.preventDefault();
        if (!draggedNode || draggedNode.path === targetNode.path) return;

        // Calculate drop position logic again to determine action
        // This duplicates logic in FileTreeItem but gives us the final decision
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

        // Action Logic
        if (position === 'inside') {
            // Move draggedNode INTO targetNode
            await moveNode(draggedNode, targetNode.path);
        } else {
            // Reorder or Move to Sibling
            // Find parent of targetNode
            const parts = targetNode.path.split('/');
            parts.pop();
            const parentPath = parts.join('/');

            // If draggedNode is already in this parent, it's just a reorder
            // If dragging from elsewhere, it's a move + reorder
            const draggedParentParts = draggedNode.path.split('/');
            draggedParentParts.pop();
            const draggedParentPath = draggedParentParts.join('/');

            if (parentPath === draggedParentPath) {
                // Same directory: Reorder
                await reorderNode(draggedNode, targetNode, parentPath, position);
            } else {
                // Different directory: Move then Reorder
                // First move to new parent
                const newPath = parentPath ? `${parentPath}/${draggedNode.name}` : draggedNode.name;
                const moveSuccess = await moveNode(draggedNode, parentPath || '/'); // Move into parent dir

                if (moveSuccess) {
                    // Update draggedNode info for reorder step since path changed
                    const updatedDraggedNode = { ...draggedNode, path: newPath };
                    // Then reorder
                    // We need to wait for fetchPosts or manually update logic, 
                    // but reorder needs the meta keys.
                    // Let's do a best effort reorder call immediately
                    await reorderNode(updatedDraggedNode, targetNode, parentPath, position);
                }
            }
        }
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

            // Update Meta for old parent (remove key)
            const oldParts = node.path.split('/');
            oldParts.pop();
            const oldParent = oldParts.join('/');
            const key = node.name.replace(/\.(md|mdx)$/, '');

            await fetch('/api/meta', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folderPath: oldParent || '/', key })
            });

            // Update Meta for new parent (add key)
            // Ideally we want to add it at specific position, but standard move puts it at end (handled by add)
            // or we handle reorder separately. Here we just ensure it exists in meta to be shown.
            await fetch('/api/meta', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: parentPath, key, title: key })
            });

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
        // We need the list of keys in the parent directory to construct the new order
        try {
            // Fetch current meta
            const parentDir = parentPath ? parentPath : '/';
            // We use parentDir as 'folderPath' for meta api
            // Wait, we need the CURRENT order to manipulate it.
            // We can get it from 'posts' state but 'posts' is a tree.
            // We need to find the children of 'parentId' in 'posts' tree.

            const findChildren = (nodes: FileNode[], path: string): FileNode[] => {
                if (path === '') return nodes; // root
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

            const getKey = (n: FileNode) => n.name.replace(/\.(md|mdx)$/, '');

            let keys = siblings.map(getKey);
            const movedKey = getKey(movedNode);
            const targetKey = getKey(targetNode);

            // Remove movedKey
            keys = keys.filter(k => k !== movedKey);

            // Insert at new position
            const targetIndex = keys.indexOf(targetKey);
            if (targetIndex === -1) {
                // Fallback: append
                keys.push(movedKey);
            } else {
                if (position === 'before') {
                    keys.splice(targetIndex, 0, movedKey);
                } else {
                    keys.splice(targetIndex + 1, 0, movedKey);
                }
            }

            // Call PATCH meta
            const res = await fetch('/api/meta', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folderPath: parentPath || '/', order: keys })
            });

            if (!res.ok) throw new Error('Reorder failed');

            await fetchPosts();

        } catch (e: any) {
            console.error(e);
            window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Reorder failed' }));
        }
    };

    const handleNodeDragLeave = (_e: React.DragEvent) => {
        // Just required placeholder
    };

    const editorViewRef = useRef<ReactCodeMirrorRef>(null);

    // Drag and Drop Header State
    const [draggedHeaderIndex, setDraggedHeaderIndex] = useState<number | null>(null);
    const [dragOverHeaderIndex, setDragOverHeaderIndex] = useState<number | null>(null);
    const [dragHeaderPosition, setDragHeaderPosition] = useState<'top' | 'bottom' | null>(null);

    // Close context menu on click elsewhere
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

    // Optimized content change handler with debounce
    const handleContentChange = useCallback((val: string) => {
        contentRef.current = val;

        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
            setContent(val);
            setDebouncedContent(val);
        }, 150);
    }, []);

    // Extract headers when debounced content changes
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
            // Only update if headers actually changed to prevent immediate re-render loop
            if (JSON.stringify(prev) === JSON.stringify(headers)) return prev;
            return headers;
        });
    }, [debouncedContent]);

    // Initial TOC Collapse Logic
    useEffect(() => {
        if (toc.length > 0 && !tocInitialized) {
            // Find highest level > 1 (assuming H1 title)
            const nonTitleHeaders = toc.filter(h => h.level > 1);
            if (nonTitleHeaders.length === 0) return;

            const minLevel = Math.min(...nonTitleHeaders.map(h => h.level));
            const newCollapsed = new Set<string>();

            // Mark all headers of minLevel (and deeper?) as collapsed initially?
            // User: "Standards on highest level header ... all folded".
            // Means show Top Level (minLevel) items, hide their children.
            // So we need to mark "minLevel" items as collapsed.
            // We also mark "minLevel + 1" items as collapsed? Yes, fold all deep levels.

            nonTitleHeaders.forEach(h => {
                // Determine if it has children?
                // A header has children if the NEXT headers have higher level.
                // We can just eagerly mark EVERYTHING as collapsed. 
                // Using Set, we can toggle 'expanded' (remove from set).
                // "Collapsed" means "Children Hidden".

                // Let's mark ALL headers with children as collapsed?
                // Or simply all headers? Collapsing a leaf node does nothing visually if we render right.
                // But simple approach: Fold everything.
                newCollapsed.add(h.id);
            });

            setCollapsedIds(newCollapsed);
            setTocInitialized(true);
        }
    }, [toc, tocInitialized]);

    // Resizing Logic (TOC)
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

    // Resizing Logic (Sidebar)
    const startSidebarResizing = useCallback((mouseDownEvent: React.MouseEvent) => {
        mouseDownEvent.preventDefault();
        setIsSidebarResizing(true);
    }, []);

    const stopSidebarResizing = useCallback(() => {
        setIsSidebarResizing(false);
    }, []);

    const resizeSidebar = useCallback(
        (mouseMoveEvent: MouseEvent) => {
            if (isSidebarResizing) {
                // Calculate new width based on mouse position
                const newWidth = mouseMoveEvent.clientX;
                if (newWidth > 150 && newWidth < 600) {
                    setSidebarWidth(newWidth);
                }
            }
        },
        [isSidebarResizing]
    );

    // Resizing Logic (Editor/Preview Pane Split)
    const startPaneResizing = useCallback((mouseDownEvent: React.MouseEvent) => {
        mouseDownEvent.preventDefault();
        setIsPaneResizing(true);
    }, []);

    const stopPaneResizing = useCallback(() => {
        setIsPaneResizing(false);
    }, []);

    const resizePane = useCallback(
        (mouseMoveEvent: MouseEvent) => {
            if (isPaneResizing) {
                const workspace = document.getElementById('workspace-container');
                if (workspace) {
                    const rect = workspace.getBoundingClientRect();
                    // Calculate ratio based on mouse position relative to workspace width
                    // mouseX - workspaceLeft = width of left pane
                    const relativeX = mouseMoveEvent.clientX - rect.left;
                    const newRatio = relativeX / rect.width;

                    if (newRatio > 0.2 && newRatio < 0.8) {
                        setEditorRatio(newRatio);
                    }
                }
            }
        },
        [isPaneResizing]
    );

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
        setCurrentPost(slug)
        const res = await fetch(`/api/post?slug=${slug}&t=${Date.now()}`)
        if (res.ok) {
            const data = await res.json()
            setContent(data.content)
            setDebouncedContent(data.content)
            contentRef.current = data.content
            setInitialContent(data.content)

            router.push(`/admin/editor?open=${slug}`, undefined, { shallow: true })
        }
    }

    // Link textareaRef (Not needed for CodeMirror as we use editorViewRef directly)
    // Removed old LiveEditor linking logic

    const savePost = useCallback(async () => {
        if (!currentPost) return
        setStatus('Saving...')

        // Capture current cursor position before saving
        const editor = editorViewRef.current?.view;
        let savedSelection: any = null;
        if (editor) {
            savedSelection = editor.state.selection;
        }

        // Get latest content from view or ref to ensure we save what's on screen
        const latestContent = editor?.state.doc.toString() ?? contentRef.current ?? content;

        const res = await fetch(`/api/post?slug=${currentPost}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: latestContent })
        })
        if (res.ok) {
            setStatus('Saved')
            // Sync initialContent to mark as "clean" (not dirty)
            setInitialContent(latestContent)

            // Do NOT call setContent(latestContent) here.
            // The editor already has this content. Calling setContent causes React to re-render
            // the CodeMirror component with a new 'value' prop, which resets the editor state (cursor).
            // contentRef is enough for our internal tracking.
            contentRef.current = latestContent;

            // Restore cursor position if needed
            if (editor && savedSelection) {
                // Focus the editor to ensure selection is applied visibly
                editor.focus();
                editor.dispatch({
                    selection: savedSelection
                });
            }

            setTimeout(() => setStatus(''), 2000)
            window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Saved successfully' }))
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

    // Use Ref for currentPost to avoid stale closures in CodeMirror callbacks
    const currentPostRef = useRef(currentPost);
    useEffect(() => {
        currentPostRef.current = currentPost;
    }, [currentPost]);

    // CodeMirror handles Image Upload via onImageUpload prop helper
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
                    insertText(`![](${imagePath})`);
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

    // Logic removed: CodeMirror handles Drop/Paste/Shortcuts internally
    // Removed handleDragOver, handleDrop, handlePaste, manual Undo/Redo/History, handleTextareaKeyDown

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
            case 'h1':
                insertTextAtCursor(view, '# ');
                break;
            case 'h2':
                insertTextAtCursor(view, '## ');
                break;
            case 'quote':
                // Simple implementation for now. Better to use standard commands if possible.
                insertTextAtCursor(view, '> ');
                break;
            case 'code':
                insertTextAtCursor(view, '```\n\n```');
                break;
            case 'link':
                insertTextAtCursor(view, '[link](url)');
                break;
            case 'list':
                insertTextAtCursor(view, '- ');
                break;
        }
    }

    const scrollToHeader = (id: string) => {
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
    };

    // Context Menu Handlers
    const handleContextMenu = (e: React.MouseEvent, node: FileNode) => {
        e.preventDefault();
        e.stopPropagation(); // Prevent triggering parent context menus
        setContextMenu({ x: e.clientX, y: e.clientY, node });
    };

    const handleMetaAction = async () => {
        if (!contextMenu) return;
        const { node } = contextMenu;
        setContextMenu(null); // Close menu

        const newTitle = prompt('Enter new title for sidebar (updates _meta.json):');
        if (!newTitle) return;

        let key = node.name.replace(/\.(md|mdx)$/, '');

        // Determine the PARENT directory which contains the _meta.json responsible for this node
        const parts = node.path.split('/');
        parts.pop(); // Remove the node itself
        const parentPath = parts.join('/');

        try {
            const res = await fetch('/api/meta', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: parentPath, key, title: newTitle })
            });
            if (!res.ok) throw new Error('Failed to update title');

            window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Title updated in _meta.json' }))

            // Refresh the relevant _meta.json if it is currently open
            const metaFile = parentPath ? `${parentPath}/_meta.json` : '_meta.json';

            if (currentPost === metaFile) {
                loadPost(metaFile);
            }
        } catch (e: any) {
            alert(e.message);
        }
    }

    const handleFSAction = async (action: 'new_file' | 'new_folder' | 'rename' | 'delete') => {
        if (!contextMenu) return;
        const { node } = contextMenu;
        setContextMenu(null); // Close menu

        // Determine parent path
        // If node is a directory, actions like New File are inside it.
        // If node is a file, actions like New File are in its parent directory.
        // Wait, normally right clicking a file -> New File creates sibling.
        // Right clicking a dir -> New File creates child.

        // Helper to get directory logic
        const getParentDir = (n: FileNode) => {
            if (n.type === 'directory') return n.path;
            const parts = n.path.split('/');
            parts.pop();
            return parts.join('/');
        }

        // Target base for creation
        const creationBase = node.type === 'directory' ? node.path : getParentDir(node);

        try {
            if (action === 'new_file') {
                let name = prompt('Enter new file name (e.g. hello.md):');
                if (!name) return;

                // Implicitly add .md if extension missing
                if (!/\.(md|mdx)$/.test(name)) {
                    name += '.md';
                }

                const path = creationBase ? `${creationBase}/${name}` : name;

                const res = await fetch('/api/fs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'file', path })
                });
                if (!res.ok) throw new Error('Failed to create file');

                // Update _meta.json
                try {
                    const key = name.replace(/\.(md|mdx)$/, '');
                    await fetch('/api/meta', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ path: creationBase || '', key, title: key })
                    });

                    window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Added to _meta.json' }))

                    // Refresh parent/_meta.json if open
                    const metaPath = creationBase ? `${creationBase}/_meta.json` : '_meta.json';
                    if (currentPost === metaPath || currentPost === `/${metaPath}`) {
                        setTimeout(() => loadPost(metaPath), 100);
                    }
                } catch (e) {
                    console.error('Failed to update meta', e);
                }

                fetchPosts();

                // Automatically open the new file
                setTimeout(() => {
                    loadPost(path);
                }, 200);
            } else if (action === 'new_folder') {
                const name = prompt('Enter new folder name:');
                if (!name) return;
                const path = creationBase ? `${creationBase}/${name}` : name;

                const res = await fetch('/api/fs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'directory', path })
                });
                if (!res.ok) throw new Error('Failed to create folder');

                // Update _meta.json for folder
                try {
                    const key = name;
                    await fetch('/api/meta', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ path: creationBase || '', key, title: key })
                    });

                    // Also create a _meta.json inside the new folder?
                    // Usually not strictly required unless we put stuff in it immediately, but let's leave it empty for now, or the user can add it.
                    // Actually Nextra tends to like having _meta.json.
                    // Let's rely on manual creation or subsequent actions for inner _meta.json. 

                    window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Added to _meta.json' }))

                    // Refresh parent/_meta.json if open
                    const metaPath = creationBase ? `${creationBase}/_meta.json` : '_meta.json';
                    if (currentPost === metaPath || currentPost === `/${metaPath}`) {
                        setTimeout(() => loadPost(metaPath), 100);
                    }
                } catch (e) {
                    console.error('Failed to update meta', e);
                }

                fetchPosts();
            } else if (action === 'rename') {
                const newName = prompt('Enter new name:', node.name);
                if (!newName || newName === node.name) return;

                // For renaming, we need the parent of the current node (whether file or directory)
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

                // Update _meta.json if possible
                try {
                    const getMetaKey = (name: string) => name.replace(/\.(md|mdx)$/, '');
                    const oldKey = getMetaKey(node.name);
                    const newKey = getMetaKey(newName);

                    await fetch('/api/meta', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            folderPath: parent,
                            oldKey,
                            newKey
                        })
                    });
                } catch (e) {
                    console.error('Failed to update meta', e);
                }

                await fetchPosts();

                // If we have reduced parent/_meta.json open, reload it to show changes
                const metaPath = parent ? `${parent}/_meta.json` : '_meta.json';
                if (currentPost === metaPath || currentPost === `/${metaPath}`) {
                    setTimeout(() => loadPost(metaPath), 100);
                }

                // If we renamed the current file being edited, update currentPost
                if (currentPost === node.path) {
                    // Update slug/path to new one
                    setTimeout(() => loadPost(newPath), 100);
                }
            } else if (action === 'delete') {
                if (!confirm(`Are you sure you want to delete ${node.name}?`)) return;

                const res = await fetch('/api/fs', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: node.path })
                });
                if (!res.ok) throw new Error('Failed to delete');
                // Calculate parent and meta path for redirection
                const parts = node.path.split('/');
                parts.pop();
                const parent = parts.join('/');
                const metaPath = parent ? `${parent}/_meta.json` : '_meta.json';

                // Update _meta.json by removing key
                try {
                    const key = node.name.replace(/\.(md|mdx)$/, '');

                    await fetch('/api/meta', {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ folderPath: parent, key })
                    });

                    // Refresh parent/_meta.json if open
                    if (currentPost === metaPath || currentPost === `/${metaPath}`) {
                        setTimeout(() => loadPost(metaPath), 100);
                    }
                } catch (e) {
                    console.error('Failed to update meta on delete', e);
                }

                // If the deleted file was the one currently open, redirect to _meta.json
                if (currentPost === node.slug) {
                    setTimeout(() => {
                        loadPost(metaPath);
                        fetchPosts();
                    }, 100);
                } else {
                    // If we deleted something else, just refresh tree
                    fetchPosts();
                }
            }
        } catch (e: any) {
            alert(e.message);
        }
    }

    // Header Reordering Logic
    const handleHeaderDrop = (e: React.DragEvent, targetIndex: number) => {
        e.preventDefault();
        (e.currentTarget as HTMLElement).style.background = 'transparent';

        const sourceIndexStr = e.dataTransfer.getData('text/plain');
        if (!sourceIndexStr) return;

        const sourceIndex = parseInt(sourceIndexStr, 10);
        if (sourceIndex === targetIndex || isNaN(sourceIndex)) return;

        // Position Logic: If bottom, target is next index
        let adjustedTargetIndex = targetIndex;
        if (dragHeaderPosition === 'bottom') {
            adjustedTargetIndex = targetIndex + 1;
        }

        const headers = toc;
        if (!headers[sourceIndex] || !headers[targetIndex]) return;

        const lines = content.split('\n');

        // Helper to find line number of a header
        const headerLineIndices: number[] = [];
        let headerCount = 0;
        let inCodeBlock = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.trim().startsWith('```')) inCodeBlock = !inCodeBlock;
            if (inCodeBlock) continue;

            const match = line.match(/^(#{1,6})\s+(.+)$/);
            if (match) {
                if (headerCount < headers.length) {
                    headerLineIndices.push(i);
                    headerCount++;
                }
            }
        }

        if (headerLineIndices.length !== headers.length) {
            window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Cannot parse structure correctly for reordering' }));
            return;
        }

        // Determine range of Source Block
        const sourceStartLine = headerLineIndices[sourceIndex];
        const sourceLevel = headers[sourceIndex].level;
        let sourceEndIndex = sourceIndex + 1;
        while (sourceEndIndex < headers.length && headers[sourceEndIndex].level > sourceLevel) {
            sourceEndIndex++;
        }

        const sourceEndLine = (sourceEndIndex < headerLineIndices.length)
            ? headerLineIndices[sourceEndIndex]
            : lines.length;

        // Extract Source Block
        const sourceBlock = lines.slice(sourceStartLine, sourceEndLine);

        // Adjust lines removing source
        const linesWithoutSource = [
            ...lines.slice(0, sourceStartLine),
            ...lines.slice(sourceEndLine)
        ];

        // Calculate Target Insertion Point
        // Calculate Target Insertion Point
        let insertAt = 0;

        // If adjustedTargetIndex is past the last header, append to end
        if (adjustedTargetIndex >= headerLineIndices.length) {
            insertAt = linesWithoutSource.length;
        } else {
            const targetOriginalStart = headerLineIndices[adjustedTargetIndex];
            insertAt = targetOriginalStart;

            // Adjust if target was after source (indexes shifted up)
            if (targetOriginalStart > sourceStartLine) {
                insertAt -= (sourceEndLine - sourceStartLine);
            }
        }

        linesWithoutSource.splice(insertAt, 0, ...sourceBlock);

        const newContent = linesWithoutSource.join('\n');
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

            {/* Sidebar (File Explorer) */}
            <div
                className={styles.sidebar}
                style={{
                    width: sidebarWidth,
                    marginLeft: isSidebarOpen ? 0 : -sidebarWidth,
                    position: 'relative',
                    transition: isSidebarResizing ? 'none' : 'margin-left 0.3s ease'
                }}
                onContextMenu={(e) => {
                    if (e.defaultPrevented) return; // Ignore if handled by children (though children use stopPropagation)
                    handleContextMenu(e, { name: 'Root', type: 'directory', path: '' } as FileNode)
                }}
            >
                <div
                    className={styles.resizer}
                    style={{ left: 'auto', right: 0 }}
                    onMouseDown={startSidebarResizing}
                />
                <div className={styles.sidebarHeader}>
                    <FileText size={20} />
                    <span>Explorer</span>
                </div>
                {/* Removed top form as context menu is preferred, or we could add a root 'add' button later */}
                <div className={styles.postList}>
                    {posts.map((node, i) => (
                        <FileTreeItem
                            key={i}
                            node={node}
                            level={0}
                            onLoadPost={loadPost}
                            currentPost={currentPost}
                            onContextMenu={handleContextMenu}
                            onDragStart={handleNodeDragStart}
                            onDragOver={handleNodeDragOver}
                            onDrop={handleNodeDrop}
                            onDragLeave={handleNodeDragLeave}
                        />
                    ))}
                    {posts.length === 0 && (
                        <div style={{ padding: '1rem', color: '#888', fontSize: '0.8rem', textAlign: 'center' }}>
                            No files found. <br /> Right click to create new.
                        </div>
                    )}
                    {/* Invisible div to allow right clicking empty area to create at root? */}
                    <div
                        style={{ flex: 1, minHeight: '50px' }}
                        onContextMenu={(e) => {
                            // Virtual root node
                            handleContextMenu(e, { name: 'Root', type: 'directory', path: '' } as FileNode)
                        }}
                    />
                </div>
            </div>

            {/* Context Menu */}
            {contextMenu && (
                <div
                    className={styles.contextMenu}
                    style={{
                        top: contextMenu.y,
                        left: contextMenu.x,
                    }}
                >
                    <div className={styles.contextMenuHeader}>
                        {contextMenu.node.name || 'Root'}
                    </div>
                    <div
                        className={styles.contextMenuItem}
                        onClick={() => handleFSAction('new_file')}
                    >
                        <FileText size={14} /> New File
                    </div>
                    <div
                        className={styles.contextMenuItem}
                        onClick={() => handleFSAction('new_folder')}
                    >
                        <Plus size={14} /> New Folder
                    </div>
                    {contextMenu.node.path !== '' && ( // Don't show rename/delete for Root
                        <>
                            <div className={styles.contextMenuDivider} />
                            <div
                                className={styles.contextMenuItem}
                                onClick={() => handleFSAction('rename')}
                            >
                                <FileText size={14} /> Rename File/Folder
                            </div>
                            <div
                                className={styles.contextMenuItem}
                                onClick={() => handleMetaAction()}
                            >
                                <FileText size={14} /> Rename Title (_meta)
                            </div>
                            <div
                                className={styles.contextMenuItem}
                                onClick={() => handleFSAction('delete')}
                                style={{ color: '#e53e3e' }}
                            >
                                <X size={14} /> Delete
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
                                <button
                                    className={styles.cancelBtn}
                                    onClick={cleanUnusedImages}
                                    title="Remove unused image file (at current file)"
                                    style={{ color: '#42b883', borderColor: '#42b883', marginRight: '8px' }}
                                >
                                    <Recycle size={18} />
                                </button>
                                <button className={styles.saveBtn} onClick={savePost}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Save size={16} /> Save
                                    </span>
                                </button>
                                <button className={styles.cancelBtn} onClick={async () => {
                                    if (!currentPost) return;

                                    // Revert content to initial state and cleanup any images uploaded during this session
                                    // by saving the initial content. The server-side logic cleans up images not used in the saved content.
                                    if (initialContent !== content) {
                                        await fetch(`/api/post?slug=${currentPost}`, {
                                            method: 'PUT',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ content: initialContent }) // Revert to initial
                                        });
                                    } else {
                                        // Even if content didn't change, we might want to trigger cleanup just in case?
                                        // But usually if content didn't change, no new images were added meaningfully or they were already there.
                                        // However, if user uploaded image A, then deleted it from text, then uploaded B. Content matches initial? No.
                                        // If user uploaded image A, then deleted it. Content matches initial. Image A is orphaned.
                                        // So we should probably always sync/cleanup if we want to be strict, or just trust the daily/periodic cleanup?
                                        // The user said "Back 버튼 클릭시 클릭 직전 까지 수정을 위해 업로드한 이미지는 삭제하도록 하세요."
                                        // If I uploaded an image but didn't save, it is on the server.
                                        // If I hit Back, I want that image gone.
                                        // Saving 'initialContent' achieves this because that image is not in 'initialContent'.

                                        // Edge case: what if I uploaded an image, then deleted the line from editor?
                                        // Content matches initial (roughly). 
                                        // But the image file is there.
                                        // So yes, saving initialContent is safe and robust.
                                        await fetch(`/api/post?slug=${currentPost}`, {
                                            method: 'PUT',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ content: initialContent })
                                        });
                                    }

                                    // Check if file still exists via API
                                    try {
                                        const res = await fetch(`/api/post?slug=${currentPost}`);
                                        if (res.status === 404) {
                                            router.push('/');
                                            return;
                                        }
                                    } catch (e) {
                                        // On error, default to root or attempt nav? 
                                        // Let's safe-guard to root if we can't verify.
                                        router.push('/');
                                        return;
                                    }

                                    if (currentPost.endsWith('.json')) {
                                        // For json config files, check if parent folder has an index page
                                        const parent = currentPost.split('/').slice(0, -1).join('/');
                                        const targetPath = parent ? parent : 'home';

                                        try {
                                            // Check if the parent path maps to a valid page (index)
                                            const res = await fetch(`/api/post?slug=${targetPath}`);
                                            if (res.ok) {
                                                router.push(parent ? `/${parent}` : '/');
                                            } else {
                                                // If parent folder has no index, go to root
                                                router.push('/');
                                            }
                                        } catch {
                                            router.push('/');
                                        }
                                    } else {
                                        // Strip extension for viewer URL
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
                        <button className={styles.toolBtn} onClick={() => formatText('bold')} title="Bold">
                            <Bold size={18} />
                        </button>
                        <button className={styles.toolBtn} onClick={() => formatText('italic')} title="Italic">
                            <Italic size={18} />
                        </button>
                        <button className={styles.toolBtn} onClick={() => formatText('strikethrough')} title="Strikethrough">
                            <Strikethrough size={18} />
                        </button>
                        <button className={styles.toolBtn} onClick={() => formatText('inline-code')} title="Inline Code">
                            <Braces size={18} />
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
                <div
                    id="workspace-container"
                    className={styles.workspace}
                >
                    {currentPost ? (
                        <>
                            <div
                                className={`${styles.pane} ${styles.editorPane}`}
                                style={{
                                    display: (viewMode === 'preview' || viewMode === 'live') ? 'none' : 'flex',
                                    borderRight: viewMode === 'both' ? 'none' : '1px solid #e9ecef',
                                    flex: viewMode === 'both' ? `${editorRatio}` : '1'
                                }}
                            >
                                <div
                                    className={styles.liveEditorContainer}
                                    style={{ padding: 0 }}
                                    onKeyUp={updateActiveHeaderFromSelection}
                                    onClick={updateActiveHeaderFromSelection}
                                >
                                    {viewMode !== 'live' && (
                                        <CodeMirrorEditor
                                            ref={editorViewRef}
                                            key={currentPost}
                                            value={initialContent}
                                            onChange={handleContentChange}
                                            onImageUpload={processFileUpload}
                                            className={styles.liveEditor}
                                        />
                                    )}
                                </div>
                            </div>

                            {viewMode === 'both' && (
                                <div
                                    className={styles.paneResizer}
                                    onMouseDown={startPaneResizing}
                                />
                            )}

                            <div
                                className={`${styles.pane} ${styles.previewPane}`}
                                style={{
                                    display: (viewMode === 'source' || viewMode === 'live') ? 'none' : 'flex',
                                    flex: viewMode === 'both' ? `${1 - editorRatio}` : '1'
                                }}
                            >
                                <div className={`${styles.previewContent} prose max-w-none`}>
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        rehypePlugins={[rehypeRaw]}
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
                                                if (!inline && match) {
                                                    // It's a code block with language
                                                    return (
                                                        <CodeBlock language={match[1]} value={codeContent} />
                                                    )
                                                } else if (!inline && codeContent.includes('\n')) {
                                                    // It's a multi-line code block without explicit language
                                                    return (
                                                        <CodeBlock language="text" value={codeContent} />
                                                    )
                                                }
                                                // Otherwise it's inline code
                                                return (
                                                    <code className={className} {...props}>
                                                        {children}
                                                    </code>
                                                )
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

                                                // Flexible raw link detection that handles both string and array children
                                                // and checks if the link text matches or contains the URL
                                                const linkText = Array.isArray(children)
                                                    ? children.map(c => typeof c === 'string' ? c : '').join('')
                                                    : String(children || '');

                                                const isRawLink = linkText.trim().includes(url.trim());

                                                if (videoId && isRawLink) {
                                                    return (
                                                        <>
                                                            <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: '#42b883', textDecoration: 'underline' }}>{children}</a>
                                                            <YouTubeEmbed url={url} />
                                                        </>
                                                    );
                                                }

                                                // Generic Link Preview for other raw links
                                                if (isRawLink && (url.startsWith('http://') || url.startsWith('https://'))) {
                                                    return (
                                                        <>
                                                            <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: '#42b883', textDecoration: 'underline' }}>{children}</a>
                                                            <LinkPreview url={url} />
                                                        </>
                                                    );
                                                }

                                                return <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: '#42b883', textDecoration: 'underline' }}>{children}</a>;
                                            }
                                        }}
                                    >
                                        {debouncedContent}
                                    </ReactMarkdown>
                                </div>
                            </div>

                            {/* Live Mode Editor */}
                            <div
                                className={`${styles.pane} ${styles.livePane}`}
                                style={{ display: viewMode === 'live' ? 'block' : 'none' }}
                            >
                                <div className={styles.liveEditorContainer}>
                                    {viewMode === 'live' && (
                                        <CodeMirrorEditor
                                            ref={editorViewRef}
                                            key={currentPost}
                                            value={initialContent}
                                            onChange={handleContentChange}
                                            onImageUpload={processFileUpload}
                                            className={styles.liveEditor}
                                        />
                                    )}
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
                                    {(() => {
                                        const visibleStack: { level: number, collapsed: boolean, id: string }[] = [];

                                        return toc.map((item, index) => {
                                            // 1. Maintain Stack to determine visibility
                                            while (visibleStack.length > 0 && visibleStack[visibleStack.length - 1].level >= item.level) {
                                                visibleStack.pop();
                                            }

                                            // Check visibility
                                            const isVisible = !visibleStack.some(p => p.collapsed);

                                            // Push current
                                            const isCollapsed = collapsedIds.has(item.id);
                                            visibleStack.push({ level: item.level, collapsed: isCollapsed, id: item.id });

                                            if (!isVisible) return null;

                                            // 2. Check if has Children
                                            const hasChildren = index + 1 < toc.length && toc[index + 1].level > item.level;

                                            return (
                                                <div
                                                    key={index}
                                                    draggable
                                                    onDragStart={(e) => {
                                                        e.dataTransfer.setData('text/plain', index.toString());
                                                        setDraggedHeaderIndex(index);
                                                        e.currentTarget.style.opacity = '0.5';
                                                    }}
                                                    onDragEnd={(e) => {
                                                        e.currentTarget.style.opacity = '1';
                                                        setDraggedHeaderIndex(null);
                                                        setDragOverHeaderIndex(null);
                                                        setDragHeaderPosition(null);
                                                    }}
                                                    onDragOver={(e) => {
                                                        e.preventDefault();
                                                        const rect = e.currentTarget.getBoundingClientRect();
                                                        const y = e.clientY - rect.top;
                                                        const height = rect.height;
                                                        setDragOverHeaderIndex(index);
                                                        if (y < height / 2) setDragHeaderPosition('top');
                                                        else setDragHeaderPosition('bottom');
                                                    }}
                                                    onDragLeave={(e) => {
                                                        if (dragOverHeaderIndex === index) setDragOverHeaderIndex(null);
                                                    }}
                                                    onDrop={(e) => handleHeaderDrop(e, index)}
                                                    className={styles.tocItem}
                                                    style={{
                                                        paddingLeft: `${(item.level - 1) * 12}px`,
                                                        borderTop: dragOverHeaderIndex === index && dragHeaderPosition === 'top' ? '2px solid #42b883' : 'none',
                                                        borderBottom: dragOverHeaderIndex === index && dragHeaderPosition === 'bottom' ? '2px solid #42b883' : 'none',
                                                        opacity: draggedHeaderIndex === index ? 0.5 : 1,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        backgroundColor: item.id === activeHeaderId ? 'rgba(66, 184, 131, 0.1)' : 'transparent',
                                                        color: item.id === activeHeaderId ? '#42b883' : 'inherit'
                                                    }}
                                                >
                                                    {/* Toggle Button */}
                                                    <span
                                                        style={{
                                                            width: 16,
                                                            height: 16,
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            cursor: 'pointer',
                                                            marginRight: 4,
                                                            color: '#888'
                                                        }}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const newSet = new Set(collapsedIds);
                                                            if (newSet.has(item.id)) newSet.delete(item.id);
                                                            else newSet.add(item.id);
                                                            setCollapsedIds(newSet);
                                                        }}
                                                    >
                                                        {hasChildren ? (
                                                            isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />
                                                        ) : <span style={{ width: 12 }}></span>}
                                                    </span>

                                                    <a
                                                        href={`#${item.id}`}
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            const el = document.getElementById(item.id);
                                                            if (el) {
                                                                el.scrollIntoView({ behavior: 'smooth' });
                                                            }
                                                        }}
                                                        style={{
                                                            textDecoration: 'none',
                                                            color: 'inherit',
                                                            flex: 1,
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap'
                                                        }}
                                                    >
                                                        {item.text}
                                                    </a>
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>

                                {toc.length === 0 && (
                                    <div style={{ padding: '1rem', color: '#999', fontSize: '0.9rem' }}>
                                        No headers found
                                    </div>
                                )}
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

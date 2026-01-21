import React, { useState, useEffect, useCallback, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import Head from 'next/head'
import { useRouter } from 'next/router'
import styles from '../../styles/Editor.module.css'
import {
    Bold, Italic, Heading1, Heading2, List, ListOrdered,
    Quote, Link as LinkIcon, Image as ImageIcon, Code, Strikethrough, Braces,
    FileText, Menu, ChevronLeft, Save, Plus, Copy, X, ArrowLeft, Folder, FolderOpen
} from 'lucide-react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism'
import LiveEditor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-markdown';
import 'prismjs/themes/prism.css'; // Import base Prism styles
import rehypeRaw from 'rehype-raw'; // Support HTML in markdown
import 'prismjs/themes/prism.css'; // Import base Prism styles
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

    return (
        <div className={styles.codeBlockWrapper}>
            {!copied ? (
                <div className={styles.codeBlockHeader}>{language}</div>
            ) : null}
            <button className={styles.copyBtn} onClick={handleCopy} title="Copy code">
                {copied ? <div style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>✓</div> : <Copy size={16} />}
            </button>
            <SyntaxHighlighter
                style={vscDarkPlus}
                language={language}
                PreTag="div"
                wrapLines={true}
                wrapLongLines={true}
                showLineNumbers={true}
                lineNumberStyle={{ minWidth: '2.5em', paddingRight: '1em', color: '#6e7681', textAlign: 'right' }}
                lineProps={(lineNumber: number) => {
                    const isSelected = selectedLine === lineNumber;
                    return {
                        style: { display: 'block', cursor: 'pointer' },
                        className: isSelected ? `${styles.codeLine} ${styles.codeLineClicked}` : styles.codeLine,
                        onClick: () => setSelectedLine(isSelected ? null : lineNumber)
                    } as React.HTMLAttributes<HTMLElement>;
                }}
            >
                {value}
            </SyntaxHighlighter>
        </div>
    )
}

// YouTube helper components moved to @/components/YouTubeEmbed


// function to generate slug from text
const generateSlug = (text: string) => {
    return text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
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
    const [initialContent, setInitialContent] = useState('')
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

    // Context Menu State
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, node: FileNode } | null>(null);

    // Drag and Drop State
    const [draggedNode, setDraggedNode] = useState<FileNode | null>(null);

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

    const textareaRef = useRef<HTMLTextAreaElement>(null)

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
    }, [content]);

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
            setInitialContent(data.content)

            // Initialize history with loaded content
            historyRef.current = [data.content];
            historyStepRef.current = 0;

            router.push(`/admin/editor?open=${slug}`, undefined, { shallow: true })
        }
    }

    // Link textareaRef to the LiveEditor textarea in Both Mode
    useEffect(() => {
        if (viewMode === 'both' || viewMode === 'source') {
            const el = document.getElementById('both-mode-textarea') as HTMLTextAreaElement;
            if (el && textareaRef.current !== el) {
                (textareaRef as any).current = el;
            }
        }
    }, [viewMode, currentPost]);

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
            setInitialContent(content)
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

            const docName = currentPost.split('/').pop()?.replace(/\.(md|mdx)$/, '') || '';
            const imagePath = (currentPost === 'home' || !docName) ? `./img/${filename}` : `./img/${docName}/${filename}`;
            insertText(`![](${imagePath})`)
            setStatus('Image uploaded')
        } else {
            setStatus('Upload failed')
        }
        e.target.value = ''
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
    }

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault()
        if (!currentPost || !e.dataTransfer.files || !e.dataTransfer.files[0]) return

        // Verify if it is an image
        const file = e.dataTransfer.files[0]
        if (!file.type.startsWith('image/')) return

        const formData = new FormData()
        formData.append('file', file)

        setStatus('Uploading...')
        const res = await fetch(`/api/upload?slug=${currentPost}`, {
            method: 'POST',
            body: formData
        })

        if (res.ok) {
            const { filename } = await res.json()

            const docName = currentPost.split('/').pop()?.replace(/\.(md|mdx)$/, '') || '';
            const imagePath = (currentPost === 'home' || !docName) ? `./img/${filename}` : `./img/${docName}/${filename}`;
            insertText(`![](${imagePath})`)
            setStatus('Image uploaded')
            window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Image uploaded successfully' }))
        } else {
            setStatus('Upload failed')
            window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Upload failed' }))
        }
    }

    const handlePaste = async (e: React.ClipboardEvent) => {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type.startsWith('image/')) {
                e.preventDefault();
                const file = item.getAsFile();
                if (!file || !currentPost) return;

                const formData = new FormData();
                formData.append('file', file);

                setStatus('Uploading...');
                const res = await fetch(`/api/upload?slug=${currentPost}`, {
                    method: 'POST',
                    body: formData
                });

                if (res.ok) {
                    const { filename } = await res.json();

                    const docName = currentPost.split('/').pop()?.replace(/\.(md|mdx)$/, '') || '';
                    const imagePath = (currentPost === 'home' || !docName) ? `./img/${filename}` : `./img/${docName}/${filename}`;
                    insertText(`![](${imagePath})`);
                    setStatus('Image uploaded');
                    window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Image uploaded successfully' }));
                } else {
                    setStatus('Upload failed');
                    window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Upload failed' }));
                }
            }
        }
    };

    // Undo/Redo Logic
    const historyRef = useRef<string[]>([]);
    const historyStepRef = useRef<number>(-1);
    const isUndoRedo = useRef(false);

    // History debounced save
    useEffect(() => {
        if (isUndoRedo.current) {
            isUndoRedo.current = false;
            return;
        }

        const timer = setTimeout(() => {
            const currentStep = historyStepRef.current;
            const currentHistory = historyRef.current;

            // If completely empty history (initial load), set it
            if (currentHistory.length === 0 && content !== '') {
                historyRef.current = [content];
                historyStepRef.current = 0;
                return;
            }

            if (currentHistory.length > 0 && currentHistory[currentStep] !== content) {
                const newHistory = currentHistory.slice(0, currentStep + 1);
                newHistory.push(content);
                historyRef.current = newHistory;
                historyStepRef.current = newHistory.length - 1;
            }
        }, 700);

        return () => clearTimeout(timer);
    }, [content]);

    // Sync Ref with Content for Event Handlers (Fix for cursor jumping)
    const contentRef = useRef(content);
    useEffect(() => {
        contentRef.current = content;
    }, [content]);

    const handleUndo = useCallback(() => {
        if (historyStepRef.current > 0) {
            isUndoRedo.current = true;
            historyStepRef.current--;
            const prev = historyRef.current[historyStepRef.current];
            setContent(prev);
        }
    }, []);

    const handleRedo = useCallback(() => {
        if (historyStepRef.current < historyRef.current.length - 1) {
            isUndoRedo.current = true;
            historyStepRef.current++;
            const next = historyRef.current[historyStepRef.current];
            setContent(next);
        }
    }, []);

    const pendingCursor = useRef<{ start: number, end: number } | null>(null);

    // Apply pending cursor position after content update
    useEffect(() => {
        if (pendingCursor.current && textareaRef.current) {
            const { start, end } = pendingCursor.current;
            textareaRef.current.setSelectionRange(start, end);
            textareaRef.current.focus();
            pendingCursor.current = null;
        }
    }, [content]);

    const highlightCode = useCallback((code: string) => {
        // Custom highlighter to inject h1-h6 classes
        let html = Prism.highlight(code, Prism.languages.markdown, 'markdown');

        // Robust regex: Matches the opening 'token title' tag AND the immediate 'token punctuation' with hashes
        // This avoids issues with nested <span> tags in the content breaking the match
        return html.replace(/(<span class="token title[^"]*">)(\s*<span class="token punctuation">)(#+)(<\/span>)/g, (match, openTag, punctuationOpen, hashes, punctuationClose) => {
            const level = hashes.length;
            if (level >= 1 && level <= 6) {
                const newOpenTag = openTag.replace('token title', `token title h${level}`);
                return `${newOpenTag}${punctuationOpen}${hashes}${punctuationClose}`;
            }
            return match;
        });
    }, []);

    const handleTextareaKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Debugging Key Events
        // console.log('Key:', e.key, 'Alt:', e.altKey, 'Shift:', e.shiftKey, 'Meta:', e.metaKey);

        const textarea = e.currentTarget;
        const { selectionStart, selectionEnd } = textarea;
        const hasSelection = selectionStart !== selectionEnd;
        const currentContent = contentRef.current;

        // Undo/Redo Shortcuts
        if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'z') {
            e.preventDefault();
            handleUndo();
            return;
        }
        if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
            e.preventDefault();
            handleRedo();
            return;
        }

        // Editor Shortcuts: Move Lines (Alt+Up/Down) & Duplicate (Alt+Shift+D)
        if (e.altKey) {
            const isMoveUp = e.key === 'ArrowUp';
            const isMoveDown = e.key === 'ArrowDown';
            const isDuplicate = e.shiftKey && (e.key === 'd' || e.key === 'D');

            if (isMoveUp || isMoveDown || isDuplicate) {
                e.preventDefault();
                const lines = currentContent.split('\n');

                const getLineIndex = (offset: number) => {
                    let currentLen = 0;
                    for (let i = 0; i < lines.length; i++) {
                        currentLen += lines[i].length + 1; // +1 for newline
                        if (currentLen > offset) return i;
                    }
                    return lines.length - 1;
                };

                const startLine = getLineIndex(selectionStart);
                let endLine = getLineIndex(selectionEnd);

                // If selection ends exactly at the start of a new line, treat it as end of previous line
                // This mimics VS Code line selection behavior
                if (selectionEnd > selectionStart && selectionEnd > 0 && currentContent[selectionEnd - 1] === '\n') {
                    endLine = Math.max(startLine, getLineIndex(selectionEnd - 1));
                }

                if (isDuplicate) {
                    const linesToDuplicate = lines.slice(startLine, endLine + 1);
                    lines.splice(endLine + 1, 0, ...linesToDuplicate);
                    const newContent = lines.join('\n');

                    pendingCursor.current = { start: selectionStart, end: selectionEnd };
                    setContent(newContent);
                    return;
                }

                if (isMoveUp) {
                    if (startLine > 0) {
                        const block = lines.splice(startLine, endLine - startLine + 1);
                        lines.splice(startLine - 1, 0, ...block);
                        const newContent = lines.join('\n');

                        // The line that was swapped down is now at index 'endLine' in the new array
                        const shiftAmount = -(lines[endLine].length + 1);
                        pendingCursor.current = {
                            start: selectionStart + shiftAmount,
                            end: selectionEnd + shiftAmount
                        };

                        setContent(newContent);
                    }
                    return;
                }

                if (isMoveDown) {
                    if (endLine < lines.length - 1) {
                        const block = lines.splice(startLine, endLine - startLine + 1);
                        lines.splice(startLine + 1, 0, ...block);
                        const newContent = lines.join('\n');

                        // The line that was swapped up is now at index 'startLine' in the new array
                        const shiftAmount = lines[startLine].length + 1;
                        pendingCursor.current = {
                            start: selectionStart + shiftAmount,
                            end: selectionEnd + shiftAmount
                        };

                        setContent(newContent);
                    }
                    return;
                }
            }
        }

        // Formatting Shortcuts
        if ((e.metaKey || e.ctrlKey) && !e.shiftKey) {
            const wrapSelection = (wrapper: string) => {
                if (!hasSelection) return;
                e.preventDefault();
                const text = currentContent;
                const newText = text.substring(0, selectionStart) +
                    wrapper + text.substring(selectionStart, selectionEnd) + wrapper +
                    text.substring(selectionEnd);

                pendingCursor.current = {
                    start: selectionStart + wrapper.length,
                    end: selectionEnd + wrapper.length
                };
                setContent(newText);
            };

            // Bold: Cmd+B
            if (e.key === 'b') {
                wrapSelection('**');
                return;
            }
            // Italic: Cmd+I
            if (e.key === 'i') {
                wrapSelection('*');
                return;
            }
            // Strikethrough: Cmd+K (Note: Standard link shortcut is usually Cmd+K, but user requested Strikethrough)
            if (e.key === 'k') {
                wrapSelection('~~');
                return;
            }
        }

        // Map of keys to their wrapping pairs
        const keyMap: { [key: string]: [string, string] } = {
            '(': ['(', ')'],
            '{': ['{', '}'],
            '[': ['[', ']'],
            '`': ['`', '`'],
            '"': ['"', '"'],
            "'": ["'", "'"],
            '*': ['*', '*']
        };

        if (hasSelection && keyMap[e.key]) {
            e.preventDefault();
            const [open, close] = keyMap[e.key];
            const text = currentContent;
            const newText = text.substring(0, selectionStart) +
                open + text.substring(selectionStart, selectionEnd) + close +
                text.substring(selectionEnd);

            setContent(newText);

            // Restore selection to the original inner text (now wrapped)
            setTimeout(() => {
                if (textareaRef.current) {
                    textareaRef.current.selectionStart = selectionStart + 1;
                    textareaRef.current.selectionEnd = selectionEnd + 1;
                }
            }, 0);
        }
    }, [handleUndo, handleRedo]);

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

        switch (type) {
            case 'bold':
                newText = text.substring(0, start) + `**${selectedText}**` + text.substring(end)
                break
            case 'italic':
                newText = text.substring(0, start) + `*${selectedText}*` + text.substring(end)
                break
            case 'strikethrough':
                newText = text.substring(0, start) + `~${selectedText}~` + text.substring(end)
                break
            case 'inline-code':
                newText = text.substring(0, start) + `\`${selectedText}\`` + text.substring(end)
                break
            case 'h1':
                newText = text.substring(0, start) + `# ${selectedText}` + text.substring(end)
                break
            case 'h2':
                newText = text.substring(0, start) + `## ${selectedText}` + text.substring(end)
                break
            case 'quote':
                newText = text.substring(0, start) + selectedText.split('\n').map(line => `> ${line}`).join('\n') + text.substring(end)
                break
            case 'code':
                newText = text.substring(0, start) + `\`\`\`\n${selectedText}\n\`\`\`` + text.substring(end)
                break
            case 'link':
                const linkText = selectedText || 'link'
                newText = text.substring(0, start) + `[${linkText}](url)` + text.substring(end)
                break
            case 'list':
                newText = text.substring(0, start) + selectedText.split('\n').map(line => `- ${line}`).join('\n') + text.substring(end)
                break
        }

        if (newText) {
            setContent(newText)
            setTimeout(() => {
                textarea.focus()
            }, 0)
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
                                    onChange={(e) => setViewMode(e.target.value as 'source' | 'preview' | 'both' | 'live')}
                                >
                                    <option value="both">Both Mode</option>
                                    <option value="live">Live Mode</option>
                                    <option value="preview">Preview Mode</option>
                                    <option value="source">Source Mode</option>
                                </select>
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
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
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
                                <div className={styles.liveEditorContainer} style={{ padding: 0 }}>
                                    <LiveEditor
                                        value={content}
                                        onValueChange={setContent}
                                        highlight={highlightCode}
                                        padding={24} // Match textarea padding roughly
                                        className={styles.liveEditor}
                                        textareaClassName={styles.liveEditorTextarea}
                                        textareaId="both-mode-textarea"
                                        onPaste={handlePaste}
                                        onKeyDown={(e) => handleTextareaKeyDown(e as any)}
                                        style={{
                                            fontFamily: '"Fira Code", "Fira Mono", monospace',
                                            fontSize: 16,
                                            backgroundColor: '#ffffff',
                                            minHeight: '100%'
                                        }}
                                    />
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
                                            h1: ({ children }) => <h1 id={generateSlug(String(children))}>{children}</h1>,
                                            h2: ({ children }) => <h2 id={generateSlug(String(children))}>{children}</h2>,
                                            h3: ({ children }) => <h3 id={generateSlug(String(children))}>{children}</h3>,
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
                                        onValueChange={setContent}
                                        highlight={highlightCode}
                                        padding={30}
                                        className={styles.liveEditor}
                                        textareaClassName={styles.liveEditorTextarea}
                                        onPaste={handlePaste}
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

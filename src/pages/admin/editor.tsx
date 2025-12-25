import React, { useState, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import Head from 'next/head'

export default function Editor() {
    const [posts, setPosts] = useState<string[]>([])
    const [currentPost, setCurrentPost] = useState<string | null>(null)
    const [content, setContent] = useState('')
    const [status, setStatus] = useState('')
    const [newPostTitle, setNewPostTitle] = useState('')
    const [isSidebarOpen, setSidebarOpen] = useState(true)

    useEffect(() => {
        fetchPosts()
    }, [])

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

    // Handle Ctrl+S
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
            const imageMarkdown = `![] (./img/${filename})`
            setContent(prev => prev + '\n' + imageMarkdown)
            setStatus('Image uploaded')
        } else {
            setStatus('Upload failed')
        }
    }

    return (
        <div className="flex h-screen bg-gray-50 text-gray-900 font-sans">
            <Head>
                <title>Editor - Green Nextra</title>
            </Head>

            {/* Sidebar */}
            <div className={`w-64 bg-white border-r border-gray-200 flex flex-col transition-all ${isSidebarOpen ? '' : '-ml-64'}`}>
                <div className="p-4 border-b border-gray-200">
                    <h1 className="text-xl font-bold text-[#42b883]">Editor</h1>
                </div>
                <div className="p-4 border-b border-gray-200">
                    <div className="flex gap-2">
                        <input
                            className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm outline-none focus:border-[#42b883]"
                            placeholder="New Post Title"
                            value={newPostTitle}
                            onChange={e => setNewPostTitle(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && createPost()}
                        />
                        <button
                            onClick={createPost}
                            className="bg-[#42b883] text-white px-3 py-1 rounded text-sm hover:bg-[#33a06f]"
                        >
                            +
                        </button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {posts.map(slug => (
                        <div
                            key={slug}
                            onClick={() => loadPost(slug)}
                            className={`px-4 py-2 cursor-pointer hover:bg-gray-50 ${currentPost === slug ? 'bg-[#e0f8ed] text-[#42b883] font-medium' : ''}`}
                        >
                            {slug}
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Area */}
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Toolbar */}
                <div className="h-12 border-b border-gray-200 bg-white flex items-center px-4 justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="text-gray-500">
                            {isSidebarOpen ? '<<' : '>>'}
                        </button>
                        <span className="font-medium">{currentPost || 'Select a post'}</span>
                        <span className="text-sm text-gray-500">{status}</span>
                    </div>
                    <div className="flex items-center gap-4">
                        {currentPost && (
                            <>
                                <label className="cursor-pointer text-sm text-[#42b883] hover:underline">
                                    Upload Image
                                    <input type="file" className="hidden" onChange={handleImageUpload} accept="image/*" />
                                </label>
                                <button
                                    onClick={savePost}
                                    className="bg-[#42b883] text-white px-4 py-1.5 rounded hover:bg-[#33a06f] text-sm"
                                >
                                    Save
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Editor / Preview */}
                {currentPost ? (
                    <div className="flex-1 flex overflow-hidden">
                        <textarea
                            className="flex-1 h-full p-4 border-r border-gray-200 outline-none resize-none font-mono text-sm leading-relaxed"
                            value={content}
                            onChange={e => setContent(e.target.value)}
                            placeholder="# Write your markdown here..."
                        />
                        <div className="flex-1 h-full p-8 overflow-y-auto prose max-w-none">
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                urlTransform={(url) => {
                                    if (url.startsWith('./img/') && currentPost) {
                                        return `/api/image_preview?slug=${currentPost}&file=${url.replace('./img/', '')}`
                                    }
                                    return url
                                }}
                            >
                                {content}
                            </ReactMarkdown>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-gray-400">
                        Select or create a post to start editing
                    </div>
                )}
            </div>
        </div>
    )
}

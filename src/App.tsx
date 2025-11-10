// src/App.tsx
import { useRef, useEffect, useState, useCallback } from 'react'
import {
  Settings as SettingsIcon,
  Loader2,
  Menu,
  X,
  Search,
  Upload,
  Trash2,
  Download,
  File,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/vs2015.css'

import { Message } from './types'
import { useSettings } from './hooks/useSettings'
import { useMessages } from './hooks/useMessages'
import { ModelSelectorModal } from './components/ModelSelectorModal'
import { ProjectsList } from './components/ProjectsList'
import { ConversationsList } from './components/ConversationsList'
import { ChatInput } from './components/ChatInput'
import { SettingsPage } from './components/SettingsPage'
import { useLocation, useNavigate, Routes, Route, Link } from 'react-router-dom'
import { supabase } from './lib/supabase'

const MarkdownViewer = ({ children }: { children: string }) => {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      className="prose prose-sm max-w-none"
      components={{
        code({ inline, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '')
          return !inline && match ? (
            <pre className="rounded-lg overflow-x-auto bg-gray-900 p-4 my-4">
              <code className={`language-${match[1]} text-xs`} {...props}>
                {String(children).replace(/\n$/, '')}
              </code>
            </pre>
          ) : (
            <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono" {...props}>
              {children}
            </code>
          )
        },
      }}
    >
      {children}
    </ReactMarkdown>
  )
}

const ChatMessage = ({ message }: { message: Message }) => {
  const isUser = message.role === 'user'

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-sm">G</span>
        </div>
      )}
      <div className={`max-w-2xl ${isUser ? 'bg-blue-600 text-white' : 'bg-white'} rounded-2xl px-5 py-3 shadow-sm`}>
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        ) : (
          <MarkdownViewer>{message.content}</MarkdownViewer>
        )}
      </div>
      {isUser && (
        <div className="w-9 h-9 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-sm">U</span>
        </div>
      )}
    </div>
  )
}

function App() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [configProject, setConfigProject] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'instructions' | 'files'>('instructions')
  const [instructions, setInstructions] = useState('')
  const [projectFiles, setProjectFiles] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [projectIdToDelete, setProjectIdToDelete] = useState<string | null>(null)
  const [projectTitleToDelete, setProjectTitleToDelete] = useState<string>('')

  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null)
  const [currentConvId, setCurrentConvId] = useState<string | null>(null)

  const { settings, setSettings, isLoading: isLoadingSettings } = useSettings()
  const {
    messages,
    conversations,
    currentConv,
    projects,
    currentProject,
    addMessage,
    isLoading: isLoadingMessages,
    createConversation,
    createProject,
    deleteConversation,
    updateConversationTitle,
    setProjects,
    setCurrentProject,
  } = useMessages(currentConvId, currentProjectId, {
    setCurrentProjectId,
    setCurrentConvId,
  })

  const filteredProjects = projects.filter(p => 
    p.title?.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const filteredConversations = conversations.filter(c => 
    c.title?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const navigate = useNavigate()
  const isSettingsPage = location.pathname === '/settings'

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Prevent extension errors
  useEffect(() => {
    const handler = (e: any) => {
      if (e?.data?.type === 'pageViewId') {
        e.stopImmediatePropagation()
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  useEffect(() => {
    async function init() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) await supabase.auth.signInAnonymously()
      } catch (err) {
        console.warn('Auth init failed (non-critical)', err)
      }
    }
    init()
  }, [])

  const openConfig = useCallback(async (project: any) => {
    setConfigProject(project)
    setActiveTab('instructions')
    setProjectFiles([])
    setInstructions('')

    try {
      const { data } = await supabase
        .from('projects')
        .select('instructions')
        .eq('id', project.id)
        .single()
      setInstructions(data?.instructions || '')
    } catch (err) {
      console.warn('Failed to load instructions', err)
    }
  }, [])

  const loadProjectFiles = useCallback(async (projectId: string) => {
    try {
      const { data } = await supabase.storage
        .from('project-files')
        .list(`project_${projectId}`)
      setProjectFiles(data || [])
    } catch (err) {
      console.warn('Failed to load files', err)
    }
  }, [])

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || !configProject) return
    setUploading(true)
    try {
      for (const file of files) {
        await supabase.storage
          .from('project-files')
          .upload(`project_${configProject.id}/${Date.now()}_${file.name}`, file, { upsert: true })
      }
      await loadProjectFiles(configProject.id)
    } catch (err) {
      setError('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const deleteFile = async (fileName: string) => {
    if (!configProject) return
    try {
      await supabase.storage.from('project-files').remove([`project_${configProject.id}/${fileName}`])
      setProjectFiles(prev => prev.filter(f => f.name !== fileName))
    } catch (err) {
      setError('Delete failed')
    }
  }

  const downloadFile = async (fileName: string) => {
    if (!configProject) return
    try {
      const { data } = await supabase.storage
        .from('project-files')
        .download(`project_${configProject.id}/${fileName}`)
      if (data) {
        const url = URL.createObjectURL(data)
        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      setError('Download failed')
    }
  }

  const saveInstructions = async () => {
    if (!configProject) return
    try {
      await supabase
        .from('projects')
        .update({ instructions, updated_at: new Date().toISOString() })
        .eq('id', configProject.id)
    } catch (err) {
      setError('Save failed')
    }
  }

  const sendMessage = async (content: string) => {
    if (!settings.apiKey || !currentConv || !content.trim()) return

    await addMessage({ role: 'user', content, timestamp: Date.now() })
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch(`${settings.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${settings.apiKey}`,
        },
        body: JSON.stringify({
          model: settings.model === 'auto' ? 'grok-2-latest' : settings.model,
          messages: [
            ...(instructions ? [{ role: 'system', content: instructions }] : []),
            ...messages.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content },
          ],
          temperature: 0.7,
          max_tokens: 4096,
        }),
      })

      if (!res.ok) throw new Error(`API Error ${res.status}`)
      const data = await res.json()
      const reply = data.choices?.[0]?.message?.content || 'No response'

      await addMessage({
        role: 'assistant',
        content: reply,
        timestamp: Date.now(),
      })
    } catch (err: any) {
      setError(err.message || 'Failed to send')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoadingSettings || isLoadingMessages) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-gray-50 to-gray-100">
      {/* HEADER */}
      {!isSettingsPage && (
        <header className="bg-white border-b shadow-sm flex items-center justify-between px-4 py-3 z-50">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden p-2 hover:bg-gray-100 rounded-lg">
              {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center">
              <span className="text-white font-bold text-xl">G</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Grok Chat</h1>
              <p className="text-sm text-gray-500">Powered by xAI</p>
            </div>
          </div>
          <Link to="/settings" className="p-2 hover:bg-gray-100 rounded-lg">
            <SettingsIcon size={24} className="text-gray-600" />
          </Link>
        </header>
      )}

      <div className="flex flex-1 relative overflow-hidden">
        {/* SIDEBAR */}
        <aside className={`fixed md:static inset-0 w-64 bg-white border-r z-50 transform transition-transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
          <div className="h-full flex flex-col">
            <div className="p-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 text-sm bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              <ProjectsList
                currentProjectId={currentProjectId}
                projects={filteredProjects}
                onSelectProject={(id) => { setCurrentProjectId(id); setCurrentConvId(null); setIsSidebarOpen(false); }}
                onCreateNew={createProject}
                onDeleteProject={(p) => { setProjectIdToDelete(p.id); setProjectTitleToDelete(p.title); setDeleteModalOpen(true); }}
                onUpdateTitle={(id, title) => supabase.from('projects').update({ title }).eq('id', id)}
                onOpenConfig={openConfig}
              />
              <ConversationsList
                currentConvId={currentConvId}
                conversations={filteredConversations}
                onSelectConv={(id) => { setCurrentConvId(id); setIsSidebarOpen(false); }}
                onCreateNew={createConversation}
                onDeleteConv={deleteConversation}
                currentProjectName={currentProject?.title || 'Default'}
              />
            </div>
          </div>
        </aside>

        {isSidebarOpen && <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={() => setIsSidebarOpen(false)} />}

        {/* MAIN CHAT */}
        <div className="flex-1 flex flex-col">
          {!isSettingsPage && (
            <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{currentConv?.title || 'New Conversation'}</h2>
              {currentProject && <button onClick={() => openConfig(currentProject)} className="p-2 hover:bg-gray-100 rounded-lg"><SettingsIcon size={20} /></button>}
            </div>
          )}

          <div className="flex-1 overflow-y-auto bg-gray-50">
            <div className="max-w-4xl mx-auto px-4 py-6 pb-24">
              <Routes>
                <Route path="/" element={
                  messages.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-center">
                      <div className="space-y-4">
                        <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center">
                          <span className="text-white font-bold text-4xl">G</span>
                        </div>
                        <h2 className="text-2xl font-bold">Start a conversation</h2>
                        <p className="text-gray-500">Ask me anything!</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {messages.map((m, i) => <ChatMessage key={m.id || i} message={m} />)}
                      {isLoading && (
                        <div className="flex gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                            <Loader2 className="w-5 h-5 text-white animate-spin" />
                          </div>
                          <div className="bg-gray-100 rounded-2xl px-4 py-3">
                            <div className="flex gap-1">
                              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150" />
                              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-300" />
                            </div>
                          </div>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                  )
                } />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </div>
          </div>

          {!isSettingsPage && (
            <div className="bg-white border-t">
              <div className="max-w-4xl mx-auto">
                <ChatInput
                  onSend={sendMessage}
                  disabled={isLoading || !settings.apiKey}
                  currentModel={settings.model}
                  onOpenModelSelector={() => setIsModelSelectorOpen(true)}
                  currentProjectId={currentProjectId}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CONFIG PANEL */}
      {configProject && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setConfigProject(null)} />
          <div className="relative w-full max-w-2xl bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{configProject.title}</h2>
                <p className="text-sm text-gray-500">Project Configuration</p>
              </div>
              <button onClick={() => setConfigProject(null)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={24} /></button>
            </div>

            <div className="flex border-b">
              <button onClick={() => setActiveTab('instructions')} className={`px-6 py-3 font-medium ${activeTab === 'instructions' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>Instructions</button>
              <button onClick={() => { setActiveTab('files'); loadProjectFiles(configProject.id); }} className={`px-6 py-3 font-medium ${activeTab === 'files' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>
                Files ({projectFiles.length})
              </button>
            </div>

            <div className="flex-1 p-6 overflow-y-auto">
              {activeTab === 'instructions' && (
                <textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  rows={15}
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  placeholder="You are a senior full-stack engineer..."
                />
              )}
              {activeTab === 'files' && (
                <div>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDrop={(e) => { e.preventDefault(); handleFileUpload(e.dataTransfer.files); }}
                    onDragOver={(e) => e.preventDefault()}
                    className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center cursor-pointer hover:border-blue-500"
                  >
                    <Upload size={48} className="mx-auto mb-4 text-gray-400" />
                    <p className="text-gray-600 font-medium">Drop files here or click</p>
                    <input ref={fileInputRef} type="file" multiple onChange={(e) => handleFileUpload(e.target.files)} className="hidden" />
                  </div>
                  {uploading && <p className="mt-4 text-blue-600">Uploading...</p>}
                  {projectFiles.map(file => (
                    <div key={file.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg mt-2">
                      <div className="flex items-center gap-3">
                        <File size={20} />
                        <span className="text-sm">{file.name}</span>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => downloadFile(file.name)} className="p-2 hover:bg-gray-200 rounded"><Download size={16} /></button>
                        <button onClick={() => deleteFile(file.name)} className="p-2 hover:bg-red-100 text-red-600 rounded"><Trash2 size={16} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {activeTab === 'instructions' && (
              <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
                <button onClick={() => setConfigProject(null)} className="px-6 py-2 bg-gray-100 rounded-lg">Cancel</button>
                <button onClick={saveInstructions} className="px-6 py-2 bg-blue-600 text-white rounded-lg">Save</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDeleteModalOpen(false)} />
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
            <h3 className="text-2xl font-bold mb-4">Delete "{projectTitleToDelete}"?</h3>
            <p className="text-gray-600 mb-8">This cannot be undone.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setDeleteModalOpen(false)} className="px-6 py-3 bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={async () => {
                if (!projectIdToDelete) return
                try {
                  await supabase.storage.from('project-files').remove([`project_${projectIdToDelete}/`])
                  await supabase.from('conversations').delete().eq('project_id', projectIdToDelete)
                  await supabase.from('projects').delete().eq('id', projectIdToDelete)
                  setProjects(prev => prev.filter(p => p.id !== projectIdToDelete))
                } catch (err) {
                  setError('Delete failed')
                } finally {
                  setDeleteModalOpen(false)
                  setConfigProject(null)
                }
              }} className="px-6 py-3 bg-red-600 text-white rounded-lg">Delete</button>
            </div>
          </div>
        </div>
      )}

      <ModelSelectorModal
        isOpen={isModelSelectorOpen}
        onClose={() => setIsModelSelectorOpen(false)}
        currentModel={settings.model}
        onSelectModel={(m) => setSettings({ ...settings, model: m })}
      />
    </div>
  )
}

export default App
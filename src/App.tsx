// src/App.tsx
import { useRef, useEffect, useState } from 'react'
import {
  Settings as SettingsIcon,
  Loader2,
  AlertCircle,
  Menu,
  X,
} from 'lucide-react'
import { Message, FileAttachment } from './types'
import { useSettings } from './hooks/useSettings'
import { useMessages } from './hooks/useMessages'
import { ModelSelectorModal } from './components/ModelSelectorModal'
import { ProjectsList } from './components/ProjectsList'
import { ConversationsList } from './components/ConversationsList'
import { ChatMessage } from './components/ChatMessage'
import { ChatInput } from './components/ChatInput'
import { SettingsPage } from './components/SettingsPage'
import {
  useLocation,
  useNavigate,
  Routes,
  Route,
  Link,
} from 'react-router-dom'
import { supabase } from './lib/supabase'

function App() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

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
    switchConversation,
    switchProject,
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

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const navigate = useNavigate()
  const isSettingsPage = location.pathname === '/settings'

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) await supabase.auth.signInAnonymously()
    }
    init()
  }, [])

  const handleSelectProject = (id: string) => {
    setCurrentProjectId(id)
    setCurrentConvId(null)
    setIsSidebarOpen(false)
  }

  const handleSelectConv = (id: string) => {
    setCurrentConvId(id)
    setIsSidebarOpen(false)
  }

  const handleCreateNewProject = () => createProject()
  const handleCreateNewConv = () => createConversation()
  const handleDeleteConv = (id: string) => deleteConversation(id)

  const handleUpdateTitle = (id: string, title: string, isProject: boolean) => {
    if (isProject) {
      handleUpdateProjectTitle(id, title)
    } else {
      updateConversationTitle(id, title)
    }
  }

  const handleDeleteProject = async (projectId: string) => {
    if (!confirm('Delete project and move conversations to default?')) return

    const { error } = await supabase.from('projects').delete().eq('id', projectId)
    if (error) {
      setError('Failed to delete project')
      return
    }

    await supabase.from('conversations').update({ project_id: null }).eq('project_id', projectId)

    setProjects(prev => prev.filter(p => p.id !== projectId))
    if (currentProject?.id === projectId) {
      setCurrentProject(null)
      setCurrentProjectId(null)
    }
  }

  // FIXED: syntax error on line 140
  const handleUpdateProjectTitle = async (projectId: string, newTitle: string) => {
    const trimmed = newTitle.trim()
    if (!trimmed) {
      setError('Project name cannot be empty')
      return
    }

    const { error } = await supabase
      .from('projects')
      .update({ title: trimmed, updated_at: new Date().toISOString() })
      .eq('id', projectId)

    if (error) {
      console.error('Rename failed:', error)
      setError('Could not rename project')
      return
    }

    setProjects(prev =>
      prev.map(p => (p.id === projectId ? { ...p, title: trimmed } : p))
    )
    if (currentProject?.id === projectId) {
      setCurrentProject({ ...currentProject, title: trimmed }) // ← FIXED: was "title:eab trimmed"
    }
  }

  const sendMessage = async (content: string, attachments?: FileAttachment[]) => {
    if (!settings.apiKey) {
      setError('Set API key in Settings')
      navigate('/settings')
      return
    }
    if (!currentConv) {
      setError('No conversation selected')
      return
    }

    const userMsg: Omit<Message, 'id'> = {
      role: 'user',
      content,
      timestamp: Date.now(),
      attachments,
    }

    try {
      await addMessage(userMsg)
    } catch {
      setError('Failed to save')
      return
    }

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
            ...messages.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content },
          ],
        }),
      })

      if (!res.ok) throw new Error(`API error ${res.status}`)
      const data = await res.json()

      await addMessage({
        role: 'assistant',
        content: data.choices?.[0]?.message?.content || 'No response',
        timestamp: Date.now(),
      })
    } catch (e: any) {
      setError(e.message || 'Failed')
    } finally {
      setIsLoading(false)
    }
  }

  const hasApiKey = Boolean(settings.apiKey)

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
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="md:hidden p-2 hover:bg-gray-100 rounded-lg"
            >
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

      {/* MAIN LAYOUT */}
      <div className="flex flex-1 overflow-hidden">
        {/* SIDEBAR */}
        <div
          className={`
            fixed md:relative 
            inset-y-0 left-0 z-40 
            w-64 bg-white border-r border-gray-200 
            transform transition-transform duration-200 ease-in-out
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          `}
        >
          <div className="flex h-full">
            <ProjectsList
              currentProjectId={currentProjectId}
              projects={projects}
              onSelectProject={handleSelectProject}
              onCreateNew={handleCreateNewProject}
              onDeleteProject={handleDeleteProject}
              onUpdateTitle={handleUpdateProjectTitle}
            />
            <ConversationsList
              currentConvId={currentConvId}
              conversations={conversations}
              onSelectConv={handleSelectConv}
              onCreateNew={handleCreateNewConv}
              onDeleteConv={handleDeleteConv}
              onUpdateTitle={handleUpdateTitle}
            />
          </div>
        </div>

        {/* Mobile overlay */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* MAIN CONTENT */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!isSettingsPage && (
            <div className="border-b bg-white px-4 py-2">
              <h2 className="text-lg font-semibold text-gray-900">
                {currentConv?.title || 'New Conversation'}
              </h2>
            </div>
          )}

          <Routes>
            <Route
              path="/"
              element={
                <div className="flex-1 overflow-y-auto">
                  <div className="max-w-4xl mx-auto px-4 py-6">
                    {messages.length === 0 ? (
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
                        {messages.map((m, i) => (
                          <ChatMessage key={m.id || i} message={m} />
                        ))}
                        {isLoading && (
                          <div className="flex gap-3">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                              <Loader2 className="w-5 h-5 text-white animate-spin" />
                            </div>
                            <div className="bg-gray-100 rounded-2xl px-4 py-3">
                              <div className="flex gap-1">
                                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150" />
                                <span className="w-2 h-2 bg-gray-400 rounded
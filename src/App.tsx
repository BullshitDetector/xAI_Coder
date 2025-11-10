// src/App.tsx
import { useRef, useEffect, useState } from 'react'
import {
  Settings as SettingsIcon,
  Loader2,
  AlertCircle,
  Menu,
  X,
  Search,
  MoreVertical,
  FileText,
  MessageSquare,
  Code,
  ChevronRight,
  Upload,
  Trash2,
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
  const [searchQuery, setSearchQuery] = useState('')
  const [configProject, setConfigProject] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'instructions' | 'files' | 'history'>('instructions')
  const [instructions, setInstructions] = useState('')

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

  const filteredProjects = projects.filter(p =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const filteredConversations = conversations.filter(c =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

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

  const openConfig = async (project: any) => {
    setConfigProject(project)
    setActiveTab('instructions')
    const { data } = await supabase
      .from('projects')
      .select('instructions')
      .eq('id', project.id)
      .single()
    setInstructions(data?.instructions || '')
  }

  const saveInstructions = async () => {
    if (!configProject) return
    await supabase
      .from('projects')
      .update({ instructions })
      .eq('id', configProject.id)
  }

  const handleSelectProject = (id: string) => {
    setCurrentProjectId(id)
    setCurrentConvId(null)
    setIsSidebarOpen(false)
    setConfigProject(null)
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
    setConfigProject(null)
  }

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
      setCurrentProject({ ...currentProject, title: trimmed })
    }
    if (configProject?.id === projectId) {
      setConfigProject({ ...configProject, title: trimmed })
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
            ...(instructions ? [{ role: 'system', content: instructions }] : []),
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
              className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
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
          <Link to="/settings" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <SettingsIcon size={24} className="text-gray-600" />
          </Link>
        </header>
      )}

      {/* MAIN LAYOUT */}
      <div className="flex flex-1 relative overflow-hidden">
        {/* SIDEBAR */}
        <aside
          className={`
            fixed md:static inset-0 w-64 bg-white border-r border-gray-200
            z-50 transform transition-transform duration-300 ease-in-out
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          `}
        >
          <div className="h-full flex flex-col">
            {/* SEARCH BAR */}
            <div className="px-3 pt-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search projects & conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 text-sm bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <ProjectsList
                currentProjectId={currentProjectId}
                projects={filteredProjects}
                onSelectProject={handleSelectProject}
                onCreateNew={handleCreateNewProject}
                onDeleteProject={handleDeleteProject}
                onUpdateTitle={handleUpdateProjectTitle}
                showNewButton={true}
                onOpenConfig={openConfig}
              />
              <ConversationsList
                currentConvId={currentConvId}
                conversations={filteredConversations}
                onSelectConv={handleSelectConv}
                onCreateNew={handleCreateNewConv}
                onDeleteConv={handleDeleteConv}
                onUpdateTitle={handleUpdateTitle}
                currentProjectName={currentProject?.title || 'Default Project'}
              />
            </div>
          </div>
        </aside>

        {/* Mobile overlay */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 z-40 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* MAIN CONTENT */}
        <div className="flex-1 flex flex-col relative">
          {/* Chat header */}
          {!isSettingsPage && (
            <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {currentConv?.title || 'New Conversation'}
              </h2>
              {currentProject && (
                <button
                  onClick={() => openConfig(currentProject)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <SettingsIcon size={20} className="text-gray-600" />
                </button>
              )}
            </div>
          )}

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto bg-gray-50">
            <div className="max-w-4xl mx-auto px-4 py-6 pb-24">
              <Routes>
                <Route
                  path="/"
                  element={
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
                                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-300" />
                              </div>
                            </div>
                          </div>
                        )}
                        <div ref={messagesEndRef} />
                      </div>
                    )
                  }
                />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </div>
          </div>

          {/* INPUT */}
          {!isSettingsPage && (
            <div className="bg-white border-t">
              <div className="max-w-4xl mx-auto">
                <ChatInput
                  onSend={sendMessage}
                  disabled={isLoading || !hasApiKey}
                  currentModel={settings.model}
                  onOpenModelSelector={() => setIsModelSelectorOpen(true)}
                  currentProjectId={currentProjectId}
                />
              </div>
            </div>
          )}
        </div>

        {/* PROJECT CONFIG PANEL */}
        {configProject && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-black/50" onClick={() => setConfigProject(null)} />
            <div className="relative w-full max-w-2xl bg-white shadow-2xl translate-x-0 animate-in slide-in-from-right">
              <div className="flex items-center justify-between p-6 border-b">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{configProject.title}</h2>
                  <p className="text-sm text-gray-500">Project Configuration</p>
                </div>
                <button
                  onClick={() => setConfigProject(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex border-b">
                <button
                  onClick={() => setActiveTab('instructions')}
                  className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                    activeTab === 'instructions'
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Code className="w-4 h-4 inline mr-2" />
                  Instructions
                </button>
                <button
                  onClick={() => setActiveTab('files')}
                  className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                    activeTab === 'files'
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <FileText className="w-4 h-4 inline mr-2" />
                  Files
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                    activeTab === 'history'
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <MessageSquare className="w-4 h-4 inline mr-2" />
                  History
                </button>
              </div>

              <div className="p-6 h-full max-h-[calc(100vh-12rem)] overflow-y-auto">
                {activeTab === 'instructions' && (
                  <div>
                    <textarea
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                      placeholder="Enter system instructions for this project..."
                      className="w-full h-96 p-4 border rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button
                      onClick={saveInstructions}
                      className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Save Instructions
                    </button>
                  </div>
                )}

                {activeTab === 'files' && (
                  <div className="text-center py-12">
                    <FileText className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500">No files uploaded yet</p>
                    <button className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                      <Upload className="w-4 h-4 inline mr-2" />
                      Upload Files
                    </button>
                  </div>
                )}

                {activeTab === 'history' && (
                  <div className="text-center py-12">
                    <MessageSquare className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500">Message history will appear here</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ALERTS */}
      {!isSettingsPage && !hasApiKey && (
        <div className="fixed bottom-24 left-4 right-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4 z-50 shadow-lg">
          <div className
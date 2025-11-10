// src/App.tsx
import { useRef, useEffect, useState } from 'react'
import {
  Settings as SettingsIcon,
  Loader2,
  AlertCircle,
  Menu,
  X,
  Search,
  FileText,
  MessageSquare,
  Code,
  Upload,
  Trash2,
  Folder,
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

  // DELETE MODAL – BULLETPROOF ID + TITLE
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

  // FIXED: Proper Supabase query for project config
  const openConfig = async (project: any) => {
    setConfigProject(project)
    setActiveTab('instructions')

    try {
      const { data, error } = await supabase
        .from('projects')
        .select('instructions')
        .eq('id', project.id)
        .single()

      if (error) {
        console.error('Failed to load instructions:', error)
        setInstructions('')
        setError('Could not load project settings')
      } else {
        setInstructions(data?.instructions || '')
      }
    } catch (err) {
      console.error('Unexpected error loading config:', err)
      setInstructions('')
      setError('Failed to load project')
    }
  }

  // FIXED: Proper save with error handling
  const saveInstructions = async () => {
    if (!configProject) return

    const { error } = await supabase
      .from('projects')
      .update({ 
        instructions, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', configProject.id)

    if (error) {
      console.error('Save failed:', error)
      setError('Could not save instructions')
    } else {
      setError(null)
    }
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

  // OPEN DELETE MODAL
  const openDeleteModal = (project: { id: string; title: string }) => {
    setProjectIdToDelete(project.id)
    setProjectTitleToDelete(project.title)
    setDeleteModalOpen(true)
  }

  // CONFIRM DELETE – 100% RELIABLE
  const confirmDelete = async () => {
    if (!projectIdToDelete) {
      setError('No project selected')
      return
    }

    try {
      // 1. Delete files
      const { data: files } = await supabase.storage
        .from('project-files')
        .list(`project_${projectIdToDelete}`)

      if (files && files.length > 0) {
        const filePaths = files.map(f => `project_${projectIdToDelete}/${f.name}`)
        await supabase.storage.from('project-files').remove(filePaths)
      }

      // 2. Delete conversations
      const { data: convs } = await supabase
        .from('conversations')
        .select('id')
        .eq('project_id', projectIdToDelete)

      if (convs && convs.length > 0) {
        await supabase.from('conversations').delete().in('id', convs.map(c => c.id))
      }

      // 3. Delete project
      const { error: deleteError } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectIdToDelete)

      if (deleteError) throw deleteError

      // 4. Update UI
      setProjects(prev => prev.filter(p => p.id !== projectIdToDelete))
      if (currentProject?.id === projectIdToDelete) {
        setCurrentProject(null)
        setCurrentProjectId(null)
      }
      setConfigProject(null)

      // SUCCESS
      setProjectIdToDelete(null)
      setProjectTitleToDelete('')
      setDeleteModalOpen(false)
    } catch (err: any) {
      console.error('Delete failed:', err)
      setError(err.message || 'Failed to delete project')
    }
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
        <aside className={`
          fixed md:static inset-0 w-64 bg-white border-r border-gray-200
          z-50 transform transition-transform duration-300 ease-in-out
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}>
          <div className="h-full flex flex-col">
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
                onDeleteProject={openDeleteModal}
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
      </div>

      {/* CONFIG PANEL */}
      {configProject && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setConfigProject(null)} />
          <div className="relative w-full max-w-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{configProject.title}</h2>
                <p className="text-sm text-gray- Universities">Project Configuration</p>
              </div>
              <button onClick={() => setConfigProject(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={24} />
              </button>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  System Instructions
                </label>
                <textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  rows={12}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="Enter instructions for this project (optional)..."
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setConfigProject(null)}
                  className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={saveInstructions}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  Save Instructions
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {deleteModalOpen && projectIdToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDeleteModalOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-8">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 size={32} className="text-red-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">
                Permanently delete "{projectTitleToDelete}"?
              </h3>
              <p className="text-gray-600 mb-8">
                This will delete:
                <br />
                <strong>• The project</strong>
                <br />
                <strong>• All conversations</strong>
                <br />
                <strong>• All uploaded files</strong>
                <br />
                <br />
                This action <strong>cannot be undone</strong>.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setDeleteModalOpen(false)}
                  className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                >
                  Delete Everything
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ALERTS */}
      {!isSettingsPage && !hasApiKey && (
        <div className="fixed bottom-24 left-4 right-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4 z-50 shadow-lg">
          <div className="flex items-center gap-3 text-yellow-800">
            <AlertCircle size={20} />
            <p className="text-sm font-medium">Add your API key in Settings to start chatting</p>
            <button onClick={() => navigate('/settings')} className="ml-auto underline text-sm font-medium">
              Settings
            </button>
          </div>
        </div>
      )}

      {!isSettingsPage && error && (
        <div className="fixed bottom-24 left-4 right-4 bg-red-50 border border-red-200 rounded-lg p-4 z-50 shadow-lg">
          <div className="flex items-center gap-3 text-red-800">
            <AlertCircle size={20} />
            <p className="text-sm font-medium">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto text-sm font-medium">
              Dismiss
            </button>
          </div>
        </div>
      )}

      <ModelSelectorModal
        isOpen={isModelSelectorOpen}
        onClose={() => setIsModelSelectorOpen(false)}
        currentModel={settings.model}
        onSelectModel={model => setSettings({ ...settings, model })}
      />
    </div>
  )
}

export default App
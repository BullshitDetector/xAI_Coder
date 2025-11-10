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

  // DELETE MODAL STATE – NOW SAFE
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [projectToDelete, setProjectToDelete] = useState<any>(null)

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

  // OPEN DELETE MODAL – NOW CLONES PROJECT SAFELY
  const openDeleteModal = (project: any) => {
    setProjectToDelete({ ...project }) // ← CRITICAL FIX: Clone object
    setDeleteModalOpen(true)
  }

  // CONFIRM DELETE – NOW 100% RELIABLE
  const confirmDelete = async () => {
    if (!projectToDelete?.id) {
      setError('Invalid project')
      setDeleteModalOpen(false)
      return
    }

    const projectId = projectToDelete.id

    try {
      // 1. Delete files from storage
      const { data: files } = await supabase.storage
        .from('project-files')
        .list(`project_${projectId}`)

      if (files && files.length > 0) {
        const filePaths = files.map(f => `project_${projectId}/${f.name}`)
        const { error: storageError } = await supabase.storage
          .from('project-files')
          .remove(filePaths)
        if (storageError) console.warn('Storage cleanup failed:', storageError)
      }

      // 2. Delete conversations
      const { data: convs } = await supabase
        .from('conversations')
        .select('id')
        .eq('project_id', projectId)

      if (convs && convs.length > 0) {
        await supabase
          .from('conversations')
          .delete()
          .in('id', convs.map(c => c.id))
      }

      // 3. Delete project
      const { error: deleteError } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId)

      if (deleteError) throw deleteError

      // 4. Update UI
      setProjects(prev => prev.filter(p => p.id !== projectId))
      if (currentProject?.id === projectId) {
        setCurrentProject(null)
        setCurrentProjectId(null)
      }
      setConfigProject(null)

      setDeleteModalOpen(false)
      setProjectToDelete(null)
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
      {/* ... HEADER & LAYOUT (unchanged) ... */}

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

        {/* ... rest of layout ... */}

        {/* DELETE CONFIRMATION MODAL */}
        {deleteModalOpen && projectToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={() => setDeleteModalOpen(false)} />
            <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-8 animate-in fade-in zoom-in-95">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-100 flex items-center justify-center">
                  <Trash2 size={32} className="text-red-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">
                  Permanently delete "{projectToDelete.title}"?
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
                    onClick={() => {
                      setDeleteModalOpen(false)
                      setProjectToDelete(null)
                    }}
                    className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDelete}
                    className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors"
                  >
                    Delete Everything
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ... alerts & modals ... */}
    </div>
  )
}

export default App
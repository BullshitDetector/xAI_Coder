import { useState, useEffect, useRef } from 'react'
import { supabase, getUserId } from '../lib/supabase'
import { Message, FileAttachment, Conversation, Project } from '../types'

export function useMessages(currentConvId?: string, currentProjectId?: string) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConv, setCurrentConv] = useState<Conversation | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [currentProject, setCurrentProject] = useState<Project | null>(null)
  const userIdRef = useRef<string | null>(null)
  const initializedRef = useRef(false)

  // Define all functions first to ensure scope for addMessage
  const loadProjects = async () => {
    const userId = userIdRef.current
    if (!userId) return

    const { data, error } = await supabase
      .from('projects')
      .select('id, title, created_at, updated_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error loading projects:', error)
      setProjects([])
    } else {
      setProjects(data || [])
    }
  }

  const loadConversations = async (projectId?: string) => {
    const userId = userIdRef.current
    if (!userId) return

    let query = supabase
      .from('conversations')
      .select('id, title, created_at, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })

    if (projectId) {
      query = query.eq('project_id', projectId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error loading conversations:', error)
      setConversations([])
    } else {
      setConversations(data || [])
    }
  }

  const switchProject = async (projectId: string) => {
    const userId = userIdRef.current
    if (!userId) return

    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .select('id, title, created_at, updated_at')
      .eq('id', projectId)
      .single()

    if (projectError) {
      console.error('Error switching project:', projectError)
      return
    }

    setCurrentProject(projectData)
    await loadConversations(projectId)
    // Reset to no current conv when switching project
    setCurrentConv(null)
  }

  const switchConversation = async (convId: string) => {
    const userId = userIdRef.current
    if (!userId) return

    setIsLoading(true)
    const { data: convData, error: convError } = await supabase
      .from('conversations')
      .select('id, title, created_at, updated_at')
      .eq('id', convId)
      .single()

    if (convError) {
      console.error('Error switching conversation:', convError)
      return
    }

    setCurrentConv(convData)
    await loadMessages(convId)
  }

  const loadMessages = async (convId: string) => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('timestamp', { ascending: true })

    if (error) {
      console.error('Error loading messages:', error)
      setMessages([])
    } else {
      // Parse attachments from JSONB
      const parsedMessages: Message[] = (data || []).map((msg: any) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.timestamp).getTime(),
        attachments: JSON.parse(msg.attachments || '[]') as FileAttachment[],
      }))
      setMessages(parsedMessages)
    }
    setIsLoading(false)
  }

  const createProject = async (title: string = 'New Project') => {
    const userId = userIdRef.current
    if (!userId) return

    // Check if project with this title already exists for user
    const { data: existing } = await supabase
      .from('projects')
      .select('id')
      .eq('user_id', userId)
      .eq('title', title)
      .single()

    if (existing) {
      // If exists, switch to it instead of creating duplicate
      await switchProject(existing.id)
      return
    }

    const { data: newProject, error } = await supabase
      .from('projects')
      .insert({ user_id: userId, title })
      .select('id, title, created_at, updated_at')
      .single()

    if (error) {
      console.error('Error creating project:', error)
      return
    }

    setProjects([newProject, ...projects])
    await switchProject(newProject.id)
  }

  const createConversation = async (title: string = 'New Conversation') => {
    const userId = userIdRef.current
    if (!userId) return

    const projectId = currentProject ? currentProject.id : null

    const { data: newConv, error } = await supabase
      .from('conversations')
      .insert({ user_id: userId, title, project_id: projectId })
      .select('id, title, created_at, updated_at')
      .single()

    if (error) {
      console.error('Error creating conversation:', error)
      return
    }

    setConversations([newConv, ...conversations])
    await switchConversation(newConv.id)
  }

  const deleteConversation = async (convId: string) => {
    const userId = userIdRef.current
    if (!userId) return

    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', convId)

    if (error) {
      console.error('Error deleting conversation:', error)
      return
    }

    setConversations(conversations.filter(c => c.id !== convId))
    if (currentConv?.id === convId) {
      // Switch to another or create new
      const nextConv = conversations[0]
      if (nextConv) {
        await switchConversation(nextConv.id)
      } else {
        await createConversation('New Conversation')
      }
    }
  }

  const updateConversationTitle = async (convId: string, newTitle: string) => {
    const userId = userIdRef.current
    if (!userId) return

    const { error } = await supabase
      .from('conversations')
      .update({ title: newTitle })
      .eq('id', convId)

    if (error) {
      console.error('Error updating conversation title:', error)
      return
    }

    setConversations(conversations.map(c => c.id === convId ? { ...c, title: newTitle } : c))
    if (currentConv?.id === convId) {
      setCurrentConv({ ...currentConv, title: newTitle })
    }
  }

  const addMessage = async (message: Omit<Conversation, 'id'>) => {
    const userId = userIdRef.current
    if (!userId) {
      throw new Error('User ID not available. Please refresh.')
    }

    if (!currentConv) {
      throw new Error('No active conversation. Please select or create one.')
    }

    const dbMessage = {
      conversation_id: currentConv.id,
      role: message.role,
      content: message.content,
      timestamp: new Date(message.timestamp),
      attachments: JSON.stringify(message.attachments || []),
    }

    const { data, error } = await supabase
      .from('messages')
      .insert(dbMessage)
      .select()
      .single()

    if (error) {
      console.error('Error adding message:', error)
      throw error
    }

    // Add to local state with DB-generated ID
    const fullMessage: Conversation = { ...message, id: data.id }
    setMessages((prev) => [...prev, fullMessage])

    // Update conversation timestamp
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', currentConv.id)

    // Refresh conversations list for updated_at
    await loadConversations(currentProject ? currentProject.id : undefined)
  }

  useEffect(() => {
    if (initializedRef.current) return

    async function initialize() {
      setIsLoading(true)
      const userId = await getUserId()
      if (!userId) {
        setIsLoading(false)
        return
      }
      userIdRef.current = userId

      await loadProjects()

      const { data: convData, error } = await supabase
        .from('conversations')
        .select('id, title, created_at, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })

      if (error) {
        console.error('Error loading conversations:', error)
      } else {
        setConversations(convData || [])
      }

      if (currentProjectId) {
        await switchProject(currentProjectId)
      } else {
        const defaultProject = projects[0]
        if (defaultProject) {
          await switchProject(defaultProject.id)
        } else {
          await createProject('Default Project')
        }
      }

      if (currentConvId) {
        await switchConversation(currentConvId)
      } else {
        // Use fetched data directly to avoid state lag
        const latestConvData = convData?.[0]
        if (latestConvData) {
          await switchConversation(latestConvData.id)
        } else {
          await createConversation('New Conversation')
        }
      }
      setIsLoading(false)
      initializedRef.current = true
    }

    initialize()
  }, [])

  // Add useEffect to react to currentConvId prop changes for switching
  useEffect(() => {
    if (!initializedRef.current || !currentConvId) return

    switchConversation(currentConvId)
  }, [currentConvId])

  return { 
    messages, 
    conversations, 
    currentConv, 
    projects,
    currentProject,
    addMessage, 
    isLoading,
    switchConversation,
    switchProject,
    createConversation,
    createProject,
    deleteConversation,
    updateConversationTitle 
  }
}
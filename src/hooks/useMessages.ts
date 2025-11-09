import { useState, useEffect, useRef } from 'react'
import { supabase, getUserId } from '../lib/supabase'
import { Message, FileAttachment, Conversation } from '../types'

export function useMessages(currentConvId?: string) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConv, setCurrentConv] = useState<Conversation | null>(null)
  const userIdRef = useRef<string | null>(null)
  const initializedRef = useRef(false)

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

  const createConversation = async (title: string = 'New Conversation') => {
    const userId = userIdRef.current
    if (!userId) return

    const { data: newConv, error } = await supabase
      .from('conversations')
      .insert({ user_id: userId, title })
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

  const addMessage = async (message: Omit<Message, 'id'>) => {
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
    const fullMessage: Message = { ...message, id: data.id }
    setMessages((prev) => [...prev, fullMessage])

    // Update conversation timestamp
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', currentConv.id)

    // Refresh conversations list for updated_at
    await loadConversations()
  }

  return { 
    messages, 
    conversations, 
    currentConv, 
    addMessage, 
    isLoading,
    switchConversation,
    createConversation,
    deleteConversation,
    updateConversationTitle 
  }
}
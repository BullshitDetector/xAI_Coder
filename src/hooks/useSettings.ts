// src/hooks/useSettings.ts
import { create } from 'zustand'
import { supabase } from '../lib/supabase'

interface Settings {
  apiKey: string
  baseUrl: string
  model: string
  logoUrl: string
}

interface SettingsStore extends Settings {
  isLoading: boolean
  setSettings: (settings: Partial<Settings>) => Promise<void>
}

export const useSettings = create<SettingsStore>((set, get) => ({
  apiKey: '',
  baseUrl: 'https://api.x.ai',
  model: 'auto',
  logoUrl: '',
  isLoading: true,

  setSettings: async (newSettings) => {
    const current = get()
    const updated = { ...current, ...newSettings }

    const { error } = await supabase
      .from('settings')
      .upsert({
        id: 'global',
        ...updated,
      })

    if (!error) {
      set({ ...updated })
    }
  },

  // AUTO-LOAD ON START
  init: async () => {
    set({ isLoading: true })
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('id', 'global')
      .single()

    if (data) {
      set({
        apiKey: data.apiKey || '',
        baseUrl: data.baseUrl || 'https://api.x.ai',
        model: data.model || 'auto',
        logoUrl: data.logoUrl || '',
        isLoading: false,
      })
    } else {
      // Create default row if none exists
      await supabase.from('settings').insert({
        id: 'global',
        apiKey: '',
        baseUrl: 'https://api.x.ai',
        model: 'auto',
        logoUrl: '',
      })
      set({ isLoading: false })
    }
  },
}))

// CRITICAL: INIT ON LOAD
useSettings.getState().init()
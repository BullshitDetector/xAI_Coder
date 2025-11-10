// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://vrcxtkstyeutxwhllnws.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZyY3h0a3N0eWV1dHh3aGxsbndzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzEyNzQ3NzcsImV4cCI6MjA0Njg1MDc3N30.q1L5x9k9t5v5u5v5w5x5y5z5A5B5C5D5E5F5G5H5I5J' // ← YOUR ANON KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  global: {
    headers: {
      // THIS IS THE MAGIC LINE
      apikey: supabaseAnonKey,
      // Optional: force content-type
      'Content-Type': 'application/json',
    },
  },
})
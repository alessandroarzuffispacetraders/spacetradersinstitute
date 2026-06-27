import { createClient } from '@supabase/supabase-js'

// .trim() guards against a stray trailing newline/space in the env var,
// which would corrupt the Realtime WebSocket apikey (sent as a URL param).
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string).trim()
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string).trim()

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

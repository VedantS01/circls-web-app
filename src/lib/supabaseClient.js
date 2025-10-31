import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in environment')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export default supabase

// Expose client for debugging in development only
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  try {
    window.supabase = supabase
  } catch (e) {
    // ignore in non-browser environments
  }
}

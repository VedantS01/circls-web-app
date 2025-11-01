import { createClient } from '@supabase/supabase-js'

// Server-side Supabase client that uses the service role key. Only use on server.
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  // In development we allow missing keys to avoid crashing CI; the endpoint will surface a helpful error.
  if (process.env.NODE_ENV === 'development') {
    console.warn('supabaseAdminClient: Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE in environment; generate_link calls will fail.')
  } else {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY (server-only) in environment')
  }
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false
  },
  // Explicitly disable RLS for admin operations
  db: {
    schema: 'public'
  }
})

export default supabaseAdmin

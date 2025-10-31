import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdminClient'

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}))
    const userId = body?.userId
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    // Try to verify the auth user exists if admin API is available. If not, fall back and attempt to create the profile row
    try {
      if (supabaseAdmin.auth && supabaseAdmin.auth.admin && typeof supabaseAdmin.auth.admin.getUserById === 'function') {
        const res = await supabaseAdmin.auth.admin.getUserById(userId)
        const authUser = res?.data ?? res?.user ?? null
        const authErr = res?.error ?? null
        if (authErr) {
          // If user_not_found, return a 404 with helpful hint instead of attempting to insert a profiles row
          if (authErr.status === 404 || authErr.code === 'user_not_found') {
            return NextResponse.json({ error: 'Auth user not found', detail: 'The provided userId does not exist in auth.users. Verify the session and that SUPABASE_SERVICE_ROLE_KEY points to the same project.' }, { status: 404 })
          }
          // For other admin errors, log and continue to attempt insert (insert may still fail due to FK)
          console.warn('ensure-profile: admin.getUserById returned error', authErr)
        } else if (!authUser) {
          return NextResponse.json({ error: 'Auth user lookup returned no user', detail: 'admin.getUserById returned no data' }, { status: 404 })
        }
      } else {
        console.warn('ensure-profile: admin.getUserById not available on supabaseAdmin client; attempting insert')
      }

      // Attempt to create a profiles row with the same id using the admin client
      const { data, error } = await supabaseAdmin.from('profiles').insert([{ id: userId }]).select().maybeSingle()
      if (error) return NextResponse.json({ error: error.message, detail: error }, { status: 500 })
      return NextResponse.json({ profile: data })
    } catch (err) {
      console.error('ensure-profile: unexpected error', err)
      return NextResponse.json({ error: 'unexpected error', details: String(err) }, { status: 500 })
    }
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

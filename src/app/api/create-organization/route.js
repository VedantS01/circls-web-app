import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdminClient'

export async function POST(req) {
  if (!supabaseAdmin) return NextResponse.json({ error: 'Admin client not configured' }, { status: 501 })

  try {
  const body = await req.json().catch(() => ({}))
  const token = body?.access_token || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const payload = body?.payload || {}
  const fallbackUserId = body?.userId || null

    if (!token) return NextResponse.json({ error: 'Missing access token' }, { status: 401 })

    // Verify token with admin to obtain the user id. This avoids relying on client anon keys for inserts.
    try {
      // Some Supabase admin clients expose getUserByCookie or getUser; prefer admin.getUserById if provided
      // Try to resolve the user from the provided access token first.
      // Different supabase-js versions expose different helpers; try several.
      let user = null
      if (token) {
        try {
          if (supabaseAdmin.auth && typeof supabaseAdmin.auth.getUser === 'function') {
            const userRes = await supabaseAdmin.auth.getUser(token)
            user = userRes?.data?.user || userRes?.user || null
          } else if (supabaseAdmin.auth && supabaseAdmin.auth.api && typeof supabaseAdmin.auth.api.getUser === 'function') {
            const userRes = await supabaseAdmin.auth.api.getUser(token)
            user = userRes?.data?.user || userRes?.user || null
          }
        } catch (e) {
          console.warn('create-organization: token-based lookup threw', e)
          user = null
        }
      }

      // If token-based lookup failed but client sent a userId, verify that user exists via admin API
      if (!user && fallbackUserId && supabaseAdmin.auth && supabaseAdmin.auth.admin && typeof supabaseAdmin.auth.admin.getUserById === 'function') {
        try {
          const who = await supabaseAdmin.auth.admin.getUserById(fallbackUserId)
          user = who?.data?.user || who?.user || null
        } catch (e) {
          console.warn('create-organization: admin.getUserById threw', e)
          user = null
        }
      }

      // If still no user but token looks like a UUID, try treating token as a userId
      if (!user && token && /^[0-9a-fA-F-]{36}$/.test(token) && supabaseAdmin.auth && supabaseAdmin.auth.admin && typeof supabaseAdmin.auth.admin.getUserById === 'function') {
        try {
          const who = await supabaseAdmin.auth.admin.getUserById(token)
          user = who?.data?.user || who?.user || null
        } catch (e) {
          console.warn('create-organization: admin.getUserById(token-as-id) threw', e)
          user = null
        }
      }

      if (!user) {
        return NextResponse.json({ error: 'Invalid token or unable to verify user' }, { status: 401 })
      }

      const userId = user.id

      // Optional: ensure email confirmed before allowing org creation
      const confirmed = user.email_confirmed_at || user.confirmed_at
      if (!confirmed) return NextResponse.json({ error: 'Email not confirmed' }, { status: 403 })

      const insertPayload = {
        name: (payload.name || '').trim(),
        description: payload.description || null,
        contact_info: payload.contact_info || null,
        created_by: userId,
      }

      const { data, error } = await supabaseAdmin.from('organizations').insert([insertPayload]).select().maybeSingle()
      if (error) return NextResponse.json({ error: error.message, detail: error }, { status: 500 })

      return NextResponse.json({ organization: data })
    } catch (err) {
      console.error('create-organization error', err)
      return NextResponse.json({ error: String(err) }, { status: 500 })
    }
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

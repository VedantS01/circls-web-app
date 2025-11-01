import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdminClient'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export async function POST(request) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: 'Supabase environment not configured' }, { status: 500 })
  }

  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return NextResponse.json({ error: 'Missing access token' }, { status: 401 })
    }

    const accessToken = authHeader.substring(7)
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
      auth: { persistSession: false },
    })

    const body = await request.json().catch(() => ({}))
    const email = body?.email?.trim()
    const organizationId = body?.organization_id
    const destinationId = body?.destination_id

    if (!email || !organizationId || !destinationId) {
      return NextResponse.json({ error: 'Missing email, organization_id or destination_id' }, { status: 400 })
    }

  const token = randomUUID().replace(/-/g, '')
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString()

    const { data: invite, error } = await supabaseUser
      .from('staff_invites')
      .insert([
        {
          organization_id: organizationId,
          destination_id: destinationId,
          invited_email: email,
          token,
          expires_at: expiresAt,
        },
      ])
      .select()
      .maybeSingle()

    if (error) {
      const status = error.code === '42501' ? 403 : 500
      return NextResponse.json({ error: error.message }, { status })
    }

    let generatedLink = null
    if (supabaseAdmin && supabaseAdmin.auth?.admin?.generateLink) {
      try {
        const result = await supabaseAdmin.auth.admin.generateLink({ type: 'signup', email, password: null })
        generatedLink = result?.data?.link || null
      } catch (err) {
        console.warn('staff-invite: generateLink failed', err?.message || err)
      }
    }

    const fallbackLink = `/accept-invite?token=${invite.token}`

    return NextResponse.json({
      message: 'Invite created',
      invite,
      link: generatedLink || fallbackLink,
    })
  } catch (err) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}

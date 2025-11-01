import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdminClient'

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    
    // Extract token from body or Authorization header
    const token = body?.access_token || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized - Missing access token' }, { status: 401 })
    }

    // Verify token and get user
    let user = null
    if (supabaseAdmin.auth && typeof supabaseAdmin.auth.getUser === 'function') {
      const userRes = await supabaseAdmin.auth.getUser(token)
      user = userRes?.data?.user || userRes?.user || null
    }
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized - Invalid token' }, { status: 401 })
    }

    const email = body?.email?.trim()
    const organizationId = body?.organizationId
    const destinationId = body?.destinationId

    if (!email || !organizationId || !destinationId) {
      return NextResponse.json({ error: 'Missing email, organizationId or destinationId' }, { status: 400 })
    }

    // Verify user has staff_manager permission
    const { data: membership } = await supabaseAdmin
      .from('organization_memberships')
      .select('permissions')
      .eq('organization_id', organizationId)
      .eq('profile_id', user.id)
      .single()

    if (!membership || !membership.permissions.includes('staff_manager')) {
      return NextResponse.json(
        { error: 'You do not have permission to send invites' },
        { status: 403 }
      )
    }

    const inviteToken = randomUUID().replace(/-/g, '')
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString()

    const { data: invite, error } = await supabaseAdmin
      .from('staff_invites')
      .insert([
        {
          organization_id: organizationId,
          destination_id: destinationId,
          invited_email: email,
          token: inviteToken,
          expires_at: expiresAt,
          created_by: user.id,
        },
      ])
      .select()
      .single()

    if (error) {
      console.error('Error creating invite:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const inviteLink = `${baseUrl}/staff-invite?token=${inviteToken}`

    return NextResponse.json({
      success: true,
      invite,
      inviteLink,
    })
  } catch (err) {
    console.error('Staff invite error:', err)
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}

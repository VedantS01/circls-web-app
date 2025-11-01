import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdminClient'

export async function POST(request) {
  if (!supabaseAdmin) return NextResponse.json({ error: 'Admin client not configured' }, { status: 501 })

  try {
    let body = {}
    try {
      body = await request.json()
    } catch (jsonError) {
      const form = await request.formData().catch(() => null)
      if (form) {
        for (const [key, value] of form.entries()) body[key] = value
      }
    }

    const token = body?.token || new URL(request.url).searchParams.get('token')
    const providedEmail = body?.email?.trim().toLowerCase()
    const providedFullName = body?.full_name?.trim() || null
    const providedPassword = body?.password || null

    if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

    const { data: invite, error: inviteError } = await supabaseAdmin
      .from('staff_invites')
      .select('*')
      .eq('token', token)
      .maybeSingle()

    if (inviteError) return NextResponse.json({ error: inviteError.message }, { status: 500 })
    if (!invite) return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
    if (invite.accepted) return NextResponse.json({ message: 'Invite already accepted' })
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Token expired' }, { status: 410 })
    }

    const inviteEmail = invite.invited_email?.toLowerCase()
    if (!invite.destination_id) {
      return NextResponse.json({ error: 'Invite is missing its destination mapping' }, { status: 422 })
    }
    if (providedEmail && inviteEmail && providedEmail !== inviteEmail) {
      return NextResponse.json({ error: 'Email does not match the invite' }, { status: 400 })
    }

    const email = providedEmail || inviteEmail
    if (!email) return NextResponse.json({ error: 'Invite is missing a target email' }, { status: 400 })

    const { data: lookup, error: lookupError } = await supabaseAdmin.auth.admin.getUserByEmail(email)
    if (lookupError && lookupError.code !== 'user_not_found') {
      return NextResponse.json({ error: lookupError.message }, { status: lookupError.status || 500 })
    }

    let user = lookup?.user || null

    if (!user) {
      const password = providedPassword || `${randomUUID().slice(0, 12)}Aa!`
      const createRes = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })
      if (createRes.error) return NextResponse.json({ error: createRes.error.message }, { status: createRes.error.status || 500 })
      user = createRes.data.user
    }

    const profileFullName = providedFullName || user.user_metadata?.full_name || (email.split('@')[0]?.replace(/^./, (char) => char.toUpperCase()) ?? null)
    await supabaseAdmin.from('profiles').upsert({ id: user.id, full_name: profileFullName }, { onConflict: 'id' })

    const orgPermissions = []
    const destPermissions = ['booking_manager']

    const { data: existingOrgMembership, error: fetchOrgMembershipError } = await supabaseAdmin
      .from('organization_memberships')
      .select('permissions')
      .eq('organization_id', invite.organization_id)
      .eq('profile_id', user.id)
      .maybeSingle()

    if (fetchOrgMembershipError) {
      console.error('Failed to read org membership', fetchOrgMembershipError)
      return NextResponse.json({ error: 'Unable to process invite' }, { status: 500 })
    }

    if (!existingOrgMembership) {
      const { error: insertOrgMembershipError } = await supabaseAdmin.from('organization_memberships').insert({
        organization_id: invite.organization_id,
        profile_id: user.id,
        permissions: orgPermissions,
      })

      if (insertOrgMembershipError) {
        console.error('Failed to create org membership', insertOrgMembershipError)
        return NextResponse.json({ error: 'Unable to process invite' }, { status: 500 })
      }
    }

    const { data: existingDestMembership, error: fetchDestMembershipError } = await supabaseAdmin
      .from('destination_memberships')
      .select('permissions')
      .eq('destination_id', invite.destination_id)
      .eq('profile_id', user.id)
      .maybeSingle()

    if (fetchDestMembershipError) {
      console.error('Failed to read destination membership', fetchDestMembershipError)
      return NextResponse.json({ error: 'Unable to process invite' }, { status: 500 })
    }

    const mergedDestPermissions = Array.from(new Set([...(existingDestMembership?.permissions || []), ...destPermissions]))

    const { error: upsertDestMembershipError } = await supabaseAdmin.from('destination_memberships').upsert({
      destination_id: invite.destination_id,
      profile_id: user.id,
      permissions: mergedDestPermissions,
    }, { onConflict: 'destination_id,profile_id' })

    if (upsertDestMembershipError) {
      console.error('Failed to upsert destination membership', upsertDestMembershipError)
      return NextResponse.json({ error: 'Unable to process invite' }, { status: 500 })
    }

    await supabaseAdmin
      .from('staff_invites')
      .update({
        accepted: true,
        accepted_at: new Date().toISOString(),
        accepted_by: user.id,
        invited_profile_id: user.id,
      })
      .eq('id', invite.id)

    return NextResponse.json({ message: 'Invite accepted', user_id: user.id })
  } catch (err) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}

export async function GET(request) {
  const url = new URL(request.url)
  const token = url.searchParams.get('token')
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Accept Invite</title></head><body><div style="max-width:600px;margin:40px auto;font-family:system-ui,Arial"><h2>Accept Invite</h2><p>Click the button to accept the invite and link your account.</p><form method="post" action="${url.pathname}"><input type="hidden" name="token" value="${token || ''}"/><label>Email<input name="email" type="email" placeholder="you@example.com" style="display:block;margin:8px 0;padding:8px;width:100%" required /></label><button type="submit" style="padding:8px 16px">Accept Invite</button></form></div></body></html>`
  return new Response(html, { headers: { 'Content-Type': 'text/html' } })
}

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
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false },
    })

    const body = await request.json().catch(() => ({}))
    const email = body?.email?.trim()
    const organizationId = body?.organization_id
    const destinationId = body?.destination_id
    const orgPermissions = Array.isArray(body?.org_permissions) ? body.org_permissions : []
    const destinationPermissions = Array.isArray(body?.destination_permissions) ? body.destination_permissions : []

    if (!email || !organizationId) {
      return NextResponse.json({ error: 'Missing email or organization_id' }, { status: 400 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Admin client not configured' }, { status: 501 })
    }

    const { data: lookup, error: lookupError } = await supabaseAdmin.auth.admin.getUserByEmail(email)
    if (lookupError && lookupError.code !== 'user_not_found') {
      return NextResponse.json({ error: lookupError.message }, { status: lookupError.status || 500 })
    }

    const user = lookup?.user || null
    if (!user) {
      return NextResponse.json({ error: 'No auth user found for email' }, { status: 404 })
    }

    const defaultName = email.split('@')[0]
    const fullName = defaultName ? defaultName.charAt(0).toUpperCase() + defaultName.slice(1) : null
    await supabaseAdmin.from('profiles').upsert({ id: user.id, full_name: fullName }, { onConflict: 'id' })

    const normalizedOrgPermissions = orgPermissions.filter(permission => ['staff_manager', 'destination_editor', 'data_manager'].includes(permission))
    const normalizedDestinationPermissions = destinationPermissions.filter(permission => ['destination_manager', 'booking_manager'].includes(permission))

    if (normalizedOrgPermissions.length > 0) {
      const { error: orgError } = await supabaseUser
        .from('organization_memberships')
        .upsert({
          organization_id: organizationId,
          profile_id: user.id,
          permissions: normalizedOrgPermissions,
        }, { onConflict: 'organization_id,profile_id' })

      if (orgError) {
        const status = orgError.code === '42501' ? 403 : 500
        return NextResponse.json({ error: orgError.message }, { status })
      }
    }

    if (destinationId && normalizedDestinationPermissions.length > 0) {
      const { error: destError } = await supabaseUser
        .from('destination_memberships')
        .upsert({
          destination_id: destinationId,
          profile_id: user.id,
          permissions: normalizedDestinationPermissions,
        }, { onConflict: 'destination_id,profile_id' })

      if (destError) {
        const status = destError.code === '42501' ? 403 : 500
        return NextResponse.json({ error: destError.message }, { status })
      }
    }

    return NextResponse.json({ message: 'User mapped successfully', user_id: user.id })
  } catch (err) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}

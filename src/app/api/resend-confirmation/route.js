import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdminClient'

export async function POST(request) {
  // This endpoint expects the admin key to be configured. It will attempt to generate an email link.
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Admin client not configured' }, { status: 501 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const email = body?.email
    if (!email) {
      return NextResponse.json({ error: 'Missing email in request body' }, { status: 400 })
    }

    // Use the admin API to generate an invite/confirmation link (best-effort).
    // supabase-js may expose admin.generateLink or admin.auth.admin.generateLink depending on version.
    if (supabaseAdmin.auth && supabaseAdmin.auth.admin && supabaseAdmin.auth.admin.generateLink) {
      const { data, error } = await supabaseAdmin.auth.admin.generateLink({ type: 'invite', email })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ message: 'Confirmation link generated', link: data?.link })
    }

    return NextResponse.json({ error: 'Admin generateLink not available on this client' }, { status: 501 })
  } catch (err) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}

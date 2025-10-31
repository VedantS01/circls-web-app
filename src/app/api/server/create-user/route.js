import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdminClient'

export async function POST(request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Admin client not configured' }, { status: 501 })
  }

  try {
    const body = await request.json()
    const { email, password } = body || {}
    if (!email || !password) return NextResponse.json({ error: 'Missing email or password' }, { status: 400 })

    if (!supabaseAdmin.auth || !supabaseAdmin.auth.admin || !supabaseAdmin.auth.admin.createUser) {
      return NextResponse.json({ error: 'Admin createUser not available on this client' }, { status: 501 })
    }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({ email, password })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}

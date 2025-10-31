import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdminClient'

export async function POST(request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Admin client not configured' }, { status: 501 })
  }

  try {
    const body = await request.json()
    const { id, full_name, avatar_url } = body || {}
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const { data, error } = await supabaseAdmin.from('profiles').upsert([{ id, full_name, avatar_url }], { returning: 'representation' })
    if (error) return NextResponse.json({ error: error.message, details: error.details }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}

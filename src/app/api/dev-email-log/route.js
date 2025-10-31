import { NextResponse } from 'next/server'
import supabaseAdmin from '@/lib/supabaseAdminClient'

// Dev-only endpoint: POST { email, type: 'recovery' | 'verify' } optionally { redirectTo }
export async function POST(req) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'dev-email-log is only available in development' }, { status: 403 })
  }

  let body
  try {
    body = await req.json()
  } catch (e) {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }

  const { email, type = 'recovery', redirectTo } = body || {}
  if (!email) return NextResponse.json({ error: 'email is required' }, { status: 400 })

  try {
    // Map friendly types to generateLink types
    const generateType = type === 'verify' ? 'magiclink' : type === 'recovery' ? 'recovery' : type

    const opts = { email }
    const params = { type: generateType, email }
    if (redirectTo) params.options = { redirectTo }

    const { data, error } = await supabaseAdmin.auth.admin.generateLink(params)

    if (error) {
      console.error('dev-email-log: generateLink error', error)
      return NextResponse.json({ error: error.message || error }, { status: 500 })
    }

    const props = data?.properties || {}

    // Build a simple email preview depending on the properties returned
    const verificationType = props.verification_type || generateType
    const lines = []
    lines.push('--- Dev Email Preview ---')
    lines.push(`To: ${email}`)
    lines.push(`Type: ${verificationType}`)
    if (props.action_link) lines.push(`Link: ${props.action_link}`)
    if (props.email_otp) lines.push(`OTP: ${props.email_otp}`)
    if (props.hashed_token) lines.push(`Token (hashed): ${props.hashed_token}`)
    if (props.redirect_to) lines.push(`RedirectTo: ${props.redirect_to}`)
    lines.push('-------------------------')

    // Log the email content to the server console for easy access during dev
    console.log(lines.join('\n'))

    // Return the generated properties to the caller for convenience
    return NextResponse.json({ properties: props, user: data?.user || null })
  } catch (err) {
    console.error('dev-email-log: unexpected error', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

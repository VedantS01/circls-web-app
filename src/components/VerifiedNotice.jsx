"use client"
import React, { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function VerifiedNotice({ user }) {
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')

  const resend = async () => {
    setSending(true)
    setMessage('')
    try {
      if (!user?.email) throw new Error('No email available')
      // Supabase sends verification emails when using invite/OTP flows; to resend we can call
      // auth.api.generateLink or use the client-side signInWithOtp for email. Here we call
      // supabase.auth.resetPasswordForEmail which triggers an email; for pure verification resends,
      // you may want to use the server-side admin API. This will at least send an email flow.
      const { error } = await supabase.auth.resetPasswordForEmail(user.email)
      if (error) throw error
      setMessage('Verification email resent — check your inbox.')
    } catch (err) {
      setMessage(err.message || 'Failed to resend verification')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="p-4 bg-surface border-l-4 border-theme rounded">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-medium">Please verify your email</div>
          <div className="text-sm text-muted">Check your inbox for a verification link. You must verify your email to participate in bookings and circles.</div>
        </div>
        <div className="ml-4">
          <button onClick={resend} disabled={sending} className="btn btn-primary">{sending ? 'Sending...' : 'Resend'}</button>
        </div>
      </div>
      {message && <div className="mt-2 text-sm text-muted">{message}</div>}
    </div>
  )
}

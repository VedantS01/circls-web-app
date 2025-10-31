"use client"
import React, { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function ConfirmEmailPage() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('Please confirm your email address. A confirmation link was sent to your email when you signed up.')

  const handleResend = async () => {
    setLoading(true)
    setMessage('Sending...')
    // Try server-side resend first (admin endpoint). Fallback to client-side magic link.
    try {
      const res = await fetch('/api/resend-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || json?.message || 'Failed')
      setMessage(json?.message || 'Confirmation email sent.')
    } catch (err) {
      // Fallback: try sending a sign-in magic link which gets the user into the app even without confirmation
      try {
        const { error } = await supabase.auth.signInWithOtp({ email: (await supabase.auth.getUser()).data?.user?.email })
        if (error) throw error
        setMessage('Magic link sent to your email. Use it to sign in.')
      } catch (err2) {
        setMessage('Unable to send confirmation automatically. Check your inbox or contact support.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <h2 className="text-xl font-bold mb-4">Confirm your email</h2>
      <p className="mb-4">{message}</p>
      <button className="btn btn-primary" onClick={handleResend} disabled={loading}>
        {loading ? 'Sending…' : 'Resend confirmation'}
      </button>
    </div>
  )
}

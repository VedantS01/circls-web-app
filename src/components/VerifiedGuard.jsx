"use client"
import React from 'react'
import { useRouter } from 'next/navigation'
import useUser from '@/hooks/useUser'
import VerifiedNotice from './VerifiedNotice'

export default function VerifiedGuard({ children }) {
  const router = useRouter()
  const { user, loading, verified } = useUser()

  if (loading) return <div>Loading...</div>

  if (!user) {
    // Not signed in — redirect to login
    if (typeof window !== 'undefined') router.push('/login')
    return null
  }

  if (!verified) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <VerifiedNotice user={user} />
  <div className="mt-6 text-sm text-muted">Once you verify your email, this page will update automatically.</div>
      </div>
    )
  }

  return <>{children}</>
}

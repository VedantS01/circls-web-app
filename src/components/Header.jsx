"use client"
import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import useUser from '@/hooks/useUser'

export default function Header() {
  const router = useRouter()
  const { user, profile, organizations, verified, loading } = useUser()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <header className="site-header bg-glass backdrop-blur-sm border-theme">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/" className="text-2xl font-bold text-primary">Circles</Link>
          <nav className="hidden md:flex items-center gap-3 text-sm text-muted">
            <Link href="/search" className="link-underline">Search</Link>
            <Link href="/circles" className="link-underline">Circles</Link>
            <Link href="/destination" className="link-underline">Destinations</Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {!loading && !user && (
            <Link href="/login" className="btn btn-outline">Log in</Link>
          )}

          {!loading && user && (
            <>
              <Link href="/bookings" className="px-3 py-1 rounded hover:bg-surface-1">Bookings</Link>
              <Link href="/circles" className="px-3 py-1 rounded hover:bg-surface-1">Circles</Link>
              {organizations && organizations.length > 0 && (
                <Link href="/dashboard" className="btn btn-primary">Dashboard</Link>
              )}

              <div className="flex items-center gap-2 ml-2">
                <div className="text-sm">
                  <div className="font-medium">{profile?.full_name || user?.user_metadata?.full_name || user.email}</div>
                  <div className="text-xs text-muted flex items-center gap-2">
                    {verified ? (
                      <span className="text-success">Verified</span>
                    ) : (
                      <Link href="/login" className="text-accent">Verify</Link>
                    )}
                  </div>
                </div>
                <button onClick={handleLogout} className="btn btn-ghost border-theme">Log out</button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

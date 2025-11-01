"use client"
import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import useUser from '@/hooks/useUser'

export default function Header() {
  const router = useRouter()
  const { user, profile, organizations, verified, loading } = useUser()
  const [showModal, setShowModal] = React.useState(false)

  const avatarLabel = profile?.full_name || user?.user_metadata?.full_name || user?.email || ''
  const avatarInitial = avatarLabel ? avatarLabel.trim().charAt(0).toUpperCase() : '?'

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <header className="site-header bg-glass backdrop-blur-sm border-theme">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/" className="text-2xl font-bold text-primary">Circls</Link>
          <nav className="hidden md:flex items-center gap-3 text-sm text-muted">
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
              <Link href="/onboarding" className="px-3 py-1 rounded hover:bg-surface-1">Onboarding</Link>
              {organizations && organizations.length > 0 && (
                <Link href="/dashboard" className="btn btn-primary">Dashboard</Link>
              )}

              <div className="ml-2 relative">
                <button
                  aria-label="User menu"
                  onClick={() => setShowModal(true)}
                  className="w-10 h-10 rounded-full flex items-center justify-center bg-accent text-on-accent font-semibold"
                >
                  {profile?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.avatar_url} alt={avatarLabel} className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <span>{avatarInitial}</span>
                  )}
                </button>

                {showModal && (
                  <div className="absolute right-0 mt-2 w-64 bg-surface border rounded shadow p-4 z-50">
                    <div className="text-sm mb-2">
                      <div className="font-medium">{profile?.full_name || user?.user_metadata?.full_name || user.email}</div>
                      <div className="text-xs text-muted">{user?.email}</div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setShowModal(false)} className="btn btn-ghost">Close</button>
                      <button onClick={async () => { await handleLogout() }} className="btn btn-danger">Log out</button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

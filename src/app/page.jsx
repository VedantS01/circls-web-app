'use client'
import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'
import useUser from '@/hooks/useUser'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const [destinations, setDestinations] = useState([])
  const { user, verified, loading: userLoading, organizations } = useUser()
  const router = useRouter()
  const [query, setQuery] = useState('')

  useEffect(() => {
    async function fetchDestinations() {
      const { data } = await supabase.from('destinations').select('*')
      setDestinations(data || [])
    }
    fetchDestinations()
  }, [])

  return (
    <div className="px-4 py-8">
      <section className="max-w-6xl mx-auto">
  <div className="rounded-lg bg-surface-1 p-8 mb-8 flex flex-col md:flex-row items-center gap-6">
          <div className="flex-1">
            <h1 className="text-4xl font-extrabold mb-2">Book local courts, fields and events — quickly</h1>
            <p className="text-lg text-muted mb-4">Discover nearby venues, reserve slots, create communities and manage bookings with Circles.</p>

            <form className="flex gap-3" onSubmit={(e) => { e.preventDefault(); router.push(`/search?q=${encodeURIComponent(query)}`) }}>
              <input aria-label="Search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, type or location" className="flex-1 p-3 rounded border" />
              <button className="btn btn-primary" type="submit">Search</button>
            </form>

              <div className="mt-4 text-sm text-muted">
              <span>Already a host? </span>
              <Link href="/onboarding" className="text-primary">Create your organization</Link>
            </div>
          </div>

          <div className="w-full md:w-1/3">
            <div className="bg-surface p-4 rounded shadow">
              <h3 className="font-semibold">Quick actions</h3>
              <ul className="mt-3 space-y-2 text-sm">
                <li><Link href="/search" className="text-primary">Find a destination</Link></li>
                {organizations && organizations.length > 0 && (
                  <li><Link href="/dashboard" className="text-primary">Manage destinations</Link></li>
                )}
                <li>
                  {user ? (
                      verified ? (
                      <Link href="/bookings" className="text-primary">My bookings</Link>
                    ) : (
                      <span className="text-accent">Verify your phone to book</span>
                    )
                  ) : (
                    <Link href="/login" className="text-primary">Log in to get started</Link>
                  )}
                </li>
              </ul>
            </div>
          </div>
        </div>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Featured destinations</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {destinations.slice(0,6).map(d => (
              <div key={d.id} className="p-4 border rounded bg-surface">
                <div className="h-36 bg-surface-1 rounded mb-3 flex items-center justify-center text-muted">Photo</div>
                <div className="font-medium">{d.name}</div>
                <div className="text-sm text-muted">{d.type} • {d.address}</div>
                <div className="mt-3 flex justify-between items-center">
          <Link href={`/destination/${d.id}`} className="text-primary">View</Link>
                  <div className="text-sm text-muted">£{d?.price || '—'}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">Browse by category</h2>
          <div className="flex flex-wrap gap-3">
            {['Badminton Court','Tennis Court','Football Pitch','Basketball','Gym'].map(c => (
              <Link key={c} href={`/search?type=${encodeURIComponent(c)}`} className="px-3 py-2 border rounded text-sm">{c}</Link>
            ))}
          </div>
        </section>
      </section>
    </div>
  )
}

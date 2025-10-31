'use client'
import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import VerifiedGuard from '@/components/VerifiedGuard'

export default function CirclesPage() {
  const [circles, setCircles] = useState([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')

  useEffect(() => {
    let mounted = true
    async function load() {
      const { data } = await supabase.from('circles').select('*')
      if (mounted) setCircles(data || [])
      if (mounted) setLoading(false)
    }
    load()
    return () => { mounted = false }
  }, [])

  const handleCreate = async () => {
    if (!name) return alert('Enter a name')
  // attach center_user_id from current session so RLS insert check can allow the operation
  const sessionResp = await supabase.auth.getSession()
  const userId = sessionResp?.data?.session?.user?.id
  if (!userId) return alert('You must be logged in to create a circle')
    // ensure a profiles row exists for this user (circles.center_user_id references profiles.id)
    const { data: existingProfile } = await supabase.from('profiles').select('id').eq('id', userId).maybeSingle()
    if (!existingProfile) {
      // ask server to create profile using admin client to satisfy FK constraints
      const res = await fetch('/api/ensure-profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) })
      const j = await res.json().catch(() => ({}))
      if (j?.error) return alert('Error creating profile row: ' + j.error)
    }

    const payload = { name, description: desc, center_user_id: userId }
    const { data, error } = await supabase.from('circles').insert([payload]).select().maybeSingle()
    if (error) return alert('Error creating circle: ' + error.message)
    setCircles(prev => [data, ...prev])
    setName('')
    setDesc('')
  }

  if (loading) return <div className="p-6">Loading...</div>

  return (
    <VerifiedGuard>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Circles</h1>
        </div>

        <div className="mb-4 p-4 border rounded bg-card">
          <h3 className="text-sm font-medium mb-2">Create a circle</h3>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Circle name" className="input w-full mb-2" />
          <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description" className="input w-full mb-2 h-20" />
          <div className="flex justify-end">
            <button onClick={handleCreate} className="btn btn-primary">Create</button>
          </div>
        </div>

        {circles.length === 0 ? (
          <p className="text-sm text-muted">No circles yet.</p>
        ) : (
          <ul className="space-y-3">
            {circles.map(c => (
              <li key={c.id} className="p-3 border rounded">
                <div className="font-medium">{c.name}</div>
                <div className="text-sm text-muted">{c.description}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </VerifiedGuard>
  )
}

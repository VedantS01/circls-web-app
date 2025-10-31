"use client"
import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import useUser from '@/hooks/useUser'
import VerifiedNotice from '@/components/VerifiedNotice'

export default function ProfilePage() {
  const { user, profile, loading, verified } = useUser()
  const [fullName, setFullName] = useState(null)
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [saving, setSaving] = useState(false)
  // Local state is initialized lazily; inputs will derive from profile when state is null.

  const save = async (e) => {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    const payload = { id: user.id, full_name: fullName, avatar_url: avatarUrl }
    const { error } = await supabase.from('profiles').upsert([payload], { returning: 'minimal' })
    setSaving(false)
    if (error) alert('Save failed: ' + error.message)
    else alert('Saved')
  }

  if (loading) return <div>Loading...</div>
  if (!user) return <div>Please log in.</div>

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {!verified && <div className="mb-4"><VerifiedNotice user={user} /></div>}

      <h1 className="text-2xl font-bold mb-4">Profile</h1>
      <form onSubmit={save} className="space-y-4">
        <label className="block">
          <span className="text-sm">Full name</span>
          <input value={fullName ?? (profile?.full_name || '')} onChange={(e) => setFullName(e.target.value)} className="mt-1 block w-full rounded border p-2" />
        </label>

        <label className="block">
          <span className="text-sm">Avatar URL</span>
          <input value={avatarUrl ?? (profile?.avatar_url || '')} onChange={(e) => setAvatarUrl(e.target.value)} className="mt-1 block w-full rounded border p-2" />
        </label>

  <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save profile'}</button>
      </form>
    </div>
  )
}

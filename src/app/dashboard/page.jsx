'use client'
import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import VerifiedGuard from '@/components/VerifiedGuard'

export default function DashboardPage() {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [destinations, setDestinations] = useState([])
  const [org, setOrg] = useState(null)
  const [selectedDestId, setSelectedDestId] = useState(null)
  const [selectedDest, setSelectedDest] = useState(null)
  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getSession()
      if (!data.session) {
        router.push('/login')
        return
      }
      setSession(data.session)
      const { data: orgs } = await supabase
        .from('organizations')
        .select('*')
        .eq('owner_id', data.session.user.id)

      let selectedOrg = null
      if (orgs && orgs.length > 0) {
        selectedOrg = orgs[0]
      } else {
        const { data: links } = await supabase
          .from('org_admin_links')
          .select('organization_id')
          .eq('user_id', data.session.user.id)
          .limit(1)
        if (links && links.length > 0) {
          const orgRes = await supabase
            .from('organizations')
            .select('*')
            .eq('id', links[0].organization_id)
            .single()
          selectedOrg = orgRes.data
        }
      }
      setOrg(selectedOrg)
      if (selectedOrg) {
        const { data: dests } = await supabase
          .from('destinations')
          .select('*')
          .eq('organization_id', selectedOrg.id)
        setDestinations(dests || [])
        if (dests && dests.length > 0) {
          setSelectedDestId(dests[0].id)
        }
      }
      setLoading(false)
    }
    init()
  }, [router])

  // load selected destination details and slots
  useEffect(() => {
    if (!selectedDestId) return
    let mounted = true
    async function loadDest() {
      const { data: dest } = await supabase.from('destinations').select('*').eq('id', selectedDestId).maybeSingle()
      if (mounted) setSelectedDest(dest || null)

      const { data: s } = await supabase.from('slots').select('*').eq('destination_id', selectedDestId)
      if (mounted) setSlots(s || [])
    }
    loadDest()
    return () => { mounted = false }
  }, [selectedDestId])

  if (loading) return <div>Loading...</div>

  return (
    <VerifiedGuard>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Organization Dashboard</h1>
        {!org ? (
          <div>
            <p>No organization found. Please create one via onboarding.</p>
            <Link href="/onboarding" className="text-primary">Create organization</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Left column: Org & Destinations list */}
            <div className="md:col-span-1 bg-card p-4 rounded border">
              <div className="mb-4">
                <h2 className="text-lg font-semibold">{org.name}</h2>
                <p className="text-sm text-muted">{org.description}</p>
                <Link href="/dashboard/create-destination">
                  <button className="mt-3 btn btn-sm btn-success">Create Destination</button>
                </Link>
              </div>

              <div>
                <h3 className="text-sm font-medium mb-2">Manage Destinations</h3>
                {destinations.length === 0 ? (
                  <p className="text-xs text-muted">No destinations yet</p>
                ) : (
                  <ul className="space-y-2">
                    {destinations.map((d) => (
                      <li key={d.id}>
                        <button
                          onClick={() => setSelectedDestId(d.id)}
                          className={`w-full text-left p-3 rounded border ${selectedDestId === d.id ? 'bg-primary/10 border-primary' : 'hover:bg-surface-1'}`}>
                          <div className="font-medium">{d.name}</div>
                          <div className="text-xs text-muted">{d.address}</div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Right columns: details and slots */}
            <div className="md:col-span-3 space-y-6">
              {!selectedDest ? (
                <div className="p-6 border rounded">Select a destination to view details</div>
              ) : (
                <div className="space-y-4">
                  {/* Destination metadata editor */}
                  <DestinationEditor
                    key={selectedDest.id}
                    dest={selectedDest}
                    onSaved={(updated) => {
                      // update local state and destinations list
                      setSelectedDest(updated)
                      setDestinations((prev) => prev.map(d => d.id === updated.id ? updated : d))
                    }}
                  />

                  {/* Members / invites management */}
                  <div className="p-4 border rounded bg-card">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">Members & Invites</h3>
                      <small className="text-sm text-muted">Invite users or map existing users to the org</small>
                    </div>

                    <MembersPanel org={org} onMemberAdded={(entry) => {
                      // refresh org admin links list by fetching org_admin_links
                    }} />
                  </div>

                  {/* Slots management */}
                  <div className="p-4 border rounded bg-card">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">Slots</h3>
                      <small className="text-sm text-muted">Manage time slots for this destination</small>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {slots.map((s) => (
                        <SlotCard
                          key={`${s.id}-${s.start_time}-${s.price}`}
                          slot={s}
                          onUpdate={(upd) => setSlots(prev => prev.map(x => x.id === upd.id ? upd : x))}
                          onDelete={(id) => setSlots(prev => prev.filter(x => x.id !== id))}
                        />
                      ))}

                      {/* Add new slot card */}
                      <NewSlotCard
                        destinationId={selectedDest.id}
                        onCreated={(newSlot) => setSlots(prev => [newSlot, ...prev])}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </VerifiedGuard>
  )
}

function DestinationEditor({ dest, onSaved }) {
  const [form, setForm] = useState(() => ({ name: dest?.name || '', address: dest?.address || '', capacity: dest?.capacity || 1, description: dest?.description || '' }))
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    const { data, error } = await supabase.from('destinations').update({ name: form.name, address: form.address, capacity: form.capacity, description: form.description }).eq('id', dest.id).select().maybeSingle()
    setSaving(false)
    if (error) {
      alert('Error saving destination: ' + error.message)
      return
    }
    onSaved(data || dest)
  }

  return (
    <div className="p-4 border rounded bg-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">Destination Details</h3>
        <div className="text-sm text-muted">Editable metadata</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium">Name</label>
          <input value={form.name} onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))} className="input w-full" />
        </div>
        <div>
          <label className="text-xs font-medium">Capacity</label>
          <input type="number" value={form.capacity} onChange={(e) => setForm(prev => ({ ...prev, capacity: Number(e.target.value) }))} className="input w-full" />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs font-medium">Address</label>
          <input value={form.address} onChange={(e) => setForm(prev => ({ ...prev, address: e.target.value }))} className="input w-full" />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs font-medium">Description</label>
          <textarea value={form.description} onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))} className="input w-full h-24" />
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <button onClick={handleSave} className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</button>
      </div>
    </div>
  )
}

function SlotCard({ slot, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState(() => ({ price: slot?.price, start_time: slot?.start_time, end_time: slot?.end_time, effective_start_date: slot?.effective_start_date, effective_end_date: slot?.effective_end_date }))

  const handleSave = async () => {
    setSaving(true)
    const { data, error } = await supabase.from('slots').update({ price: form.price, start_time: form.start_time, end_time: form.end_time, effective_start_date: form.effective_start_date, effective_end_date: form.effective_end_date }).eq('id', slot.id).select().maybeSingle()
    setSaving(false)
    if (error) return alert('Error saving slot: ' + error.message)
    onUpdate(data || slot)
    setEditing(false)
  }

  const handleDelete = async () => {
    if (!confirm('Delete this slot?')) return
    const { error } = await supabase.from('slots').delete().eq('id', slot.id)
    if (error) return alert('Error deleting slot: ' + error.message)
    onDelete(slot.id)
  }

  return (
    <div className="p-3 border rounded bg-white shadow-sm">
      {!editing ? (
        <div>
          <div className="font-medium">Price: {slot.price}</div>
          <div className="text-sm text-muted">{slot.start_time} - {slot.end_time}</div>
          <div className="text-xs text-muted">Effective: {slot.effective_start_date}{slot.effective_end_date ? ' → ' + slot.effective_end_date : ''}</div>
          <div className="mt-3 flex gap-2">
            <button onClick={() => setEditing(true)} className="btn btn-sm">Edit</button>
            <button onClick={handleDelete} className="btn btn-sm btn-danger">Delete</button>
          </div>
        </div>
      ) : (
        <div>
          <label className="text-xs">Price</label>
          <input value={form.price} onChange={e => setForm(prev => ({ ...prev, price: e.target.value }))} className="input w-full" />
          <label className="text-xs">Start</label>
          <input value={form.start_time} onChange={e => setForm(prev => ({ ...prev, start_time: e.target.value }))} className="input w-full" />
          <label className="text-xs">End</label>
          <input value={form.end_time} onChange={e => setForm(prev => ({ ...prev, end_time: e.target.value }))} className="input w-full" />
          <label className="text-xs">From</label>
          <input type="date" value={form.effective_start_date} onChange={e => setForm(prev => ({ ...prev, effective_start_date: e.target.value }))} className="input w-full" />
          <label className="text-xs">Until</label>
          <input type="date" value={form.effective_end_date || ''} onChange={e => setForm(prev => ({ ...prev, effective_end_date: e.target.value }))} className="input w-full" />
          <div className="mt-2 flex gap-2">
            <button onClick={handleSave} className="btn btn-sm btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            <button onClick={() => setEditing(false)} className="btn btn-sm">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

function NewSlotCard({ destinationId, onCreated }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ price: '0.00', start_time: '09:00:00', end_time: '10:00:00', effective_start_date: new Date().toISOString().slice(0,10), effective_end_date: '' })
  const [saving, setSaving] = useState(false)

  const handleCreate = async () => {
    setSaving(true)
    const payload = { destination_id: destinationId, price: form.price, start_time: form.start_time, end_time: form.end_time, effective_start_date: form.effective_start_date || null, effective_end_date: form.effective_end_date || null }
    const { data, error } = await supabase.from('slots').insert([payload]).select().maybeSingle()
    setSaving(false)
    if (error) return alert('Error creating slot: ' + error.message)
    setOpen(false)
    onCreated(data)
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="p-4 border rounded flex items-center justify-center text-2xl text-muted">+</button>
    )
  }

  return (
    <div className="p-3 border rounded bg-white">
      <label className="text-xs">Price</label>
      <input value={form.price} onChange={e => setForm(prev => ({ ...prev, price: e.target.value }))} className="input w-full" />
      <label className="text-xs">Start time</label>
      <input value={form.start_time} onChange={e => setForm(prev => ({ ...prev, start_time: e.target.value }))} className="input w-full" />
      <label className="text-xs">End time</label>
      <input value={form.end_time} onChange={e => setForm(prev => ({ ...prev, end_time: e.target.value }))} className="input w-full" />
      <label className="text-xs">From</label>
      <input type="date" value={form.effective_start_date} onChange={e => setForm(prev => ({ ...prev, effective_start_date: e.target.value }))} className="input w-full" />
      <label className="text-xs">Until</label>
      <input type="date" value={form.effective_end_date} onChange={e => setForm(prev => ({ ...prev, effective_end_date: e.target.value }))} className="input w-full" />
      <div className="mt-2 flex gap-2">
        <button onClick={handleCreate} className="btn btn-primary" disabled={saving}>{saving ? 'Creating...' : 'Create'}</button>
        <button onClick={() => setOpen(false)} className="btn">Cancel</button>
      </div>
    </div>
  )
}

function MembersPanel({ org, onMemberAdded }) {
  const [email, setEmail] = useState('')
  const [loadingInvite, setLoadingInvite] = useState(false)
  const [mappingEmail, setMappingEmail] = useState('')
  const [members, setMembers] = useState([])

  useEffect(() => {
    let mounted = true
    async function loadMembers() {
      if (!org) return
      const { data } = await supabase.from('org_admin_links').select('id,user_id,permissions').eq('organization_id', org.id)
      if (mounted) setMembers(data || [])
    }
    loadMembers()
    return () => { mounted = false }
  }, [org])

  const handleInvite = async () => {
    if (!email) return alert('Enter an email')
    setLoadingInvite(true)
    try {
      // create invite token - random simple token for now
      const token = Math.random().toString(36).slice(2, 10)
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString() // 7 days
      const { data, error } = await supabase.from('org_invites').insert([{ organization_id: org.id, email, invited_by: supabase.auth.getUser ? (await supabase.auth.getUser()).data?.user?.id : null, token, expires_at: expiresAt }]).select().maybeSingle()
      if (error) throw error

      // attempt to send an invite link - prefer a dev endpoint in development
      if (process.env.NODE_ENV === 'development') {
        await fetch('/api/dev-email-log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, type: 'verify', redirectTo: `/accept-invite?token=${token}` }) })
      } else {
        // try server endpoint that uses admin generate link
        await fetch('/api/resend-confirmation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
      }

      alert('Invite created and email attempted (check dev logs or mailer).')
      setEmail('')
      onMemberAdded && onMemberAdded(data)
    } catch (err) {
      console.error('invite error', err)
      alert('Error creating invite: ' + (err.message || JSON.stringify(err)))
    } finally {
      setLoadingInvite(false)
    }
  }

  const handleMapUser = async () => {
    if (!mappingEmail) return alert('Enter an email to map')
    // find profile by email in auth.users -> need to query auth.users via admin client; try to find via profiles table
    const { data: profile } = await supabase.from('profiles').select('id,full_name').ilike('email', mappingEmail).maybeSingle()
    // Note: If profiles table does not store email, attempt to use admin API or ask user id instead
    if (!profile) {
      // try searching auth.users via admin client is not possible from anon client; just notify
      alert('Could not find profile by email in profiles table. Please ask the user to sign in first, or provide their user id.')
      return
    }

    const payload = { user_id: profile.id, organization_id: org.id, permissions: ['manage_destinations'] }
    const { error } = await supabase.from('org_admin_links').insert([payload])
    if (error) return alert('Error mapping user: ' + error.message)
    alert('User mapped to organization as admin')
    setMappingEmail('')
    // reload members
    const { data } = await supabase.from('org_admin_links').select('id,user_id,permissions').eq('organization_id', org.id)
    setMembers(data || [])
    onMemberAdded && onMemberAdded(payload)
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className="text-xs">Invite by email</label>
          <div className="flex gap-2 mt-1">
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" className="input w-full" />
            <button onClick={handleInvite} className="btn btn-primary" disabled={loadingInvite}>{loadingInvite ? 'Sending...' : 'Invite'}</button>
          </div>
        </div>

        <div>
          <label className="text-xs">Map existing user (email)</label>
          <div className="flex gap-2 mt-1">
            <input value={mappingEmail} onChange={(e) => setMappingEmail(e.target.value)} placeholder="user@example.com" className="input w-full" />
            <button onClick={handleMapUser} className="btn">Map</button>
          </div>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-medium">Organization Admins</h4>
        {members.length === 0 ? (
          <div className="text-xs text-muted">No admins yet</div>
        ) : (
          <ul className="space-y-1 mt-2">
            {members.map(m => (
              <li key={m.id} className="p-2 border rounded text-sm">User ID: {m.user_id} — Permissions: {Array.isArray(m.permissions) ? m.permissions.join(', ') : m.permissions}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

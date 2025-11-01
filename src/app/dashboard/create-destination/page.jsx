'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function CreateDestination() {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [memberships, setMemberships] = useState([])
  const [selectedOrgId, setSelectedOrgId] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [address, setAddress] = useState('')
  const [capacity, setCapacity] = useState(4)
  const [type, setType] = useState('')
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [errorMessage, setErrorMessage] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setFetching(true)
      try {
        const { data } = await supabase.auth.getSession()
        const currentSession = data?.session ?? null
        if (!currentSession) {
          router.push('/login')
          return
        }
        if (!cancelled) setSession(currentSession)

        const { data: orgMemberships, error } = await supabase
          .from('organization_memberships')
          .select('organization_id, permissions, organization:organization_id (id, name)')
          .eq('profile_id', currentSession.user.id)
          .order('created_at', { ascending: true })

        if (error) throw error

        const editable = (orgMemberships || [])
          .filter(entry => Array.isArray(entry.permissions) && entry.permissions.includes('destination_editor'))
          .map(entry => ({
            id: entry.organization_id,
            name: entry.organization?.name || entry.organization_id,
          }))

        if (!cancelled) {
          setMemberships(editable)
          setSelectedOrgId(prev => (prev && editable.some(item => item.id === prev)) ? prev : (editable[0]?.id ?? ''))
        }
      } catch (err) {
        console.error('create-destination: failed to load memberships', err)
        if (!cancelled) setErrorMessage(err.message || 'Unable to load organization permissions')
      } finally {
        if (!cancelled) setFetching(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [router])

  const canCreate = useMemo(() => selectedOrgId && !fetching && memberships.length > 0, [selectedOrgId, fetching, memberships.length])

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!session) {
      router.push('/login')
      return
    }
    if (!selectedOrgId) {
      alert('Select an organization before creating a destination.')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase
        .from('destinations')
        .insert([{
          organization_id: selectedOrgId,
          name: name.trim(),
          description: description.trim() || null,
          address: address.trim() || null,
          capacity,
          type: type.trim() || null,
        }])

      if (error) throw error
      router.push('/dashboard')
    } catch (err) {
      alert('Error creating destination: ' + (err.message || err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Create destination</h1>
        <p className="text-sm text-muted">Destinations can only be created for organizations where you have the Destination editor permission.</p>
      </div>

      {fetching ? (
        <div>Loading organizations…</div>
      ) : memberships.length === 0 ? (
        <div className="rounded border border-dashed p-4 text-sm text-muted">
          You do not have destination editor access on any organization. Ask a staff manager to grant permissions.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMessage && (
            <div className="rounded border border-warning bg-warning/10 px-3 py-2 text-sm text-warning">{errorMessage}</div>
          )}

          <label className="block text-sm font-medium">
            Organization
            <select value={selectedOrgId} onChange={(event) => setSelectedOrgId(event.target.value)} className="input mt-1">
              {memberships.map(org => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium">
            Name
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="input mt-1"
              placeholder="eg. Court 1"
            />
          </label>

          <label className="block text-sm font-medium">
            Description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="input mt-1 h-24"
              placeholder="Optional overview for the team"
            />
          </label>

          <label className="block text-sm font-medium">
            Address
            <input
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              className="input mt-1"
              placeholder="Optional location"
            />
          </label>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium">
              Capacity
              <input
                type="number"
                min={1}
                value={capacity}
                onChange={(event) => setCapacity(Number(event.target.value))}
                className="input mt-1"
              />
            </label>

            <label className="block text-sm font-medium">
              Type
              <input
                value={type}
                onChange={(event) => setType(event.target.value)}
                className="input mt-1"
                placeholder="eg. Badminton court"
              />
            </label>
          </div>

          <button type="submit" className="btn btn-primary" disabled={!canCreate || loading}>{loading ? 'Creating…' : 'Create destination'}</button>
        </form>
      )}
    </div>
  )
}

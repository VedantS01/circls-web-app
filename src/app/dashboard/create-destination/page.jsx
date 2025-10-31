'use client'
import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function CreateDestination() {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [address, setAddress] = useState('')
  const [capacity, setCapacity] = useState(4)
  const [type, setType] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function getSession() {
      const { data } = await supabase.auth.getSession()
      if (!data.session) {
        router.push('/login')
        return
      }
      setSession(data.session)
    }
    getSession()
  }, [router])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    if (!session) {
      setLoading(false)
      router.push('/login')
      return
    }
    const { data: orgs } = await supabase.from('organizations').select('*').eq('owner_id', session.user.id).limit(1)
    let orgId = null
    if (orgs && orgs.length > 0) orgId = orgs[0].id
    else {
      const { data: links } = await supabase.from('org_admin_links').select('organization_id').eq('user_id', session.user.id).limit(1)
      if (links && links.length > 0) orgId = links[0].organization_id
    }
    if (!orgId) {
      setLoading(false)
      alert('No organization found. Please create an organization first.')
      return
    }

    const { error } = await supabase.from('destinations').insert([{
      organization_id: orgId,
      name,
      description,
      address,
      capacity,
      type
    }])
    setLoading(false)
    if (error) {
      alert('Error creating destination: ' + error.message)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="p-6 max-w-lg mx-auto">
      <h2 className="text-xl font-bold mb-4">Create Destination</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input required placeholder="Name" value={name} onChange={e => setName(e.target.value)} className="w-full p-2 border rounded"/>
        <textarea placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} className="w-full p-2 border rounded"/>
        <input placeholder="Address" value={address} onChange={e => setAddress(e.target.value)} className="w-full p-2 border rounded"/>
        <input type="number" placeholder="Capacity" value={capacity} onChange={e => setCapacity(Number(e.target.value))} className="w-full p-2 border rounded"/>
        <input placeholder="Type (e.g. Badminton Court)" value={type} onChange={e => setType(e.target.value)} className="w-full p-2 border rounded"/>
  <button className="btn btn-primary" disabled={loading}>{loading ? 'Creating...' : 'Create'}</button>
      </form>
    </div>
  )
}

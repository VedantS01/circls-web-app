'use client'
import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'

export default function DestinationIndex() {
  const [dests, setDests] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    async function load() {
      const { data } = await supabase.from('destinations').select('*')
      if (mounted) setDests(data || [])
      if (mounted) setLoading(false)
    }
    load()
    return () => { mounted = false }
  }, [])

  if (loading) return <div className="p-6">Loading...</div>

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">All Destinations</h1>
        <Link href="/dashboard/create-destination" className="btn btn-sm btn-success">Create</Link>
      </div>

      {dests.length === 0 ? (
        <p className="text-sm text-muted">No destinations yet.</p>
      ) : (
        <ul className="space-y-3">
          {dests.map(d => (
            <li key={d.id} className="p-3 border rounded flex justify-between items-center">
              <div>
                <div className="font-medium">{d.name}</div>
                <div className="text-sm text-muted">{d.address}</div>
              </div>
              <Link href={`/destination/${d.id}`} className="btn">View</Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

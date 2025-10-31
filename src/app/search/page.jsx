'use client'
import React, { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'

export default function SearchPage() {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  const handleSearch = async () => {
    if (!q || q.trim() === '') return setResults([])
    setLoading(true)
    try {
      const like = `%${q}%`
      const { data, error } = await supabase
        .from('destinations')
        .select('*')
        .or(`name.ilike.${like},address.ilike.${like}`)
      if (error) throw error
      setResults(data || [])
    } catch (err) {
      console.error('search error', err)
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Search Destinations</h1>

      <div className="flex gap-2 mb-4">
        <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} className="input flex-1" placeholder="Search by name or address" />
        <button onClick={handleSearch} className="btn btn-primary">Search</button>
      </div>

      {loading ? <div>Searching...</div> : (
        <div>
          {results.length === 0 ? (
            <div className="text-sm text-muted">No results</div>
          ) : (
            <ul className="space-y-3">
              {results.map(r => (
                <li key={r.id} className="p-3 border rounded flex justify-between items-center">
                  <div>
                    <div className="font-medium">{r.name}</div>
                    <div className="text-sm text-muted">{r.address}</div>
                  </div>
                  <Link href={`/destination/${r.id}`} className="btn">View</Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

"use client"
import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'

export default function DestinationDetail() {
  const params = useParams()
  const id = params.id
  const [destination, setDestination] = useState(null)
  const [slots, setSlots] = useState([])
  const [events, setEvents] = useState([])

  useEffect(() => {
    async function fetchData() {
      const { data: d } = await supabase.from('destinations').select('*').eq('id', id).single()
      setDestination(d)
      const { data: s } = await supabase.from('slots').select('*').eq('destination_id', id)
      setSlots(s || [])
      const { data: e } = await supabase.from('events').select('*').eq('destination_id', id)
      setEvents(e || [])
    }
    fetchData()
  }, [id])

  if (!destination) return <div>Loading...</div>

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold">{destination.name}</h1>
  <p className="text-sm text-muted">{destination.type} • {destination.address}</p>
      <p className="mt-3">{destination.description}</p>

      <div className="mt-6">
        <h2 className="text-lg font-semibold">Slots</h2>
        {slots.length === 0 ? <p>No slots available.</p> : (
          <ul className="space-y-2">
            {slots.map(s => (
              <li key={s.id} className="p-3 border rounded flex justify-between items-center">
                <div>
                  <div>{s.start_time} - {s.end_time}</div>
                  <div className="text-sm text-muted">Price: £{s.price}</div>
                </div>
                <Link href={`/destination/${id}/book-slot/${s.id}`} className="btn btn-primary">Book</Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6">
        <h2 className="text-lg font-semibold">Events</h2>
        {events.length === 0 ? <p>No events.</p> : (
          <ul className="space-y-2">
            {events.map(e => (
              <li key={e.id} className="p-3 border rounded flex justify-between items-center">
                <div>
                  <div className="font-medium">{e.name}</div>
                  <div className="text-sm">{new Date(e.start_datetime).toLocaleString()} - {new Date(e.end_datetime).toLocaleString()}</div>
                  <div className="text-sm text-muted">Price: £{e.price}</div>
                </div>
                <Link href={`/destination/${id}/book-event/${e.id}`} className="btn btn-primary">Book</Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

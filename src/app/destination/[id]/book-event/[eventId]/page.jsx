'use client'
import React, { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import VerifiedGuard from '@/components/VerifiedGuard'

export default function BookEvent() {
  const params = useParams()
  const router = useRouter()
  const { id, eventId } = params
  const [session, setSession] = useState(null)
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function init(){
      const { data } = await supabase.auth.getSession()
      if (!data.session) {
        router.push('/login')
        return
      }
      setSession(data.session)
      const { data: e } = await supabase.from('events').select('*').eq('id', eventId).single()
      setEvent(e)
    }
    init()
  }, [id, eventId, router])

  if (!event) return <div>Loading...</div>

  const handleConfirm = async () => {
    setLoading(true)
    if (!session) {
      setLoading(false)
      router.push('/login')
      return
    }
    const payload = {
      bookable_id: event.id,
      bookable_type: 'event',
      user_id: session.user.id,
      destination_id: event.destination_id,
      start_datetime: event.start_datetime,
      end_datetime: event.end_datetime,
      number_of_attendees: 1,
      total_amount: event.price,
      booking_status: 'confirmed'
    }

    const { error } = await supabase.from('bookings').insert([payload])
    setLoading(false)
    if (error) {
      alert('Booking failed: ' + error.message)
    } else {
      router.push('/dashboard/bookings')
    }
  }

  return (
    <VerifiedGuard>
      <div className="p-6 max-w-lg mx-auto">
        <h2 className="text-xl font-bold">Confirm Event Booking</h2>
        <p className="mt-2">Event: {event.name}</p>
        <p className="mt-1">When: {new Date(event.start_datetime).toLocaleString()}</p>
        <p className="mt-1 text-muted">Price: £{event.price}</p>
        <button onClick={handleConfirm} disabled={loading} className="mt-4 btn btn-success">
          {loading ? 'Booking...' : 'Confirm Booking'}
        </button>
      </div>
    </VerifiedGuard>
  )
}

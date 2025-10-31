'use client'
import React, { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import VerifiedGuard from '@/components/VerifiedGuard'

export default function BookSlot() {
  const params = useParams()
  const router = useRouter()
  const { id, slotId } = params
  const [session, setSession] = useState(null)
  const [slot, setSlot] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function init(){
      const { data } = await supabase.auth.getSession()
      if (!data.session) {
        router.push('/login')
        return
      }
      setSession(data.session)
      const { data: s } = await supabase.from('slots').select('*').eq('id', slotId).single()
      setSlot(s)
    }
    init()
  }, [id, slotId, router])

  if (!slot) return <div>Loading...</div>

  const handleConfirm = async () => {
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]
    const startDT = new Date(`${today}T${slot.start_time}`)
    const endDT = new Date(`${today}T${slot.end_time}`)

    const payload = {
      bookable_id: slot.id,
      bookable_type: 'slot',
      user_id: session.user.id,
      destination_id: slot.destination_id,
      start_datetime: startDT.toISOString(),
      end_datetime: endDT.toISOString(),
      number_of_attendees: 1,
      total_amount: slot.price,
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
        <h2 className="text-xl font-bold">Confirm Booking</h2>
        <p className="mt-2">Slot: {slot.start_time} - {slot.end_time}</p>
        <p className="mt-1 text-muted">Price: £{slot.price}</p>
        <button onClick={handleConfirm} disabled={loading} className="mt-4 btn btn-success">
          {loading ? 'Booking...' : 'Confirm Booking'}
        </button>
      </div>
    </VerifiedGuard>
  )
}

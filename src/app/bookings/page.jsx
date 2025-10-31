'use client'
import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import VerifiedGuard from '@/components/VerifiedGuard'
import { useRouter } from 'next/navigation'

export default function UserBookings() {
  const router = useRouter()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    async function load() {
      const { data: session } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      const uid = session.user.id
      const { data } = await supabase.from('bookings').select('*').eq('user_id', uid)
      if (mounted) setBookings(data || [])
      if (mounted) setLoading(false)
    }
    load()
    return () => { mounted = false }
  }, [router])

  if (loading) return <div className="p-6">Loading...</div>

  return (
    <VerifiedGuard>
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">My Bookings</h1>
        {bookings.length === 0 ? (
          <p className="text-sm text-muted">You have no bookings.</p>
        ) : (
          <ul className="space-y-3">
            {bookings.map(b => (
              <li key={b.id} className="p-3 border rounded flex justify-between items-center">
                <div>
                  <div className="font-medium">Booking {b.id}</div>
                  <div className="text-sm">{new Date(b.start_datetime).toLocaleString()} — {new Date(b.end_datetime).toLocaleString()}</div>
                  <div className="text-sm text-muted">Status: {b.booking_status}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">£{b.total_amount}</div>
                  <div className="text-sm">Attendees: {b.number_of_attendees}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </VerifiedGuard>
  )
}

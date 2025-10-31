'use client'
import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import VerifiedGuard from '@/components/VerifiedGuard'
import { useRouter } from 'next/navigation'

export default function AdminBookings() {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [bookings, setBookings] = useState([])

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getSession()
      if (!data.session) {
        router.push('/login')
        return
      }
      setSession(data.session)

      const { data: links } = await supabase.from('org_admin_links').select('organization_id').eq('user_id', data.session.user.id)
      const orgIds = (links || []).map(l => l.organization_id)
      if (orgIds.length === 0) {
        setBookings([])
        return
      }
      const { data: dests } = await supabase.from('destinations').select('id').in('organization_id', orgIds)
      const destIds = (dests || []).map(d => d.id)
      if (destIds.length === 0) {
        setBookings([])
        return
      }
      const { data: bk } = await supabase.from('bookings').select('*').in('destination_id', destIds)
      setBookings(bk || [])
    }
    init()
  }, [router])

  return (
    <VerifiedGuard>
      <div className="p-6">
        <h2 className="text-xl font-bold mb-4">Bookings</h2>
      {bookings.length === 0 ? (
        <p>No bookings found.</p>
      ) : (
        <ul className="space-y-3">
          {bookings.map(b => (
            <li key={b.id} className="p-3 border rounded">
              <div className="flex justify-between">
                <div>
                  <div className="font-medium">Booking {b.id}</div>
                    <div className="text-sm text-muted">User: {b.user_id} — Status: {b.booking_status}</div>
                  <div className="text-sm">From: {new Date(b.start_datetime).toLocaleString()} — To: {new Date(b.end_datetime).toLocaleString()}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">£{b.total_amount}</div>
                  <div className="text-sm">Attendees: {b.number_of_attendees}</div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      </div>
    </VerifiedGuard>
  )
}

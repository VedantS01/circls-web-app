'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import VerifiedGuard from '@/components/VerifiedGuard'
import { supabase } from '@/lib/supabaseClient'

export default function AdminBookings() {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const { data } = await supabase.auth.getSession()
        const currentSession = data?.session ?? null
        if (!currentSession) {
          router.push('/login')
          return
        }
        if (!cancelled) setSession(currentSession)

        const [{ data: destinationMemberships, error: destinationMembershipError }, { data: organizationMemberships, error: organizationMembershipError }] = await Promise.all([
          supabase
            .from('destination_memberships')
            .select('destination_id, permissions')
            .eq('profile_id', currentSession.user.id),
          supabase
            .from('organization_memberships')
            .select('organization_id, permissions')
            .eq('profile_id', currentSession.user.id),
        ])

        if (destinationMembershipError) throw destinationMembershipError
        if (organizationMembershipError) throw organizationMembershipError

        const destinationIds = new Set()

        for (const entry of destinationMemberships || []) {
          const perms = entry?.permissions || []
          if (perms.includes('booking_manager') || perms.includes('destination_manager')) {
            destinationIds.add(entry.destination_id)
          }
        }

        const organizationIds = (organizationMemberships || [])
          .filter(entry => Array.isArray(entry.permissions) && entry.permissions.includes('destination_editor'))
          .map(entry => entry.organization_id)

        if (organizationIds.length > 0) {
          const { data: orgDestinations, error: orgDestinationsError } = await supabase
            .from('destinations')
            .select('id')
            .in('organization_id', organizationIds)

          if (orgDestinationsError) throw orgDestinationsError
          for (const dest of orgDestinations || []) destinationIds.add(dest.id)
        }

        if (destinationIds.size === 0) {
          if (!cancelled) setBookings([])
          return
        }

        const { data: bookingRows, error: bookingsError } = await supabase
          .from('bookings')
          .select('id, destination_id, user_id, start_datetime, end_datetime, number_of_attendees, total_amount, booking_status, payment_status, created_at')
          .in('destination_id', Array.from(destinationIds))
          .order('start_datetime', { ascending: false })

        if (bookingsError) throw bookingsError
        if (!cancelled) setBookings(bookingRows || [])
      } catch (err) {
        console.error('bookings dashboard: failed to load', err)
        if (!cancelled) setError(err.message || 'Unable to load bookings')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [router])

  const emptyState = useMemo(() => bookings.length === 0 && !loading && !error, [bookings.length, loading, error])

  return (
    <VerifiedGuard>
      <div className="p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Bookings</h1>
          <p className="text-sm text-muted">View reservations for destinations where you manage bookings.</p>
        </div>

        {loading && <div>Loading bookings…</div>}

        {error && (
          <div className="rounded border border-warning bg-warning/10 px-3 py-2 text-sm text-warning">{error}</div>
        )}

        {emptyState ? (
          <div className="rounded border border-dashed p-4 text-sm text-muted">
            No bookings found for your destinations yet.
          </div>
        ) : (
          <ul className="space-y-3">
            {bookings.map(booking => (
              <li key={booking.id} className="rounded border bg-card p-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="text-sm font-semibold">Booking {booking.id}</div>
                    <div className="text-xs text-muted">Destination: {booking.destination_id}</div>
                    <div className="text-xs text-muted">Customer: {booking.user_id}</div>
                    <div className="text-xs text-muted">Status: {booking.booking_status} · Payment: {booking.payment_status}</div>
                    <div className="text-xs text-muted">Created {new Date(booking.created_at).toLocaleString()}</div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="font-medium">{new Date(booking.start_datetime).toLocaleString()}</div>
                    <div className="text-xs text-muted">to {new Date(booking.end_datetime).toLocaleString()}</div>
                    <div className="mt-2 font-semibold">₹{booking.total_amount}</div>
                    <div className="text-xs text-muted">Attendees: {booking.number_of_attendees}</div>
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

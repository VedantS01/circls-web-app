'use client'
import React, { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import VerifiedGuard from '@/components/VerifiedGuard'
import {
  Container,
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  CircularProgress,
  Divider,
  Alert,
  Paper,
} from '@mui/material'
import {
  Schedule,
  AttachMoney,
  CheckCircle,
  ArrowBack,
  CalendarToday,
  Person,
} from '@mui/icons-material'

export default function BookSlot() {
  const params = useParams()
  const router = useRouter()
  const { id, slotId } = params
  const [session, setSession] = useState(null)
  const [slot, setSlot] = useState(null)
  const [destination, setDestination] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

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
      
      if (s) {
        const { data: d } = await supabase.from('destinations').select('name').eq('id', s.destination_id).single()
        setDestination(d)
      }
    }
    init()
  }, [id, slotId, router])

  if (!slot) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  const handleConfirm = async () => {
    setLoading(true)
    setError(null)
    
    try {
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

      const { error: bookingError } = await supabase.from('bookings').insert([payload])
      
      if (bookingError) {
        setError(bookingError.message)
      } else {
        router.push('/bookings')
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <VerifiedGuard>
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Button 
          onClick={() => router.push(`/destination/${id}`)} 
          startIcon={<ArrowBack />}
          sx={{ mb: 3 }}
        >
          Back to Destination
        </Button>

        <Card elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
          <CardContent sx={{ p: 4 }}>
            {/* Header */}
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  bgcolor: 'primary.50',
                  color: 'primary.main',
                  mb: 2,
                }}
              >
                <CheckCircle sx={{ fontSize: 48 }} />
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                Confirm Booking
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Review your booking details before confirming
              </Typography>
            </Box>

            <Divider sx={{ mb: 3 }} />

            {/* Booking Details */}
            <Paper elevation={0} sx={{ bgcolor: 'grey.50', p: 3, borderRadius: 2, mb: 3 }}>
              {destination && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
                    Destination
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {destination.name}
                  </Typography>
                </Box>
              )}

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Schedule color="primary" />
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Time Slot
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {slot.start_time} - {slot.end_time}
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <CalendarToday color="primary" />
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Date
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Person color="primary" />
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Attendees
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    1 person
                  </Typography>
                </Box>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Total Amount
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <AttachMoney color="success" />
                  <Typography variant="h5" color="success.main" sx={{ fontWeight: 700 }}>
                    ₹{parseFloat(slot.price).toFixed(2)}
                  </Typography>
                </Box>
              </Box>
            </Paper>

            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

            {/* Action Buttons */}
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <Button
                variant="outlined"
                size="large"
                onClick={() => router.push(`/destination/${id}`)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                size="large"
                onClick={handleConfirm}
                disabled={loading}
                startIcon={loading ? <CircularProgress size={20} /> : <CheckCircle />}
              >
                {loading ? 'Processing...' : 'Confirm Booking'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Container>
    </VerifiedGuard>
  )
}

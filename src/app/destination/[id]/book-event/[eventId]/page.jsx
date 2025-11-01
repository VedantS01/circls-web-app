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
  EventNote,
  AttachMoney,
  CheckCircle,
  ArrowBack,
  CalendarToday,
  Person,
  AccessTime,
} from '@mui/icons-material'

export default function BookEvent() {
  const params = useParams()
  const router = useRouter()
  const { id, eventId } = params
  const [session, setSession] = useState(null)
  const [event, setEvent] = useState(null)
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
      const { data: e } = await supabase.from('events').select('*').eq('id', eventId).single()
      setEvent(e)
      
      if (e) {
        const { data: d } = await supabase.from('destinations').select('name').eq('id', e.destination_id).single()
        setDestination(d)
      }
    }
    init()
  }, [id, eventId, router])

  if (!event) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  const handleConfirm = async () => {
    setLoading(true)
    setError(null)
    
    if (!session) {
      setLoading(false)
      router.push('/login')
      return
    }
    
    try {
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

  const formatDateTime = (datetime) => {
    const dt = new Date(datetime)
    return {
      date: dt.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      time: dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    }
  }

  const startFormatted = formatDateTime(event.start_datetime)
  const endFormatted = formatDateTime(event.end_datetime)

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
                  bgcolor: 'secondary.50',
                  color: 'secondary.main',
                  mb: 2,
                }}
              >
                <EventNote sx={{ fontSize: 48 }} />
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                Confirm Event Booking
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Review your event booking details before confirming
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

              <Box sx={{ mb: 3 }}>
                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
                  Event Name
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: 'secondary.main' }}>
                  {event.name}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <CalendarToday color="secondary" />
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Start Date & Time
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {startFormatted.date}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {startFormatted.time}
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <AccessTime color="secondary" />
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    End Date & Time
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {endFormatted.date}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {endFormatted.time}
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Person color="secondary" />
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
                    ₹{parseFloat(event.price).toFixed(2)}
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
                sx={{ bgcolor: 'secondary.main', '&:hover': { bgcolor: 'secondary.dark' } }}
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

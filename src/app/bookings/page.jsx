'use client'
import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import VerifiedGuard from '@/components/VerifiedGuard'
import { useRouter } from 'next/navigation'
import {
  Container,
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  CircularProgress,
  Divider,
  Button,
} from '@mui/material'
import {
  EventNote,
  CalendarToday,
  People,
  AttachMoney,
  CheckCircle,
  Schedule,
  Cancel,
} from '@mui/icons-material'

export default function UserBookings() {
  const router = useRouter()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    async function load() {
      const { data: session } = await supabase.auth.getSession()
      if (!session?.session) {
        router.push('/login')
        return
      }
      const uid = session.session.user.id
      const { data } = await supabase.from('bookings').select('*').eq('profile_id', uid)
      if (mounted) setBookings(data || [])
      if (mounted) setLoading(false)
    }
    load()
    return () => { mounted = false }
  }, [router])

  const getStatusIcon = (status) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle sx={{ fontSize: 20 }} />
      case 'pending':
        return <Schedule sx={{ fontSize: 20 }} />
      case 'cancelled':
        return <Cancel sx={{ fontSize: 20 }} />
      default:
        return <EventNote sx={{ fontSize: 20 }} />
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed':
        return 'success'
      case 'pending':
        return 'warning'
      case 'cancelled':
        return 'error'
      default:
        return 'default'
    }
  }

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 8, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    )
  }

  return (
    <VerifiedGuard>
      <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: 4 }}>
        <Container maxWidth="lg">
          <Box sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
              <EventNote sx={{ fontSize: 40, color: 'primary.main' }} />
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                My Bookings
              </Typography>
            </Box>
            <Typography variant="body1" color="text.secondary">
              View and manage all your event bookings
            </Typography>
          </Box>

          {bookings.length === 0 ? (
            <Card elevation={0} sx={{ border: 1, borderColor: 'divider', textAlign: 'center', py: 8 }}>
              <CardContent>
                <EventNote sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                  No Bookings Yet
                </Typography>
                <Typography color="text.secondary" sx={{ mb: 3 }}>
                  You haven&apos;t made any bookings. Explore destinations to get started.
                </Typography>
                <Button
                  variant="contained"
                  onClick={() => router.push('/destination')}
                >
                  Browse Destinations
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Grid container spacing={3}>
              {bookings.map(booking => (
                <Grid item xs={12} key={booking.id}>
                  <Card elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
                    <CardContent sx={{ p: 3 }}>
                      <Grid container spacing={3}>
                        <Grid item xs={12} md={8}>
                          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
                            <Box
                              sx={{
                                bgcolor: `${getStatusColor(booking.status)}.50`,
                                color: `${getStatusColor(booking.status)}.main`,
                                p: 1,
                                borderRadius: 1.5,
                                display: 'flex',
                              }}
                            >
                              {getStatusIcon(booking.status)}
                            </Box>
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                                Booking #{booking.id.slice(0, 8)}
                              </Typography>
                              <Chip
                                label={booking.status}
                                size="small"
                                color={getStatusColor(booking.status)}
                                sx={{ fontWeight: 500 }}
                              />
                            </Box>
                          </Box>

                          <Divider sx={{ my: 2 }} />

                          <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <CalendarToday sx={{ fontSize: 18, color: 'text.secondary' }} />
                                <Typography variant="body2" color="text.secondary">
                                  Start Time
                                </Typography>
                              </Box>
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {booking.start_datetime
                                  ? new Date(booking.start_datetime).toLocaleString()
                                  : 'N/A'}
                              </Typography>
                            </Grid>

                            <Grid item xs={12} sm={6}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <CalendarToday sx={{ fontSize: 18, color: 'text.secondary' }} />
                                <Typography variant="body2" color="text.secondary">
                                  End Time
                                </Typography>
                              </Box>
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {booking.end_datetime
                                  ? new Date(booking.end_datetime).toLocaleString()
                                  : 'N/A'}
                              </Typography>
                            </Grid>
                          </Grid>
                        </Grid>

                        <Grid item xs={12} md={4}>
                          <Box
                            sx={{
                              bgcolor: 'grey.50',
                              borderRadius: 2,
                              p: 2,
                              height: '100%',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'center',
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                              <AttachMoney sx={{ fontSize: 20, color: 'success.main' }} />
                              <Typography variant="h5" sx={{ fontWeight: 700, color: 'success.main' }}>
                                £{booking.total_amount || '0.00'}
                              </Typography>
                            </Box>

                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <People sx={{ fontSize: 18, color: 'text.secondary' }} />
                              <Typography variant="body2" color="text.secondary">
                                {booking.number_of_attendees || 0} Attendees
                              </Typography>
                            </Box>

                            <Divider sx={{ my: 2 }} />

                            <Typography variant="caption" color="text.secondary">
                              Booked on{' '}
                              {booking.created_at
                                ? new Date(booking.created_at).toLocaleDateString()
                                : 'N/A'}
                            </Typography>
                          </Box>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Container>
      </Box>
    </VerifiedGuard>
  )
}

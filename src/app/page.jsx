'use client'
import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'
import useUser from '@/hooks/useUser'
import { useRouter } from 'next/navigation'
import {
  Container,
  Box,
  Typography,
  Button,
  TextField,
  Grid,
  Card,
  CardContent,
  CardActions,
  Chip,
  Paper,
  InputAdornment,
} from '@mui/material'
import {
  Search,
  Place,
  EventAvailable,
  TrendingUp,
  ArrowForward,
  Dashboard,
  Login,
  Event,
  CalendarToday,
  Schedule,
} from '@mui/icons-material'

export default function HomePage() {
  const [destinations, setDestinations] = useState([])
  const [upcomingEvents, setUpcomingEvents] = useState([])
  const [popularDestinations, setPopularDestinations] = useState([])
  const { user, verified, organizations } = useUser()
  const router = useRouter()
  const [query, setQuery] = useState('')

  useEffect(() => {
    async function fetchData() {
      // Fetch all destinations
      const { data: allDest } = await supabase
        .from('destinations')
        .select('*')
        .order('created_at', { ascending: false })
      setDestinations(allDest || [])

      // Fetch upcoming events (future events, limit 6)
      const now = new Date().toISOString()
      const { data: events } = await supabase
        .from('events')
        .select('*, destinations(name)')
        .gte('start_datetime', now)
        .order('start_datetime', { ascending: true })
        .limit(6)
      setUpcomingEvents(events || [])

      // Fetch popular destinations (destinations with most bookings)
      const { data: bookingsCount } = await supabase
        .from('bookings')
        .select('destination_id')
      
      // Count bookings per destination
      const countMap = {}
      bookingsCount?.forEach(b => {
        countMap[b.destination_id] = (countMap[b.destination_id] || 0) + 1
      })
      
      // Sort destinations by booking count
      const sorted = (allDest || [])
        .map(dest => ({ ...dest, bookingCount: countMap[dest.id] || 0 }))
        .sort((a, b) => b.bookingCount - a.bookingCount)
        .slice(0, 6)
      
      setPopularDestinations(sorted)
    }
    fetchData()
  }, [])

  const handleSearch = (e) => {
    e.preventDefault()
    router.push(`/search?q=${encodeURIComponent(query)}`)
  }

  const categories = [
    'Badminton Court',
    'Tennis Court',
    'Football Pitch',
    'Basketball',
    'Gym',
  ]

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh' }}>
      {/* Hero Section */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
          color: 'white',
          py: { xs: 6, md: 10 },
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Container maxWidth="lg">
          <Grid container spacing={4} alignItems="center">
            <Grid xs={12} md={7}>
              <Typography
                variant="h2"
                sx={{
                  fontWeight: 800,
                  mb: 2,
                  fontSize: { xs: '2rem', md: '3rem' },
                }}
              >
                Book Local Courts, Fields & Events
              </Typography>
              <Typography
                variant="h6"
                sx={{ mb: 4, opacity: 0.95, fontWeight: 400 }}
              >
                Discover nearby venues, reserve slots, and manage bookings with Circls
              </Typography>

              <Paper
                component="form"
                onSubmit={handleSearch}
                elevation={3}
                sx={{
                  p: 0.5,
                  display: 'flex',
                  alignItems: 'center',
                  bgcolor: 'white',
                  borderRadius: 2,
                }}
              >
                <TextField
                  fullWidth
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name, type or location..."
                  variant="standard"
                  InputProps={{
                    disableUnderline: true,
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search sx={{ color: 'text.secondary', ml: 1 }} />
                      </InputAdornment>
                    ),
                    sx: { px: 2, py: 1 },
                  }}
                />
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  sx={{ minWidth: 120, borderRadius: 1.5 }}
                >
                  Search
                </Button>
              </Paper>

              <Typography variant="body2" sx={{ mt: 2, opacity: 0.9 }}>
                Already a host?{' '}
                <Link
                  href="/onboarding"
                  style={{ color: 'white', fontWeight: 600, textDecoration: 'underline' }}
                >
                  Create your organization
                </Link>
              </Typography>
            </Grid>

            <Grid xs={12} md={5}>
              <Card elevation={3}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    Quick Actions
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <Button
                      variant="outlined"
                      fullWidth
                      startIcon={<Place />}
                      onClick={() => router.push('/search')}
                      sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                    >
                      Find a Destination
                    </Button>

                    {organizations && organizations.length > 0 && (
                      <Button
                        variant="outlined"
                        fullWidth
                        startIcon={<Dashboard />}
                        onClick={() => router.push('/dashboard')}
                        sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                      >
                        Manage Destinations
                      </Button>
                    )}

                    {user ? (
                      verified ? (
                        <Button
                          variant="outlined"
                          fullWidth
                          startIcon={<EventAvailable />}
                          onClick={() => router.push('/bookings')}
                          sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                        >
                          My Bookings
                        </Button>
                      ) : (
                        <Chip
                          label="Verify your account to book"
                          color="warning"
                          sx={{ width: '100%', height: 'auto', py: 1.5 }}
                        />
                      )
                    ) : (
                      <Button
                        variant="contained"
                        fullWidth
                        startIcon={<Login />}
                        onClick={() => router.push('/login')}
                        sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                      >
                        Log in to Get Started
                      </Button>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Featured Destinations */}
      <Container maxWidth="lg" sx={{ py: 8 }}>
        <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
          <TrendingUp sx={{ fontSize: 40, color: 'primary.main' }} />
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
              Popular Destinations
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Most booked venues this month
            </Typography>
          </Box>
        </Box>

        <Grid container spacing={3}>
          {popularDestinations.length > 0 ? (
            popularDestinations.map((dest) => (
              <Grid xs={12} sm={6} md={4} key={dest.id}>
                <Card
                  elevation={0}
                  sx={{
                    border: 1,
                    borderColor: 'divider',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      boxShadow: 3,
                      transform: 'translateY(-4px)',
                    },
                  }}
                >
                  <Box
                    sx={{
                      height: 200,
                      bgcolor: 'grey.100',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderBottom: 1,
                      borderColor: 'divider',
                      position: 'relative',
                    }}
                  >
                    <Place sx={{ fontSize: 64, color: 'grey.400' }} />
                    {dest.bookingCount > 0 && (
                      <Chip
                        label={`${dest.bookingCount} bookings`}
                        size="small"
                        color="primary"
                        sx={{
                          position: 'absolute',
                          top: 12,
                          right: 12,
                          fontWeight: 600,
                        }}
                      />
                    )}
                  </Box>
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                      {dest.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {dest.address || 'No address provided'}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {dest.type && (
                        <Chip label={dest.type} size="small" variant="outlined" />
                      )}
                      {dest.capacity && (
                        <Chip
                          label={`Capacity: ${dest.capacity}`}
                          size="small"
                          variant="outlined"
                        />
                      )}
                    </Box>
                  </CardContent>
                  <CardActions sx={{ p: 2, pt: 0 }}>
                    <Button
                      component={Link}
                      href={`/destination/${dest.id}`}
                      endIcon={<ArrowForward />}
                      fullWidth
                      variant="outlined"
                    >
                      View Details
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))
          ) : (
            destinations.slice(0, 6).map((dest) => (
              <Grid xs={12} sm={6} md={4} key={dest.id}>
                <Card
                  elevation={0}
                  sx={{
                    border: 1,
                    borderColor: 'divider',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      boxShadow: 3,
                      transform: 'translateY(-4px)',
                    },
                  }}
                >
                  <Box
                    sx={{
                      height: 200,
                      bgcolor: 'grey.100',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderBottom: 1,
                      borderColor: 'divider',
                    }}
                  >
                    <Place sx={{ fontSize: 64, color: 'grey.400' }} />
                  </Box>
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                      {dest.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {dest.address || 'No address provided'}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {dest.type && (
                        <Chip label={dest.type} size="small" variant="outlined" />
                      )}
                      {dest.capacity && (
                        <Chip
                          label={`Capacity: ${dest.capacity}`}
                          size="small"
                          variant="outlined"
                        />
                      )}
                    </Box>
                  </CardContent>
                  <CardActions sx={{ p: 2, pt: 0 }}>
                    <Button
                      component={Link}
                      href={`/destination/${dest.id}`}
                      endIcon={<ArrowForward />}
                      fullWidth
                      variant="outlined"
                    >
                      View Details
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))
          )}
        </Grid>
      </Container>

      {/* Upcoming Events */}
      {upcomingEvents.length > 0 && (
        <Box sx={{ bgcolor: 'grey.50', py: 8 }}>
          <Container maxWidth="lg">
            <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
              <Event sx={{ fontSize: 40, color: 'secondary.main' }} />
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
                  Upcoming Events
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Don&apos;t miss out on these exciting events
                </Typography>
              </Box>
            </Box>

            <Grid container spacing={3}>
              {upcomingEvents.map((event) => (
                <Grid xs={12} sm={6} md={4} key={event.id}>
                  <Card
                    elevation={0}
                    sx={{
                      border: 1,
                      borderColor: 'divider',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        boxShadow: 3,
                        transform: 'translateY(-4px)',
                      },
                    }}
                  >
                    <Box
                      sx={{
                        height: 160,
                        bgcolor: 'secondary.50',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderBottom: 1,
                        borderColor: 'divider',
                      }}
                    >
                      <Event sx={{ fontSize: 64, color: 'secondary.main' }} />
                    </Box>
                    <CardContent sx={{ flexGrow: 1 }}>
                      <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                        {event.name}
                      </Typography>
                      {event.destinations && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                          <Place sx={{ fontSize: 16, color: 'text.secondary' }} />
                          <Typography variant="body2" color="text.secondary">
                            {event.destinations.name}
                          </Typography>
                        </Box>
                      )}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                        <CalendarToday sx={{ fontSize: 16, color: 'text.secondary' }} />
                        <Typography variant="body2" color="text.secondary">
                          {new Date(event.start_datetime).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 2 }}>
                        <Schedule sx={{ fontSize: 16, color: 'text.secondary' }} />
                        <Typography variant="body2" color="text.secondary">
                          {new Date(event.start_datetime).toLocaleTimeString('en-GB', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Typography>
                      </Box>
                      {event.price && (
                        <Chip
                          label={`₹${parseFloat(event.price).toFixed(2)}`}
                          color="success"
                          size="small"
                          sx={{ fontWeight: 600 }}
                        />
                      )}
                    </CardContent>
                    <CardActions sx={{ p: 2, pt: 0 }}>
                      <Button
                        component={Link}
                        href={`/destination/${event.destination_id}`}
                        endIcon={<ArrowForward />}
                        fullWidth
                        variant="contained"
                        color="secondary"
                      >
                        View Event
                      </Button>
                    </CardActions>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Container>
        </Box>
      )}

      {/* Categories */}
      <Box sx={{ bgcolor: 'grey.50', py: 8 }}>
        <Container maxWidth="lg">
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 4 }}>
            Browse by Category
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            {categories.map((category) => (
              <Chip
                key={category}
                label={category}
                component={Link}
                href={`/search?type=${encodeURIComponent(category)}`}
                clickable
                sx={{
                  px: 2,
                  py: 2.5,
                  fontSize: '1rem',
                  fontWeight: 500,
                  '&:hover': {
                    bgcolor: 'primary.main',
                    color: 'white',
                  },
                }}
              />
            ))}
          </Box>
        </Container>
      </Box>
    </Box>
  )
}

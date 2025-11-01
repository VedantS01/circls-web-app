"use client"
import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'
import {
  Container,
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  Divider,
  CircularProgress,
  List,
  ListItem,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Grid,
} from '@mui/material'
import {
  Place,
  Schedule,
  People,
  AttachMoney,
  CalendarToday,
  EventNote,
  ArrowBack,
  ArrowForward,
  BookOnline,
  Edit,
  Add,
  Payment,
  Close,
  AccessTime,
  Info,
  CheckCircle,
} from '@mui/icons-material'

export default function DestinationDetail() {
  const params = useParams()
  const router = useRouter()
  const id = params.id
  const [destination, setDestination] = useState(null)
  const [slots, setSlots] = useState([])
  const [events, setEvents] = useState([])
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState(null)
  const [userPermissions, setUserPermissions] = useState({
    canManage: false,
    canViewBookings: false,
  })
  
  // Slot booking state
  const [slotBookingOpen, setSlotBookingOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [availableSlots, setAvailableSlots] = useState([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  
  // Payment modal state
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [bookingData, setBookingData] = useState(null)
  const [processingPayment, setProcessingPayment] = useState(false)
  const [paymentError, setPaymentError] = useState(null)

  useEffect(() => {
    async function fetchData() {
      try {
        // Get current user (optional for public viewing)
        const { data: { session } } = await supabase.auth.getSession()
        setCurrentUser(session?.user || null)

        // Fetch destination (public access)
        const { data: d } = await supabase.from('destinations').select('*').eq('id', id).single()
        setDestination(d)

        // Check user permissions only if logged in
        if (session?.user) {
          const { data: membership } = await supabase
            .from('destination_memberships')
            .select('permissions')
            .eq('destination_id', id)
            .eq('profile_id', session.user.id)
            .single()

          const hasDestinationManager = membership?.permissions?.includes('destination_manager')
          const hasBookingManager = membership?.permissions?.includes('booking_manager')

          setUserPermissions({
            canManage: hasDestinationManager || false,
            canViewBookings: hasBookingManager || hasDestinationManager || false,
          })

          // Fetch bookings (only for managers)
          if (hasBookingManager || hasDestinationManager) {
            const { data: b } = await supabase
              .from('bookings')
              .select(`
                *,
                profiles:user_id (full_name)
              `)
              .eq('destination_id', id)
              .order('created_at', { ascending: false })
            setBookings(b || [])
          }

          // Fetch all slots for management view
          if (hasDestinationManager) {
            const { data: s } = await supabase.from('slots').select('*').eq('destination_id', id)
            setSlots(s || [])
          }
        }

        // Fetch events (public access) - only future events
        const now = new Date().toISOString()
        const { data: e } = await supabase
          .from('events')
          .select('*')
          .eq('destination_id', id)
          .gte('start_datetime', now)
          .order('start_datetime', { ascending: true })
        setEvents(e || [])

      } catch (error) {
        console.error('Error fetching destination:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [id])

  // Fetch available slots for a specific date
  const fetchSlotsForDate = async (date) => {
    setLoadingSlots(true)
    try {
      const { data: slotsData } = await supabase
        .from('slots')
        .select('*')
        .eq('destination_id', id)
        .lte('effective_start_date', date)
        .gte('effective_end_date', date)

      // Check which slots are already booked for this date
      const { data: bookedSlots } = await supabase
        .from('bookings')
        .select('bookable_id, start_datetime, end_datetime')
        .eq('destination_id', id)
        .eq('bookable_type', 'slot')
        .gte('start_datetime', `${date}T00:00:00`)
        .lte('start_datetime', `${date}T23:59:59`)

      const bookedSlotIds = new Set(bookedSlots?.map(b => b.bookable_id) || [])

      const available = (slotsData || []).map(slot => ({
        ...slot,
        isAvailable: !bookedSlotIds.has(slot.id),
      }))

      setAvailableSlots(available)
    } catch (error) {
      console.error('Error fetching slots:', error)
    } finally {
      setLoadingSlots(false)
    }
  }

  const handleOpenSlotBooking = () => {
    if (!currentUser) {
      router.push('/login')
      return
    }
    setSlotBookingOpen(true)
    fetchSlotsForDate(selectedDate)
  }

  const handleDateChange = (newDate) => {
    setSelectedDate(newDate)
    fetchSlotsForDate(newDate)
  }

  const handleSlotSelect = (slot) => {
    const today = selectedDate
    const startDT = new Date(`${today}T${slot.start_time}`)
    const endDT = new Date(`${today}T${slot.end_time}`)

    const booking = {
      bookable_id: slot.id,
      bookable_type: 'slot',
      destination_id: id,
      start_datetime: startDT.toISOString(),
      end_datetime: endDT.toISOString(),
      number_of_attendees: 1,
      total_amount: parseFloat(slot.price),
      booking_status: 'confirmed'
    }

    setBookingData(booking)
    setSlotBookingOpen(false)

    if (parseFloat(slot.price) > 0) {
      setPaymentModalOpen(true)
    } else {
      confirmBooking(booking)
    }
  }

  const handleEventBook = (event) => {
    if (!currentUser) {
      router.push('/login')
      return
    }

    const booking = {
      bookable_id: event.id,
      bookable_type: 'event',
      destination_id: id,
      start_datetime: event.start_datetime,
      end_datetime: event.end_datetime,
      number_of_attendees: 1,
      total_amount: parseFloat(event.price),
      booking_status: 'confirmed'
    }

    setBookingData(booking)

    if (parseFloat(event.price) > 0) {
      setPaymentModalOpen(true)
    } else {
      confirmBooking(booking)
    }
  }

  const confirmBooking = async (booking) => {
    setProcessingPayment(true)
    setPaymentError(null)

    try {
      const payload = {
        ...booking,
        user_id: currentUser.id,
      }

      const { error: bookingError } = await supabase.from('bookings').insert([payload])

      if (bookingError) {
        setPaymentError(bookingError.message)
      } else {
        setPaymentModalOpen(false)
        router.push('/bookings')
      }
    } catch (err) {
      setPaymentError(String(err))
    } finally {
      setProcessingPayment(false)
    }
  }

  const handlePaymentConfirm = () => {
    // In real implementation, integrate with payment gateway here
    // For now, we'll just confirm the booking
    confirmBooking(bookingData)
  }

  const checkEventAvailability = (event) => {
    if (!event.capacity) return true // Unlimited capacity
    
    // Count existing bookings for this event
    const eventBookings = bookings.filter(b => 
      b.bookable_type === 'event' && b.bookable_id === event.id
    ).length

    return eventBookings < event.capacity
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!destination) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Typography variant="h5" color="error">Destination not found</Typography>
        <Button onClick={() => router.push('/destination')} startIcon={<ArrowBack />} sx={{ mt: 2 }}>
          Back to Destinations
        </Button>
      </Container>
    )
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Back Button */}
      <Button 
        onClick={() => router.push('/destination')} 
        startIcon={<ArrowBack />}
        sx={{ mb: 3 }}
      >
        Back to Destinations
      </Button>

      {/* Destination Header */}
      <Card elevation={0} sx={{ border: 1, borderColor: 'divider', mb: 4 }}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, flex: 1 }}>
              <Box
                sx={{
                  bgcolor: 'primary.50',
                  color: 'primary.main',
                  p: 2,
                  borderRadius: 2,
                  display: 'flex',
                }}
              >
                <Place sx={{ fontSize: 40 }} />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                  {destination.name}
                </Typography>
                {destination.type && (
                  <Chip label={destination.type} color="primary" size="small" sx={{ mb: 2 }} />
                )}
                {destination.address && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                    <Place sx={{ fontSize: 18, color: 'text.secondary' }} />
                    <Typography variant="body2" color="text.secondary">
                      {destination.address}
                    </Typography>
                  </Box>
                )}
                {destination.capacity && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <People sx={{ fontSize: 18, color: 'text.secondary' }} />
                    <Typography variant="body2" color="text.secondary">
                      Capacity: {destination.capacity}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>
            
            {userPermissions.canManage && (
              <Button
                variant="outlined"
                startIcon={<Edit />}
                onClick={() => alert('Edit functionality coming soon')}
              >
                Edit Destination
              </Button>
            )}
          </Box>

          {destination.description && (
            <>
              <Divider sx={{ my: 3 }} />
              <Typography variant="body1" color="text.secondary">
                {destination.description}
              </Typography>
            </>
          )}
        </CardContent>
      </Card>

      {/* Book Regular Slot Button */}
      <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', mb: 4, p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Schedule sx={{ fontSize: 40, color: 'primary.main' }} />
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 600 }}>
                Regular Time Slots
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Book a time slot for a specific date
              </Typography>
            </Box>
          </Box>
          <Button
            variant="contained"
            size="large"
            startIcon={<BookOnline />}
            onClick={handleOpenSlotBooking}
          >
            Book a Slot
          </Button>
        </Box>

        {userPermissions.canManage && (
          <Box sx={{ mt: 3, pt: 3, borderTop: 1, borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Manage Slots
              </Typography>
              <Button
                variant="outlined"
                startIcon={<Add />}
                size="small"
                onClick={() => router.push(`/destination/${id}/create-slot`)}
              >
                Add Slot
              </Button>
            </Box>
            {slots.length > 0 ? (
              <List sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {slots.map(s => (
                  <ListItem 
                    key={s.id}
                    sx={{
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 1,
                      p: 2,
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <Box>
                        <Typography variant="body1" sx={{ fontWeight: 600 }}>
                          {s.start_time} - {s.end_time}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          ₹{parseFloat(s.price).toFixed(2)} | Valid: {s.effective_start_date} to {s.effective_end_date}
                        </Typography>
                      </Box>
                      <IconButton size="small" onClick={() => alert('Edit slot coming soon')}>
                        <Edit />
                      </IconButton>
                    </Box>
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography variant="body2" color="text.secondary">No slots created yet</Typography>
            )}
          </Box>
        )}
      </Paper>

      {/* Events Section */}
      <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', mb: 4, p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EventNote color="secondary" />
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              Upcoming Events
            </Typography>
          </Box>
          {userPermissions.canManage && (
            <Button
              variant="outlined"
              startIcon={<Add />}
              size="small"
              color="secondary"
              onClick={() => router.push(`/destination/${id}/create-event`)}
            >
              Add Event
            </Button>
          )}
        </Box>
        
        {events.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <EventNote sx={{ fontSize: 60, color: 'text.disabled', mb: 2 }} />
            <Typography variant="body1" color="text.secondary">
              No upcoming events scheduled
            </Typography>
          </Box>
        ) : (
          <Grid container spacing={3}>
            {events.map(e => {
              const isAvailable = checkEventAvailability(e)
              const isPast = new Date(e.start_datetime) < new Date()
              const canBook = isAvailable && !isPast

              return (
                <Grid item xs={12} sm={6} md={4} key={e.id}>
                  <Card
                    elevation={0}
                    sx={{
                      border: 1,
                      borderColor: 'divider',
                      height: '100%',
                      opacity: canBook ? 1 : 0.5,
                      transition: 'all 0.3s',
                      '&:hover': canBook ? {
                        boxShadow: 3,
                        transform: 'translateY(-4px)',
                      } : {},
                    }}
                  >
                    <Box
                      sx={{
                        height: 120,
                        bgcolor: 'secondary.50',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderBottom: 1,
                        borderColor: 'divider',
                        position: 'relative',
                      }}
                    >
                      <EventNote sx={{ fontSize: 48, color: 'secondary.main' }} />
                      {!canBook && (
                        <Chip
                          label={isPast ? 'Past Event' : 'Sold Out'}
                          size="small"
                          color="error"
                          sx={{
                            position: 'absolute',
                            top: 12,
                            right: 12,
                          }}
                        />
                      )}
                    </Box>
                    <CardContent>
                      <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                        {e.name}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                        <CalendarToday sx={{ fontSize: 16, color: 'text.secondary' }} />
                        <Typography variant="body2" color="text.secondary">
                          {new Date(e.start_datetime).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                        <AccessTime sx={{ fontSize: 16, color: 'text.secondary' }} />
                        <Typography variant="body2" color="text.secondary">
                          {new Date(e.start_datetime).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 2 }}>
                        <Chip
                          label={`₹${parseFloat(e.price).toFixed(2)}`}
                          color="success"
                          size="small"
                          sx={{ fontWeight: 600 }}
                        />
                        {e.capacity && (
                          <Typography variant="caption" color="text.secondary">
                            {bookings.filter(b => b.bookable_id === e.id && b.bookable_type === 'event').length}/{e.capacity} booked
                          </Typography>
                        )}
                      </Box>
                      <Button
                        fullWidth
                        variant="contained"
                        color="secondary"
                        sx={{ mt: 2 }}
                        disabled={!canBook}
                        onClick={() => handleEventBook(e)}
                      >
                        {canBook ? 'Book Now' : (isPast ? 'Past Event' : 'Fully Booked')}
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>
              )
            })}
          </Grid>
        )}
      </Paper>

      {/* Bookings Section (Manager Only) */}
      {userPermissions.canViewBookings && bookings.length > 0 && (
        <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', p: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 600, mb: 3 }}>
            Recent Bookings
          </Typography>
          <List sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {bookings.slice(0, 10).map(b => (
              <ListItem 
                key={b.id}
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 2,
                  p: 2,
                }}
              >
                <Box sx={{ width: '100%' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {b.profiles?.full_name || 'Unknown User'}
                    </Typography>
                    <Chip
                      label={b.booking_status}
                      size="small"
                      color={b.booking_status === 'confirmed' ? 'success' : 'default'}
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {b.bookable_type === 'slot' ? 'Time Slot' : 'Event'} | {new Date(b.start_datetime).toLocaleString('en-IN')} | ₹{parseFloat(b.total_amount).toFixed(2)}
                  </Typography>
                </Box>
              </ListItem>
            ))}
          </List>
        </Paper>
      )}

      {/* Slot Booking Dialog */}
      <Dialog
        open={slotBookingOpen}
        onClose={() => setSlotBookingOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Select a Time Slot
            </Typography>
            <IconButton onClick={() => setSlotBookingOpen(false)}>
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 3 }}>
            <TextField
              fullWidth
              type="date"
              label="Select Date"
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              InputLabelProps={{ shrink: true }}
              inputProps={{ min: new Date().toISOString().split('T')[0] }}
            />
          </Box>

          {loadingSlots ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : availableSlots.length === 0 ? (
            <Alert severity="info">No slots available for this date</Alert>
          ) : (
            <List sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {availableSlots.map(slot => (
                <ListItem
                  key={slot.id}
                  sx={{
                    border: 1,
                    borderColor: slot.isAvailable ? 'divider' : 'error.main',
                    borderRadius: 2,
                    p: 2,
                    bgcolor: slot.isAvailable ? 'background.paper' : 'grey.100',
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        {slot.start_time} - {slot.end_time}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        ₹{parseFloat(slot.price).toFixed(2)}
                      </Typography>
                    </Box>
                    <Button
                      variant="contained"
                      disabled={!slot.isAvailable}
                      onClick={() => handleSlotSelect(slot)}
                    >
                      {slot.isAvailable ? 'Book' : 'Booked'}
                    </Button>
                  </Box>
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Modal */}
      <Dialog
        open={paymentModalOpen}
        onClose={() => !processingPayment && setPaymentModalOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Payment color="primary" />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Payment Required
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Paper elevation={0} sx={{ bgcolor: 'grey.50', p: 3, borderRadius: 2, mb: 3 }}>
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main', mb: 1 }}>
              ₹{bookingData?.total_amount?.toFixed(2)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Total Amount
            </Typography>
          </Paper>

          <Alert severity="info" icon={<Info />} sx={{ mb: 2 }}>
            Payment integration is in progress. For now, click &quot;Confirm Payment&quot; to complete your booking.
          </Alert>

          {paymentError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {paymentError}
            </Alert>
          )}

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            By confirming, you agree to the booking terms and conditions.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button
            onClick={() => setPaymentModalOpen(false)}
            disabled={processingPayment}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handlePaymentConfirm}
            disabled={processingPayment}
            startIcon={processingPayment ? <CircularProgress size={20} /> : <CheckCircle />}
          >
            {processingPayment ? 'Processing...' : 'Confirm Payment'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}

'use client'
import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
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
  BookOnline,
  Edit,
  Add,
  Close,
  CheckCircle,
  Cancel,
} from '@mui/icons-material'

export default function DestinationDetail() {
  const params = useParams()
  const router = useRouter()
  const id = params.id
  
  // State
  const [destination, setDestination] = useState(null)
  const [slots, setSlots] = useState([])
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState(null)
  const [userPermissions, setUserPermissions] = useState({
    canManage: false,
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
        const { data: d } = await supabase
          .from('destinations')
          .select('*, organizations(payment_details)')
          .eq('id', id)
          .single()
        setDestination(d)

        // Check user permissions only if logged in
        if (session?.user) {
          const { data: membership, error: membershipError } = await supabase
            .from('destination_memberships')
            .select('*')
            .eq('destination_id', id)
            .eq('profile_id', session.user.id)
            .maybeSingle()

          if (membershipError) {
            console.error('Error fetching membership:', membershipError)
          }

          const hasDestinationManager = membership?.permissions?.includes('destination_manager')

          setUserPermissions({
            canManage: hasDestinationManager || false,
          })

          // Fetch all slots for managers only
          if (hasDestinationManager) {
            const { data: s } = await supabase
              .from('slots')
              .select('*')
              .eq('destination_id', id)
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
  const fetchAvailableSlotsForDate = async (date) => {
    setLoadingSlots(true)
    try {
      // Get all slots for this destination that are effective on this date
      const { data: allSlots } = await supabase
        .from('slots')
        .select('*')
        .eq('destination_id', id)
        .lte('effective_start_date', date)
        .gte('effective_end_date', date)

      if (!allSlots || allSlots.length === 0) {
        setAvailableSlots([])
        setLoadingSlots(false)
        return
      }

      // Get bookings for this date (check all bookings and filter by date)
      const { data: bookedSlots } = await supabase
        .from('bookings')
        .select('bookable_id, start_datetime, end_datetime')
        .eq('destination_id', id)
        .eq('bookable_type', 'slot')
        .in('booking_status', ['confirmed', 'pending'])

      console.log('All bookings:', bookedSlots)

      // Filter bookings that match the selected date
      const bookedSlotsOnDate = bookedSlots?.filter(booking => {
        const bookingDate = new Date(booking.start_datetime).toISOString().split('T')[0]
        return bookingDate === date
      }) || []

      console.log('Booked slots for date', date, ':', bookedSlotsOnDate)

      const bookedSlotIds = new Set(bookedSlotsOnDate.map(b => b.bookable_id))

      // Mark slots as available or booked
      const slotsWithAvailability = allSlots.map(slot => ({
        ...slot,
        isAvailable: !bookedSlotIds.has(slot.id)
      }))

      setAvailableSlots(slotsWithAvailability)
    } catch (error) {
      console.error('Error fetching slots:', error)
      setAvailableSlots([])
    } finally {
      setLoadingSlots(false)
    }
  }

  // Handle slot booking dialog open
  const handleOpenSlotBooking = () => {
    setSlotBookingOpen(true)
    fetchAvailableSlotsForDate(selectedDate)
  }

  // Handle date change in slot booking
  const handleDateChange = (newDate) => {
    setSelectedDate(newDate)
    fetchAvailableSlotsForDate(newDate)
  }

  // Handle slot booking
  const handleBookSlot = async (slot) => {
    if (!currentUser) {
      router.push('/login')
      return
    }

    // Use the selected date and combine with slot times
    const startDT = new Date(`${selectedDate}T${slot.start_time}`)
    const endDT = new Date(`${selectedDate}T${slot.end_time}`)

    console.log('Creating booking with datetimes:', {
      selectedDate,
      slotStart: slot.start_time,
      slotEnd: slot.end_time,
      startDT: startDT.toISOString(),
      endDT: endDT.toISOString()
    })

    const booking = {
      bookable_id: slot.id,
      bookable_type: 'slot',
      user_id: currentUser.id,
      destination_id: id,
      start_datetime: startDT.toISOString(),
      end_datetime: endDT.toISOString(),
      number_of_attendees: 1,
      total_amount: slot.price,
      booking_status: 'pending',
    }

    // Check if payment is required
    if (parseFloat(slot.price) > 0) {
      setBookingData(booking)
      setPaymentModalOpen(true)
      setSlotBookingOpen(false)
    } else {
      // Free booking
      await confirmBooking(booking)
    }
  }

  // Handle event booking
  const handleBookEvent = async (event) => {
    if (!currentUser) {
      router.push('/login')
      return
    }

    // Check if event is full
    if (event.capacity) {
      const { data: existingBookings } = await supabase
        .from('bookings')
        .select('id')
        .eq('bookable_id', event.id)
        .eq('bookable_type', 'event')
        .eq('booking_status', 'confirmed')

      if (existingBookings && existingBookings.length >= event.capacity) {
        alert('This event is fully booked')
        return
      }
    }

    const booking = {
      bookable_id: event.id,
      bookable_type: 'event',
      user_id: currentUser.id,
      destination_id: id,
      start_datetime: event.start_datetime,
      end_datetime: event.end_datetime,
      number_of_attendees: 1,
      total_amount: event.price,
      booking_status: 'pending',
    }

    // Check if payment is required
    if (parseFloat(event.price) > 0) {
      setBookingData(booking)
      setPaymentModalOpen(true)
    } else {
      // Free booking
      await confirmBooking(booking)
    }
  }

  // Confirm booking (after payment or if free)
  const confirmBooking = async (booking) => {
    try {
      const { error } = await supabase
        .from('bookings')
        .insert([{ ...booking, booking_status: 'confirmed' }])

      if (error) throw error

      alert('Booking confirmed successfully!')
      setPaymentModalOpen(false)
      setSlotBookingOpen(false)
      router.push('/bookings')
    } catch (error) {
      console.error('Booking error:', error)
      alert('Booking failed: ' + error.message)
    }
  }

  // Handle payment
  const handlePayment = async () => {
    setProcessingPayment(true)
    setPaymentError(null)

    try {
      // Check if organization has payment enabled
      if (!destination.organizations?.payment_enabled || !destination.organizations?.stripe_account_id) {
        // Skip payment if not configured
        await confirmBooking(bookingData)
        return
      }

      // TODO: Implement actual payment processing with Stripe
      // For now, simulate payment success
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      await confirmBooking(bookingData)
    } catch (error) {
      console.error('Payment error:', error)
      setPaymentError('Payment failed. Please try again.')
    } finally {
      setProcessingPayment(false)
    }
  }

  // Check if event is available (not full)
  const isEventAvailable = (event) => {
    if (!event.capacity) return true
    // This would need to be calculated properly with actual bookings
    return true // Simplified for now
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

      {/* Destination Header - Always visible */}
      <Card elevation={0} sx={{ border: 1, borderColor: 'divider', mb: 4 }}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
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
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                {destination.type && (
                  <Chip label={destination.type} color="primary" size="small" />
                )}
                {destination.capacity && (
                  <Chip 
                    icon={<People sx={{ fontSize: 18 }} />}
                    label={`Capacity: ${destination.capacity}`} 
                    variant="outlined"
                    size="small"
                  />
                )}
              </Box>
              {destination.address && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
                  <Place sx={{ fontSize: 18 }} />
                  <Typography variant="body2">{destination.address}</Typography>
                </Box>
              )}
            </Box>
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

      {/* Book Regular Slot Button - For regular users */}
      {!userPermissions.canManage && (
        <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', mb: 4, p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box
                sx={{
                  bgcolor: 'primary.50',
                  color: 'primary.main',
                  p: 1.5,
                  borderRadius: 1.5,
                  display: 'flex',
                }}
              >
                <Schedule fontSize="large" />
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Book a Regular Slot
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Choose a date and view available time slots
                </Typography>
              </Box>
            </Box>
            <Button
              variant="contained"
              size="large"
              startIcon={<BookOnline />}
              onClick={handleOpenSlotBooking}
            >
              View Slots
            </Button>
          </Box>
        </Paper>
      )}

      {/* Manage Slots - For managers only */}
      {userPermissions.canManage && (
        <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', mb: 4, p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Schedule color="primary" />
              <Typography variant="h5" sx={{ fontWeight: 600 }}>
                Manage Slots
              </Typography>
            </Box>
            <Button
              variant="outlined"
              startIcon={<Add />}
              onClick={() => router.push(`/destination/${id}/create-slot`)}
            >
              Add Slot
            </Button>
          </Box>
          
          {slots.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Schedule sx={{ fontSize: 60, color: 'text.disabled', mb: 2 }} />
              <Typography variant="body1" color="text.secondary">
                No slots created yet.
              </Typography>
            </Box>
          ) : (
            <List sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {slots.map(s => (
                <ListItem 
                  key={s.id}
                  sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 2,
                    p: 2,
                  }}
                >
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {s.start_time} - {s.end_time}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      ₹{parseFloat(s.price).toFixed(2)} • Valid: {s.effective_start_date} to {s.effective_end_date}
                    </Typography>
                  </Box>
                  <IconButton size="small">
                    <Edit />
                  </IconButton>
                </ListItem>
              ))}
            </List>
          )}
        </Paper>
      )}

      {/* Events Section - Always visible */}
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
              No upcoming events at this destination.
            </Typography>
          </Box>
        ) : (
          <Grid container spacing={2}>
            {events.map(e => {
              const available = isEventAvailable(e)
              return (
                <Grid item xs={12} md={6} key={e.id}>
                  <Card
                    elevation={0}
                    sx={{
                      border: 1,
                      borderColor: 'divider',
                      opacity: available ? 1 : 0.6,
                      bgcolor: available ? 'background.paper' : 'grey.100',
                    }}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'start', gap: 2, mb: 2 }}>
                        <Box
                          sx={{
                            bgcolor: 'secondary.50',
                            color: 'secondary.main',
                            p: 1,
                            borderRadius: 1,
                          }}
                        >
                          <EventNote />
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                            {e.name}
                          </Typography>
                          {!available && (
                            <Chip label="Full" size="small" color="error" sx={{ mb: 1 }} />
                          )}
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                            <CalendarToday sx={{ fontSize: 16, color: 'text.secondary' }} />
                            <Typography variant="body2" color="text.secondary">
                              {new Date(e.start_datetime).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <AttachMoney sx={{ fontSize: 18, color: 'success.main' }} />
                            <Typography variant="body1" sx={{ fontWeight: 600, color: 'success.main' }}>
                              ₹{parseFloat(e.price).toFixed(2)}
                            </Typography>
                          </Box>
                          {e.capacity && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                              <People sx={{ fontSize: 16, color: 'text.secondary' }} />
                              <Typography variant="caption" color="text.secondary">
                                Capacity: {e.capacity}
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        {userPermissions.canManage && (
                          <IconButton size="small">
                            <Edit />
                          </IconButton>
                        )}
                        <Button
                          variant="contained"
                          color="secondary"
                          fullWidth
                          disabled={!available}
                          onClick={() => handleBookEvent(e)}
                        >
                          {available ? 'Book Event' : 'Fully Booked'}
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              )
            })}
          </Grid>
        )}
      </Paper>

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
              Book a Time Slot
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
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : availableSlots.length === 0 ? (
            <Alert severity="info">No slots available for this date.</Alert>
          ) : (
            <List sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {availableSlots.map(slot => (
                <ListItem
                  key={slot.id}
                  sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 2,
                    p: 2,
                    opacity: slot.isAvailable ? 1 : 0.5,
                    bgcolor: slot.isAvailable ? 'background.paper' : 'grey.50',
                  }}
                >
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {slot.start_time} - {slot.end_time}
                    </Typography>
                    <Typography variant="body1" color="success.main" sx={{ fontWeight: 600 }}>
                      ₹{parseFloat(slot.price).toFixed(2)}
                    </Typography>
                  </Box>
                  <Button
                    variant="contained"
                    disabled={!slot.isAvailable}
                    onClick={() => handleBookSlot(slot)}
                  >
                    {slot.isAvailable ? 'Book' : 'Booked'}
                  </Button>
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              sx={{
                bgcolor: 'success.50',
                color: 'success.main',
                p: 1,
                borderRadius: 1,
              }}
            >
              <AttachMoney />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Complete Payment
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          {bookingData && (
            <Box sx={{ py: 2 }}>
              <Paper elevation={0} sx={{ bgcolor: 'grey.50', p: 3, borderRadius: 2, mb: 3 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Booking Details
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                  {bookingData.bookable_type === 'slot' 
                    ? `Time Slot: ${new Date(bookingData.start_datetime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} - ${new Date(bookingData.end_datetime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
                    : `Event on ${new Date(bookingData.start_datetime).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                  }
                </Typography>
                <Divider sx={{ my: 2 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="h6">Total Amount</Typography>
                  <Typography variant="h5" color="success.main" sx={{ fontWeight: 700 }}>
                    ₹{parseFloat(bookingData.total_amount).toFixed(2)}
                  </Typography>
                </Box>
              </Paper>

              {destination.organizations?.payment_details ? null : (
                <Alert severity="info" sx={{ mb: 2 }}>
                  Payment processing is not configured for this venue. Your booking will be confirmed without payment.
                </Alert>
              )}

              {paymentError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {paymentError}
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button
            onClick={() => setPaymentModalOpen(false)}
            disabled={processingPayment}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handlePayment}
            disabled={processingPayment}
            startIcon={processingPayment ? <CircularProgress size={20} /> : <CheckCircle />}
          >
            {processingPayment ? 'Processing...' : destination.organizations?.payment_enabled ? 'Pay Now' : 'Confirm Booking'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}

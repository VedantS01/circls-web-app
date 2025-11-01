'use client'
import React, { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import VerifiedGuard from '@/components/VerifiedGuard'
import {
  Container,
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Grid,
} from '@mui/material'
import {
  ArrowBack,
  Save,
  EventNote,
} from '@mui/icons-material'

export default function CreateEvent() {
  const params = useParams()
  const router = useRouter()
  const { id } = params
  const [destination, setDestination] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    start_datetime: '',
    end_datetime: '',
    price: '',
    capacity: '',
  })

  useEffect(() => {
    async function init() {
      const { data: session } = await supabase.auth.getSession()
      if (!session.session) {
        router.push('/login')
        return
      }

      // Fetch destination
      const { data: dest, error: destError } = await supabase
        .from('destinations')
        .select('*')
        .eq('id', id)
        .single()

      if (destError || !dest) {
        setError('Destination not found')
        setLoading(false)
        return
      }

      setDestination(dest)
      setLoading(false)
    }
    init()
  }, [id, router])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSaving(true)

    try {
      // Validate
      if (!formData.name.trim()) {
        setError('Event name is required')
        setSaving(false)
        return
      }

      if (!formData.start_datetime || !formData.end_datetime) {
        setError('Start and end date/time are required')
        setSaving(false)
        return
      }

      if (!formData.price || parseFloat(formData.price) < 0) {
        setError('Valid price is required')
        setSaving(false)
        return
      }

      if (formData.capacity && (parseInt(formData.capacity) < 1)) {
        setError('Capacity must be at least 1')
        setSaving(false)
        return
      }

      // Check if end is after start
      const startDT = new Date(formData.start_datetime)
      const endDT = new Date(formData.end_datetime)
      if (endDT <= startDT) {
        setError('End date/time must be after start date/time')
        setSaving(false)
        return
      }

      const payload = {
        destination_id: id,
        name: formData.name.trim(),
        start_datetime: formData.start_datetime,
        end_datetime: formData.end_datetime,
        price: parseFloat(formData.price),
      }

      // Add capacity if provided
      if (formData.capacity) {
        payload.capacity = parseInt(formData.capacity)
      }

      const { error: insertError } = await supabase
        .from('events')
        .insert([payload])

      if (insertError) {
        setError(insertError.message)
      } else {
        setSuccess(true)
        setTimeout(() => {
          router.push(`/destination/${id}`)
        }, 1500)
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (error && !destination) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    )
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
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 56,
                  height: 56,
                  borderRadius: 2,
                  bgcolor: 'secondary.50',
                  color: 'secondary.main',
                }}
              >
                <EventNote sx={{ fontSize: 32 }} />
              </Box>
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  Create Event
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  {destination?.name}
                </Typography>
              </Box>
            </Box>

            {success && (
              <Alert severity="success" sx={{ mb: 3 }}>
                Event created successfully! Redirecting...
              </Alert>
            )}

            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit}>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Event Name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    disabled={saving || success}
                    placeholder="e.g., Summer Tournament, Yoga Class"
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Start Date & Time"
                    name="start_datetime"
                    type="datetime-local"
                    value={formData.start_datetime}
                    onChange={handleChange}
                    required
                    disabled={saving || success}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="End Date & Time"
                    name="end_datetime"
                    type="datetime-local"
                    value={formData.end_datetime}
                    onChange={handleChange}
                    required
                    disabled={saving || success}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Price (₹)"
                    name="price"
                    type="number"
                    value={formData.price}
                    onChange={handleChange}
                    required
                    disabled={saving || success}
                    inputProps={{ min: 0, step: 0.01 }}
                    placeholder="0.00"
                  />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Capacity (Optional)"
                    name="capacity"
                    type="number"
                    value={formData.capacity}
                    onChange={handleChange}
                    disabled={saving || success}
                    inputProps={{ min: 1, step: 1 }}
                    placeholder="Maximum number of attendees"
                    helperText="Leave empty for unlimited capacity"
                  />
                </Grid>

                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                    <Button
                      variant="outlined"
                      onClick={() => router.push(`/destination/${id}`)}
                      disabled={saving || success}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="contained"
                      startIcon={saving ? <CircularProgress size={20} /> : <Save />}
                      disabled={saving || success}
                      color="secondary"
                    >
                      {saving ? 'Creating...' : 'Create Event'}
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </form>
          </CardContent>
        </Card>
      </Container>
    </VerifiedGuard>
  )
}

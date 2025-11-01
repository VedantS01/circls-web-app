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
  Schedule,
} from '@mui/icons-material'

export default function CreateSlot() {
  const params = useParams()
  const router = useRouter()
  const { id } = params
  const [destination, setDestination] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const [formData, setFormData] = useState({
    start_time: '',
    end_time: '',
    price: '',
    effective_start_date: '',
    effective_end_date: '',
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
      if (!formData.start_time || !formData.end_time) {
        setError('Start and end times are required')
        setSaving(false)
        return
      }

      if (!formData.effective_start_date || !formData.effective_end_date) {
        setError('Effective start and end dates are required')
        setSaving(false)
        return
      }

      if (!formData.price || parseFloat(formData.price) < 0) {
        setError('Valid price is required')
        setSaving(false)
        return
      }

      // Check if end_time is after start_time
      const [startHour, startMin] = formData.start_time.split(':').map(Number)
      const [endHour, endMin] = formData.end_time.split(':').map(Number)
      const startMinutes = startHour * 60 + startMin
      const endMinutes = endHour * 60 + endMin

      if (endMinutes <= startMinutes) {
        setError('End time must be after start time')
        setSaving(false)
        return
      }

      // Check if effective_end_date is after effective_start_date
      const effectiveStart = new Date(formData.effective_start_date)
      const effectiveEnd = new Date(formData.effective_end_date)

      if (effectiveEnd <= effectiveStart) {
        setError('Effective end date must be after effective start date')
        setSaving(false)
        return
      }

      const payload = {
        destination_id: id,
        start_time: formData.start_time,
        end_time: formData.end_time,
        price: parseFloat(formData.price),
        effective_start_date: formData.effective_start_date,
        effective_end_date: formData.effective_end_date,
      }

      const { error: insertError } = await supabase
        .from('slots')
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
                  bgcolor: 'primary.50',
                  color: 'primary.main',
                }}
              >
                <Schedule sx={{ fontSize: 32 }} />
              </Box>
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  Create Time Slot
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  {destination?.name}
                </Typography>
              </Box>
            </Box>

            {success && (
              <Alert severity="success" sx={{ mb: 3 }}>
                Slot created successfully! Redirecting...
              </Alert>
            )}

            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit}>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Start Time"
                    name="start_time"
                    type="time"
                    value={formData.start_time}
                    onChange={handleChange}
                    required
                    disabled={saving || success}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="End Time"
                    name="end_time"
                    type="time"
                    value={formData.end_time}
                    onChange={handleChange}
                    required
                    disabled={saving || success}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Effective Start Date"
                    name="effective_start_date"
                    type="date"
                    value={formData.effective_start_date}
                    onChange={handleChange}
                    required
                    disabled={saving || success}
                    InputLabelProps={{ shrink: true }}
                    helperText="When this slot becomes available"
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Effective End Date"
                    name="effective_end_date"
                    type="date"
                    value={formData.effective_end_date}
                    onChange={handleChange}
                    required
                    disabled={saving || success}
                    InputLabelProps={{ shrink: true }}
                    helperText="When this slot expires"
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
                    >
                      {saving ? 'Creating...' : 'Create Slot'}
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

'use client'
import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import {
  Container,
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Stepper,
  Step,
  StepLabel,
  CircularProgress,
  Alert,
  Paper,
  Grid,
} from '@mui/material'
import {
  Business,
  CheckCircle,
  ArrowForward,
} from '@mui/icons-material'

export default function OnboardingPage() {
  const router = useRouter()
  const [orgName, setOrgName] = useState('')
  const [loading, setLoading] = useState(false)
  const [session, setSession] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function getSession() {
      const { data } = await supabase.auth.getSession()
      setSession(data.session)
      
      if (!data.session) {
        router.push('/login')
        return
      }

      const confirmed = data.session.user?.email_confirmed_at || data.session.user?.confirmed_at
      if (!confirmed) {
        router.push('/login?confirmRequired=1')
        return
      }
    }
    getSession()
  }, [router])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!session) return
    
    const confirmed = session.user?.email_confirmed_at || session.user?.confirmed_at
    if (!confirmed) {
      setLoading(false)
      setError('Please confirm your email before continuing. Check your inbox for a confirmation link.')
      return
    }
    
    setLoading(true)
    setError(null)

    const profilePayload = {
      id: session.user.id,
      full_name: session.user.user_metadata?.full_name || session.user.email || null,
      avatar_url: session.user.user_metadata?.avatar_url || null
    }

    const { data: upsertData, error: upsertError } = await supabase
      .from('profiles')
      .upsert([profilePayload], { returning: 'representation' })

    if (upsertError) {
      console.error('Profile upsert failed', upsertError)
      setLoading(false)
      setError('Unable to create profile: ' + upsertError.message)
      return
    }

    const { data: existingProfile, error: profileSelectError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', session.user.id)
      .single()

    if (profileSelectError || !existingProfile) {
      console.error('Profile select failed', profileSelectError)
      setLoading(false)
      setError('Profile was not found after creation. Please check your permissions.')
      return
    }

    const payload = { name: orgName.trim() }
    const accessToken = session.access_token || (await supabase.auth.getSession()).data?.session?.access_token
    
    try {
      const res = await fetch('/api/create-organization', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ payload, userId: session.user.id }),
      })
      const result = await res.json()
      
      console.log('Create organization response:', { status: res.status, result });
      
      setLoading(false)
      
      if (!res.ok) {
        const errorMessage = result.error || res.statusText
        const errorDetails = result.details ? ` (${result.details})` : ''
        const errorHint = result.hint ? ` Hint: ${result.hint}` : ''
        console.error('Create organization failed:', { status: res.status, result });
        setError(`Error creating organization: ${errorMessage}${errorDetails}${errorHint}`)
        return
      }
      
      console.log('Organization created successfully:', result.organization);
      router.push('/dashboard')
    } catch (err) {
      setLoading(false)
      console.error('Create org request failed', err)
      setError('Error creating organization: ' + String(err))
    }
  }

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: 4 }}>
      <Container maxWidth="md">
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 6 }}>
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
            <Business sx={{ fontSize: 48 }} />
          </Box>
          <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
            Welcome to Circls
          </Typography>
          <Typography variant="h6" color="text.secondary">
            Let&apos;s set up your organization
          </Typography>
        </Box>

        {/* Progress Stepper */}
        <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', mb: 4, p: 3 }}>
          <Stepper activeStep={0} alternativeLabel>
            <Step>
              <StepLabel>Create Organization</StepLabel>
            </Step>
            <Step>
              <StepLabel>Add Team Members</StepLabel>
            </Step>
            <Step>
              <StepLabel>Create Destinations</StepLabel>
            </Step>
          </Stepper>
        </Paper>

        {/* Form Card */}
        <Card elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
          <CardContent sx={{ p: 4 }}>
            <Box sx={{ mb: 3 }}>
              <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
                Create Your Organization
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Your organization will be the hub for managing destinations, staff, and bookings.
              </Typography>
            </Box>

            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit}>
              <TextField
                fullWidth
                required
                label="Organization Name"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="e.g. Sports Center Downtown"
                helperText="Choose a name that represents your business or organization"
                sx={{ mb: 3 }}
              />

              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={loading || !orgName.trim()}
                  endIcon={loading ? <CircularProgress size={20} /> : <ArrowForward />}
                >
                  {loading ? 'Creating...' : 'Create Organization'}
                </Button>
              </Box>
            </form>
          </CardContent>
        </Card>

        {/* Info Cards */}
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            What happens next?
          </Typography>
          <Grid container spacing={2} sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
            <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                <CheckCircle sx={{ color: 'success.main' }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  1. Invite Your Team
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Add staff members and assign permissions to manage your organization
              </Typography>
            </Paper>

            <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                <CheckCircle sx={{ color: 'success.main' }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  2. Add Destinations
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Create venues, courts, or spaces that customers can book
              </Typography>
            </Paper>

            <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                <CheckCircle sx={{ color: 'success.main' }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  3. Start Taking Bookings
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Set up slots and start accepting bookings from customers
              </Typography>
            </Paper>
          </Grid>
        </Box>
      </Container>
    </Box>
  )
}

'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import {
  Container,
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material'
import {
  Place,
  ArrowBack,
  Save,
} from '@mui/icons-material'

export default function CreateDestination() {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [memberships, setMemberships] = useState([])
  const [selectedOrgId, setSelectedOrgId] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [address, setAddress] = useState('')
  const [capacity, setCapacity] = useState(4)
  const [type, setType] = useState('')
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [errorMessage, setErrorMessage] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setFetching(true)
      try {
        const { data } = await supabase.auth.getSession()
        const currentSession = data?.session ?? null
        if (!currentSession) {
          router.push('/login')
          return
        }
        if (!cancelled) setSession(currentSession)

        const { data: orgMemberships, error } = await supabase
          .from('organization_memberships')
          .select('organization_id, permissions, organization:organization_id (id, name)')
          .eq('profile_id', currentSession.user.id)
          .order('created_at', { ascending: true })

        if (error) throw error

        const editable = (orgMemberships || [])
          .filter(entry => Array.isArray(entry.permissions) && entry.permissions.includes('destination_editor'))
          .map(entry => ({
            id: entry.organization_id,
            name: entry.organization?.name || entry.organization_id,
          }))

        if (!cancelled) {
          setMemberships(editable)
          setSelectedOrgId(prev => (prev && editable.some(item => item.id === prev)) ? prev : (editable[0]?.id ?? ''))
        }
      } catch (err) {
        console.error('create-destination: failed to load memberships', err)
        if (!cancelled) setErrorMessage(err.message || 'Unable to load organization permissions')
      } finally {
        if (!cancelled) setFetching(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [router])

  const canCreate = useMemo(() => selectedOrgId && !fetching && memberships.length > 0, [selectedOrgId, fetching, memberships.length])

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!session) {
      router.push('/login')
      return
    }
    if (!selectedOrgId) {
      alert('Select an organization before creating a destination.')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase
        .from('destinations')
        .insert([{
          organization_id: selectedOrgId,
          name: name.trim(),
          description: description.trim() || null,
          address: address.trim() || null,
          capacity,
          type: type.trim() || null,
        }])

      if (error) throw error
      router.push('/dashboard')
    } catch (err) {
      alert('Error creating destination: ' + (err.message || err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: 4 }}>
      <Container maxWidth="md">
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Button
            startIcon={<ArrowBack />}
            onClick={() => router.push('/dashboard')}
            sx={{ mb: 2 }}
          >
            Back to Dashboard
          </Button>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
            <Place sx={{ fontSize: 40, color: 'primary.main' }} />
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                Create Destination
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Add a new venue to your organization
              </Typography>
            </Box>
          </Box>
        </Box>

        {fetching ? (
          <Card elevation={0} sx={{ border: 1, borderColor: 'divider', textAlign: 'center', py: 8 }}>
            <CircularProgress />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Loading organizations...
            </Typography>
          </Card>
        ) : memberships.length === 0 ? (
          <Alert severity="warning">
            You do not have destination editor access on any organization. Ask a staff manager to grant permissions.
          </Alert>
        ) : (
          <Card elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
            <CardContent sx={{ p: 4 }}>
              {errorMessage && (
                <Alert severity="error" sx={{ mb: 3 }}>
                  {errorMessage}
                </Alert>
              )}

              <form onSubmit={handleSubmit}>
                <Grid container spacing={3}>
                  {/* Organization Selection */}
                  <Grid xs={12}>
                    <FormControl fullWidth>
                      <InputLabel>Organization</InputLabel>
                      <Select
                        value={selectedOrgId}
                        label="Organization"
                        onChange={(event) => setSelectedOrgId(event.target.value)}
                      >
                        {memberships.map(org => (
                          <MenuItem key={org.id} value={org.id}>
                            {org.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid xs={12}>
                    <Divider />
                  </Grid>

                  {/* Name */}
                  <Grid xs={12}>
                    <TextField
                      fullWidth
                      required
                      label="Destination Name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="e.g. Court 1"
                      helperText="A clear, descriptive name for your destination"
                    />
                  </Grid>

                  {/* Description */}
                  <Grid xs={12}>
                    <TextField
                      fullWidth
                      multiline
                      rows={4}
                      label="Description"
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="Provide details about this destination..."
                      helperText="Optional overview for your team and visitors"
                    />
                  </Grid>

                  {/* Address */}
                  <Grid xs={12}>
                    <TextField
                      fullWidth
                      label="Address"
                      value={address}
                      onChange={(event) => setAddress(event.target.value)}
                      placeholder="123 Main Street, City, Country"
                      helperText="Physical location of the destination"
                    />
                  </Grid>

                  {/* Capacity and Type */}
                  <Grid xs={12} sm={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Capacity"
                      value={capacity}
                      onChange={(event) => setCapacity(Number(event.target.value))}
                      inputProps={{ min: 1 }}
                      helperText="Maximum number of people"
                    />
                  </Grid>

                  <Grid xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Type"
                      value={type}
                      onChange={(event) => setType(event.target.value)}
                      placeholder="e.g. Badminton Court"
                      helperText="Category or type of venue"
                    />
                  </Grid>

                  {/* Submit Button */}
                  <Grid xs={12}>
                    <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                      <Button
                        variant="outlined"
                        onClick={() => router.push('/dashboard')}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        variant="contained"
                        size="large"
                        startIcon={loading ? <CircularProgress size={20} /> : <Save />}
                        disabled={!canCreate || loading}
                      >
                        {loading ? 'Creating...' : 'Create Destination'}
                      </Button>
                    </Box>
                  </Grid>
                </Grid>
              </form>
            </CardContent>
          </Card>
        )}
      </Container>
    </Box>
  )
}

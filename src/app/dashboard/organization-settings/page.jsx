'use client'
import React, { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
  Alert,
  Grid,
  CircularProgress,
} from '@mui/material'
import { ArrowBack, Save, Business } from '@mui/icons-material'

export default function OrganizationSettings() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const orgId = searchParams.get('org')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasPermission, setHasPermission] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    address: '',
    contact_email: '',
    contact_phone: '',
    payment_upi: '',
    payment_account_number: '',
    payment_ifsc: '',
  })

  useEffect(() => {
    async function init() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          router.push('/login')
          return
        }

        if (!orgId) {
          setError('No organization selected')
          setLoading(false)
          return
        }

        // Check if user has data_manager permission
        const { data: membership } = await supabase
          .from('organization_memberships')
          .select('permissions')
          .eq('organization_id', orgId)
          .eq('profile_id', session.user.id)
          .single()

        const isDataManager = membership?.permissions?.includes('data_manager')
        setHasPermission(isDataManager)

        if (!isDataManager) {
          setError('You do not have permission to edit organization settings')
          setLoading(false)
          return
        }

        // Fetch organization data
        const { data: org, error: orgError } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', orgId)
          .single()

        if (orgError) throw orgError

        // Parse contact_info and payment_details
        const contactInfo = org.contact_info || {}
        const paymentDetails = org.payment_details || {}

        setFormData({
          name: org.name || '',
          description: org.description || '',
          address: org.address || '',
          contact_email: contactInfo.email || '',
          contact_phone: contactInfo.phone || '',
          payment_upi: paymentDetails.upi || '',
          payment_account_number: paymentDetails.account_number || '',
          payment_ifsc: paymentDetails.ifsc || '',
        })

        setLoading(false)
      } catch (err) {
        console.error('Error loading organization:', err)
        setError(err.message)
        setLoading(false)
      }
    }

    init()
  }, [orgId, router])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      // Build contact_info and payment_details JSON
      const contactInfo = {
        email: formData.contact_email,
        phone: formData.contact_phone,
      }

      const paymentDetails = {
        upi: formData.payment_upi,
        account_number: formData.payment_account_number,
        ifsc: formData.payment_ifsc,
      }

      const { error: updateError } = await supabase
        .from('organizations')
        .update({
          name: formData.name,
          description: formData.description,
          address: formData.address,
          contact_info: contactInfo,
          payment_details: paymentDetails,
        })
        .eq('id', orgId)

      if (updateError) throw updateError

      setSuccess(true)
      setTimeout(() => {
        router.push(`/dashboard?org=${orgId}`)
      }, 1500)
    } catch (err) {
      console.error('Error updating organization:', err)
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <VerifiedGuard>
        <Container maxWidth="md" sx={{ py: 4, textAlign: 'center' }}>
          <CircularProgress />
        </Container>
      </VerifiedGuard>
    )
  }

  if (!hasPermission) {
    return (
      <VerifiedGuard>
        <Container maxWidth="md" sx={{ py: 4 }}>
          <Alert severity="error">{error || 'Access denied'}</Alert>
          <Button onClick={() => router.push('/dashboard')} sx={{ mt: 2 }}>
            Back to Dashboard
          </Button>
        </Container>
      </VerifiedGuard>
    )
  }

  return (
    <VerifiedGuard>
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Button
          onClick={() => router.push(`/dashboard?org=${orgId}`)}
          startIcon={<ArrowBack />}
          sx={{ mb: 3 }}
        >
          Back to Dashboard
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
                <Business sx={{ fontSize: 32 }} />
              </Box>
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  Organization Settings
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Manage sensitive organization information
                </Typography>
              </Box>
            </Box>

            {success && (
              <Alert severity="success" sx={{ mb: 3 }}>
                Settings saved successfully! Redirecting...
              </Alert>
            )}

            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit}>
              <Grid container spacing={3}>
                {/* Basic Information */}
                <Grid item xs={12}>
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                    Basic Information
                  </Typography>
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Organization Name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    disabled={saving || success}
                  />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Description"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    multiline
                    rows={3}
                    disabled={saving || success}
                  />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Address"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    multiline
                    rows={2}
                    disabled={saving || success}
                  />
                </Grid>

                {/* Contact Information */}
                <Grid item xs={12}>
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, mt: 2 }}>
                    Contact Information
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Contact Email"
                    name="contact_email"
                    type="email"
                    value={formData.contact_email}
                    onChange={handleChange}
                    disabled={saving || success}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Contact Phone"
                    name="contact_phone"
                    value={formData.contact_phone}
                    onChange={handleChange}
                    disabled={saving || success}
                  />
                </Grid>

                {/* Payment Details */}
                <Grid item xs={12}>
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, mt: 2 }}>
                    Payment Details
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Configure payment information to receive booking payments
                  </Typography>
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="UPI ID"
                    name="payment_upi"
                    value={formData.payment_upi}
                    onChange={handleChange}
                    disabled={saving || success}
                    placeholder="yourname@paytm"
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Bank Account Number"
                    name="payment_account_number"
                    value={formData.payment_account_number}
                    onChange={handleChange}
                    disabled={saving || success}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="IFSC Code"
                    name="payment_ifsc"
                    value={formData.payment_ifsc}
                    onChange={handleChange}
                    disabled={saving || success}
                    placeholder="SBIN0001234"
                  />
                </Grid>

                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 2 }}>
                    <Button
                      variant="outlined"
                      onClick={() => router.push(`/dashboard?org=${orgId}`)}
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
                      {saving ? 'Saving...' : 'Save Settings'}
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

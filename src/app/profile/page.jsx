"use client"
import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import useUser from '@/hooks/useUser'
import VerifiedNotice from '@/components/VerifiedNotice'
import {
  Container,
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Avatar,
  Grid,
  Divider,
  Alert,
  CircularProgress,
} from '@mui/material'
import { 
  AccountCircle, 
  Save, 
  PhotoCamera 
} from '@mui/icons-material'

export default function ProfilePage() {
  const { user, profile, loading, verified } = useUser()
  const [fullName, setFullName] = useState(null)
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [saving, setSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState(false)

  const save = async (e) => {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    setSuccessMessage(false)
    
    const payload = { id: user.id, full_name: fullName, avatar_url: avatarUrl }
    const { error } = await supabase.from('profiles').upsert([payload], { returning: 'minimal' })
    setSaving(false)
    
    if (error) {
      alert('Save failed: ' + error.message)
    } else {
      setSuccessMessage(true)
      setTimeout(() => setSuccessMessage(false), 3000)
    }
  }

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 8, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    )
  }

  if (!user) {
    return (
      <Container maxWidth="md" sx={{ py: 8, textAlign: 'center' }}>
        <Typography variant="h5" color="text.secondary">
          Please log in to view your profile.
        </Typography>
      </Container>
    )
  }

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: 4 }}>
      <Container maxWidth="md">
        {!verified && (
          <Box sx={{ mb: 3 }}>
            <VerifiedNotice user={user} />
          </Box>
        )}

        {successMessage && (
          <Alert severity="success" sx={{ mb: 3 }}>
            Profile saved successfully!
          </Alert>
        )}

        <Card elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
          <CardContent sx={{ p: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
              <AccountCircle sx={{ fontSize: 40, color: 'primary.main' }} />
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  Profile Settings
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Manage your personal information
                </Typography>
              </Box>
            </Box>

            <Divider sx={{ mb: 4 }} />

            {/* Avatar Section */}
            <Box sx={{ mb: 4, textAlign: 'center' }}>
              <Avatar
                src={avatarUrl ?? profile?.avatar_url}
                alt={(fullName ?? profile?.full_name) || 'User'}
                sx={{
                  width: 120,
                  height: 120,
                  mx: 'auto',
                  mb: 2,
                  bgcolor: 'primary.main',
                  fontSize: 48,
                }}
              >
                {((fullName ?? profile?.full_name) || user.email || '?').charAt(0).toUpperCase()}
              </Avatar>
              <Typography variant="body2" color="text.secondary">
                Profile Picture
              </Typography>
            </Box>

            <Divider sx={{ mb: 4 }} />

            {/* Form */}
            <form onSubmit={save}>
              <Grid container spacing={3}>
                <Grid xs={12}>
                  <TextField
                    fullWidth
                    label="Email Address"
                    value={user.email || ''}
                    disabled
                    helperText="Email cannot be changed"
                  />
                </Grid>

                <Grid xs={12}>
                  <TextField
                    fullWidth
                    label="Full Name"
                    value={fullName ?? (profile?.full_name || '')}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your full name"
                  />
                </Grid>

                <Grid xs={12}>
                  <TextField
                    fullWidth
                    label="Avatar URL"
                    value={avatarUrl ?? (profile?.avatar_url || '')}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    placeholder="https://example.com/avatar.jpg"
                    helperText="Provide a URL to your profile picture"
                    InputProps={{
                      startAdornment: <PhotoCamera sx={{ mr: 1, color: 'text.secondary' }} />,
                    }}
                  />
                </Grid>

                <Grid xs={12}>
                  <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                    <Button
                      type="submit"
                      variant="contained"
                      size="large"
                      startIcon={saving ? <CircularProgress size={20} /> : <Save />}
                      disabled={saving}
                    >
                      {saving ? 'Saving...' : 'Save Profile'}
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </form>
          </CardContent>
        </Card>

        {/* Account Info Card */}
        <Card elevation={0} sx={{ border: 1, borderColor: 'divider', mt: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Account Information
            </Typography>
            <Grid container spacing={2}>
              <Grid xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">
                  User ID
                </Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                  {user.id}
                </Typography>
              </Grid>
              <Grid xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">
                  Account Created
                </Typography>
                <Typography variant="body2">
                  {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Container>
    </Box>
  )
}

"use client"
import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import useUser from '@/hooks/useUser'
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  Box,
  Chip,
  Divider,
  ListItemIcon,
  ListItemText,
} from '@mui/material'
import {
  AccountCircle,
  Dashboard,
  Logout,
  Event,
  Place,
  PersonAdd,
  CheckCircle,
  Warning,
} from '@mui/icons-material'

export default function Header() {
  const router = useRouter()
  const { user, profile, organizations, verified, loading } = useUser()
  const [anchorEl, setAnchorEl] = React.useState(null)
  const open = Boolean(anchorEl)

  const avatarLabel = profile?.full_name || user?.user_metadata?.full_name || user?.email || ''
  const avatarInitial = avatarLabel ? avatarLabel.trim().charAt(0).toUpperCase() : '?'

  const handleOpenMenu = (event) => {
    setAnchorEl(event.currentTarget)
  }

  const handleCloseMenu = () => {
    setAnchorEl(null)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    handleCloseMenu()
    router.push('/')
  }

  const handleNavigate = (path) => {
    router.push(path)
    handleCloseMenu()
  }

  return (
    <AppBar 
      position="sticky" 
      elevation={0}
      sx={{ 
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Toolbar sx={{ maxWidth: 1200, width: '100%', mx: 'auto', px: { xs: 2, sm: 3 } }}>
        {/* Logo */}
        <Typography
          variant="h5"
          component={Link}
          href="/"
          sx={{
            flexGrow: 0,
            fontWeight: 700,
            color: 'primary.main',
            textDecoration: 'none',
            mr: 4,
            '&:hover': {
              opacity: 0.8,
            },
          }}
        >
          Circls
        </Typography>

        {/* Navigation */}
        <Box sx={{ flexGrow: 1, display: { xs: 'none', md: 'flex' }, gap: 1 }}>
          <Button
            component={Link}
            href="/destination"
            startIcon={<Place />}
            sx={{ color: 'text.secondary' }}
          >
            Destinations
          </Button>
        </Box>

        {/* Right side buttons */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {!loading && !user && (
            <Button
              component={Link}
              href="/login"
              variant="outlined"
            >
              Log in
            </Button>
          )}

          {!loading && user && (
            <>
              <Button
                component={Link}
                href="/bookings"
                startIcon={<Event />}
                sx={{ display: { xs: 'none', sm: 'inline-flex' }, color: 'text.secondary' }}
              >
                Bookings
              </Button>
              
              <Button
                component={Link}
                href="/onboarding"
                startIcon={<PersonAdd />}
                sx={{ display: { xs: 'none', sm: 'inline-flex' }, color: 'text.secondary' }}
              >
                Onboarding
              </Button>

              {organizations && organizations.length > 0 && (
                <Button
                  component={Link}
                  href="/dashboard"
                  variant="contained"
                  startIcon={<Dashboard />}
                  sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
                >
                  Dashboard
                </Button>
              )}

              {/* User Avatar Menu */}
              <IconButton
                onClick={handleOpenMenu}
                size="small"
                aria-controls={open ? 'account-menu' : undefined}
                aria-haspopup="true"
                aria-expanded={open ? 'true' : undefined}
              >
                <Avatar
                  src={profile?.avatar_url}
                  alt={avatarLabel}
                  sx={{ 
                    width: 40, 
                    height: 40,
                    bgcolor: 'secondary.main',
                    fontWeight: 600,
                  }}
                >
                  {avatarInitial}
                </Avatar>
              </IconButton>

              <Menu
                anchorEl={anchorEl}
                id="account-menu"
                open={open}
                onClose={handleCloseMenu}
                onClick={handleCloseMenu}
                PaperProps={{
                  elevation: 3,
                  sx: {
                    minWidth: 260,
                    mt: 1.5,
                    overflow: 'visible',
                    filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.08))',
                    '&:before': {
                      content: '""',
                      display: 'block',
                      position: 'absolute',
                      top: 0,
                      right: 14,
                      width: 10,
                      height: 10,
                      bgcolor: 'background.paper',
                      transform: 'translateY(-50%) rotate(45deg)',
                      zIndex: 0,
                    },
                  },
                }}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
              >
                {/* User Info */}
                <Box sx={{ px: 2, py: 1.5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    {avatarLabel}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {user.email}
                  </Typography>
                  <Chip
                    icon={verified ? <CheckCircle /> : <Warning />}
                    label={verified ? 'Verified' : 'Not Verified'}
                    size="small"
                    color={verified ? 'success' : 'warning'}
                    sx={{ height: 24 }}
                  />
                </Box>

                <Divider />

                {/* Menu Items */}
                <MenuItem onClick={() => handleNavigate('/profile')}>
                  <ListItemIcon>
                    <AccountCircle fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Profile</ListItemText>
                </MenuItem>

                <MenuItem onClick={() => handleNavigate('/bookings')}>
                  <ListItemIcon>
                    <Event fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>My Bookings</ListItemText>
                </MenuItem>

                {organizations && organizations.length > 0 && (
                  <MenuItem onClick={() => handleNavigate('/dashboard')}>
                    <ListItemIcon>
                      <Dashboard fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Dashboard</ListItemText>
                  </MenuItem>
                )}

                <Divider />

                <MenuItem onClick={handleLogout}>
                  <ListItemIcon>
                    <Logout fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Logout</ListItemText>
                </MenuItem>
              </Menu>
            </>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  )
}

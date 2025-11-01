'use client'
import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'
import {
  Container,
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  CircularProgress,
  Chip,
  TextField,
  InputAdornment,
} from '@mui/material'
import {
  Place,
  Add,
  Search,
  People,
  ArrowForward,
} from '@mui/icons-material'
export default function DestinationIndex() {
  const [dests, setDests] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    let mounted = true
    async function load() {
      const { data } = await supabase.from('destinations').select('*')
      if (mounted) {
        setDests(data || [])
      }
      if (mounted) setLoading(false)
    }
    load()
    return () => { mounted = false }
  }, [])

  // Compute filtered destinations as a derived value
  const filteredDests = React.useMemo(() => {
    if (!searchQuery.trim()) {
      return dests
    }
    const query = searchQuery.toLowerCase()
    return dests.filter(
      d =>
        d.name?.toLowerCase().includes(query) ||
        d.address?.toLowerCase().includes(query) ||
        d.description?.toLowerCase().includes(query)
    )
  }, [searchQuery, dests])

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 8, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    )
  }

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: 4 }}>
      <Container maxWidth="lg">
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Place sx={{ fontSize: 40, color: 'primary.main' }} />
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  All Destinations
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Browse available venues and locations
                </Typography>
              </Box>
            </Box>
            <Button
              component={Link}
              href="/dashboard/create-destination"
              variant="contained"
              startIcon={<Add />}
            >
              Create Destination
            </Button>
          </Box>

          {/* Search */}
          <TextField
            fullWidth
            placeholder="Search destinations by name, address, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
            sx={{ maxWidth: 600 }}
          />
        </Box>

        {/* Destinations Grid */}
        {filteredDests.length === 0 ? (
          <Card elevation={0} sx={{ border: 1, borderColor: 'divider', textAlign: 'center', py: 8 }}>
            <CardContent>
              <Place sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                {searchQuery ? 'No destinations found' : 'No Destinations Yet'}
              </Typography>
              <Typography color="text.secondary" sx={{ mb: 3 }}>
                {searchQuery
                  ? 'Try adjusting your search terms'
                  : 'Create your first destination to get started'}
              </Typography>
              {!searchQuery && (
                <Button
                  component={Link}
                  href="/dashboard/create-destination"
                  variant="contained"
                  startIcon={<Add />}
                >
                  Create Destination
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <Grid container spacing={3}>
            {filteredDests.map(dest => (
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
                  {/* Image placeholder */}
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
                    
                    {dest.address && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {dest.address}
                      </Typography>
                    )}

                    {dest.description && (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          mb: 2,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                        }}
                      >
                        {dest.description}
                      </Typography>
                    )}

                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {dest.capacity && (
                        <Chip
                          icon={<People />}
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
                      variant="contained"
                    >
                      View Details
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        {/* Results count */}
        {filteredDests.length > 0 && (
          <Typography
            variant="body2"
            color="text.secondary"
            align="center"
            sx={{ mt: 4 }}
          >
            Showing {filteredDests.length} of {dests.length} destination{dests.length !== 1 ? 's' : ''}
          </Typography>
        )}
      </Container>
    </Box>
  )
}

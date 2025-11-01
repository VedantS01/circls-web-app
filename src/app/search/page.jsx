'use client'
import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  Container,
  Box,
  Typography,
  TextField,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  CircularProgress,
  Chip,
  InputAdornment,
  Paper,
  Alert,
} from '@mui/material'
import {
  Search,
  Place,
  ArrowForward,
  FilterList,
  Clear,
} from '@mui/icons-material'

export default function SearchPage() {
  const searchParams = useSearchParams()
  const [q, setQ] = useState(searchParams.get('q') || '')
  const [type, setType] = useState(searchParams.get('type') || '')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  useEffect(() => {
    const query = searchParams.get('q')
    const typeParam = searchParams.get('type')
    if (query || typeParam) {
      setQ(query || '')
      setType(typeParam || '')
      performSearch(query || '', typeParam || '')
    }
  }, [searchParams])

  const performSearch = async (searchQuery, searchType) => {
    setLoading(true)
    setHasSearched(true)
    try {
      let query = supabase.from('destinations').select('*')

      if (searchQuery && searchQuery.trim()) {
        const like = `%${searchQuery}%`
        query = query.or(`name.ilike.${like},address.ilike.${like}`)
      }

      if (searchType && searchType.trim()) {
        query = query.ilike('type', `%${searchType}%`)
      }

      const { data, error } = await query
      if (error) throw error
      setResults(data || [])
    } catch (err) {
      console.error('search error', err)
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async (e) => {
    e?.preventDefault()
    performSearch(q, type)
  }

  const handleClear = () => {
    setQ('')
    setType('')
    setResults([])
    setHasSearched(false)
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Search Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          Search Destinations
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Find the perfect venue for your next booking
        </Typography>
      </Box>

      {/* Search Form */}
      <Paper elevation={0} sx={{ p: 3, mb: 4, border: 1, borderColor: 'divider' }}>
        <form onSubmit={handleSearch}>
          <Grid container spacing={2}>
            <Grid xs={12} md={5}>
              <TextField
                fullWidth
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by name or location..."
                variant="outlined"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid xs={12} md={3}>
              <TextField
                fullWidth
                value={type}
                onChange={(e) => setType(e.target.value)}
                placeholder="Type (e.g. Court, Pitch)"
                variant="outlined"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <FilterList />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid xs={12} md={4}>
              <Box sx={{ display: 'flex', gap: 1, height: '100%' }}>
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  fullWidth
                  startIcon={<Search />}
                  disabled={loading}
                >
                  {loading ? 'Searching...' : 'Search'}
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  onClick={handleClear}
                  disabled={loading}
                  sx={{ minWidth: 'auto' }}
                >
                  <Clear />
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>
      </Paper>

      {/* Results */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : hasSearched ? (
        results.length === 0 ? (
          <Alert severity="info" sx={{ mb: 4 }}>
            No destinations found. Try adjusting your search criteria.
          </Alert>
        ) : (
          <>
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {results.length} {results.length === 1 ? 'Result' : 'Results'} Found
              </Typography>
            </Box>

            <Grid container spacing={3}>
              {results.map((dest) => (
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
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {dest.address || 'No address provided'}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {dest.type && (
                          <Chip label={dest.type} size="small" color="primary" variant="outlined" />
                        )}
                        {dest.capacity && (
                          <Chip
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
                        variant="outlined"
                      >
                        View Details
                      </Button>
                    </CardActions>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </>
        )
      ) : (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Search sx={{ fontSize: 80, color: 'grey.300', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            Enter a search term to find destinations
          </Typography>
        </Box>
      )}
    </Container>
  )
}

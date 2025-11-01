'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Container,
  Grid,
  Typography,
  Box,
  Tabs,
  Tab,
  Button,
  Select,
  MenuItem,
  FormControl,
  Paper,
  Divider,
  Alert,
} from '@mui/material';
import {
  Business,
  Place,
  People,
  EventNote,
  Add,
  TrendingUp,
  AttachMoney,
} from '@mui/icons-material';
import VerifiedGuard from '@/components/VerifiedGuard';
import { supabase } from '@/lib/supabaseClient';
import StatsCard from './components/StatsCard';
import DataTable, { AvatarCell, StatusChip } from './components/DataTable';
import { 
  BookingsChart, 
  RevenueChart, 
  DestinationPerformanceChart,
  BookingStatusPieChart 
} from './components/Charts';

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`dashboard-tabpanel-${index}`}
      aria-labelledby={`dashboard-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState(null);
  const [tabValue, setTabValue] = useState(0);

  // Organization data
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrgId, setSelectedOrgId] = useState(null);
  const [orgMembers, setOrgMembers] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [allBookings, setAllBookings] = useState([]);
  const [staffInvites, setStaffInvites] = useState([]);

  // Initialize session and load organizations
  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      setLoading(true);
      try {
        const { data } = await supabase.auth.getSession();
        const currentSession = data?.session ?? null;
        
        if (!currentSession) {
          router.push('/login');
          return;
        }

        if (!cancelled) setSession(currentSession);

        const { data: memberships, error } = await supabase
          .from('organization_memberships')
          .select('organization_id, permissions, organization:organization_id (*)')
          .eq('profile_id', currentSession.user.id)
          .order('created_at', { ascending: true });

        if (error) {
          console.error('Dashboard: failed to load memberships', error);
          if (!cancelled) setStatusMessage({ type: 'error', text: error.message || 'Unable to load organizations' });
          return;
        }

        const resolvedOrgs = (memberships || [])
          .map(entry => {
            const organization = entry?.organization;
            if (!organization) return null;
            return {
              ...organization,
              membershipPermissions: Array.isArray(entry.permissions) ? entry.permissions : [],
            };
          })
          .filter(Boolean);

        if (!cancelled) {
          setOrganizations(resolvedOrgs);
          setSelectedOrgId(prev => 
            (prev && resolvedOrgs.some(org => org.id === prev)) 
              ? prev 
              : (resolvedOrgs[0]?.id ?? null)
          );
        }
      } catch (err) {
        console.error('Dashboard initialization error:', err);
        if (!cancelled) setStatusMessage({ type: 'error', text: 'Failed to initialize dashboard' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    initialize();
    return () => { cancelled = true; };
  }, [router]);

  // Load organization data when selected org changes
  useEffect(() => {
    if (!selectedOrgId || !session?.user?.id) {
      setOrgMembers([]);
      setDestinations([]);
      setAllBookings([]);
      setStaffInvites([]);
      return;
    }

    let cancelled = false;

    async function loadOrganizationData() {
      try {
        // Load members
        const { data: members, error: membersError } = await supabase
          .from('organization_memberships')
          .select('id, organization_id, profile_id, permissions, created_at, profile:profile_id (id, full_name, avatar_url, email)')
          .eq('organization_id', selectedOrgId)
          .order('created_at', { ascending: true });

        if (membersError) throw membersError;

        // Load destinations
        const { data: destData, error: destinationsError } = await supabase
          .from('destinations')
          .select('id, name, description, address, capacity, created_at, updated_at')
          .eq('organization_id', selectedOrgId)
          .order('created_at', { ascending: true });

        if (destinationsError) throw destinationsError;

        // Load bookings for all destinations
        const destinationIds = (destData || []).map(d => d.id);
        let bookings = [];
        
        if (destinationIds.length > 0) {
          // First get all slots for these destinations
          const { data: slotsData } = await supabase
            .from('slots')
            .select('id')
            .in('destination_id', destinationIds);
          
          const slotIds = (slotsData || []).map(s => s.id);
          
          if (slotIds.length > 0) {
            const { data: bookingsData, error: bookingsError } = await supabase
              .from('bookings')
              .select('id, slot_id, profile_id, status, created_at')
              .in('slot_id', slotIds)
              .order('created_at', { ascending: false });

            if (!bookingsError) {
              bookings = bookingsData || [];
            }
          }
        }

        // Load staff invites (if user has permission)
        const currentMembership = (members || []).find(m => m.profile_id === session.user.id);
        let invites = [];
        
        if (currentMembership?.permissions?.includes('staff_manager')) {
          const { data: inviteData } = await supabase
            .from('staff_invites')
            .select('*')
            .eq('organization_id', selectedOrgId)
            .order('created_at', { ascending: false });
          
          invites = inviteData || [];
        }

        if (!cancelled) {
          console.log('Dashboard data loaded:', {
            members: members?.length || 0,
            destinations: destData?.length || 0,
            bookings: bookings?.length || 0,
            invites: invites?.length || 0
          });
          setOrgMembers(members || []);
          setDestinations(destData || []);
          setAllBookings(bookings);
          setStaffInvites(invites);
        }
      } catch (err) {
        console.error('Failed to load organization data:', err);
        if (!cancelled) {
          setStatusMessage({ type: 'error', text: 'Failed to load organization data' });
        }
      }
    }

    loadOrganizationData();
    return () => { cancelled = true; };
  }, [selectedOrgId, session?.user?.id]);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalDestinations = destinations.length;
    const totalStaff = orgMembers.length;
    const totalBookings = allBookings.length;
    const totalRevenue = allBookings.reduce((sum, booking) => {
      return sum + (parseFloat(booking.slots?.price || 0));
    }, 0);

    // Mock trend data (in real app, compare with previous period)
    return {
      destinations: { value: totalDestinations, trend: 'up', trendValue: '+12%' },
      staff: { value: totalStaff, trend: 'up', trendValue: '+5%' },
      bookings: { value: totalBookings, trend: 'up', trendValue: '+23%' },
      revenue: { 
        value: `£${totalRevenue.toFixed(2)}`, 
        trend: 'up', 
        trendValue: '+18%' 
      },
    };
  }, [destinations, orgMembers, allBookings]);

  // Chart data
  const chartData = useMemo(() => {
    // Mock data for charts (in real app, aggregate from actual bookings)
    const bookingsData = [
      { name: 'Jan', bookings: 12 },
      { name: 'Feb', bookings: 19 },
      { name: 'Mar', bookings: 15 },
      { name: 'Apr', bookings: 25 },
      { name: 'May', bookings: 22 },
      { name: 'Jun', bookings: 30 },
    ];

    const revenueData = [
      { name: 'Jan', revenue: 420 },
      { name: 'Feb', revenue: 680 },
      { name: 'Mar', revenue: 550 },
      { name: 'Apr', revenue: 890 },
      { name: 'May', revenue: 770 },
      { name: 'Jun', revenue: 1050 },
    ];

    const destinationPerformance = destinations.slice(0, 5).map(dest => ({
      name: dest.name,
      bookings: Math.floor(Math.random() * 30) + 5,
    }));

    const bookingStatus = [
      { name: 'Confirmed', value: allBookings.filter(b => b.status === 'confirmed').length || 15 },
      { name: 'Pending', value: allBookings.filter(b => b.status === 'pending').length || 8 },
      { name: 'Cancelled', value: allBookings.filter(b => b.status === 'cancelled').length || 3 },
    ];

    return { bookingsData, revenueData, destinationPerformance, bookingStatus };
  }, [destinations, allBookings]);

  const currentOrg = useMemo(
    () => organizations.find(org => org.id === selectedOrgId) || null,
    [organizations, selectedOrgId]
  );

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  if (loading) {
    return (
      <VerifiedGuard>
        <Container maxWidth="xl" sx={{ py: 4 }}>
          <Typography>Loading dashboard...</Typography>
        </Container>
      </VerifiedGuard>
    );
  }

  if (organizations.length === 0) {
    return (
      <VerifiedGuard>
        <Container maxWidth="md" sx={{ py: 8, textAlign: 'center' }}>
          <Business sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 600 }}>
            No Organizations Yet
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 4 }}>
            You are not part of any organization. Start by creating one or accepting an invitation.
          </Typography>
          <Button
            variant="contained"
            size="large"
            startIcon={<Add />}
            onClick={() => router.push('/onboarding')}
          >
            Get Started
          </Button>
        </Container>
      </VerifiedGuard>
    );
  }

  return (
    <VerifiedGuard>
      <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', pb: 4 }}>
        <Container maxWidth="xl" sx={{ pt: 4 }}>
          {/* Header */}
          <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
                Dashboard
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Welcome back! Here&apos;s an overview of your organization.
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              {organizations.length > 1 && (
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <Select
                    value={selectedOrgId || ''}
                    onChange={(e) => setSelectedOrgId(e.target.value)}
                  >
                    {organizations.map(org => (
                      <MenuItem key={org.id} value={org.id}>
                        {org.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => router.push('/dashboard/create-destination')}
              >
                New Destination
              </Button>
            </Box>
          </Box>

          {/* Status Message */}
          {statusMessage && (
            <Alert 
              severity={statusMessage.type} 
              onClose={() => setStatusMessage(null)}
              sx={{ mb: 3 }}
            >
              {statusMessage.text}
            </Alert>
          )}

          {/* Stats Cards */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} lg={3}>
              <StatsCard
                title="Total Destinations"
                value={stats.destinations.value}
                icon={Place}
                trend={stats.destinations.trend}
                trendValue={stats.destinations.trendValue}
                color="primary"
              />
            </Grid>
            <Grid item xs={12} sm={6} lg={3}>
              <StatsCard
                title="Team Members"
                value={stats.staff.value}
                icon={People}
                trend={stats.staff.trend}
                trendValue={stats.staff.trendValue}
                color="secondary"
              />
            </Grid>
            <Grid item xs={12} sm={6} lg={3}>
              <StatsCard
                title="Total Bookings"
                value={stats.bookings.value}
                icon={EventNote}
                trend={stats.bookings.trend}
                trendValue={stats.bookings.trendValue}
                color="info"
              />
            </Grid>
            <Grid item xs={12} sm={6} lg={3}>
              <StatsCard
                title="Revenue"
                value={stats.revenue.value}
                icon={AttachMoney}
                trend={stats.revenue.trend}
                trendValue={stats.revenue.trendValue}
                color="success"
              />
            </Grid>
          </Grid>

          {/* Charts */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} lg={6}>
              <BookingsChart data={chartData.bookingsData} />
            </Grid>
            <Grid item xs={12} lg={6}>
              <RevenueChart data={chartData.revenueData} />
            </Grid>
            <Grid item xs={12} lg={8}>
              <DestinationPerformanceChart data={chartData.destinationPerformance} />
            </Grid>
            <Grid item xs={12} lg={4}>
              <BookingStatusPieChart data={chartData.bookingStatus} />
            </Grid>
          </Grid>

          {/* Tabs for detailed views */}
          <Paper elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
            <Tabs 
              value={tabValue} 
              onChange={handleTabChange}
              sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
            >
              <Tab label="Destinations" />
              <Tab label="Team Members" />
              <Tab label="Recent Bookings" />
              <Tab label="Invitations" />
            </Tabs>

            <TabPanel value={tabValue} index={0}>
              <Box sx={{ p: 3 }}>
                <DataTable
                  columns={[
                    { 
                      id: 'name', 
                      label: 'Destination Name',
                      render: (value, row) => (
                        <AvatarCell 
                          name={value} 
                          subtitle={row.address || 'No address'} 
                        />
                      )
                    },
                    { id: 'capacity', label: 'Capacity' },
                    { 
                      id: 'created_at', 
                      label: 'Created',
                      render: (value) => new Date(value).toLocaleDateString()
                    },
                  ]}
                  rows={destinations}
                  onEdit={(row) => router.push(`/destination/${row.id}`)}
                  emptyMessage="No destinations yet. Create your first destination to get started."
                />
              </Box>
            </TabPanel>

            <TabPanel value={tabValue} index={1}>
              <Box sx={{ p: 3 }}>
                <DataTable
                  columns={[
                    { 
                      id: 'profile', 
                      label: 'Member',
                      render: (value, row) => (
                        <AvatarCell 
                          name={value?.full_name || 'Unknown'} 
                          subtitle={value?.email || row.profile_id}
                          avatarUrl={value?.avatar_url}
                        />
                      )
                    },
                    { 
                      id: 'permissions', 
                      label: 'Permissions',
                      render: (value) => (
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                          {(value || []).map((perm) => (
                            <StatusChip key={perm} status="active" label={perm.replace('_', ' ')} />
                          ))}
                        </Box>
                      )
                    },
                    { 
                      id: 'created_at', 
                      label: 'Joined',
                      render: (value) => new Date(value).toLocaleDateString()
                    },
                  ]}
                  rows={orgMembers}
                  emptyMessage="No team members yet."
                />
              </Box>
            </TabPanel>

            <TabPanel value={tabValue} index={2}>
              <Box sx={{ p: 3 }}>
                <DataTable
                  columns={[
                    { 
                      id: 'id', 
                      label: 'Booking ID',
                      render: (value) => `#${value.slice(0, 8)}`
                    },
                    { 
                      id: 'status', 
                      label: 'Status',
                      render: (value) => <StatusChip status={value} />
                    },
                    { 
                      id: 'created_at', 
                      label: 'Booked On',
                      render: (value) => new Date(value).toLocaleDateString()
                    },
                  ]}
                  rows={allBookings.slice(0, 10)}
                  emptyMessage="No bookings yet."
                />
              </Box>
            </TabPanel>

            <TabPanel value={tabValue} index={3}>
              <Box sx={{ p: 3 }}>
                <DataTable
                  columns={[
                    { id: 'invited_email', label: 'Email' },
                    { 
                      id: 'accepted', 
                      label: 'Status',
                      render: (value) => (
                        <StatusChip 
                          status={value ? 'accepted' : 'pending'} 
                          label={value ? 'Accepted' : 'Pending'}
                        />
                      )
                    },
                    { 
                      id: 'expires_at', 
                      label: 'Expires',
                      render: (value) => new Date(value).toLocaleDateString()
                    },
                  ]}
                  rows={staffInvites}
                  emptyMessage="No pending invitations."
                />
              </Box>
            </TabPanel>
          </Paper>
        </Container>
      </Box>
    </VerifiedGuard>
  );
}

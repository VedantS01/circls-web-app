'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Container,
  Typography,
  Box,
  Button,
  Select,
  MenuItem,
  FormControl,
  Paper,
  Divider,
  Alert,
  Grid,
  Chip,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  TextField,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  InputLabel,
} from '@mui/material';
import {
  Business,
  Place,
  People,
  EventNote,
  Add,
  AttachMoney,
  Dashboard as DashboardIcon,
  Mail,
  ContentCopy,
  CheckCircle,
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

const DRAWER_WIDTH = 280;

const SIDEBAR_SECTIONS = [
  { id: 'data', label: 'Data', icon: DashboardIcon, requiresDataManager: true },
  { id: 'destinations', label: 'Destinations', icon: Place, requiresDataManager: false },
  { id: 'team', label: 'Team Members', icon: People, requiresDataManager: false },
  { id: 'bookings', label: 'Recent Bookings', icon: EventNote, requiresDataManager: false },
  { id: 'invitations', label: 'Invitations', icon: Mail, requiresDataManager: false },
];

export default function DashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState(null);
  const [activeSection, setActiveSection] = useState('destinations');
  const [copiedInviteId, setCopiedInviteId] = useState(null);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteDestination, setInviteDestination] = useState('');
  const [sendingInvite, setSendingInvite] = useState(false);

  // Organization data
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrgId, setSelectedOrgId] = useState(null);
  const [orgMembers, setOrgMembers] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [allBookings, setAllBookings] = useState([]);
  const [staffInvites, setStaffInvites] = useState([]);
  
  // Organization settings state (for Data section)
  const [orgSettings, setOrgSettings] = useState({
    name: '',
    description: '',
    address: '',
    contact_info: '',
    payment_details: '',
  });

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
      setOrgSettings({
        name: '',
        description: '',
        address: '',
        contact_info: '',
        payment_details: '',
      });
      return;
    }

    let cancelled = false;

    async function loadOrganizationData() {
      try {
        // Load organization details
        const { data: orgData, error: orgError } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', selectedOrgId)
          .single();

        if (orgError) throw orgError;

        // Load members
        const { data: members, error: membersError } = await supabase
          .from('organization_memberships')
          .select('id, organization_id, profile_id, permissions, created_at, profile:profile_id (id, full_name, avatar_url)')
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
          const { data: bookingsData, error: bookingsError } = await supabase
            .from('bookings')
            .select('id, bookable_id, bookable_type, user_id, destination_id, start_datetime, end_datetime, total_amount, booking_status, payment_status, created_at')
            .in('destination_id', destinationIds)
            .order('created_at', { ascending: false });

          if (!bookingsError) {
            bookings = bookingsData || [];
          } else {
            console.error('Error fetching bookings:', bookingsError);
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
          setOrgMembers(members || []);
          setDestinations(destData || []);
          setAllBookings(bookings);
          setStaffInvites(invites);
          
          // Set organization settings
          setOrgSettings({
            name: orgData.name || '',
            description: orgData.description || '',
            address: orgData.address || '',
            contact_info: JSON.stringify(orgData.contact_info || {}, null, 2),
            payment_details: JSON.stringify(orgData.payment_details || {}, null, 2),
          });
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
      return sum + (parseFloat(booking.total_amount || 0));
    }, 0);

    // Calculate real trends (compare this month vs last month)
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    const thisMonthBookings = allBookings.filter(b => new Date(b.created_at) >= thisMonthStart);
    const lastMonthBookings = allBookings.filter(b => {
      const date = new Date(b.created_at);
      return date >= lastMonthStart && date <= lastMonthEnd;
    });

    const calculateTrend = (current, previous) => {
      if (previous === 0) return { trend: current > 0 ? 'up' : 'neutral', trendValue: 'N/A' };
      const percentChange = ((current - previous) / previous * 100).toFixed(1);
      return {
        trend: percentChange > 0 ? 'up' : percentChange < 0 ? 'down' : 'neutral',
        trendValue: `${percentChange > 0 ? '+' : ''}${percentChange}%`
      };
    };

    const bookingsTrend = calculateTrend(thisMonthBookings.length, lastMonthBookings.length);
    
    const thisMonthRevenue = thisMonthBookings.reduce((sum, b) => sum + parseFloat(b.total_amount || 0), 0);
    const lastMonthRevenue = lastMonthBookings.reduce((sum, b) => sum + parseFloat(b.total_amount || 0), 0);
    const revenueTrend = calculateTrend(thisMonthRevenue, lastMonthRevenue);

    return {
      destinations: { value: totalDestinations, trend: 'neutral', trendValue: 'N/A' },
      staff: { value: totalStaff, trend: 'neutral', trendValue: 'N/A' },
      bookings: { value: totalBookings, ...bookingsTrend },
      revenue: { 
        value: `₹${totalRevenue.toFixed(2)}`, 
        ...revenueTrend
      },
    };
  }, [destinations, orgMembers, allBookings]);

  // Chart data
  const chartData = useMemo(() => {
    // Real data from bookings
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    
    // Group bookings by month
    const monthlyData = {};
    for (let i = 0; i < 6; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const monthKey = date.toLocaleDateString('en-US', { month: 'short' });
      monthlyData[monthKey] = { bookings: 0, revenue: 0 };
    }

    // Aggregate real booking data
    allBookings.forEach(booking => {
      const bookingDate = new Date(booking.created_at);
      if (bookingDate >= sixMonthsAgo) {
        const monthKey = bookingDate.toLocaleDateString('en-US', { month: 'short' });
        if (monthlyData[monthKey]) {
          monthlyData[monthKey].bookings += 1;
          monthlyData[monthKey].revenue += parseFloat(booking.total_amount || 0);
        }
      }
    });

    const bookingsData = Object.keys(monthlyData).map(month => ({
      name: month,
      bookings: monthlyData[month].bookings,
    }));

    const revenueData = Object.keys(monthlyData).map(month => ({
      name: month,
      revenue: monthlyData[month].revenue,
    }));

    // Real destination performance (bookings per destination)
    const destBookingCounts = {};
    allBookings.forEach(booking => {
      const destId = booking.destination_id;
      if (destId) {
        destBookingCounts[destId] = (destBookingCounts[destId] || 0) + 1;
      }
    });

    const destinationPerformance = destinations
      .map(dest => ({
        name: dest.name,
        bookings: destBookingCounts[dest.id] || 0,
      }))
      .sort((a, b) => b.bookings - a.bookings)
      .slice(0, 5);

    // Real booking status counts
    const bookingStatus = [
      { name: 'Confirmed', value: allBookings.filter(b => b.booking_status === 'confirmed').length },
      { name: 'Pending', value: allBookings.filter(b => b.booking_status === 'pending').length },
      { name: 'Cancelled', value: allBookings.filter(b => b.booking_status === 'cancelled').length },
    ].filter(status => status.value > 0); // Only show non-zero statuses

    return { bookingsData, revenueData, destinationPerformance, bookingStatus };
  }, [destinations, allBookings]);

  const currentOrg = useMemo(
    () => organizations.find(org => org.id === selectedOrgId) || null,
    [organizations, selectedOrgId]
  );

  const currentMembership = useMemo(() => {
    if (!session?.user?.id || !orgMembers.length) return null;
    return orgMembers.find(m => m.profile_id === session.user.id);
  }, [orgMembers, session?.user?.id]);

  const isDataManager = useMemo(() => {
    return currentMembership?.permissions?.includes('data_manager') || false;
  }, [currentMembership]);

  const canManageStaff = useMemo(() => {
    return currentMembership?.permissions?.includes('staff_manager') || false;
  }, [currentMembership]);

  const handleCopyInviteLink = async (invite) => {
    const baseUrl = window.location.origin;
    const inviteLink = `${baseUrl}/staff-invite?token=${invite.token}`;
    
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopiedInviteId(invite.id);
      setTimeout(() => setCopiedInviteId(null), 2000);
    } catch (err) {
      console.error('Failed to copy invite link:', err);
      setStatusMessage({ type: 'error', text: 'Failed to copy link' });
    }
  };

  const handleSendInvite = async () => {
    if (!inviteEmail || !inviteDestination) {
      setStatusMessage({ type: 'error', text: 'Please fill in all fields' });
      return;
    }

    setSendingInvite(true);
    try {
      const response = await fetch('/api/staff-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          organizationId: selectedOrgId,
          destinationId: inviteDestination,
          access_token: session?.access_token,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send invite');
      }

      setStatusMessage({ type: 'success', text: 'Invitation sent successfully!' });
      setInviteDialogOpen(false);
      setInviteEmail('');
      setInviteDestination('');
      
      // Reload invites
      const { data: inviteData } = await supabase
        .from('staff_invites')
        .select('*')
        .eq('organization_id', selectedOrgId)
        .order('created_at', { ascending: false });
      
      setStaffInvites(inviteData || []);
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setSendingInvite(false);
    }
  };

  const handleSaveOrgSettings = async () => {
    if (!selectedOrgId || !isDataManager) {
      setStatusMessage({ type: 'error', text: 'Unauthorized to edit organization settings' });
      return;
    }

    try {
      // Parse JSON fields
      let contactInfo, paymentDetails;
      try {
        contactInfo = orgSettings.contact_info.trim() ? JSON.parse(orgSettings.contact_info) : {};
      } catch (e) {
        setStatusMessage({ type: 'error', text: 'Invalid JSON in Contact Info' });
        return;
      }

      try {
        paymentDetails = orgSettings.payment_details.trim() ? JSON.parse(orgSettings.payment_details) : {};
      } catch (e) {
        setStatusMessage({ type: 'error', text: 'Invalid JSON in Payment Details' });
        return;
      }

      const { error } = await supabase
        .from('organizations')
        .update({
          name: orgSettings.name,
          description: orgSettings.description,
          address: orgSettings.address,
          contact_info: contactInfo,
          payment_details: paymentDetails,
        })
        .eq('id', selectedOrgId);

      if (error) throw error;

      setStatusMessage({ type: 'success', text: 'Organization settings saved successfully' });
      
      // Reload organizations to reflect the name change
      const { data: memberships } = await supabase
        .from('organization_memberships')
        .select('organization_id, permissions, organization:organization_id (*)')
        .eq('profile_id', session.user.id)
        .order('created_at', { ascending: true });

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

      setOrganizations(resolvedOrgs);
    } catch (err) {
      console.error('Failed to save organization settings:', err);
      setStatusMessage({ type: 'error', text: err.message || 'Failed to save settings' });
    }
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
      <Box sx={{ display: 'flex', bgcolor: 'background.default', minHeight: '100vh' }}>
        {/* Sidebar */}
        <Drawer
          variant="permanent"
          sx={{
            width: DRAWER_WIDTH,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              boxSizing: 'border-box',
              borderRight: 1,
              borderColor: 'divider',
              bgcolor: 'background.paper',
              position: 'relative',
            },
          }}
        >
          <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Dashboard
            </Typography>
            {organizations.length > 1 && (
              <FormControl size="small" fullWidth sx={{ mt: 2 }}>
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
          </Box>
          
          <List sx={{ py: 2 }}>
            {SIDEBAR_SECTIONS.map((section) => {
              // Skip Data section if user is not data_manager
              if (section.requiresDataManager && !isDataManager) {
                return null;
              }
              
              const Icon = section.icon;
              const isActive = activeSection === section.id;
              
              return (
                <ListItem key={section.id} disablePadding sx={{ px: 2, py: 0.5 }}>
                  <ListItemButton
                    selected={isActive}
                    onClick={() => setActiveSection(section.id)}
                    sx={{
                      borderRadius: 2,
                      '&.Mui-selected': {
                        bgcolor: 'primary.main',
                        color: 'primary.contrastText',
                        '&:hover': {
                          bgcolor: 'primary.dark',
                        },
                        '& .MuiListItemIcon-root': {
                          color: 'primary.contrastText',
                        },
                      },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      <Icon />
                    </ListItemIcon>
                    <ListItemText primary={section.label} />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        </Drawer>

        {/* Main content */}
        <Box component="main" sx={{ flexGrow: 1, p: 4 }}>
          {/* Header */}
          <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
                {currentOrg?.name || 'Organization Dashboard'}
              </Typography>
              <Typography variant="body1" color="text.secondary">
                {activeSection === 'data' && 'Analytics and Organization Settings'}
                {activeSection === 'destinations' && 'Manage your destinations'}
                {activeSection === 'team' && 'Team member management'}
                {activeSection === 'bookings' && 'Recent booking activity'}
                {activeSection === 'invitations' && 'Staff invitations'}
              </Typography>
            </Box>
            
            {activeSection === 'destinations' && (
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => router.push('/dashboard/create-destination')}
              >
                New Destination
              </Button>
            )}
            
            {activeSection === 'invitations' && canManageStaff && (
              <Button
                variant="contained"
                startIcon={<Mail />}
                onClick={() => setInviteDialogOpen(true)}
              >
                Send Invite
              </Button>
            )}
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

          {/* Data Section - Analytics & Settings */}
          {activeSection === 'data' && (
            <>
              {/* Stats Cards */}
              <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid xs={12} sm={6} lg={3}>
                  <StatsCard
                    title="Total Destinations"
                    value={stats.destinations.value}
                    icon={Place}
                    trend={stats.destinations.trend}
                    trendValue={stats.destinations.trendValue}
                    color="primary"
                  />
                </Grid>
                <Grid xs={12} sm={6} lg={3}>
                  <StatsCard
                    title="Team Members"
                    value={stats.staff.value}
                    icon={People}
                    trend={stats.staff.trend}
                    trendValue={stats.staff.trendValue}
                    color="secondary"
                  />
                </Grid>
                <Grid xs={12} sm={6} lg={3}>
                  <StatsCard
                    title="Total Bookings"
                    value={stats.bookings.value}
                    icon={EventNote}
                    trend={stats.bookings.trend}
                    trendValue={stats.bookings.trendValue}
                    color="info"
                  />
                </Grid>
                <Grid xs={12} sm={6} lg={3}>
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
                <Grid xs={12} lg={6}>
                  <BookingsChart data={chartData.bookingsData} />
                </Grid>
                <Grid xs={12} lg={6}>
                  <RevenueChart data={chartData.revenueData} />
                </Grid>
                <Grid xs={12} lg={8}>
                  <DestinationPerformanceChart data={chartData.destinationPerformance} />
                </Grid>
                <Grid xs={12} lg={4}>
                  <BookingStatusPieChart data={chartData.bookingStatus} />
                </Grid>
              </Grid>

              {/* Organization Settings */}
              <Paper elevation={0} sx={{ p: 4, border: 1, borderColor: 'divider' }}>
                <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
                  Organization Settings
                </Typography>
                <Grid container spacing={3}>
                  <Grid xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Organization Name"
                      value={orgSettings.name}
                      onChange={(e) => setOrgSettings({ ...orgSettings, name: e.target.value })}
                      required
                    />
                  </Grid>
                  <Grid xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Address"
                      value={orgSettings.address}
                      onChange={(e) => setOrgSettings({ ...orgSettings, address: e.target.value })}
                    />
                  </Grid>
                  <Grid xs={12}>
                    <TextField
                      fullWidth
                      label="Description"
                      value={orgSettings.description}
                      onChange={(e) => setOrgSettings({ ...orgSettings, description: e.target.value })}
                      multiline
                      rows={3}
                    />
                  </Grid>
                  <Grid xs={12} md={6}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Contact Info (JSON format)
                    </Typography>
                    <TextField
                      fullWidth
                      multiline
                      rows={6}
                      value={orgSettings.contact_info}
                      onChange={(e) => setOrgSettings({ ...orgSettings, contact_info: e.target.value })}
                      placeholder='{"email": "contact@org.com", "phone": "+91..."}'
                      sx={{ fontFamily: 'monospace' }}
                    />
                  </Grid>
                  <Grid xs={12} md={6}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Payment Details (JSON format)
                    </Typography>
                    <TextField
                      fullWidth
                      multiline
                      rows={6}
                      value={orgSettings.payment_details}
                      onChange={(e) => setOrgSettings({ ...orgSettings, payment_details: e.target.value })}
                      placeholder='{"account": "...", "ifsc": "..."}'
                      sx={{ fontFamily: 'monospace' }}
                    />
                  </Grid>
                  <Grid xs={12}>
                    <Button
                      variant="contained"
                      onClick={handleSaveOrgSettings}
                      sx={{ mt: 2 }}
                    >
                      Save Settings
                    </Button>
                  </Grid>
                </Grid>
              </Paper>
            </>
          )}

          {/* Destinations Section */}
          {activeSection === 'destinations' && (
            <Paper elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
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
            </Paper>
          )}

          {/* Team Members Section */}
          {activeSection === 'team' && (
            <Paper elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
              <Box sx={{ p: 3 }}>
                <DataTable
                  columns={[
                    { 
                      id: 'profile', 
                      label: 'Member',
                      render: (value, row) => (
                        <AvatarCell 
                          name={value?.full_name || 'Unknown'} 
                          subtitle={value?.id ? `ID: ${value.id.slice(0, 8)}...` : row.profile_id}
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
            </Paper>
          )}

          {/* Recent Bookings Section */}
          {activeSection === 'bookings' && (
            <Paper elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
              <Box sx={{ p: 3 }}>
                <DataTable
                  columns={[
                    { 
                      id: 'id', 
                      label: 'Booking ID',
                      render: (value) => `#${value.slice(0, 8)}`
                    },
                    {
                      id: 'bookable_type',
                      label: 'Type',
                      render: (value) => (
                        <Chip 
                          label={value === 'slot' ? 'Slot' : 'Event'} 
                          size="small"
                          color={value === 'slot' ? 'primary' : 'secondary'}
                        />
                      )
                    },
                    {
                      id: 'start_datetime',
                      label: 'Date',
                      render: (value) => new Date(value).toLocaleDateString('en-GB', { 
                        day: 'numeric', 
                        month: 'short', 
                        year: 'numeric' 
                      })
                    },
                    {
                      id: 'total_amount',
                      label: 'Amount',
                      render: (value) => `₹${parseFloat(value || 0).toFixed(2)}`
                    },
                    { 
                      id: 'booking_status', 
                      label: 'Status',
                      render: (value) => <StatusChip status={value} />
                    },
                    { 
                      id: 'created_at', 
                      label: 'Booked On',
                      render: (value) => new Date(value).toLocaleDateString('en-GB')
                    },
                  ]}
                  rows={allBookings.slice(0, 50)}
                  emptyMessage="No bookings yet."
                />
              </Box>
            </Paper>
          )}

          {/* Invitations Section */}
          {activeSection === 'invitations' && (
            <Paper elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
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
                    {
                      id: 'token',
                      label: 'Actions',
                      render: (value, row) => (
                        <Tooltip title={copiedInviteId === row.id ? 'Copied!' : 'Copy invite link'}>
                          <IconButton
                            size="small"
                            color={copiedInviteId === row.id ? 'success' : 'primary'}
                            onClick={() => handleCopyInviteLink(row)}
                          >
                            {copiedInviteId === row.id ? <CheckCircle /> : <ContentCopy />}
                          </IconButton>
                        </Tooltip>
                      )
                    },
                  ]}
                  rows={staffInvites}
                  emptyMessage="No pending invitations."
                />
              </Box>
            </Paper>
          )}
        </Box>
      </Box>

      {/* Send Invite Dialog */}
      <Dialog 
        open={inviteDialogOpen} 
        onClose={() => setInviteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Send Staff Invitation</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              label="Email Address"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@example.com"
              autoFocus
            />
            
            <FormControl fullWidth>
              <InputLabel>Destination</InputLabel>
              <Select
                value={inviteDestination}
                onChange={(e) => setInviteDestination(e.target.value)}
                label="Destination"
              >
                <MenuItem value="">
                  <em>Select a destination</em>
                </MenuItem>
                {destinations.map((dest) => (
                  <MenuItem key={dest.id} value={dest.id}>
                    {dest.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Typography variant="caption" color="text.secondary">
              The invite will expire in 7 days. The invitee will have booking management permissions for the selected destination.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setInviteDialogOpen(false)}
            disabled={sendingInvite}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSendInvite}
            variant="contained"
            disabled={sendingInvite || !inviteEmail || !inviteDestination}
          >
            {sendingInvite ? 'Sending...' : 'Send Invite'}
          </Button>
        </DialogActions>
      </Dialog>
    </VerifiedGuard>
  );
}

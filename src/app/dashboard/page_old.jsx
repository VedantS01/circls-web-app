"use client"

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import VerifiedGuard from '@/components/VerifiedGuard'
import { supabase } from '@/lib/supabaseClient'

const ORG_PERMISSION_OPTIONS = [
	{ key: 'staff_manager', label: 'Staff manager', description: 'Invite staff, edit team permissions, and manage membership.' },
	{ key: 'destination_editor', label: 'Destination editor', description: 'Create, archive, and configure destinations owned by the organization.' },
	{ key: 'data_manager', label: 'Data manager', description: 'View sensitive business information such as payment details.' },
]

const DEST_PERMISSION_OPTIONS = [
	{ key: 'destination_manager', label: 'Destination manager', description: 'Edit destination information, slots, and downtime rules.' },
	{ key: 'booking_manager', label: 'Booking manager', description: 'View and manage bookings and attendee information.' },
]

const normalizePermissions = (values = [], options = []) => {
	const order = options.map(opt => opt.key)
	const unique = Array.from(new Set(values.filter(Boolean)))
	return order.filter(key => unique.includes(key))
}

const formatDateTime = (value) => {
	if (!value) return '—'
	try {
		return new Date(value).toLocaleString()
	} catch (err) {
		return String(value)
	}
}

export default function DashboardPage() {
	const router = useRouter()
	const [session, setSession] = useState(null)
	const [loading, setLoading] = useState(true)
	const [loadingOrgDetail, setLoadingOrgDetail] = useState(false)
	const [loadingDestinationDetail, setLoadingDestinationDetail] = useState(false)
	const [statusMessage, setStatusMessage] = useState(null)

	const [organizations, setOrganizations] = useState([])
	const [selectedOrgId, setSelectedOrgId] = useState(null)

	const [orgMembers, setOrgMembers] = useState([])
	const [staffInvites, setStaffInvites] = useState([])
	const [destinations, setDestinations] = useState([])
	const [selectedDestinationId, setSelectedDestinationId] = useState(null)

	const [destinationMembers, setDestinationMembers] = useState([])
	const [slots, setSlots] = useState([])

	useEffect(() => {
		let cancelled = false

		async function initialise() {
			setLoading(true)
			try {
				const { data } = await supabase.auth.getSession()
				const currentSession = data?.session ?? null
				if (!currentSession) {
					router.push('/login')
					return
				}

				if (!cancelled) {
					setSession(currentSession)
				}

				const { data: memberships, error } = await supabase
					.from('organization_memberships')
					.select('organization_id, permissions, organization:organization_id (*)')
					.eq('profile_id', currentSession.user.id)
					.order('created_at', { ascending: true })

				if (error) {
					console.error('dashboard: failed to load memberships', error)
					if (!cancelled) setStatusMessage(error.message || 'Unable to load organizations')
				}

				const resolvedOrgs = (memberships || [])
					.map(entry => {
						const organization = entry?.organization
						if (!organization) return null
						return {
							...organization,
							membershipPermissions: Array.isArray(entry.permissions) ? entry.permissions : [],
						}
					})
					.filter(Boolean)

				if (!cancelled) {
					setOrganizations(resolvedOrgs)
					setSelectedOrgId(prev => (prev && resolvedOrgs.some(org => org.id === prev)) ? prev : (resolvedOrgs[0]?.id ?? null))
				}
			} finally {
				if (!cancelled) setLoading(false)
			}
		}

		initialise()

		return () => {
			cancelled = true
		}
	}, [router])

	const fetchOrganizationData = useCallback(async (organizationId) => {
		const { data: members, error: membersError } = await supabase
			.from('organization_memberships')
			.select('id, organization_id, profile_id, permissions, created_at, profile:profile_id (id, full_name, avatar_url)')
			.eq('organization_id', organizationId)
			.order('created_at', { ascending: true })

		if (membersError) throw membersError

		const { data: destData, error: destinationsError } = await supabase
			.from('destinations')
			.select('id, name, description, address, capacity, created_at, updated_at')
			.eq('organization_id', organizationId)
			.order('created_at', { ascending: true })

		if (destinationsError) throw destinationsError

		const currentMembership = (members || []).find(member => member.profile_id === session?.user?.id)
		let invites = []

		if (currentMembership?.permissions?.includes('staff_manager')) {
			const { data: inviteData, error: invitesError } = await supabase
				.from('staff_invites')
				.select('id, destination_id, invited_email, invited_profile_id, accepted, accepted_at, expires_at, created_at, token')
				.eq('organization_id', organizationId)
				.order('created_at', { ascending: false })

			if (invitesError && invitesError.code !== '42501') throw invitesError
			invites = inviteData || []
		}

		return {
			members: members || [],
			destinations: destData || [],
			invites,
		}
	}, [session?.user?.id])

	const applyOrganizationData = useCallback((payload) => {
		setOrgMembers(payload.members)
		setDestinations(payload.destinations)
		setStaffInvites(payload.invites)
		setSelectedDestinationId(prev => {
			if (prev && payload.destinations.some(dest => dest.id === prev)) return prev
			return payload.destinations[0]?.id ?? null
		})
	}, [])

	useEffect(() => {
		if (!selectedOrgId || !session?.user?.id) {
			setOrgMembers([])
			setDestinations([])
			setStaffInvites([])
			setSelectedDestinationId(null)
			return
		}

		let cancelled = false
		setLoadingOrgDetail(true)

		fetchOrganizationData(selectedOrgId)
			.then(payload => {
				if (!cancelled) applyOrganizationData(payload)
			})
			.catch(err => {
				console.error('dashboard: organization fetch failed', err)
				if (!cancelled) setStatusMessage(err.message || 'Unable to load organization details')
			})
			.finally(() => {
				if (!cancelled) setLoadingOrgDetail(false)
			})

		return () => {
			cancelled = true
		}
	}, [selectedOrgId, session?.user?.id, fetchOrganizationData, applyOrganizationData])

	const fetchDestinationData = useCallback(async (destinationId) => {
		const { data: members, error: membersError } = await supabase
			.from('destination_memberships')
			.select('id, destination_id, profile_id, permissions, created_at, profile:profile_id (id, full_name, avatar_url)')
			.eq('destination_id', destinationId)
			.order('created_at', { ascending: true })

		if (membersError) throw membersError

		const { data: slotData, error: slotsError } = await supabase
			.from('slots')
			.select('*')
			.eq('destination_id', destinationId)
			.order('start_time', { ascending: true })

		if (slotsError) throw slotsError

		return {
			members: members || [],
			slots: slotData || [],
		}
	}, [])

	const applyDestinationData = useCallback((payload) => {
		setDestinationMembers(payload.members)
		setSlots(payload.slots)
	}, [])

	useEffect(() => {
		if (!session?.user?.id || !selectedDestinationId) {
			setDestinationMembers([])
			setSlots([])
			return
		}

		let cancelled = false
		setLoadingDestinationDetail(true)

		fetchDestinationData(selectedDestinationId)
			.then(payload => {
				if (!cancelled) applyDestinationData(payload)
			})
			.catch(err => {
				console.error('dashboard: destination fetch failed', err)
				if (!cancelled) setStatusMessage(err.message || 'Unable to load destination details')
			})
			.finally(() => {
				if (!cancelled) setLoadingDestinationDetail(false)
			})

		return () => {
			cancelled = true
		}
	}, [session?.user?.id, selectedDestinationId, fetchDestinationData, applyDestinationData])

	const refreshOrganization = useCallback(async () => {
		if (!selectedOrgId) return
		const payload = await fetchOrganizationData(selectedOrgId)
		applyOrganizationData(payload)
	}, [selectedOrgId, fetchOrganizationData, applyOrganizationData])

	const refreshDestination = useCallback(async (destinationId = selectedDestinationId) => {
		if (!destinationId) return
		const payload = await fetchDestinationData(destinationId)
		applyDestinationData(payload)
	}, [selectedDestinationId, fetchDestinationData, applyDestinationData])

	const currentOrg = useMemo(() => organizations.find(org => org.id === selectedOrgId) || null, [organizations, selectedOrgId])
	const myOrgMembership = useMemo(() => orgMembers.find(member => member.profile_id === session?.user?.id) || null, [orgMembers, session?.user?.id])
	const orgPermissions = myOrgMembership?.permissions ?? currentOrg?.membershipPermissions ?? []
	const canManageStaff = orgPermissions.includes('staff_manager')
	const canEditDestinations = orgPermissions.includes('destination_editor')
	const canViewSensitive = orgPermissions.includes('data_manager')

	const currentDestination = useMemo(() => destinations.find(dest => dest.id === selectedDestinationId) || null, [destinations, selectedDestinationId])
	const myDestinationMembership = useMemo(() => destinationMembers.find(member => member.profile_id === session?.user?.id) || null, [destinationMembers, session?.user?.id])
	const destinationPermissions = myDestinationMembership?.permissions ?? []
	const canManageDestination = destinationPermissions.includes('destination_manager') || canEditDestinations
	const canManageDestinationMembers = canManageDestination || canManageStaff
	const canManageBookings = destinationPermissions.includes('booking_manager') || canManageDestination

	const handleToggleOrgPermission = useCallback(async (membershipId, permissionKey, checked) => {
		try {
			const membership = orgMembers.find(member => member.id === membershipId)
			if (!membership) return

			const nextSet = new Set(membership.permissions || [])
			if (checked) nextSet.add(permissionKey)
			else nextSet.delete(permissionKey)

			const permissions = normalizePermissions(Array.from(nextSet), ORG_PERMISSION_OPTIONS)

			const { error } = await supabase
				.from('organization_memberships')
				.update({ permissions })
				.eq('id', membershipId)

			if (error) throw error

			setOrgMembers(prev => prev.map(member => member.id === membershipId ? { ...member, permissions } : member))
			setStatusMessage('Updated organization permissions')
		} catch (err) {
			console.error('dashboard: toggle org permission failed', err)
			alert('Unable to update permissions: ' + (err.message || err))
		}
	}, [orgMembers])

	const handleRemoveOrgMember = useCallback(async (membershipId, profileId) => {
		if (!window.confirm('Remove this member from the organization?')) return
		try {
			const { error } = await supabase
				.from('organization_memberships')
				.delete()
				.eq('id', membershipId)

			if (error) throw error

			await refreshOrganization()
			if (profileId === session?.user?.id) {
				setSelectedOrgId(null)
			} else if (selectedDestinationId) {
				await refreshDestination()
			}
			setStatusMessage('Removed organization member')
		} catch (err) {
			console.error('dashboard: remove org member failed', err)
			alert('Unable to remove member: ' + (err.message || err))
		}
	}, [refreshOrganization, refreshDestination, session?.user?.id, selectedDestinationId])

	const handleToggleDestinationPermission = useCallback(async (membershipId, permissionKey, checked) => {
		try {
			const membership = destinationMembers.find(member => member.id === membershipId)
			if (!membership) return

			const nextSet = new Set(membership.permissions || [])
			if (checked) nextSet.add(permissionKey)
			else nextSet.delete(permissionKey)

			const permissions = normalizePermissions(Array.from(nextSet), DEST_PERMISSION_OPTIONS)

			const { error } = await supabase
				.from('destination_memberships')
				.update({ permissions })
				.eq('id', membershipId)

			if (error) throw error

			setDestinationMembers(prev => prev.map(member => member.id === membershipId ? { ...member, permissions } : member))
			setStatusMessage('Updated destination permissions')
		} catch (err) {
			console.error('dashboard: toggle destination permission failed', err)
			alert('Unable to update destination permissions: ' + (err.message || err))
		}
	}, [destinationMembers])

	const handleRemoveDestinationMember = useCallback(async (membershipId) => {
		if (!window.confirm('Remove this profile from the destination?')) return
		try {
			const { error } = await supabase
				.from('destination_memberships')
				.delete()
				.eq('id', membershipId)

			if (error) throw error

			await refreshDestination()
			setStatusMessage('Removed destination member')
		} catch (err) {
			console.error('dashboard: remove destination member failed', err)
			alert('Unable to remove destination member: ' + (err.message || err))
		}
	}, [refreshDestination])

		const handleCreateStaffInvite = useCallback(async (email, destinationId) => {
			if (!selectedOrgId) throw new Error('No organization selected')
			if (!session?.access_token) throw new Error('Missing session token')
		try {
			const response = await fetch('/api/staff-invite', {
				method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${session.access_token}`,
					},
				body: JSON.stringify({ email, organization_id: selectedOrgId, destination_id: destinationId }),
			})
			const payload = await response.json().catch(() => ({}))
			if (!response.ok) throw new Error(payload?.error || 'Failed to create invite')
			await refreshOrganization()
			return payload
		} catch (err) {
			console.error('dashboard: create staff invite failed', err)
			throw err
		}
		}, [selectedOrgId, refreshOrganization, session?.access_token])

	const handleMapExistingUser = useCallback(async ({ email, orgPermissions, destinationPermissions, destinationId }) => {
			if (!selectedOrgId) throw new Error('No organization selected')
			if (!session?.access_token) throw new Error('Missing session token')
		try {
			const response = await fetch('/api/map-user', {
				method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${session.access_token}`,
					},
				body: JSON.stringify({
					email,
					organization_id: selectedOrgId,
					destination_id: destinationId || null,
					org_permissions: orgPermissions,
					destination_permissions: destinationId ? destinationPermissions : [],
				}),
			})

			const payload = await response.json().catch(() => ({}))
			if (!response.ok) throw new Error(payload?.error || 'Failed to map user')

			await refreshOrganization()
			if (destinationId) await refreshDestination(destinationId)
			return payload
		} catch (err) {
			console.error('dashboard: map existing user failed', err)
			throw err
		}
		}, [selectedOrgId, refreshOrganization, refreshDestination, session?.access_token])

	if (loading) {
		return (
			<VerifiedGuard>
				<div className="p-6">Loading dashboard…</div>
			</VerifiedGuard>
		)
	}

	return (
		<VerifiedGuard>
			<div className="p-6 space-y-6">
				<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
					<div>
						<h1 className="text-2xl font-bold">Organization dashboard</h1>
						<p className="text-sm text-muted">Manage destinations, permissions, and schedules in one place.</p>
					</div>
					<div className="flex items-center gap-3">
						{organizations.length > 1 && (
							<select
								value={selectedOrgId || ''}
								onChange={(event) => setSelectedOrgId(event.target.value || null)}
								className="input"
							>
								{organizations.map(org => (
									<option key={org.id} value={org.id}>{org.name}</option>
								))}
							</select>
						)}
						<Link href="/dashboard/create-destination" className={`btn btn-primary ${canEditDestinations ? '' : 'pointer-events-none opacity-50'}`} title={canEditDestinations ? 'Create a new destination' : 'Requires the Destination editor permission'}>
							Create destination
						</Link>
					</div>
				</div>

				{statusMessage && (
					<div className="rounded border border-info bg-info/10 px-3 py-2 text-sm text-info">
						{statusMessage}
					</div>
				)}

				{organizations.length === 0 ? (
					<div className="rounded border border-dashed p-6 text-center">
						<p className="mb-3">You are not part of any organization yet.</p>
						<Link href="/onboarding" className="btn btn-primary">Start onboarding</Link>
					</div>
				) : (
					<div className="grid grid-cols-1 gap-6 xl:grid-cols-4">
						<aside className="space-y-4 rounded border bg-card p-4 xl:col-span-1">
							<div>
								<h2 className="text-lg font-semibold">{currentOrg?.name}</h2>
								<p className="text-sm text-muted">{currentOrg?.description || 'No description provided yet.'}</p>
								{canViewSensitive && (
									<p className="mt-2 rounded bg-surface-2 p-2 text-xs text-muted">You have access to sensitive organization data.</p>
								)}
							</div>

							<div>
								<h3 className="text-sm font-medium">Destinations</h3>
								<p className="text-xs text-muted mb-2">Everyone in the organization can view these spaces.</p>
								{destinations.length === 0 ? (
									<div className="rounded border border-dashed p-3 text-xs text-muted">No destinations created yet.</div>
								) : (
									<ul className="space-y-2">
										{destinations.map(dest => (
											<li key={dest.id}>
												<button
													onClick={() => setSelectedDestinationId(dest.id)}
													className={`w-full rounded border p-3 text-left text-sm transition ${selectedDestinationId === dest.id ? 'border-primary bg-primary/10' : 'hover:bg-surface-1'}`}
												>
													<div className="font-medium">{dest.name}</div>
													<div className="text-xs text-muted">{dest.address || 'No address'}</div>
												</button>
											</li>
										))}
									</ul>
								)}
							</div>
						</aside>

						<main className="space-y-6 xl:col-span-3">
							{loadingOrgDetail ? (
								<div className="rounded border p-6">Loading organization details…</div>
							) : (
								<OrganizationMembersPanel
									members={orgMembers}
									currentUserId={session?.user?.id}
									canManageStaff={canManageStaff}
									onTogglePermission={handleToggleOrgPermission}
									onRemoveMember={handleRemoveOrgMember}
									staffInvites={staffInvites}
									onCreateStaffInvite={handleCreateStaffInvite}
									destinations={destinations}
									defaultDestinationId={selectedDestinationId}
									onMapExistingUser={handleMapExistingUser}
								/>
							)}

							{currentDestination ? (
								<div className="space-y-6 rounded border bg-card p-4">
									<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
										<div>
											<h2 className="text-xl font-semibold">{currentDestination.name}</h2>
											<p className="text-sm text-muted">Capacity {currentDestination.capacity}</p>
										</div>
										<div className="text-xs text-muted">
											Updated {formatDateTime(currentDestination.updated_at)}
										</div>
									</div>

									<DestinationEditor
										destination={currentDestination}
										editable={canManageDestination}
										onSaved={async () => {
											await refreshOrganization()
											await refreshDestination()
										}}
									/>

									{loadingDestinationDetail ? (
										<div className="rounded border p-4">Loading destination data…</div>
									) : (
										<DestinationMembersPanel
											members={destinationMembers}
											currentUserId={session?.user?.id}
											canManage={canManageDestinationMembers}
											onTogglePermission={handleToggleDestinationPermission}
											onRemoveMember={handleRemoveDestinationMember}
										/>
									)}

									<div className="space-y-4">
										<div className="flex items-center justify-between">
											<h3 className="text-lg font-semibold">Slots</h3>
											<span className="text-xs text-muted">Recurring availability for this destination.</span>
										</div>

										<div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
											{slots.map(slot => (
												<SlotCard
													key={slot.id}
													slot={slot}
													editable={canManageDestination}
													onUpdate={async () => refreshDestination()}
													onDelete={async () => refreshDestination()}
												/>
											))}

											<NewSlotCard
												destinationId={currentDestination.id}
												editable={canManageDestination}
												onCreated={async () => refreshDestination()}
											/>
										</div>
									</div>
								</div>
							) : (
								<div className="rounded border border-dashed p-6 text-center text-sm text-muted">
									Select a destination to view its details.
								</div>
							)}
						</main>
					</div>
				)}
			</div>
		</VerifiedGuard>
	)
}

function PermissionCheckbox({ option, checked, disabled, onChange }) {
	return (
		<label
			className={`flex items-center gap-2 text-sm ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
			title={option.description}
		>
			<input
				type="checkbox"
				checked={checked}
				disabled={disabled}
				onChange={(event) => onChange(option.key, event.target.checked)}
			/>
			<span>{option.label}</span>
		</label>
	)
}

function OrganizationMembersPanel({
	members,
	currentUserId,
	canManageStaff,
	onTogglePermission,
	onRemoveMember,
	staffInvites,
	onCreateStaffInvite,
	destinations,
	defaultDestinationId,
	onMapExistingUser,
}) {
	const [inviteEmail, setInviteEmail] = useState('')
	const [inviteDestinationId, setInviteDestinationId] = useState(defaultDestinationId || '')
	const [inviteLoading, setInviteLoading] = useState(false)
	const [lastInviteLink, setLastInviteLink] = useState(null)

	const [mapEmail, setMapEmail] = useState('')
	const [mapDestinationId, setMapDestinationId] = useState(defaultDestinationId || '')
	const [mapLoading, setMapLoading] = useState(false)
	const [orgPermissionState, setOrgPermissionState] = useState(() => Object.fromEntries(ORG_PERMISSION_OPTIONS.map(opt => [opt.key, opt.key === 'destination_editor'])))
	const [destPermissionState, setDestPermissionState] = useState(() => Object.fromEntries(DEST_PERMISSION_OPTIONS.map(opt => [opt.key, opt.key === 'booking_manager'])))

	useEffect(() => {
		setInviteDestinationId(defaultDestinationId || '')
		setMapDestinationId(defaultDestinationId || '')
	}, [defaultDestinationId])

	const handleCreateInvite = async () => {
		if (!inviteEmail) {
			alert('Enter an email address to invite.')
			return
		}
		if (!inviteDestinationId) {
			alert('Choose a destination for this staff invite.')
			return
		}
		setInviteLoading(true)
		try {
			const result = await onCreateStaffInvite(inviteEmail, inviteDestinationId)
			setInviteEmail('')
			setLastInviteLink(result?.link || (result?.invite?.token ? `/accept-invite?token=${result.invite.token}` : null))
		} catch (err) {
			alert(err.message || 'Failed to create staff invite')
		} finally {
			setInviteLoading(false)
		}
	}

	const handleMapSubmit = async () => {
		if (!mapEmail) {
			alert('Enter an email address to map.')
			return
		}

		const orgPermissions = ORG_PERMISSION_OPTIONS
			.filter(option => orgPermissionState[option.key])
			.map(option => option.key)

		const destinationPermissions = DEST_PERMISSION_OPTIONS
			.filter(option => destPermissionState[option.key])
			.map(option => option.key)

		setMapLoading(true)
		try {
			await onMapExistingUser({
				email: mapEmail,
				orgPermissions,
				destinationPermissions,
				destinationId: mapDestinationId || null,
			})
			setMapEmail('')
			alert('User mapped successfully.')
		} catch (err) {
			alert(err.message || 'Failed to map user')
		} finally {
			setMapLoading(false)
		}
	}

	return (
		<section className="space-y-4 rounded border bg-card p-4">
			<div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
				<div>
					<h2 className="text-lg font-semibold">Team permissions</h2>
					<p className="text-xs text-muted">Everyone can view this list. Editing requires the Staff manager permission.</p>
				</div>
			</div>

			<div className="space-y-3">
				{members.length === 0 ? (
					<div className="rounded border border-dashed p-3 text-sm text-muted">No members yet. Invite or map an existing account.</div>
				) : (
					members.map(member => {
						const name = member?.profile?.full_name || member.profile_id
						const permissions = Array.isArray(member.permissions) ? member.permissions : []
						const disableEditing = !canManageStaff
						const disableRemoval = !canManageStaff || member.profile_id === currentUserId
						return (
							<div key={member.id} className={`rounded border p-3 ${disableEditing ? 'bg-surface-1/60' : 'bg-white'}`}>
								<div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
									<div>
										<div className="font-medium">{name}</div>
										<div className="text-xs text-muted">{member.profile_id}</div>
									</div>
									{!disableRemoval && (
										<button onClick={() => onRemoveMember(member.id, member.profile_id)} className="btn btn-sm btn-outline">Remove</button>
									)}
								</div>

								<div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
									{ORG_PERMISSION_OPTIONS.map(option => (
										<PermissionCheckbox
											key={option.key}
											option={option}
											checked={permissions.includes(option.key)}
											disabled={disableEditing}
											onChange={(key, value) => onTogglePermission(member.id, key, value)}
										/>
									))}
								</div>
							</div>
						)
					})
				)}
			</div>

			<div className="rounded border bg-surface-1 p-3">
				<h3 className="text-sm font-semibold">Invite staff</h3>
				<p className="text-xs text-muted">Invited staff join the organization and selected destination with booking access.</p>
				<div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
					<input
						value={inviteEmail}
						onChange={(event) => setInviteEmail(event.target.value)}
						placeholder="staff@example.com"
						className="input"
						disabled={!canManageStaff}
					/>
					<select
						value={inviteDestinationId}
						onChange={(event) => setInviteDestinationId(event.target.value)}
						className="input"
						disabled={!canManageStaff}
					>
						<option value="">Select a destination</option>
						{destinations.map(dest => (
							<option key={dest.id} value={dest.id}>{dest.name}</option>
						))}
					</select>
				</div>
				<div className="mt-2 flex gap-2">
					<button onClick={handleCreateInvite} className="btn btn-primary" disabled={!canManageStaff || inviteLoading}>{inviteLoading ? 'Creating…' : 'Create invite'}</button>
					{lastInviteLink && (
						<button onClick={() => navigator.clipboard.writeText(lastInviteLink)} className="btn btn-outline">Copy link</button>
					)}
				</div>
			</div>

			<div className={`rounded border bg-surface-1 p-3 ${canManageStaff ? '' : 'opacity-60'}`}>
				<h3 className="text-sm font-semibold">Map existing user</h3>
				<p className="text-xs text-muted">Grant organization and destination permissions to an existing account.</p>
				<div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
					<input
						value={mapEmail}
						onChange={(event) => setMapEmail(event.target.value)}
						placeholder="user@example.com"
						className="input"
						disabled={!canManageStaff}
					/>
					<select
						value={mapDestinationId}
						onChange={(event) => setMapDestinationId(event.target.value)}
						className="input"
						disabled={!canManageStaff}
					>
						<option value="">No destination (org only)</option>
						{destinations.map(dest => (
							<option key={dest.id} value={dest.id}>{dest.name}</option>
						))}
					</select>
				</div>

				<div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
					{ORG_PERMISSION_OPTIONS.map(option => (
						<PermissionCheckbox
							key={option.key}
							option={option}
							checked={orgPermissionState[option.key]}
							disabled={!canManageStaff}
							onChange={(key, value) => setOrgPermissionState(prev => ({ ...prev, [key]: value }))}
						/>
					))}
				</div>

				{mapDestinationId && (
					<div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
						{DEST_PERMISSION_OPTIONS.map(option => (
							<PermissionCheckbox
								key={option.key}
								option={option}
								checked={destPermissionState[option.key]}
								disabled={!canManageStaff}
								onChange={(key, value) => setDestPermissionState(prev => ({ ...prev, [key]: value }))}
							/>
						))}
					</div>
				)}

				<div className="mt-3">
					<button onClick={handleMapSubmit} className="btn btn-outline" disabled={!canManageStaff || mapLoading}>{mapLoading ? 'Mapping…' : 'Map user'}</button>
				</div>
			</div>

			<div className="space-y-2">
				<h3 className="text-sm font-semibold">Pending staff invites</h3>
				{staffInvites.length === 0 ? (
					<div className="rounded border border-dashed p-3 text-xs text-muted">No outstanding invitations.</div>
				) : (
					<ul className="space-y-2">
						{staffInvites.map(invite => (
							<li key={invite.id} className="rounded border p-3 text-sm">
								<div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
									<div>
										<div className="font-medium">{invite.invited_email}</div>
										<div className="text-xs text-muted">Destination: {invite.destination_id}</div>
									</div>
									<div className="text-xs text-muted">Expires {formatDateTime(invite.expires_at)}</div>
								</div>
							</li>
						))}
					</ul>
				)}
			</div>
		</section>
	)
}

function DestinationMembersPanel({ members, currentUserId, canManage, onTogglePermission, onRemoveMember }) {
	return (
		<section className="space-y-3 rounded border bg-surface-1 p-4">
			<div className="flex items-center justify-between">
				<h3 className="text-lg font-semibold">Destination team</h3>
				{!canManage && <span className="text-xs text-muted">View-only access</span>}
			</div>

			{members.length === 0 ? (
				<div className="rounded border border-dashed p-3 text-sm text-muted">No destination members yet.</div>
			) : (
				members.map(member => {
					const permissions = Array.isArray(member.permissions) ? member.permissions : []
					const disableRemoval = !canManage || member.profile_id === currentUserId
					return (
						<div key={member.id} className={`rounded border p-3 ${canManage ? 'bg-white' : 'bg-surface-1/60'}`}>
							<div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
								<div>
									<div className="font-medium">{member?.profile?.full_name || member.profile_id}</div>
									<div className="text-xs text-muted">{member.profile_id}</div>
								</div>
								{!disableRemoval && (
									<button onClick={() => onRemoveMember(member.id)} className="btn btn-sm btn-outline">Remove</button>
								)}
							</div>
							<div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
								{DEST_PERMISSION_OPTIONS.map(option => (
									<PermissionCheckbox
										key={option.key}
										option={option}
										checked={permissions.includes(option.key)}
										disabled={!canManage}
										onChange={(key, value) => onTogglePermission(member.id, key, value)}
									/>
								))}
							</div>
						</div>
					)
				})
			)}
		</section>
	)
}

function DestinationEditor({ destination, editable, onSaved }) {
	const [form, setForm] = useState(() => ({
		name: destination?.name || '',
		address: destination?.address || '',
		capacity: destination?.capacity || 1,
		description: destination?.description || '',
	}))
	const [saving, setSaving] = useState(false)

		useEffect(() => {
			setForm({
				name: destination?.name || '',
				address: destination?.address || '',
				capacity: destination?.capacity || 1,
				description: destination?.description || '',
			})
		}, [destination])

	const handleSave = async () => {
		if (!editable) return
		setSaving(true)
		try {
			const { error } = await supabase
				.from('destinations')
				.update({
					name: form.name,
					address: form.address,
					capacity: form.capacity,
					description: form.description,
				})
				.eq('id', destination.id)

			if (error) throw error
			onSaved && onSaved()
		} catch (err) {
			alert('Unable to update destination: ' + (err.message || err))
		} finally {
			setSaving(false)
		}
	}

	return (
		<section className="space-y-3 rounded border bg-white p-4">
			<div className="flex items-center justify-between">
				<h3 className="text-lg font-semibold">Destination details</h3>
				{!editable && <span className="text-xs text-muted">Read only</span>}
			</div>

			<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
				<label className="text-xs font-medium">
					Name
					<input
						value={form.name}
						onChange={(event) => setForm(prev => ({ ...prev, name: event.target.value }))}
						className="input mt-1"
						disabled={!editable}
					/>
				</label>
				<label className="text-xs font-medium">
					Capacity
					<input
						type="number"
						min={1}
						value={form.capacity}
						onChange={(event) => setForm(prev => ({ ...prev, capacity: Number(event.target.value) }))}
						className="input mt-1"
						disabled={!editable}
					/>
				</label>
				<label className="text-xs font-medium md:col-span-2">
					Address
					<input
						value={form.address}
						onChange={(event) => setForm(prev => ({ ...prev, address: event.target.value }))}
						className="input mt-1"
						disabled={!editable}
					/>
				</label>
				<label className="text-xs font-medium md:col-span-2">
					Description
					<textarea
						value={form.description}
						onChange={(event) => setForm(prev => ({ ...prev, description: event.target.value }))}
						className="input mt-1 h-24"
						disabled={!editable}
					/>
				</label>
			</div>

			<div>
				<button onClick={handleSave} className="btn btn-primary" disabled={!editable || saving}>{saving ? 'Saving…' : 'Save changes'}</button>
			</div>
		</section>
	)
}

function SlotCard({ slot, editable, onUpdate, onDelete }) {
	const [editing, setEditing] = useState(false)
	const [saving, setSaving] = useState(false)
	const [form, setForm] = useState(() => ({
		price: slot?.price,
		start_time: slot?.start_time,
		end_time: slot?.end_time,
		effective_start_date: slot?.effective_start_date,
		effective_end_date: slot?.effective_end_date,
	}))

		useEffect(() => {
			setForm({
				price: slot?.price,
				start_time: slot?.start_time,
				end_time: slot?.end_time,
				effective_start_date: slot?.effective_start_date,
				effective_end_date: slot?.effective_end_date,
			})
		}, [slot])

	const handleSave = async () => {
		if (!editable) return
		setSaving(true)
		try {
			const { error } = await supabase
				.from('slots')
				.update({
					price: form.price,
					start_time: form.start_time,
					end_time: form.end_time,
					effective_start_date: form.effective_start_date,
					effective_end_date: form.effective_end_date,
				})
				.eq('id', slot.id)

			if (error) throw error
			onUpdate && onUpdate()
			setEditing(false)
		} catch (err) {
			alert('Unable to update slot: ' + (err.message || err))
		} finally {
			setSaving(false)
		}
	}

	const handleDelete = async () => {
		if (!editable) return
		if (!window.confirm('Delete this slot?')) return
		try {
			const { error } = await supabase
				.from('slots')
				.delete()
				.eq('id', slot.id)

			if (error) throw error
			onDelete && onDelete()
		} catch (err) {
			alert('Unable to delete slot: ' + (err.message || err))
		}
	}

	if (!editable && editing) {
		setEditing(false)
	}

	return (
		<div className="rounded border bg-white p-3 shadow-sm">
			{!editing ? (
				<div className="space-y-2 text-sm">
					<div className="flex items-center justify-between font-medium">
						<span>{slot.start_time} → {slot.end_time}</span>
						<span>£{slot.price}</span>
					</div>
					<div className="text-xs text-muted">Effective {slot.effective_start_date}{slot.effective_end_date ? ` → ${slot.effective_end_date}` : ''}</div>
					{editable && (
						<div className="flex gap-2 pt-2">
							<button onClick={() => setEditing(true)} className="btn btn-sm btn-outline">Edit</button>
							<button onClick={handleDelete} className="btn btn-sm btn-danger">Delete</button>
						</div>
					)}
				</div>
			) : (
				<div className="space-y-2 text-sm">
					<label className="text-xs">Price
						<input value={form.price} onChange={(event) => setForm(prev => ({ ...prev, price: event.target.value }))} className="input mt-1" />
					</label>
					<label className="text-xs">Start
						<input value={form.start_time} onChange={(event) => setForm(prev => ({ ...prev, start_time: event.target.value }))} className="input mt-1" />
					</label>
					<label className="text-xs">End
						<input value={form.end_time} onChange={(event) => setForm(prev => ({ ...prev, end_time: event.target.value }))} className="input mt-1" />
					</label>
					<label className="text-xs">Effective from
						<input type="date" value={form.effective_start_date || ''} onChange={(event) => setForm(prev => ({ ...prev, effective_start_date: event.target.value }))} className="input mt-1" />
					</label>
					<label className="text-xs">Effective until
						<input type="date" value={form.effective_end_date || ''} onChange={(event) => setForm(prev => ({ ...prev, effective_end_date: event.target.value }))} className="input mt-1" />
					</label>
					<div className="flex gap-2 pt-1">
						<button onClick={handleSave} className="btn btn-sm btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
						<button onClick={() => setEditing(false)} className="btn btn-sm btn-outline">Cancel</button>
					</div>
				</div>
			)}
		</div>
	)
}

function NewSlotCard({ destinationId, editable, onCreated }) {
	const [open, setOpen] = useState(false)
	const [saving, setSaving] = useState(false)
	const [form, setForm] = useState({
		price: '0.00',
		start_time: '09:00:00',
		end_time: '10:00:00',
		effective_start_date: new Date().toISOString().slice(0, 10),
		effective_end_date: '',
	})

	const handleCreate = async () => {
		if (!editable) return
		setSaving(true)
		try {
			const payload = {
				destination_id: destinationId,
				price: form.price,
				start_time: form.start_time,
				end_time: form.end_time,
				effective_start_date: form.effective_start_date || null,
				effective_end_date: form.effective_end_date || null,
			}
			const { error } = await supabase
				.from('slots')
				.insert([payload])

			if (error) throw error
			onCreated && onCreated()
			setOpen(false)
		} catch (err) {
			alert('Unable to create slot: ' + (err.message || err))
		} finally {
			setSaving(false)
		}
	}

	if (!editable) {
		return (
			<div className="rounded border border-dashed bg-surface-1/60 p-4 text-center text-xs text-muted" title="Requires Destination manager access">
				You can view slots. Destination manager access is needed to add new ones.
			</div>
		)
	}

	if (!open) {
		return (
			<button onClick={() => setOpen(true)} className="flex h-full min-h-[120px] items-center justify-center rounded border border-dashed text-3xl text-muted hover:bg-surface-1">
				+
			</button>
		)
	}

	return (
		<div className="rounded border bg-white p-3">
			<div className="space-y-2 text-sm">
				<label className="text-xs">Price
					<input value={form.price} onChange={(event) => setForm(prev => ({ ...prev, price: event.target.value }))} className="input mt-1" />
				</label>
				<label className="text-xs">Start
					<input value={form.start_time} onChange={(event) => setForm(prev => ({ ...prev, start_time: event.target.value }))} className="input mt-1" />
				</label>
				<label className="text-xs">End
					<input value={form.end_time} onChange={(event) => setForm(prev => ({ ...prev, end_time: event.target.value }))} className="input mt-1" />
				</label>
				<label className="text-xs">Effective from
					<input type="date" value={form.effective_start_date} onChange={(event) => setForm(prev => ({ ...prev, effective_start_date: event.target.value }))} className="input mt-1" />
				</label>
				<label className="text-xs">Effective until
					<input type="date" value={form.effective_end_date} onChange={(event) => setForm(prev => ({ ...prev, effective_end_date: event.target.value }))} className="input mt-1" />
				</label>
				<div className="flex gap-2 pt-2">
					<button onClick={handleCreate} className="btn btn-sm btn-primary" disabled={saving}>{saving ? 'Creating…' : 'Create slot'}</button>
					<button onClick={() => setOpen(false)} className="btn btn-sm btn-outline">Cancel</button>
				</div>
			</div>
		</div>
	)
}

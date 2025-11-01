# Staff Management & Dashboard Features

## Implemented Features

### 1. Last Staff Manager Protection ✅
**Requirement:** The organization should always have at least one staff manager. The last staff manager's permission cannot be removed.

**Implementation:**
- Database Trigger: `supabase/migrations/20251101_prevent_last_staff_manager_removal.sql`
- Prevents UPDATE or DELETE operations that would leave an organization with zero staff_manager permissions
- Enforced at database level for data integrity

**Testing:**
- Try to remove staff_manager permission from the last remaining staff manager
- Should fail with error: "Cannot remove the last staff_manager from an organization"

---

### 2. Data Manager Sensitive Information Access ✅
**Requirement:** Data managers should be able to view and edit sensitive information like organization name, description, address, contact_info, and payment_details.

**Implementation:**
- **Dashboard Data Section**: Restricted to users with `data_manager` permission
- **Organization Settings Form**: Editable fields include:
  - Organization Name
  - Description
  - Address
  - Contact Info (JSONB field)
  - Payment Details (JSONB field)
- **Permission Check**: `isDataManager` flag computed from organization_memberships
- **Sidebar Access**: Data section only visible to data managers

**Files Modified:**
- `src/app/dashboard/page.jsx` - Added Data section with analytics + settings form
- Organization settings page removed (functionality integrated into dashboard)

**Testing:**
- Login as user with `data_manager` permission
- Navigate to "Data" section in sidebar
- Edit organization settings and save
- Verify changes persist in database

---

### 3. Send Invite Links from Dashboard ✅
**Requirement:** Provide option to send invite links from the invitations section of the dashboard.

**Implementation:**
- **Send Invite Button**: Located in Invitations section header (only visible to staff_managers)
- **Invite Dialog**: Modal form with:
  - Email address field
  - Destination dropdown selector
  - 7-day expiry notice
  - Send/Cancel actions
- **API Endpoint**: `/api/staff-invite` (POST)
  - Validates staff_manager permission
  - Generates unique invite token using `crypto.randomUUID()`
  - Sets expiry to 7 days from creation
  - Returns invite link for sharing

**Files Modified:**
- `src/app/dashboard/page.jsx` - Added invite dialog UI and state management
- `src/app/api/staff-invite/route.js` - Updated to use session-based auth and correct field names

**Database Fields:**
- `staff_invites.invite_token` - Unique token for invite link
- `staff_invites.invited_email` - Email of invitee
- `staff_invites.destination_id` - Destination they'll manage
- `staff_invites.organization_id` - Organization they're joining
- `staff_invites.expires_at` - Expiration timestamp (7 days)
- `staff_invites.created_by` - User ID of inviter

**Invite Link Format:**
```
{SITE_URL}/staff-invite?token={invite_token}
```

**Testing:**
- Login as user with `staff_manager` permission
- Go to Invitations section
- Click "Send Invite" button
- Fill email and select destination
- Click "Send Invite"
- Verify invite appears in table
- Copy invite link and test acceptance flow

---

### 4. Elegant Sidebar Navigation ✅
**Requirement:** Add an elegant left section with options: Data, Destinations, Team Members, Recent Bookings, Invitations.

**Implementation:**
- **Permanent Drawer**: 280px width sidebar on left
- **Navigation Sections**:
  1. **Data** - Analytics dashboard + organization settings (data_manager only)
  2. **Destinations** - List of destinations with "New Destination" action
  3. **Team Members** - Staff list with permission management
  4. **Recent Bookings** - Latest 50 bookings across all destinations
  5. **Invitations** - Pending invites with send/copy actions

**Visual Design:**
- Rounded selection highlights (border-radius: 2)
- Active state: Primary color background with contrast text
- Hover effects on all buttons
- Icons for each section (Dashboard, Place, People, EventNote, Mail)
- Organization selector at top (if multiple orgs)

**Permission-Based Display:**
- Data section hidden for non-data_managers
- Send Invite button hidden for non-staff_managers
- All users can view their accessible sections

**Files Modified:**
- `src/app/dashboard/page.jsx` - Complete tab-to-drawer conversion

**Key Variables:**
```javascript
const DRAWER_WIDTH = 280;
const SIDEBAR_SECTIONS = [
  { id: 'data', label: 'Data', icon: DashboardIcon, requiresDataManager: true },
  { id: 'destinations', label: 'Destinations', icon: Place },
  { id: 'team', label: 'Team Members', icon: People },
  { id: 'bookings', label: 'Recent Bookings', icon: EventNote },
  { id: 'invitations', label: 'Invitations', icon: Mail },
];
```

**Testing:**
- Navigate between all sections
- Verify smooth transitions
- Check Data section visibility based on permission
- Test organization switcher with multiple orgs
- Verify active state styling

---

## Permission System Summary

### Organization Memberships Permissions:
1. **staff_manager**: Can manage team members, send invites, edit permissions
2. **destination_editor**: Can edit destination settings
3. **data_manager**: Can view analytics, edit sensitive organization data

### Destination Memberships Permissions:
1. **destination_manager**: Can manage destination settings and slots/events
2. **booking_manager**: Can view and manage bookings

---

## Database Schema Updates

### staff_invites Table:
```sql
- id (uuid, PK)
- organization_id (uuid, FK)
- destination_id (uuid, FK)
- invited_email (text)
- invite_token (text, unique)
- expires_at (timestamp)
- created_by (uuid, FK to profiles)
- accepted (boolean)
- created_at (timestamp)
- updated_at (timestamp)
```

### Triggers:
- `prevent_last_staff_manager_removal()` - Ensures at least one staff_manager per organization

---

## Testing Checklist

### Feature 1: Last Staff Manager Protection
- [ ] Create organization with one staff_manager
- [ ] Try to remove staff_manager permission
- [ ] Verify error message appears
- [ ] Add second staff_manager
- [ ] Remove first staff_manager (should succeed)

### Feature 2: Data Manager Access
- [ ] Login as user without data_manager permission
- [ ] Verify "Data" section is hidden in sidebar
- [ ] Add data_manager permission to user
- [ ] Verify "Data" section appears
- [ ] Edit organization settings
- [ ] Verify changes save successfully

### Feature 3: Send Invites
- [ ] Login as staff_manager
- [ ] Open Invitations section
- [ ] Click "Send Invite"
- [ ] Enter email and select destination
- [ ] Send invite
- [ ] Verify invite appears in table
- [ ] Copy invite link
- [ ] Test invite acceptance flow

### Feature 4: Sidebar Navigation
- [ ] Click each section in sidebar
- [ ] Verify correct content displays
- [ ] Check active state highlighting
- [ ] Test with multiple organizations
- [ ] Verify responsive behavior

---

## Future Enhancements

1. **Email Notifications**: Automatically send email when invite is created
2. **Invite Management**: Allow staff_manager to revoke/resend invites
3. **Bulk Invites**: Send multiple invites at once
4. **Permission Templates**: Pre-defined permission sets for common roles
5. **Audit Log**: Track all permission changes and invite activities
6. **Advanced Analytics**: More detailed charts and export functionality

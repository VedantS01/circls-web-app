# Database Seed Data

This directory contains seed data to populate the Circls database with realistic test data.

## What's Included

The seed script (`seed.sql`) creates:

- **1000 Users**: Test user accounts (user1@example.com to user1000@example.com)
- **50 Organizations**: Mix of sports facilities, cafes, and conference venues
- **2-4 Destinations per Organization**: Total ~150 destinations
- **Hourly Slots**: Each destination has 18 slots (6 AM to 12 AM)
- **Events**: Conference halls have 5 events each (mostly free)
- **100 Sample Bookings**: Distributed across various slots

### Organization Distribution

1. **Organizations 1-25**: Sports facilities
   - Badminton, Tennis, Basketball, Football, Cricket, Swimming, etc.
   - Rates: ₹300, ₹500, ₹700, ₹1000 per hour

2. **Organizations 26-35**: Cafes
   - Coffee lounges and dining spaces
   - Rates: ₹200, ₹300, ₹400 per hour

3. **Organizations 36-50**: Conference Halls
   - Business meeting rooms and event spaces
   - Rates: ₹500, ₹1000, ₹1500, ₹2000 per hour
   - 5 events each (mostly free)

### Geographic Distribution

Facilities are spread across major Indian cities:
- **Bangalore**: Koramangala, Indiranagar, Whitefield, HSR Layout, etc.
- **Mumbai**: Andheri, Bandra, Powai, Worli, Lower Parel, etc.
- **Pune**: Koregaon Park, Viman Nagar, Hinjewadi, Kharadi, etc.
- **Nagpur**: Sadar, Dharampeth, Civil Lines, Sitabuldi, etc.

### User Assignments

- **Users 1-50**: Organization owners with full permissions (staff_manager, data_manager, destination_editor)
- **Users 51-250**: Destination managers (destination_manager, booking_manager)
- **Users 251-1000**: Regular users for bookings

## How to Use

### Using Supabase CLI (Recommended)

1. Make sure you have Supabase CLI installed and running:
   ```bash
   supabase start
   ```

2. Run the seed script:
   ```bash
   supabase db reset --db-url postgresql://postgres:postgres@localhost:54322/postgres
   ```
   
   Or manually execute:
   ```bash
   psql postgresql://postgres:postgres@localhost:54322/postgres -f supabase/seed.sql
   ```

### Using Supabase Dashboard

1. Go to the SQL Editor in your Supabase dashboard
2. Copy the contents of `seed.sql`
3. Paste and run the script

## Test Credentials

All seeded users have the same password: `password123`

Example accounts:
- `user1@example.com` - Organization owner
- `user2@example.com` - Organization owner
- `user51@example.com` - Destination manager
- `user251@example.com` - Regular user

## Data Structure

### Organizations Table
- Name, description, address
- Contact info (phone, email, website) in JSONB
- Payment details (UPI, bank info) in JSONB

### Destinations Table
- Linked to organizations
- Various sports facilities, cafes, conference halls
- Amenities, rules, coordinates
- Cover images from Unsplash

### Slots Table
- 18 hourly slots per destination (6 AM - 12 AM)
- Recurring daily pattern
- Valid for 6 months from current date
- Prices vary by destination type

### Events Table
- Only for conference halls
- 5 events per hall
- Scheduled weekly for next 5 weeks
- Mostly free (60% free, 40% paid)

### Bookings Table
- 100 sample bookings
- Mix of confirmed and pending
- Distributed across next 30 days
- Payment status linked to slot price

## Resetting Data

To clear all seed data and start fresh:

```bash
supabase db reset
```

This will:
1. Drop all tables
2. Re-run migrations
3. Leave database empty for new seeding

## Notes

- All timestamps are relative to execution time
- Geographic coordinates are randomized within city boundaries
- Phone numbers are sequential: +919000000001, +919000000002, etc.
- UPI IDs follow pattern: organizationname@paytm
- Booking distribution favors confirmed bookings (75% confirmed, 25% pending)
- Payment status: 67% paid, 33% pending (for paid slots)

## Troubleshooting

**Error: auth.users table doesn't exist**
- Make sure migrations are run first
- Check Supabase instance is properly initialized

**Error: permission denied**
- Script uses admin privileges
- Run through Supabase CLI or as superuser

**Duplicate key errors**
- Clear existing data first with `supabase db reset`
- Or modify script to check for existing records

## Customization

You can modify the following in `seed.sql`:

- Number of users: Change loop range `1..1000`
- Number of organizations: Change loop range `1..50`
- Destinations per org: Modify `v_num_destinations` calculation
- Slot hours: Adjust `6..23` range
- Booking count: Change loop range `1..100`
- Prices: Update `ARRAY[300, 500, 700, 1000]` arrays

## Data Quality

The seed data includes:
- ✅ Realistic organization and destination names
- ✅ Valid Indian addresses and cities
- ✅ Proper lat/long coordinates
- ✅ Structured JSONB for contact info and payment details
- ✅ Correct permission assignments
- ✅ Valid datetime ranges
- ✅ Referential integrity (all foreign keys valid)
- ✅ Diverse data for testing search, filters, analytics

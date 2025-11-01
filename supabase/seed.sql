-- Database Seed Data for Circls Application
-- 50 organizations, 2-4 destinations each, 1000 users
-- Various sports facilities, cafes, conference halls across Indian cities

BEGIN;

-- First, create 1000 users (profiles)
-- Note: In production, these would be created through Supabase Auth
-- For seeding, we'll create profiles directly

DO $$
DECLARE
  v_user_id UUID;
  v_counter INT := 1;
BEGIN
  FOR v_counter IN 1..1000 LOOP
    v_user_id := gen_random_uuid();
    
    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      confirmation_token,
      email_change_token_new,
      recovery_token
    ) VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'user' || v_counter || '@example.com',
      crypt('password123', gen_salt('bf')),
      NOW(),
      NOW(),
      NOW(),
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object('name', 'User ' || v_counter),
      false,
      '',
      '',
      ''
    );
    
    -- Profile is auto-created by trigger, just update the full_name
    UPDATE public.profiles 
    SET full_name = 'User ' || v_counter
    WHERE id = v_user_id;
  END LOOP;
END $$;

-- Organization and Destination data
DO $$
DECLARE
  v_org_id UUID;
  v_dest_id UUID;
  v_slot_id UUID;
  v_event_id UUID;
  v_user_ids UUID[];
  v_org_owner_id UUID;
  v_dest_manager_id UUID;
  v_org_counter INT := 1;
  v_dest_counter INT;
  v_num_destinations INT;
  v_slot_hour INT;
  v_slot_rate DECIMAL;
  
  -- Organization types and names
  v_org_names TEXT[] := ARRAY[
    'Elite Sports Arena', 'Urban Fitness Hub', 'Premium Sports Club', 'City Sports Complex',
    'Champions Academy', 'Victory Sports Center', 'Active Life Sports', 'Peak Performance Hub',
    'Sports Nation', 'Game On Sports', 'Athletic Excellence', 'Pro Sports Arena',
    'Fitness First Club', 'Power Play Sports', 'Dynamic Sports Zone', 'Stellar Athletics',
    'Prime Sports Hub', 'Metro Sports Club', 'Alpha Sports Complex', 'Titan Sports Arena',
    'Velocity Sports Center', 'Apex Athletics', 'Summit Sports Club', 'Phoenix Sports Hub',
    'Olympus Sports Arena', 'Elite Cafe Network', 'Urban Brew Spaces', 'Conference Pro India',
    'Meeting Minds Venues', 'Workspace Solutions', 'Event Hubs India', 'Corporate Spaces Co',
    'Business Centers India', 'Premium Venues Ltd', 'Smart Spaces Network', 'Venue Masters',
    'Modern Workspaces', 'Executive Centers', 'Professional Venues', 'Corporate Connect',
    'Business Hub India', 'Premium Meetings Co', 'Workspace Elite', 'Conference Connect',
    'Venue Solutions', 'Smart Meeting Rooms', 'Corporate Events Co', 'Professional Spaces',
    'Elite Gatherings', 'Business Centers Pro'
  ];
  
  -- Sports facilities
  v_sports_facilities TEXT[] := ARRAY[
    'Badminton Court', 'Tennis Court', 'Basketball Court', 'Football Turf', 'Cricket Net',
    'Swimming Pool', 'Squash Court', 'Table Tennis Hall', 'Volleyball Court', 'Gym Floor',
    'Boxing Ring', 'Indoor Soccer Arena', 'Pickleball Court', 'Skating Rink', 'Yoga Studio'
  ];
  
  -- Cafes
  v_cafe_names TEXT[] := ARRAY[
    'Artisan Coffee Lounge', 'Espresso Bar', 'Brew & Bites Cafe', 'Cozy Corner Cafe',
    'Urban Grind Coffee', 'The Daily Brew', 'Cafe Delight', 'Coffee Culture'
  ];
  
  -- Conference halls
  v_conference_names TEXT[] := ARRAY[
    'Executive Boardroom', 'Innovation Hall', 'Conference Center A', 'Meeting Room Elite',
    'Business Hub Conference', 'Corporate Hall', 'Summit Room', 'Strategy Center'
  ];
  
  -- Cities and areas
  v_cities TEXT[] := ARRAY['Bangalore', 'Mumbai', 'Pune', 'Nagpur'];
  v_bangalore_areas TEXT[] := ARRAY['Koramangala', 'Indiranagar', 'Whitefield', 'HSR Layout', 'Marathahalli', 'JP Nagar', 'Jayanagar', 'BTM Layout'];
  v_mumbai_areas TEXT[] := ARRAY['Andheri', 'Bandra', 'Powai', 'Worli', 'Lower Parel', 'Malad', 'Goregaon', 'Juhu'];
  v_pune_areas TEXT[] := ARRAY['Koregaon Park', 'Viman Nagar', 'Hinjewadi', 'Kharadi', 'Wakad', 'Baner', 'Aundh', 'Hadapsar'];
  v_nagpur_areas TEXT[] := ARRAY['Sadar', 'Dharampeth', 'Civil Lines', 'Sitabuldi', 'Ramdaspeth', 'Wardha Road', 'Kamptee Road', 'Seminary Hills'];
  
  v_city TEXT;
  v_area TEXT;
  v_dest_type TEXT;
  v_dest_name TEXT;
  
BEGIN
  -- Get array of user IDs for assignment
  SELECT ARRAY_AGG(id) INTO v_user_ids FROM public.profiles LIMIT 100;
  
  -- Create 50 organizations
  FOR v_org_counter IN 1..50 LOOP
    v_org_id := gen_random_uuid();
    
    -- Pick a city
    v_city := v_cities[1 + (v_org_counter % 4)];
    
    -- Pick an area based on city
    IF v_city = 'Bangalore' THEN
      v_area := v_bangalore_areas[1 + (v_org_counter % 8)];
    ELSIF v_city = 'Mumbai' THEN
      v_area := v_mumbai_areas[1 + (v_org_counter % 8)];
    ELSIF v_city = 'Pune' THEN
      v_area := v_pune_areas[1 + (v_org_counter % 8)];
    ELSE
      v_area := v_nagpur_areas[1 + (v_org_counter % 8)];
    END IF;
    
    -- Create organization
    INSERT INTO public.organizations (
      id,
      name,
      description,
      address,
      contact_info,
      payment_details,
      created_at
    ) VALUES (
      v_org_id,
      v_org_names[v_org_counter],
      'Premier sports and recreation facility offering world-class amenities and professional coaching services.',
      v_area || ', ' || v_city || ', India',
      jsonb_build_object(
        'phone', '+91' || (9000000000 + v_org_counter)::TEXT,
        'email', 'contact@' || LOWER(REPLACE(v_org_names[v_org_counter], ' ', '')) || '.com',
        'website', 'https://' || LOWER(REPLACE(v_org_names[v_org_counter], ' ', '')) || '.com'
      ),
      jsonb_build_object(
        'upi_id', LOWER(REPLACE(v_org_names[v_org_counter], ' ', '')) || '@paytm',
        'account_holder', v_org_names[v_org_counter],
        'bank_name', 'HDFC Bank'
      ),
      NOW() - (v_org_counter || ' days')::INTERVAL
    );
    
    -- Assign organization owner (one user per org from first 50 users)
    v_org_owner_id := v_user_ids[v_org_counter];
    
    INSERT INTO public.organization_memberships (
      organization_id,
      profile_id,
      permissions,
      created_at
    ) VALUES (
      v_org_id,
      v_org_owner_id,
      ARRAY['staff_manager', 'data_manager', 'destination_editor']::TEXT[],
      NOW()
    );
    
    -- Create 2-4 destinations per organization
    v_num_destinations := 2 + (v_org_counter % 3); -- Will give 2, 3, or 4
    
    FOR v_dest_counter IN 1..v_num_destinations LOOP
      v_dest_id := gen_random_uuid();
      
      -- Determine destination type and name
      IF v_org_counter <= 25 THEN
        -- First 25 orgs: Sports facilities
        v_dest_type := 'sports';
        v_dest_name := v_sports_facilities[1 + ((v_org_counter * v_dest_counter) % 15)];
      ELSIF v_org_counter <= 35 THEN
        -- Orgs 26-35: Cafes
        v_dest_type := 'cafe';
        v_dest_name := v_cafe_names[1 + (v_dest_counter % 8)];
      ELSE
        -- Orgs 36-50: Conference halls
        v_dest_type := 'conference';
        v_dest_name := v_conference_names[1 + (v_dest_counter % 8)];
      END IF;
      
      -- Set rate based on destination type and counter
      IF v_dest_type = 'sports' THEN
        v_slot_rate := (ARRAY[300, 500, 700, 1000])[1 + (v_dest_counter % 4)];
      ELSIF v_dest_type = 'cafe' THEN
        v_slot_rate := (ARRAY[200, 300, 400])[1 + (v_dest_counter % 3)];
      ELSE
        v_slot_rate := (ARRAY[500, 1000, 1500, 2000])[1 + (v_dest_counter % 4)];
      END IF;
      
      -- Create destination
      INSERT INTO public.destinations (
        id,
        organization_id,
        name,
        type,
        description,
        address,
        capacity,
        created_at
      ) VALUES (
        v_dest_id,
        v_org_id,
        v_dest_name,
        CASE 
          WHEN v_dest_name LIKE '%Court%' OR v_dest_name LIKE '%Turf%' OR v_dest_name LIKE '%Pool%' THEN 'sports'
          WHEN v_dest_name LIKE '%Cafe%' OR v_dest_name LIKE '%Lounge%' THEN 'cafe'
          WHEN v_dest_name LIKE '%Conference%' OR v_dest_name LIKE '%Meeting%' THEN 'conference'
          ELSE 'other'
        END,
        'Experience top-tier facilities with professional equipment and comfortable amenities.',
        v_area || ', ' || v_city || ', India',
        CASE 
          WHEN v_dest_name LIKE '%Conference%' OR v_dest_name LIKE '%Meeting%' THEN 50
          WHEN v_dest_name LIKE '%Court%' THEN 4
          WHEN v_dest_name LIKE '%Pool%' THEN 1
          ELSE 10
        END,
        NOW() - (v_dest_counter || ' days')::INTERVAL
      );
      
      -- Assign destination manager (one additional user per destination)
      v_dest_manager_id := v_user_ids[50 + ((v_org_counter - 1) * 4) + v_dest_counter];
      
      INSERT INTO public.organization_memberships (
        organization_id,
        profile_id,
        permissions,
        created_at
      ) VALUES (
        v_org_id,
        v_dest_manager_id,
        ARRAY['destination_editor']::TEXT[],
        NOW()
      );
      
      INSERT INTO public.destination_memberships (
        destination_id,
        profile_id,
        permissions,
        created_at
      ) VALUES (
        v_dest_id,
        v_dest_manager_id,
        ARRAY['destination_manager', 'booking_manager']::TEXT[],
        NOW()
      );
      
      -- Create hourly slots from 6 AM to 12 AM (18 hours)
      FOR v_slot_hour IN 6..23 LOOP
        v_slot_id := gen_random_uuid();
        
        INSERT INTO public.slots (
          id,
          destination_id,
          start_time,
          end_time,
          price,
          effective_start_date,
          effective_end_date,
          recurrence_rule,
          created_at
        ) VALUES (
          v_slot_id,
          v_dest_id,
          (v_slot_hour || ':00:00')::TIME,
          ((v_slot_hour + 1) || ':00:00')::TIME,
          v_slot_rate,
          CURRENT_DATE,
          CURRENT_DATE + INTERVAL '6 months',
          'FREQ=DAILY',
          NOW()
        );
      END LOOP;
      
      -- Create events for conference halls (5 events per hall, mostly free)
      IF v_dest_type = 'conference' THEN
        FOR v_event_counter IN 1..5 LOOP
          v_event_id := gen_random_uuid();
          
          INSERT INTO public.events (
            id,
            destination_id,
            name,
            description,
            start_datetime,
            end_datetime,
            is_paid,
            price,
            capacity,
            created_at
          ) VALUES (
            v_event_id,
            v_dest_id,
            (ARRAY['Tech Meetup', 'Business Networking', 'Workshop Series', 'Community Gathering', 'Industry Conference'])[v_event_counter],
            'Join us for an engaging session with industry experts and networking opportunities.',
            (CURRENT_DATE + (v_event_counter * 7 || ' days')::INTERVAL)::TIMESTAMP + INTERVAL '18 hours',
            (CURRENT_DATE + (v_event_counter * 7 || ' days')::INTERVAL)::TIMESTAMP + INTERVAL '21 hours',
            CASE WHEN v_event_counter <= 3 THEN false ELSE true END,
            CASE WHEN v_event_counter <= 3 THEN 0 ELSE 500 END,
            100,
            NOW()
          );
        END LOOP;
      END IF;
      
    END LOOP; -- destinations
    
  END LOOP; -- organizations
  
END $$;

-- Create some sample bookings (100 bookings across various slots)
DO $$
DECLARE
  v_slot_ids UUID[];
  v_user_ids UUID[];
  v_booking_id UUID;
  v_counter INT;
  v_slot_id UUID;
  v_user_id UUID;
  v_slot_price DECIMAL;
  v_dest_id UUID;
BEGIN
  -- Get arrays of slot IDs and user IDs
  SELECT ARRAY_AGG(id) INTO v_slot_ids FROM public.slots LIMIT 100;
  SELECT ARRAY_AGG(id) INTO v_user_ids FROM (SELECT id FROM public.profiles ORDER BY created_at LIMIT 100) sub;
  
  FOR v_counter IN 1..100 LOOP
    v_booking_id := gen_random_uuid();
    v_slot_id := v_slot_ids[v_counter];
    v_user_id := v_user_ids[v_counter];
    
    -- Get slot price and destination
    SELECT price, destination_id INTO v_slot_price, v_dest_id 
    FROM public.slots WHERE id = v_slot_id;
    
    INSERT INTO public.bookings (
      id,
      user_id,
      destination_id,
      bookable_id,
      bookable_type,
      start_datetime,
      end_datetime,
      total_amount,
      booking_status,
      payment_status,
      created_at
    ) VALUES (
      v_booking_id,
      v_user_id,
      v_dest_id,
      v_slot_id,
      'slot',
      (CURRENT_DATE + ((v_counter % 30) || ' days')::INTERVAL)::TIMESTAMP + INTERVAL '10 hours',
      (CURRENT_DATE + ((v_counter % 30) || ' days')::INTERVAL)::TIMESTAMP + INTERVAL '11 hours',
      v_slot_price,
      (ARRAY['confirmed', 'confirmed', 'confirmed', 'pending'])[1 + (v_counter % 4)],
      CASE WHEN v_slot_price = 0 THEN 'not_required' ELSE (ARRAY['paid', 'paid', 'pending'])[1 + (v_counter % 3)] END,
      NOW() - (v_counter || ' hours')::INTERVAL
    );
  END LOOP;
END $$;

COMMIT;

-- Summary report
DO $$
DECLARE
  v_org_count INT;
  v_dest_count INT;
  v_user_count INT;
  v_slot_count INT;
  v_event_count INT;
  v_booking_count INT;
BEGIN
  SELECT COUNT(*) INTO v_org_count FROM public.organizations;
  SELECT COUNT(*) INTO v_dest_count FROM public.destinations;
  SELECT COUNT(*) INTO v_user_count FROM public.profiles;
  SELECT COUNT(*) INTO v_slot_count FROM public.slots;
  SELECT COUNT(*) INTO v_event_count FROM public.events;
  SELECT COUNT(*) INTO v_booking_count FROM public.bookings;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'SEED DATA SUMMARY';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Organizations: %', v_org_count;
  RAISE NOTICE 'Destinations: %', v_dest_count;
  RAISE NOTICE 'Users: %', v_user_count;
  RAISE NOTICE 'Slots: %', v_slot_count;
  RAISE NOTICE 'Events: %', v_event_count;
  RAISE NOTICE 'Bookings: %', v_booking_count;
  RAISE NOTICE '========================================';
END $$;

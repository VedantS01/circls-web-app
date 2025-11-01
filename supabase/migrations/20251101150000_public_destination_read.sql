-- Add public read policies for destinations, events, and slots
-- This allows all users (including anonymous) to view these for booking purposes

-- Drop the existing restrictive policies
DROP POLICY IF EXISTS "Org members can read destination" ON public.destinations;
DROP POLICY IF EXISTS "Org members can view events" ON public.events;
DROP POLICY IF EXISTS "Org members can view slots" ON public.slots;

-- Create new public read policies:

-- 1. Allow public read access to all destinations
CREATE POLICY "Public can read destinations" ON public.destinations
	FOR SELECT USING (true);

-- 2. Allow public read access to all events
CREATE POLICY "Public can read events" ON public.events
	FOR SELECT USING (true);

-- 3. Allow public read access to all slots
CREATE POLICY "Public can read slots" ON public.slots
	FOR SELECT USING (true);

-- Keep the existing write policies unchanged
-- (Editors/managers can create/update/delete remain the same)

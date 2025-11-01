--
-- File: supabase/migrations/0001_initial_schema.sql
-- Description: Sets up the core database schema for the Circls marketplace platform.
--

SET search_path TO public;

-- Resolve the current request user (works with RLS-aware queries and triggers).
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sub TEXT;
BEGIN
  BEGIN
	_sub := current_setting('request.jwt.claim.sub');
  EXCEPTION WHEN others THEN
	_sub := NULL;
  END;

  IF _sub IS NOT NULL AND _sub <> '' THEN
	RETURN _sub::uuid;
  END IF;

  RETURN auth.uid();
END;
$$;


-- 1. EXTENSIONS -----------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;


-- 2. PROFILES -------------------------------------------------------------
CREATE TABLE public.profiles (
	id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
	full_name TEXT,
	avatar_url TEXT,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.profiles IS 'Public profile data for each authenticated user.';


-- 3. ORGANIZATIONS --------------------------------------------------------
CREATE TABLE public.organizations (
	id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
	name TEXT NOT NULL,
	description TEXT,
	address TEXT,
	contact_info JSONB,
	created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT public.current_user_id(),
	payment_details JSONB,
	status TEXT NOT NULL DEFAULT 'pending', -- pending, active, suspended
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.organizations IS 'Business entities that own destinations and staff.';


-- 4. ORGANIZATION MEMBERSHIPS --------------------------------------------
CREATE TABLE public.organization_memberships (
	id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
	organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
	profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
	permissions TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[] CHECK (
		permissions <@ ARRAY['staff_manager','destination_editor','data_manager']::TEXT[]
	),
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	UNIQUE (organization_id, profile_id)
);
COMMENT ON TABLE public.organization_memberships IS 'Many-to-many mapping between organizations and profiles with scoped permissions.';


-- 5. DESTINATIONS ---------------------------------------------------------
CREATE TABLE public.destinations (
	id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
	organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
	name TEXT NOT NULL,
	type TEXT,
	description TEXT,
	photos TEXT[],
	address TEXT,
	capacity INT NOT NULL DEFAULT 1,
	rules_json JSONB,
	created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT public.current_user_id(),
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.destinations IS 'Physical spaces that can be booked under an organization.';


-- 6. DESTINATION MEMBERSHIPS ---------------------------------------------
CREATE TABLE public.destination_memberships (
	id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
	destination_id UUID NOT NULL REFERENCES public.destinations(id) ON DELETE CASCADE,
	profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
	permissions TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[] CHECK (
		permissions <@ ARRAY['destination_manager','booking_manager']::TEXT[]
	),
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	UNIQUE (destination_id, profile_id)
);
COMMENT ON TABLE public.destination_memberships IS 'Links profiles to destinations with destination-level permissions.';


-- 7. INVITES --------------------------------------------------------------
CREATE TABLE public.app_invites (
	id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
	email TEXT NOT NULL,
	token TEXT NOT NULL UNIQUE,
	metadata JSONB,
	expires_at TIMESTAMPTZ,
	accepted BOOLEAN NOT NULL DEFAULT FALSE,
	accepted_at TIMESTAMPTZ,
	accepted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
	created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT public.current_user_id(),
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.app_invites IS 'General-purpose invites to onboard people onto the platform.';

CREATE TABLE public.staff_invites (
	id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
	organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
	destination_id UUID NOT NULL REFERENCES public.destinations(id) ON DELETE CASCADE,
	invited_email TEXT NOT NULL,
	invited_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
	token TEXT NOT NULL UNIQUE,
	expires_at TIMESTAMPTZ,
	accepted BOOLEAN NOT NULL DEFAULT FALSE,
	accepted_at TIMESTAMPTZ,
	accepted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
	created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT public.current_user_id(),
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.staff_invites IS 'Invites that connect a profile to an organization and destination with starter permissions.';


-- 8. BOOKABLE INVENTORY ---------------------------------------------------
CREATE TABLE public.slots (
	id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
	destination_id UUID NOT NULL REFERENCES public.destinations(id) ON DELETE CASCADE,
	price DECIMAL(10, 2) NOT NULL,
	start_time TIME NOT NULL,
	end_time TIME NOT NULL,
	recurrence_rule TEXT,
	effective_start_date DATE NOT NULL,
	effective_end_date DATE,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.slots IS 'Recurring, bookable time frames.';

CREATE TABLE public.events (
	id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
	destination_id UUID NOT NULL REFERENCES public.destinations(id) ON DELETE CASCADE,
	name TEXT NOT NULL,
	description TEXT,
	start_datetime TIMESTAMPTZ NOT NULL,
	end_datetime TIMESTAMPTZ NOT NULL,
	is_paid BOOLEAN NOT NULL DEFAULT TRUE,
	price DECIMAL(10, 2) DEFAULT 0,
	capacity INT NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.events IS 'One-off activities scheduled at a destination.';

CREATE TABLE public.downtimes (
	id BIGSERIAL PRIMARY KEY,
	destination_id UUID NOT NULL REFERENCES public.destinations(id) ON DELETE CASCADE,
	start_datetime TIMESTAMPTZ NOT NULL,
	end_datetime TIMESTAMPTZ NOT NULL,
	reason TEXT,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.downtimes IS 'Blockers indicating when a destination is unavailable.';


-- 9. BOOKINGS -------------------------------------------------------------
CREATE TABLE public.bookings (
	id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
	bookable_id UUID NOT NULL,
	bookable_type TEXT NOT NULL CHECK (bookable_type IN ('slot','event')),
	user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
	destination_id UUID NOT NULL REFERENCES public.destinations(id) ON DELETE CASCADE,
	booking_datetime TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	start_datetime TIMESTAMPTZ NOT NULL,
	end_datetime TIMESTAMPTZ NOT NULL,
	number_of_attendees INT NOT NULL DEFAULT 1,
	total_amount DECIMAL(10, 2) NOT NULL,
	payment_status TEXT NOT NULL DEFAULT 'pending',
	booking_status TEXT NOT NULL DEFAULT 'confirmed',
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.bookings IS 'Central ledger of reservations.';


-- 10. INDEXES ------------------------------------------------------------
CREATE INDEX idx_destinations_organization_id ON public.destinations (organization_id);
CREATE INDEX idx_org_memberships_profile ON public.organization_memberships (profile_id);
CREATE INDEX idx_org_memberships_org ON public.organization_memberships (organization_id);
CREATE INDEX idx_destination_memberships_profile ON public.destination_memberships (profile_id);
CREATE INDEX idx_destination_memberships_destination ON public.destination_memberships (destination_id);
CREATE INDEX idx_slots_destination_id ON public.slots (destination_id);
CREATE INDEX idx_events_destination_id ON public.events (destination_id);
CREATE INDEX idx_downtimes_destination_id ON public.downtimes (destination_id);
CREATE INDEX idx_bookings_user_id ON public.bookings (user_id);
CREATE INDEX idx_bookings_destination_id ON public.bookings (destination_id);
CREATE INDEX idx_staff_invites_org ON public.staff_invites (organization_id);
CREATE INDEX idx_staff_invites_destination ON public.staff_invites (destination_id);
CREATE INDEX idx_app_invites_email ON public.app_invites (email);


-- 11. HELPER FUNCTIONS ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_org_member(p_organization_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_organization_id IS NULL OR p_user_id IS NULL THEN
	RETURN FALSE;
  END IF;

  RETURN EXISTS (
	SELECT 1
	FROM public.organization_memberships om
	WHERE om.organization_id = p_organization_id
	  AND om.profile_id = p_user_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.has_org_permission(p_organization_id UUID, p_user_id UUID, p_permission TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_permission IS NULL OR p_permission = '' THEN
	RETURN FALSE;
  END IF;

  RETURN EXISTS (
	SELECT 1
	FROM public.organization_memberships om
	WHERE om.organization_id = p_organization_id
	  AND om.profile_id = p_user_id
	  AND (
		p_permission = ANY(om.permissions)
		OR 'staff_manager' = ANY(om.permissions) -- staff managers can manage subordinate scopes
	  )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.has_any_org_permission(p_organization_id UUID, p_user_id UUID, p_permissions TEXT[])
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_permissions IS NULL OR array_length(p_permissions, 1) IS NULL THEN
	RETURN FALSE;
  END IF;

  RETURN EXISTS (
	SELECT 1
	FROM public.organization_memberships om
	WHERE om.organization_id = p_organization_id
	  AND om.profile_id = p_user_id
	  AND (
		om.permissions && p_permissions
		OR 'staff_manager' = ANY(om.permissions)
	  )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.destination_organization_id(p_destination_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.destinations WHERE id = p_destination_id;
$$;

CREATE OR REPLACE FUNCTION public.is_destination_member(p_destination_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_destination_id IS NULL OR p_user_id IS NULL THEN
	RETURN FALSE;
  END IF;

  RETURN EXISTS (
	SELECT 1
	FROM public.destination_memberships dm
	WHERE dm.destination_id = p_destination_id
	  AND dm.profile_id = p_user_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.has_destination_permission(p_destination_id UUID, p_user_id UUID, p_permission TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org UUID;
BEGIN
  IF p_destination_id IS NULL OR p_user_id IS NULL OR p_permission IS NULL OR p_permission = '' THEN
	RETURN FALSE;
  END IF;

  _org := public.destination_organization_id(p_destination_id);

  RETURN EXISTS (
	SELECT 1
	FROM public.destination_memberships dm
	WHERE dm.destination_id = p_destination_id
	  AND dm.profile_id = p_user_id
	  AND (
		p_permission = ANY(dm.permissions)
		OR 'destination_manager' = ANY(dm.permissions)
	  )
  )
  OR public.has_org_permission(_org, p_user_id, 'destination_editor');
END;
$$;


-- 12. TRIGGERS ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


CREATE OR REPLACE FUNCTION public.create_initial_organization_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _requester UUID;
  _full_perms CONSTANT TEXT[] := ARRAY['staff_manager','destination_editor','data_manager'];
BEGIN
  _requester := COALESCE(NEW.created_by, public.current_user_id());

  IF _requester IS NULL THEN
	RETURN NEW;
  END IF;

  INSERT INTO public.organization_memberships (organization_id, profile_id, permissions)
  VALUES (NEW.id, _requester, _full_perms)
  ON CONFLICT (organization_id, profile_id) DO UPDATE
	SET permissions = (
	  SELECT ARRAY(
		SELECT DISTINCT perm
		FROM unnest(organization_memberships.permissions || EXCLUDED.permissions) AS perm
	  )
	),
		updated_at = NOW();

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_organizations_initial_membership
AFTER INSERT ON public.organizations
FOR EACH ROW EXECUTE PROCEDURE public.create_initial_organization_membership();


CREATE OR REPLACE FUNCTION public.create_initial_destination_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _requester UUID;
  _initial_perms CONSTANT TEXT[] := ARRAY['destination_manager','booking_manager'];
BEGIN
  _requester := COALESCE(NEW.created_by, public.current_user_id());

  IF _requester IS NULL THEN
	RETURN NEW;
  END IF;

  INSERT INTO public.destination_memberships (destination_id, profile_id, permissions)
  VALUES (NEW.id, _requester, _initial_perms)
  ON CONFLICT (destination_id, profile_id) DO UPDATE
	SET permissions = (
	  SELECT ARRAY(
		SELECT DISTINCT perm
		FROM unnest(destination_memberships.permissions || EXCLUDED.permissions) AS perm
	  )
	),
		updated_at = NOW();

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_destinations_initial_membership
AFTER INSERT ON public.destinations
FOR EACH ROW EXECUTE PROCEDURE public.create_initial_destination_membership();


CREATE TRIGGER trg_profiles_set_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER trg_organizations_set_updated_at
BEFORE UPDATE ON public.organizations
FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER trg_destinations_set_updated_at
BEFORE UPDATE ON public.destinations
FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER trg_org_memberships_set_updated_at
BEFORE UPDATE ON public.organization_memberships
FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER trg_destination_memberships_set_updated_at
BEFORE UPDATE ON public.destination_memberships
FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER trg_slots_set_updated_at
BEFORE UPDATE ON public.slots
FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER trg_events_set_updated_at
BEFORE UPDATE ON public.events
FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER trg_downtimes_set_updated_at
BEFORE UPDATE ON public.downtimes
FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER trg_bookings_set_updated_at
BEFORE UPDATE ON public.bookings
FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();


-- 13. ROW LEVEL SECURITY --------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.destination_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.downtimes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;


-- Profiles policies -------------------------------------------------------
CREATE POLICY "Profiles are self-readable" ON public.profiles
	FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Profiles are self-updatable" ON public.profiles
	FOR UPDATE USING (auth.uid() = id)
	WITH CHECK (auth.uid() = id);

CREATE POLICY "Profiles are self-insertable" ON public.profiles
	FOR INSERT WITH CHECK (auth.uid() = id);


-- Organizations policies --------------------------------------------------
CREATE POLICY "Org members can read organization" ON public.organizations
	FOR SELECT USING (
		public.is_org_member(id, auth.uid())
	);

CREATE POLICY "Authenticated users can create organizations" ON public.organizations
	FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Org managers can update organization" ON public.organizations
	FOR UPDATE USING (
		public.has_any_org_permission(id, auth.uid(), ARRAY['staff_manager','data_manager'])
	)
	WITH CHECK (
		public.has_any_org_permission(id, auth.uid(), ARRAY['staff_manager','data_manager'])
	);

CREATE POLICY "Org managers can delete organization" ON public.organizations
	FOR DELETE USING (
		public.has_any_org_permission(id, auth.uid(), ARRAY['staff_manager','data_manager'])
	);


-- Organization memberships policies --------------------------------------
CREATE POLICY "Org members can view memberships" ON public.organization_memberships
	FOR SELECT USING (
		public.is_org_member(organization_id, auth.uid())
	);

CREATE POLICY "Staff managers can add memberships" ON public.organization_memberships
	FOR INSERT WITH CHECK (
		public.has_org_permission(organization_id, auth.uid(), 'staff_manager')
	);

CREATE POLICY "Staff managers can update memberships" ON public.organization_memberships
	FOR UPDATE USING (
		public.has_org_permission(organization_id, auth.uid(), 'staff_manager')
	)
	WITH CHECK (
		public.has_org_permission(organization_id, auth.uid(), 'staff_manager')
	);

CREATE POLICY "Staff managers can remove memberships" ON public.organization_memberships
	FOR DELETE USING (
		public.has_org_permission(organization_id, auth.uid(), 'staff_manager')
	);


-- Destinations policies ---------------------------------------------------
CREATE POLICY "Org members can read destination" ON public.destinations
	FOR SELECT USING (
		public.is_org_member(organization_id, auth.uid())
	);

CREATE POLICY "Destination editors can create destination" ON public.destinations
	FOR INSERT WITH CHECK (
		public.has_org_permission(organization_id, auth.uid(), 'destination_editor')
	);

CREATE POLICY "Destination editors can update destination" ON public.destinations
	FOR UPDATE USING (
		public.has_org_permission(organization_id, auth.uid(), 'destination_editor')
	)
	WITH CHECK (
		public.has_org_permission(organization_id, auth.uid(), 'destination_editor')
	);

CREATE POLICY "Destination editors can delete destination" ON public.destinations
	FOR DELETE USING (
		public.has_org_permission(organization_id, auth.uid(), 'destination_editor')
	);


-- Destination memberships policies ---------------------------------------
CREATE POLICY "Org members can read destination memberships" ON public.destination_memberships
	FOR SELECT USING (
		public.is_org_member(public.destination_organization_id(destination_id), auth.uid())
	);

CREATE POLICY "Destination managers or staff managers can add destination memberships" ON public.destination_memberships
	FOR INSERT WITH CHECK (
		public.has_destination_permission(destination_id, auth.uid(), 'destination_manager')
		OR public.has_org_permission(public.destination_organization_id(destination_id), auth.uid(), 'staff_manager')
	);

CREATE POLICY "Destination managers or staff managers can update destination memberships" ON public.destination_memberships
	FOR UPDATE USING (
		public.has_destination_permission(destination_id, auth.uid(), 'destination_manager')
		OR public.has_org_permission(public.destination_organization_id(destination_id), auth.uid(), 'staff_manager')
	)
	WITH CHECK (
		public.has_destination_permission(destination_id, auth.uid(), 'destination_manager')
		OR public.has_org_permission(public.destination_organization_id(destination_id), auth.uid(), 'staff_manager')
	);

CREATE POLICY "Destination managers or staff managers can remove destination memberships" ON public.destination_memberships
	FOR DELETE USING (
		public.has_destination_permission(destination_id, auth.uid(), 'destination_manager')
		OR public.has_org_permission(public.destination_organization_id(destination_id), auth.uid(), 'staff_manager')
	);


-- App invites policies ----------------------------------------------------
CREATE POLICY "Invite creators can manage app invites" ON public.app_invites
	USING (created_by = auth.uid())
	WITH CHECK (created_by = auth.uid());


-- Staff invites policies --------------------------------------------------
CREATE POLICY "Staff managers can read staff invites" ON public.staff_invites
	FOR SELECT USING (
		public.has_org_permission(organization_id, auth.uid(), 'staff_manager')
		OR invited_profile_id = auth.uid()
	);

CREATE POLICY "Staff managers can create staff invites" ON public.staff_invites
	FOR INSERT WITH CHECK (
		public.has_org_permission(organization_id, auth.uid(), 'staff_manager')
	);

CREATE POLICY "Staff managers can update staff invites" ON public.staff_invites
	FOR UPDATE USING (
		public.has_org_permission(organization_id, auth.uid(), 'staff_manager')
	)
	WITH CHECK (
		public.has_org_permission(organization_id, auth.uid(), 'staff_manager')
	);

CREATE POLICY "Staff managers can delete staff invites" ON public.staff_invites
	FOR DELETE USING (
		public.has_org_permission(organization_id, auth.uid(), 'staff_manager')
	);


-- Slots policies ----------------------------------------------------------
CREATE POLICY "Org members can view slots" ON public.slots
	FOR SELECT USING (
		public.is_org_member(public.destination_organization_id(destination_id), auth.uid())
	);

CREATE POLICY "Slot managers can insert slots" ON public.slots
	FOR INSERT WITH CHECK (
		public.has_destination_permission(destination_id, auth.uid(), 'destination_manager')
	);

CREATE POLICY "Slot managers can update slots" ON public.slots
	FOR UPDATE USING (
		public.has_destination_permission(destination_id, auth.uid(), 'destination_manager')
	)
	WITH CHECK (
		public.has_destination_permission(destination_id, auth.uid(), 'destination_manager')
	);

CREATE POLICY "Slot managers can delete slots" ON public.slots
	FOR DELETE USING (
		public.has_destination_permission(destination_id, auth.uid(), 'destination_manager')
	);


-- Events policies ---------------------------------------------------------
CREATE POLICY "Org members can view events" ON public.events
	FOR SELECT USING (
		public.is_org_member(public.destination_organization_id(destination_id), auth.uid())
	);

CREATE POLICY "Destination managers can insert events" ON public.events
	FOR INSERT WITH CHECK (
		public.has_destination_permission(destination_id, auth.uid(), 'destination_manager')
	);

CREATE POLICY "Destination managers can update events" ON public.events
	FOR UPDATE USING (
		public.has_destination_permission(destination_id, auth.uid(), 'destination_manager')
	)
	WITH CHECK (
		public.has_destination_permission(destination_id, auth.uid(), 'destination_manager')
	);

CREATE POLICY "Destination managers can delete events" ON public.events
	FOR DELETE USING (
		public.has_destination_permission(destination_id, auth.uid(), 'destination_manager')
	);


-- Downtimes policies ------------------------------------------------------
CREATE POLICY "Org members can view downtimes" ON public.downtimes
	FOR SELECT USING (
		public.is_org_member(public.destination_organization_id(destination_id), auth.uid())
	);

CREATE POLICY "Destination managers can insert downtimes" ON public.downtimes
	FOR INSERT WITH CHECK (
		public.has_destination_permission(destination_id, auth.uid(), 'destination_manager')
	);

CREATE POLICY "Destination managers can update downtimes" ON public.downtimes
	FOR UPDATE USING (
		public.has_destination_permission(destination_id, auth.uid(), 'destination_manager')
	)
	WITH CHECK (
		public.has_destination_permission(destination_id, auth.uid(), 'destination_manager')
	);

CREATE POLICY "Destination managers can delete downtimes" ON public.downtimes
	FOR DELETE USING (
		public.has_destination_permission(destination_id, auth.uid(), 'destination_manager')
	);


-- Bookings policies -------------------------------------------------------
CREATE POLICY "Profiles can create own bookings or as booking managers" ON public.bookings
	FOR INSERT WITH CHECK (
		auth.uid() = user_id
		OR public.has_destination_permission(destination_id, auth.uid(), 'booking_manager')
	);

CREATE POLICY "Profiles can view own bookings" ON public.bookings
	FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Booking managers can view bookings" ON public.bookings
	FOR SELECT USING (
		public.has_destination_permission(destination_id, auth.uid(), 'booking_manager')
	);

CREATE POLICY "Booking managers can update bookings" ON public.bookings
	FOR UPDATE USING (
		public.has_destination_permission(destination_id, auth.uid(), 'booking_manager')
	)
	WITH CHECK (
		public.has_destination_permission(destination_id, auth.uid(), 'booking_manager')
	);

CREATE POLICY "Booking managers can delete bookings" ON public.bookings
	FOR DELETE USING (
		public.has_destination_permission(destination_id, auth.uid(), 'booking_manager')
	);


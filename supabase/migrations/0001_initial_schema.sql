--
-- File: supabase/migrations/YYYYMMDDHHMMSS_initial_schema.sql
-- Description: Sets up the initial database schema for the marketplace platform.
--

-- 1. EXTENSIONS
-- Enable pgcrypto for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";


-- 2. PROFILES TABLE
-- Stores public user data, linked one-to-one with Supabase's auth.users.
CREATE TABLE "public"."profiles" (
    "id" UUID NOT NULL PRIMARY KEY REFERENCES "auth"."users" ON DELETE CASCADE,
    "full_name" TEXT,
    "avatar_url" TEXT
);
COMMENT ON TABLE "public"."profiles" IS 'Public profile data for each user.';

-- 3. ORGANIZATIONS & DESTINATIONS
CREATE TABLE "public"."organizations" (
    "id" UUID NOT NULL PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "address" TEXT,
    "contact_info" JSONB,
    "owner_id" UUID NOT NULL REFERENCES "public"."profiles" ON DELETE RESTRICT,
    "payment_details" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'active', 'suspended'
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE "public"."organizations" IS 'Business entities that own destinations.';

CREATE TABLE "public"."destinations" (
    "id" UUID NOT NULL PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
    "organization_id" UUID NOT NULL REFERENCES "public"."organizations" ON DELETE CASCADE,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "description" TEXT,
    "photos" TEXT[],
    "address" TEXT,
    "capacity" INT NOT NULL DEFAULT 1,
    "rules_json" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE "public"."destinations" IS 'Physical, bookable spaces like courts or halls.';


-- 4. ADMIN & STAFF MANAGEMENT
CREATE TABLE "public"."org_admin_links" (
    "id" BIGSERIAL PRIMARY KEY,
    "user_id" UUID NOT NULL REFERENCES "public"."profiles" ON DELETE CASCADE,
    "organization_id" UUID NOT NULL REFERENCES "public"."organizations" ON DELETE CASCADE,
    "destination_id" UUID REFERENCES "public"."destinations" ON DELETE CASCADE, -- NULL for org-level admin
    "permissions" TEXT[] NOT NULL,
    UNIQUE("user_id", "organization_id", "destination_id")
);
COMMENT ON TABLE "public"."org_admin_links" IS 'Links users to organizations/destinations with specific permissions.';

-- Organization invites table (merged from later migration)
CREATE TABLE IF NOT EXISTS public.org_invites (
    id UUID NOT NULL PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    invited_by UUID REFERENCES auth.users ON DELETE SET NULL,
    token TEXT NOT NULL,
    expires_at TIMESTAMPTZ,
    accepted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS org_invites_organization_id_idx ON public.org_invites (organization_id);
CREATE INDEX IF NOT EXISTS org_invites_email_idx ON public.org_invites (email);


-- 5. CIRCLES (Social Groups)
CREATE TABLE "public"."circles" (
    "id" UUID NOT NULL PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "circle_picture_url" TEXT,
    "center_user_id" UUID NOT NULL REFERENCES "public"."profiles" ON DELETE SET NULL, -- Admin of the circle
    "is_private" BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE "public"."circles" IS 'User-created social groups or clubs.';

CREATE TABLE "public"."circle_memberships" (
    "id" BIGSERIAL PRIMARY KEY,
    "user_id" UUID NOT NULL REFERENCES "public"."profiles" ON DELETE CASCADE,
    "circle_id" UUID NOT NULL REFERENCES "public"."circles" ON DELETE CASCADE,
    "role" TEXT NOT NULL DEFAULT 'member', -- 'member', 'center'
    "join_date" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE("user_id", "circle_id")
);
COMMENT ON TABLE "public"."circle_memberships" IS 'Junction table for users and their circles.';


-- 6. BOOKABLE ENTITIES (Slots, Events, Downtime)
CREATE TABLE "public"."slots" (
    "id" UUID NOT NULL PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
    "destination_id" UUID NOT NULL REFERENCES "public"."destinations" ON DELETE CASCADE,
    "price" DECIMAL(10, 2) NOT NULL,
    "start_time" TIME NOT NULL,
    "end_time" TIME NOT NULL,
    "recurrence_rule" TEXT, -- RRULE string
    "effective_start_date" DATE NOT NULL,
    "effective_end_date" DATE,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE "public"."slots" IS 'Recurring, bookable time frames.';

CREATE TABLE "public"."events" (
    "id" UUID NOT NULL PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
    "destination_id" UUID NOT NULL REFERENCES "public"."destinations" ON DELETE CASCADE,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "start_datetime" TIMESTAMPTZ NOT NULL,
    "end_datetime" TIMESTAMPTZ NOT NULL,
    "is_paid" BOOLEAN NOT NULL DEFAULT TRUE,
    "price" DECIMAL(10, 2) DEFAULT 0,
    "capacity" INT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE "public"."events" IS 'One-off activities at a destination.';

CREATE TABLE "public"."downtimes" (
    "id" BIGSERIAL PRIMARY KEY,
    "destination_id" UUID NOT NULL REFERENCES "public"."destinations" ON DELETE CASCADE,
    "start_datetime" TIMESTAMPTZ NOT NULL,
    "end_datetime" TIMESTAMPTZ NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE "public"."downtimes" IS 'Periods when a destination is unavailable.';


-- 7. BOOKINGS (Central Transaction Record)
CREATE TABLE "public"."bookings" (
    "id" UUID NOT NULL PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
    "bookable_id" UUID NOT NULL,
    "bookable_type" TEXT NOT NULL, -- 'slot' or 'event'
    "user_id" UUID NOT NULL REFERENCES "public"."profiles" ON DELETE SET NULL,
    "destination_id" UUID NOT NULL REFERENCES "public"."destinations" ON DELETE CASCADE,
    "circle_id" UUID REFERENCES "public"."circles" ON DELETE SET NULL,
    "booking_datetime" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "start_datetime" TIMESTAMPTZ NOT NULL,
    "end_datetime" TIMESTAMPTZ NOT NULL,
    "number_of_attendees" INT NOT NULL DEFAULT 1,
    "total_amount" DECIMAL(10, 2) NOT NULL,
    "payment_status" TEXT NOT NULL DEFAULT 'pending',
    "booking_status" TEXT NOT NULL DEFAULT 'confirmed'
);
COMMENT ON TABLE "public"."bookings" IS 'Records of all reservations.';


-- 8. INDEXES FOR PERFORMANCE
CREATE INDEX ON "public"."destinations" ("organization_id");
CREATE INDEX ON "public"."org_admin_links" ("user_id");
CREATE INDEX ON "public"."circle_memberships" ("user_id", "circle_id");
CREATE INDEX ON "public"."slots" ("destination_id");
CREATE INDEX ON "public"."events" ("destination_id");
CREATE INDEX ON "public"."bookings" ("user_id");
CREATE INDEX ON "public"."bookings" ("destination_id");


-- 9. HELPER FUNCTION & TRIGGER FOR PROFILE CREATION
-- Function to create a profile for a new user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (new.id);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to run the function when a new user signs up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- Helper function to check if a user is an admin for a destination
CREATE OR REPLACE FUNCTION public.is_org_admin(p_organization_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Return true if user is listed in org_admin_links OR is the owner on organizations
    RETURN EXISTS (
        SELECT 1
        FROM public.org_admin_links
        WHERE organization_id = p_organization_id AND user_id = p_user_id
    )
    OR EXISTS (
        SELECT 1 FROM public.organizations WHERE id = p_organization_id AND owner_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Enable RLS for all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_admin_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.downtimes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Policies for PROFILES
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
-- Allow authenticated users to create their own profile rows
CREATE POLICY "Users can create their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Policies for ORGANIZATIONS
CREATE POLICY "All users can view organizations" ON public.organizations FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create organizations" ON public.organizations FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Owners can update their own organizations" ON public.organizations FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Owners can delete their own organizations" ON public.organizations FOR DELETE USING (auth.uid() = owner_id);

-- Policies for DESTINATIONS
CREATE POLICY "All users can view destinations" ON public.destinations FOR SELECT USING (true);
CREATE POLICY "Admins can create destinations for their org" ON public.destinations FOR INSERT WITH CHECK (is_org_admin(organization_id, auth.uid()));
CREATE POLICY "Admins can update destinations" ON public.destinations FOR UPDATE USING (is_org_admin(organization_id, auth.uid()));
CREATE POLICY "Admins can delete destinations" ON public.destinations FOR DELETE USING (is_org_admin(organization_id, auth.uid()));

-- Policies for CIRCLES
CREATE POLICY "All users can view circles" ON public.circles FOR SELECT USING (true);
-- Allow authenticated users to create a circle. Preferably the client provides center_user_id = auth.uid().
CREATE POLICY "Authenticated users can create circles" ON public.circles FOR INSERT WITH CHECK (auth.role() = 'authenticated');
-- Only the circle center (owner) can update or delete their circle
CREATE POLICY "Circle owners can update" ON public.circles FOR UPDATE USING (auth.uid() = center_user_id);
CREATE POLICY "Circle owners can delete" ON public.circles FOR DELETE USING (auth.uid() = center_user_id);

-- Policies for BOOKINGS
CREATE POLICY "Users can create bookings" ON public.bookings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can see their own bookings" ON public.bookings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can see bookings for their destinations" ON public.bookings FOR SELECT USING (is_org_admin((SELECT organization_id FROM destinations WHERE id = destination_id), auth.uid()));

-- Add more policies for Circles, Slots, Events etc. as needed following the same pattern.

-- -------------- SLOTS POLICIES (merged)
-- Allow anyone to read slots (optional; change to more restrictive if desired)
CREATE POLICY "All users can view slots" ON public.slots
    FOR SELECT USING (true);

-- Allow org admins (and org owners) to create slots for destinations in their org
CREATE POLICY "Admins can create slots for their destination" ON public.slots
    FOR INSERT WITH CHECK (
        is_org_admin((SELECT organization_id FROM public.destinations WHERE id = destination_id), auth.uid())
    );

-- Allow org admins to update slots belonging to their destinations
CREATE POLICY "Admins can update slots" ON public.slots
    FOR UPDATE USING (
        is_org_admin((SELECT organization_id FROM public.destinations WHERE id = destination_id), auth.uid())
    );

-- Allow org admins to delete slots belonging to their destinations
CREATE POLICY "Admins can delete slots" ON public.slots
    FOR DELETE USING (
        is_org_admin((SELECT organization_id FROM public.destinations WHERE id = destination_id), auth.uid())
    );

-- -------------- ORG INVITES & ADMIN LINKS POLICIES (merged)
ALTER TABLE public.org_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins can view invites" ON public.org_invites
    FOR SELECT USING (
        is_org_admin(organization_id, auth.uid())
    );

CREATE POLICY "Org admins can create invites" ON public.org_invites
    FOR INSERT WITH CHECK (
        is_org_admin(organization_id, auth.uid())
    );

CREATE POLICY "Org admins can update invites" ON public.org_invites
    FOR UPDATE USING (
        is_org_admin(organization_id, auth.uid())
    );

CREATE POLICY "Org admins can delete invites" ON public.org_invites
    FOR DELETE USING (
        is_org_admin(organization_id, auth.uid())
    );

ALTER TABLE public.org_admin_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins can view admin links" ON public.org_admin_links
    FOR SELECT USING (
        is_org_admin(organization_id, auth.uid())
    );

CREATE POLICY "Org admins can create admin links" ON public.org_admin_links
    FOR INSERT WITH CHECK (
        is_org_admin(organization_id, auth.uid())
    );

CREATE POLICY "Org admins can update admin links" ON public.org_admin_links
    FOR UPDATE USING (
        is_org_admin(organization_id, auth.uid())
    );

CREATE POLICY "Org admins can delete admin links" ON public.org_admin_links
    FOR DELETE USING (
        is_org_admin(organization_id, auth.uid())
    );
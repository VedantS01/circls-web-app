# Circles — API Endpoints (Frontend reference)

This document lists the RESTful endpoints the frontend interacts with. Supabase auto-generated REST APIs handle most CRUD; a few custom RPCs may be created as Edge Functions or SQL functions.

Auth

- POST /auth/v1/otp — Supabase built-in: send OTP to a phone number to begin authentication flow.

- POST /auth/v1/token?grant_type=phone — Supabase built-in: exchange OTP for a session token (sign in/up).

- POST /auth/v1/logout — Supabase built-in: sign the current user out.

Profiles

- GET /rest/v1/profiles?id=eq.{user_id} — Get a user's public profile.

- PATCH /rest/v1/profiles?id=eq.{user_id} — Update current user's profile (name, avatar, phone_confirmed flag).

Organizations

- POST /rest/v1/organizations — Create a new organization (owner_id required).

- GET /rest/v1/organizations?owner_id=eq.{user_id} — Get organizations owned by user.

- PATCH /rest/v1/organizations?id=eq.{org_id} — Update organization details.

Destinations

- GET /rest/v1/destinations — List destinations. Supports filters (e.g. ?type=eq.Tennis).

- GET /rest/v1/destinations?id=eq.{dest_id} — Get destination details.

- POST /rest/v1/destinations — Admin: create a destination for an organization.

- PATCH /rest/v1/destinations?id=eq.{dest_id} — Admin: update destination.

- DELETE /rest/v1/destinations?id=eq.{dest_id} — Admin: delete destination.

Slots, Events & Availability

- GET /rest/v1/destinations?id=eq.{dest_id}&select=*,slots(*),events(*) — Get a destination and related slots and events.

- POST /rest/v1/slots — Admin: create recurring slot.

- POST /rest/v1/events — Admin: create one-off event.

- GET /rpc/get_availability — Custom RPC: compute availability for a destination on a date taking into account bookings and downtimes.

Bookings

- POST /rest/v1/bookings — Create a booking for a slot or event.

- GET /rest/v1/bookings?user_id=eq.{user_id} — Get user's bookings.

- GET /rest/v1/bookings?destination_id=eq.{dest_id} — Admin: get bookings for a destination.

- PATCH /rest/v1/bookings?id=eq.{booking_id} — Update booking status (e.g. cancel).

Notes

- Supabase's row-level security (RLS) and policies should be configured so that only verified users can create bookings or organizations. Consider adding a `phone_confirmed` boolean on `profiles` to gate actions.

- For availability logic that requires collisions and recurrence handling, implement a Postgres function `get_availability(destination_id, date)` and expose it via RPC.

- Edge Functions can be used for actions that require server-side secrets (payment processing, webhooks) or complex business logic.

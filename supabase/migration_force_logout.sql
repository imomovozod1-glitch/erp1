-- =============================================================================
-- FORCE-LOGOUT ON ADMIN-INITIATED PASSWORD RESET
-- Safe to run multiple times.
--
-- Problem: Supabase's admin.updateUserById({ password }) revokes the user's
-- refresh token server-side, but their currently-held access token (a
-- stateless JWT, ~1h TTL) keeps working until it naturally expires — so a
-- tenant whose password the super-admin just reset stays logged in for up
-- to an hour instead of being kicked out immediately.
--
-- Fix: a `force_logout_at` marker on `profiles`, set by the admin-panel
-- password-reset route (src/app/api/admin/tenants/[id]/reset-password/route.ts)
-- every time it resets a password. The app's own middleware
-- (src/lib/supabase/middleware.ts) compares this against `user.last_sign_in_at`
-- on every request — if the marker is newer than the user's last real sign-in,
-- their session is force-signed-out and they're redirected to /login,
-- regardless of how long their access token has left to live.
-- =============================================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS force_logout_at TIMESTAMPTZ;

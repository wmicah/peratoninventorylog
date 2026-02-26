/**
 * Supabase client with service role. Use only on the server (e.g. Server Actions, API routes).
 * Bypasses RLS. Required for creating users and admin profiles.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (typeof window !== "undefined") {
  throw new Error("supabase-admin must not be used in the browser");
}

export const supabaseAdmin =
  url && serviceRoleKey
    ? createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
    : null;

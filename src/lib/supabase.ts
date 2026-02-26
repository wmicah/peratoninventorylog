import { createBrowserClient } from "@supabase/ssr"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

if (!supabaseUrl || !supabaseAnonKey) {
	console.warn(
		"Supabase credentials are missing. Please add them to your .env file.",
	)
}

/** Browser client that stores auth in cookies so the server can read the session (e.g. getOrCreateProfile). */
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)

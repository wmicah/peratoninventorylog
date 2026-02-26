"use server"

import { createServerSupabase } from "@/lib/supabase-server"
import { supabaseAdmin } from "@/lib/supabase-admin"

/** Update admin notes for a submitted audit session. Admin only. */
export async function updateSessionAdminNotes(
	sessionId: string,
	adminNotes: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
	const supabase = await createServerSupabase()
	if (!supabase) return { ok: false, error: "Not available" }

	const {
		data: { user },
	} = await supabase.auth.getUser()
	if (!user) return { ok: false, error: "Not signed in" }

	const { data: profile } = await supabase
		.from("profiles")
		.select("role")
		.eq("id", user.id)
		.single()
	if (profile?.role !== "admin")
		return { ok: false, error: "Only admins can add audit notes" }

	const admin = supabaseAdmin
	if (!admin)
		return { ok: false, error: "Service unavailable. Try again later." }

	const { error } = await admin
		.from("sessions")
		.update({ admin_notes: adminNotes ?? null })
		.eq("id", sessionId)

	if (error) return { ok: false, error: error.message }
	return { ok: true }
}

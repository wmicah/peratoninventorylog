"use server"

import { isSuperAdminEmail } from "@/lib/super-admin"
import { createServerSupabase } from "@/lib/supabase-server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { getProfile } from "@/app/actions/auth"

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

const FIVE_YEARS_MS = 5 * 365.25 * 24 * 60 * 60 * 1000

/** Delete sessions (audit logs) older than 5 years. Admin or super admin only. Uses submitted_at for submitted sessions, created_at for drafts. Returns count of deleted rows. */
export async function purgeSessionsOlderThan5Years(): Promise<
	{ ok: true; deleted: number } | { ok: false; error: string }
> {
	const supabase = await createServerSupabase()
	if (!supabase) return { ok: false, error: "Not available" }

	const {
		data: { user },
	} = await supabase.auth.getUser()
	if (!user) return { ok: false, error: "Not signed in" }

	const profile = await getProfile()
	if (!profile) return { ok: false, error: "Profile not found" }
	if (profile.role !== "admin" && !isSuperAdminEmail(user.email))
		return { ok: false, error: "Only admins can purge old data" }

	const admin = supabaseAdmin
	if (!admin) return { ok: false, error: "Service unavailable" }

	const cutoff = new Date(Date.now() - FIVE_YEARS_MS).toISOString()

	// Delete submitted sessions where submitted_at < cutoff
	const { data: submittedRows, error: subErr } = await admin
		.from("sessions")
		.select("id")
		.not("submitted_at", "is", null)
		.lt("submitted_at", cutoff)

	if (subErr) return { ok: false, error: subErr.message }

	// Delete draft sessions where created_at < cutoff
	const { data: draftRows, error: draftErr } = await admin
		.from("sessions")
		.select("id")
		.is("submitted_at", null)
		.lt("created_at", cutoff)

	if (draftErr) return { ok: false, error: draftErr.message }

	const idsToDelete = [
		...(submittedRows ?? []).map((r) => r.id),
		...(draftRows ?? []).map((r) => r.id),
	]
	// Dedupe (shouldn't overlap)
	const uniqueIds = [...new Set(idsToDelete)]
	if (uniqueIds.length === 0) return { ok: true, deleted: 0 }

	const { error: delErr } = await admin
		.from("sessions")
		.delete()
		.in("id", uniqueIds)

	if (delErr) return { ok: false, error: delErr.message }
	return { ok: true, deleted: uniqueIds.length }
}

"use server"

import { isSuperAdminEmail } from "@/lib/super-admin"
import { createServerSupabase } from "@/lib/supabase-server"
import { supabaseAdmin } from "@/lib/supabase-admin"

function isAdminOrSuperAdmin(
	profileRole: string | undefined,
	userEmail: string | undefined,
): boolean {
	if (profileRole === "admin") return true
	return isSuperAdminEmail(userEmail)
}

/** Create many badges for a site in one go. Admin or super admin only. */
export async function createBadges(
	siteId: string,
	badges: { code: string; categoryId: string }[],
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
	const supabase = await createServerSupabase()
	if (!supabase) return { ok: false, error: "Server not configured" }

	const {
		data: { user },
	} = await supabase.auth.getUser()
	if (!user) return { ok: false, error: "Not signed in" }

	const { data: profile } = await supabase
		.from("profiles")
		.select("role")
		.eq("id", user.id)
		.single()
	if (!isAdminOrSuperAdmin(profile?.role, user.email))
		return { ok: false, error: "Only admins can add badges" }

	const admin = supabaseAdmin
	if (!admin) return { ok: false, error: "Server missing service role key" }

	if (badges.length === 0) return { ok: false, error: "No badges to add" }
	if (badges.length > 2000)
		return { ok: false, error: "Maximum 2000 badges per import" }

	const rows = badges.map((b) => ({
		id: crypto.randomUUID(),
		code: b.code.trim(),
		site_id: siteId,
		category_id: b.categoryId,
		active: true,
		display_number: null,
	}))

	const { error } = await admin.from("badges").insert(rows)
	if (error) return { ok: false, error: error.message }
	return { ok: true, count: rows.length }
}

/** Update a badge's active-for-inventory flag and/or display number. Admin or super admin only. */
export async function updateBadge(
	badgeId: string,
	updates: { active?: boolean; displayNumber?: number | null },
): Promise<{ ok: true } | { ok: false; error: string }> {
	const supabase = await createServerSupabase()
	if (!supabase) return { ok: false, error: "Server not configured" }

	const {
		data: { user },
	} = await supabase.auth.getUser()
	if (!user) return { ok: false, error: "Not signed in" }

	const { data: profile } = await supabase
		.from("profiles")
		.select("role")
		.eq("id", user.id)
		.single()
	if (!isAdminOrSuperAdmin(profile?.role, user.email))
		return { ok: false, error: "Only admins can update badges" }

	const admin = supabaseAdmin
	if (!admin) return { ok: false, error: "Server missing service role key" }

	const payload: { active?: boolean; display_number?: number | null } = {}
	if (typeof updates.active === "boolean") payload.active = updates.active
	if (updates.displayNumber !== undefined)
		payload.display_number = updates.displayNumber

	if (Object.keys(payload).length === 0) return { ok: true }

	const { error } = await admin.from("badges").update(payload).eq("id", badgeId)

	if (error) return { ok: false, error: error.message }
	return { ok: true }
}

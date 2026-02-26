"use server"

import { isSuperAdminEmail } from "@/app/actions/auth"
import { createServerSupabase } from "@/lib/supabase-server"
import { supabaseAdmin } from "@/lib/supabase-admin"

function isAdminOrSuperAdmin(
	profileRole: string | undefined,
	userEmail: string | undefined,
): boolean {
	if (profileRole === "admin") return true
	return isSuperAdminEmail(userEmail)
}

/** Create a new facility. Admin or super admin. Site-wide: all admins and loggers see it. */
export async function createSite(data: {
	id: string
	name: string
	address?: string | null
}): Promise<{ ok: true } | { ok: false; error: string }> {
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
		return { ok: false, error: "Only admins can create facilities" }

	const admin = supabaseAdmin
	if (!admin) return { ok: false, error: "Server missing service role key" }

	const id = data.id.trim().toUpperCase().replace(/\s+/g, "-")
	const name = data.name.trim()
	const address = data.address?.trim() || null
	if (!id) return { ok: false, error: "Facility ID is required" }
	if (!name) return { ok: false, error: "Facility name is required" }

	const { error } = await admin.from("sites").insert({
		id,
		name,
		address,
	})
	if (error) {
		if (error.code === "23505")
			return { ok: false, error: "A facility with this ID already exists" }
		return { ok: false, error: error.message }
	}
	return { ok: true }
}

/** Update a site's name and/or address. Admin only. */
export async function updateSite(
	siteId: string,
	updates: { name?: string; address?: string | null },
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
		return { ok: false, error: "Only admins can edit sites" }

	const admin = supabaseAdmin
	if (!admin) return { ok: false, error: "Server missing service role key" }

	const payload: Record<string, string | null> = {}
	if (updates.name !== undefined) payload.name = updates.name.trim()
	if (updates.address !== undefined)
		payload.address = updates.address?.trim() || null
	if (Object.keys(payload).length === 0) return { ok: true }

	const { error } = await admin.from("sites").update(payload).eq("id", siteId)

	if (error) return { ok: false, error: error.message }
	return { ok: true }
}

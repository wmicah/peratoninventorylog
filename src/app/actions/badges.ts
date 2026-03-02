"use server"

import { isSuperAdminEmail } from "@/lib/super-admin"
import { createServerSupabase } from "@/lib/supabase-server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { getProfile } from "@/app/actions/auth"

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

/** Update a badge's active flag, display number, and/or deactivated reason. Admin or super admin only. */
export async function updateBadge(
	badgeId: string,
	updates: {
		active?: boolean
		displayNumber?: number | null
		deactivatedReason?: string | null
	},
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

	const payload: {
		active?: boolean
		display_number?: number | null
		deactivated_reason?: string | null
	} = {}
	if (typeof updates.active === "boolean") payload.active = updates.active
	if (updates.displayNumber !== undefined)
		payload.display_number = updates.displayNumber
	if (updates.deactivatedReason !== undefined)
		payload.deactivated_reason = updates.deactivatedReason?.trim() || null

	if (Object.keys(payload).length === 0) return { ok: true }

	const { error } = await admin.from("badges").update(payload).eq("id", badgeId)

	if (error) return { ok: false, error: error.message }
	return { ok: true }
}

/** Turn off (hide from inventory) all badges currently reported missing for a site. Officer or admin; officers only for their assigned sites. Missing is from the latest submitted run; it stays missing until a new inventory marks it present. */
export async function turnOffMissingBadgesForSite(
	siteId: string,
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
	const supabase = await createServerSupabase()
	if (!supabase) return { ok: false, error: "Server not configured" }

	const {
		data: { user },
	} = await supabase.auth.getUser()
	if (!user) return { ok: false, error: "Not signed in" }

	const profile = await getProfile()
	if (!profile) return { ok: false, error: "Profile not found" }

	const isAdmin = isSuperAdminEmail(user.email) || profile.role === "admin"
	const canAccessSite =
		isAdmin || (profile.assigned_site_ids ?? []).includes(siteId)
	if (!canAccessSite)
		return { ok: false, error: "You do not have access to this facility" }

	const admin = supabaseAdmin
	if (!admin) return { ok: false, error: "Server missing service role key" }

	// Latest submitted, non-superseded session for this site
	const { data: sessions, error: sessError } = await admin
		.from("sessions")
		.select("id, items")
		.eq("site_id", siteId)
		.eq("status", "submitted")
		.eq("is_superseded", false)
		.not("submitted_at", "is", null)
		.order("submitted_at", { ascending: false })
		.limit(1)

	if (sessError) return { ok: false, error: sessError.message }
	const session = sessions?.[0]
	if (!session?.items || typeof session.items !== "object") {
		return { ok: true, count: 0 }
	}

	const items = session.items as Record<
		string,
		{ state?: string; guestName?: string; sponsorName?: string }
	>
	const missingBadgeIds = Object.entries(items)
		.filter(([, item]) => item?.state === "missing")
		.map(([badgeId]) => badgeId)
	if (missingBadgeIds.length === 0) return { ok: true, count: 0 }

	// Only update badges that belong to this site
	const { data: siteBadges, error: badgeError } = await admin
		.from("badges")
		.select("id")
		.eq("site_id", siteId)
		.in("id", missingBadgeIds)

	if (badgeError) return { ok: false, error: badgeError.message }
	const idsToUpdate = (siteBadges ?? []).map((b) => b.id)
	if (idsToUpdate.length === 0) return { ok: true, count: 0 }

	const { error: updateError } = await admin
		.from("badges")
		.update({ active: false })
		.in("id", idsToUpdate)

	if (updateError) return { ok: false, error: updateError.message }
	return { ok: true, count: idsToUpdate.length }
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

/** Run on admin login/dashboard: turn off any badges that have been missing for 7+ days (from latest submitted run per site). Returns list of what was turned off so the client can show a one-time notification. */
export async function runAutoOffWeekOldMissing(): Promise<
	| {
			ok: true
			turnedOff: {
				badgeId: string
				code: string
				siteId: string
				siteName: string
			}[]
	  }
	| { ok: false; error: string }
> {
	const supabase = await createServerSupabase()
	if (!supabase) return { ok: false, error: "Server not configured" }

	const {
		data: { user },
	} = await supabase.auth.getUser()
	if (!user) return { ok: false, error: "Not signed in" }

	const profile = await getProfile()
	if (!profile) return { ok: false, error: "Profile not found" }
	if (profile.role !== "admin" && !isSuperAdminEmail(user.email))
		return { ok: true, turnedOff: [] }

	const admin = supabaseAdmin
	if (!admin) return { ok: false, error: "Server missing service role key" }

	const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS_MS).toISOString()

	const { data: sessions, error: sessError } = await admin
		.from("sessions")
		.select("id, site_id, submitted_at, items")
		.eq("status", "submitted")
		.eq("is_superseded", false)
		.not("submitted_at", "is", null)
		.order("submitted_at", { ascending: false })

	if (sessError) return { ok: false, error: sessError.message }

	// Latest session per site (first in list per site_id since ordered by submitted_at desc)
	const latestBySite = new Map<
		string,
		{ submitted_at: string; items: Record<string, { state?: string }> }
	>()
	for (const s of sessions ?? []) {
		if (!latestBySite.has(s.site_id))
			latestBySite.set(s.site_id, {
				submitted_at: s.submitted_at!,
				items: (s.items as Record<string, { state?: string }>) ?? {},
			})
	}

	// Only consider sessions that are 7+ days old
	for (const [siteId, data] of latestBySite) {
		if (data.submitted_at >= sevenDaysAgo) latestBySite.delete(siteId)
	}

	const { data: sites } = await admin.from("sites").select("id, name")
	const siteNames = new Map((sites ?? []).map((s) => [s.id, s.name as string]))

	const turnedOff: {
		badgeId: string
		code: string
		siteId: string
		siteName: string
	}[] = []
	for (const [siteId, { items }] of latestBySite) {
		const missingBadgeIds = Object.entries(items)
			.filter(([, item]) => item?.state === "missing")
			.map(([badgeId]) => badgeId)
		if (missingBadgeIds.length === 0) continue

		const { data: badges } = await admin
			.from("badges")
			.select("id, code")
			.eq("site_id", siteId)
			.in("id", missingBadgeIds)
			.eq("active", true)

		for (const b of badges ?? []) {
			const { error: upErr } = await admin
				.from("badges")
				.update({ active: false })
				.eq("id", b.id)
			if (!upErr) {
				turnedOff.push({
					badgeId: b.id,
					code: b.code,
					siteId,
					siteName: siteNames.get(siteId) ?? siteId,
				})
			}
		}
	}

	return { ok: true, turnedOff }
}

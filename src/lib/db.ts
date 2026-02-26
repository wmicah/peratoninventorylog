/**
 * Supabase persistence layer for Peraton Inventory MVP.
 * When NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set,
 * the app can hydrate from and sync to the database.
 */

import { supabase } from "@/lib/supabase"
import type { Session, SessionItem, Badge, Category } from "@/lib/store"

const hasSupabase = () => {
	if (typeof window === "undefined") return false
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL
	const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
	return Boolean(url && key && url.length > 0 && key.length > 0)
}

export type SiteRow = {
	id: string
	name: string
	address?: string | null
	time_zone?: string | null
}
export type CategoryRow = { id: string; name: string }
export type BadgeRow = {
	id: string
	code: string
	site_id: string
	category_id: string
	active: boolean
	display_number: number | null
	created_at: string
}
export type SessionRow = {
	id: string
	site_id: string
	created_at: string
	submitted_at: string | null
	created_by: string
	status: "draft" | "submitted"
	is_superseded: boolean
	superseded_by: string | null
	replaces: string | null
	items: Record<string, SessionItem>
	/** Add in Supabase if missing: ALTER TABLE sessions ADD COLUMN IF NOT EXISTS admin_notes TEXT; */
	admin_notes: string | null
}

export async function fetchSites(): Promise<SiteRow[]> {
	if (!hasSupabase()) return []
	const { data, error } = await supabase
		.from("sites")
		.select("id, name, address, time_zone")
		.order("id")
	if (error) {
		console.warn("[db] fetchSites error:", error.message)
		return []
	}
	return (data ?? []).map((r) => ({
		id: r.id,
		name: r.name,
		address: r.address ?? null,
		timeZone: r.time_zone ?? null,
	}))
}

export async function fetchCategories(): Promise<CategoryRow[]> {
	if (!hasSupabase()) return []
	const { data, error } = await supabase
		.from("categories")
		.select("id, name")
		.order("id")
	if (error) {
		console.warn("[db] fetchCategories error:", error.message)
		return []
	}
	return (data ?? []).map((r) => ({ id: r.id, name: r.name }))
}

export async function fetchBadges(): Promise<BadgeRow[]> {
	if (!hasSupabase()) return []
	const { data, error } = await supabase
		.from("badges")
		.select(
			"id, code, site_id, category_id, active, display_number, created_at",
		)
		.order("code")
	if (error) {
		console.warn("[db] fetchBadges error:", error.message)
		return []
	}
	return (data ?? []).map((r) => ({
		id: r.id,
		code: r.code,
		site_id: r.site_id,
		category_id: r.category_id,
		active: r.active ?? true,
		display_number: r.display_number ?? null,
		created_at: r.created_at ?? new Date().toISOString(),
	}))
}

/** Map DB badge rows to app Badge shape (e.g. for setBadges after refetch). */
export function badgeRowsToBadges(rows: BadgeRow[]): Badge[] {
	return rows.map((b) => ({
		id: b.id,
		code: b.code,
		siteId: b.site_id,
		categoryId: b.category_id,
		active: b.active,
		displayNumber: b.display_number ?? undefined,
		createdAt: b.created_at,
	}))
}

export async function fetchSessions(): Promise<SessionRow[]> {
	if (!hasSupabase()) return []
	const { data, error } = await supabase
		.from("sessions")
		.select("*")
		.order("created_at", { ascending: false })
	if (error) {
		console.warn("[db] fetchSessions error:", error.message)
		return []
	}
	return (data ?? []).map((r) => ({
		id: r.id,
		site_id: r.site_id,
		created_at: r.created_at,
		submitted_at: r.submitted_at,
		created_by: r.created_by,
		status: r.status,
		is_superseded: r.is_superseded ?? false,
		superseded_by: r.superseded_by ?? null,
		replaces: r.replaces ?? null,
		items: (r.items as Record<string, SessionItem>) ?? {},
		admin_notes: r.admin_notes ?? null,
	}))
}

/** Convert DB session row to app Session shape */
export function sessionRowToSession(row: SessionRow): Session {
	return {
		id: row.id,
		siteId: row.site_id,
		createdAt: row.created_at,
		submittedAt: row.submitted_at ?? undefined,
		createdBy: row.created_by,
		status: row.status,
		isSuperseded: row.is_superseded,
		supersededBy: row.superseded_by ?? undefined,
		replaces: row.replaces ?? undefined,
		items: row.items,
		adminNotes: row.admin_notes ?? undefined,
	}
}

/** Hydrate store from Supabase. Call once on app load if using DB. */
export async function hydrateFromSupabase(store: {
	setSites: (
		sites: {
			id: string
			name: string
			address?: string | null
		}[],
	) => void
	setCategories: (categories: Category[]) => void
	setBadges: (badges: Badge[]) => void
	setSessions: (sessions: Record<string, Session>) => void
}) {
	if (!hasSupabase()) return
	const [sites, categories, badgeRows, sessionRows] = await Promise.all([
		fetchSites(),
		fetchCategories(),
		fetchBadges(),
		fetchSessions(),
	])
	store.setSites(sites)
	store.setCategories(categories)
	store.setBadges(
		badgeRows.map((b) => ({
			id: b.id,
			code: b.code,
			siteId: b.site_id,
			categoryId: b.category_id,
			active: b.active,
			displayNumber: b.display_number ?? undefined,
			createdAt: b.created_at,
		})),
	)
	const sessionsMap: Record<string, Session> = {}
	sessionRows.forEach((r) => {
		sessionsMap[r.id] = sessionRowToSession(r)
	})
	store.setSessions(sessionsMap)
}

export async function persistSession(session: Session): Promise<boolean> {
	if (!hasSupabase()) return false
	const { error } = await supabase.from("sessions").upsert(
		{
			id: session.id,
			site_id: session.siteId,
			created_at: session.createdAt,
			submitted_at: session.submittedAt ?? null,
			created_by: session.createdBy,
			status: session.status,
			is_superseded: session.isSuperseded,
			superseded_by: session.supersededBy ?? null,
			replaces: session.replaces ?? null,
			items: session.items,
			admin_notes: session.adminNotes ?? null,
		},
		{ onConflict: "id" },
	)
	if (error) {
		console.warn("[db] persistSession error:", error.message)
		return false
	}
	return true
}

export async function persistBadge(badge: Badge): Promise<boolean> {
	if (!hasSupabase()) return false
	const { error } = await supabase.from("badges").upsert(
		{
			id: badge.id,
			code: badge.code,
			site_id: badge.siteId,
			category_id: badge.categoryId,
			active: badge.active ?? true,
			display_number: badge.displayNumber ?? null,
		},
		{ onConflict: "id" },
	)
	if (error) {
		console.warn("[db] persistBadge error:", error.message)
		return false
	}
	return true
}

export async function deleteBadgeFromDb(badgeId: string): Promise<boolean> {
	if (!hasSupabase()) return false
	const { error } = await supabase.from("badges").delete().eq("id", badgeId)
	if (error) {
		console.warn("[db] deleteBadge error:", error.message)
		return false
	}
	return true
}

export function isDbConfigured(): boolean {
	return hasSupabase()
}

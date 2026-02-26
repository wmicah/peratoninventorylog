"use server"

import { createClient } from "@supabase/supabase-js"
import { createServerSupabase } from "@/lib/supabase-server"
import { supabaseAdmin } from "@/lib/supabase-admin"

export type Profile = {
	id: string
	email: string
	full_name: string
	role: "admin" | "logger"
	assigned_site_ids: string[]
}

/** Get current user's profile (call after auth). Returns null if no profile. */
export async function getProfile(): Promise<Profile | null> {
	const supabase = await createServerSupabase()
	if (!supabase) return null

	const {
		data: { user },
	} = await supabase.auth.getUser()
	if (!user) return null

	const { data } = await supabase
		.from("profiles")
		.select("id, email, full_name, role, assigned_site_ids")
		.eq("id", user.id)
		.single()

	if (data) {
		return {
			id: data.id,
			email: data.email,
			full_name: data.full_name,
			role: data.role as "admin" | "logger",
			assigned_site_ids: data.assigned_site_ids ?? [],
		}
	}

	// Fallback: profile exists in DB but anon read failed. Fetch with service role for this user only.
	if (supabaseAdmin) {
		const { data: adminData } = await supabaseAdmin
			.from("profiles")
			.select("id, email, full_name, role, assigned_site_ids")
			.eq("id", user.id)
			.single()
		if (adminData) {
			return {
				id: adminData.id,
				email: adminData.email,
				full_name: adminData.full_name,
				role: adminData.role as "admin" | "logger",
				assigned_site_ids: adminData.assigned_site_ids ?? [],
			}
		}
	}

	// First-time: if this user is the super admin, create their admin profile
	const superAdminEmail =
		process.env.SUPABASE_SUPER_ADMIN_EMAIL?.trim().toLowerCase()
	const userEmail = user.email?.trim().toLowerCase()
	if (superAdminEmail && userEmail === superAdminEmail) {
		const admin = supabaseAdmin
		if (admin) {
			await admin.from("profiles").insert({
				id: user.id,
				email: user.email!,
				full_name: user.user_metadata?.full_name ?? user.email!.split("@")[0],
				role: "admin",
				assigned_site_ids: [],
			})
			const { data: newProfile } = await supabase
				.from("profiles")
				.select("id, email, full_name, role, assigned_site_ids")
				.eq("id", user.id)
				.single()
			if (newProfile)
				return {
					id: newProfile.id,
					email: newProfile.email,
					full_name: newProfile.full_name,
					role: newProfile.role as "admin" | "logger",
					assigned_site_ids: newProfile.assigned_site_ids ?? [],
				}
		}
	}

	return null
}

export type GetOrCreateProfileResult =
	| { ok: true; profile: Profile }
	| { ok: false; error: string }

/**
 * Get or create profile for the currently signed-in user.
 * Tries cookies first; if no session, uses the passed-in session (so login works even when cookies aren't available yet).
 */
export async function getOrCreateProfile(sessionFromClient?: {
	access_token: string
	refresh_token: string
}): Promise<GetOrCreateProfileResult> {
	// 1) Try server session from cookies
	const fromCookies = await getProfile()
	if (fromCookies) return { ok: true, profile: fromCookies }

	// 2) If client just signed in, cookies may not be on the server yet – use session they pass
	if (!sessionFromClient?.access_token || !sessionFromClient?.refresh_token)
		return {
			ok: false,
			error: "No session (missing token). Try signing in again.",
		}

	const url = process.env.NEXT_PUBLIC_SUPABASE_URL
	const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
	if (!url || !anonKey)
		return { ok: false, error: "Sign-in is unavailable. Try again later." }

	const supabase = createClient(url, anonKey, {
		auth: { persistSession: false },
	})
	const {
		data: { session },
		error: sessionError,
	} = await supabase.auth.setSession({
		access_token: sessionFromClient.access_token,
		refresh_token: sessionFromClient.refresh_token,
	})
	if (sessionError)
		return { ok: false, error: "Session invalid. Please sign in again." }
	if (!session?.user) return { ok: false, error: "Sign-in failed. Try again." }

	const user = session.user

	// Fetch existing profile (RLS: user can read own)
	const { data } = await supabase
		.from("profiles")
		.select("id, email, full_name, role, assigned_site_ids")
		.eq("id", user.id)
		.single()

	if (data) {
		return {
			ok: true,
			profile: {
				id: data.id,
				email: data.email,
				full_name: data.full_name,
				role: data.role as "admin" | "logger",
				assigned_site_ids: data.assigned_site_ids ?? [],
			},
		}
	}

	// Fallback: profile exists in DB but anon read failed (e.g. RLS/session). Fetch with service role for this user only.
	if (supabaseAdmin) {
		const { data: adminData } = await supabaseAdmin
			.from("profiles")
			.select("id, email, full_name, role, assigned_site_ids")
			.eq("id", user.id)
			.single()
		if (adminData) {
			return {
				ok: true,
				profile: {
					id: adminData.id,
					email: adminData.email,
					full_name: adminData.full_name,
					role: adminData.role as "admin" | "logger",
					assigned_site_ids: adminData.assigned_site_ids ?? [],
				},
			}
		}
	}

	// Create super admin profile if email matches
	const superAdminEmail =
		process.env.SUPABASE_SUPER_ADMIN_EMAIL?.trim().toLowerCase()
	const userEmail = user.email?.trim().toLowerCase()
	if (!superAdminEmail || userEmail !== superAdminEmail)
		return {
			ok: false,
			error: "No account found. Contact your administrator.",
		}
	if (!supabaseAdmin)
		return {
			ok: false,
			error: "Sign-in is unavailable. Try again later.",
		}

	const { error: insertError } = await supabaseAdmin.from("profiles").insert({
		id: user.id,
		email: user.email!,
		full_name: user.user_metadata?.full_name ?? user.email!.split("@")[0],
		role: "admin",
		assigned_site_ids: [],
	})

	// If duplicate (e.g. profile was created between select and insert), fetch it
	if (insertError?.code === "23505") {
		const { data: existing } = await supabaseAdmin
			.from("profiles")
			.select("id, email, full_name, role, assigned_site_ids")
			.eq("id", user.id)
			.single()
		if (existing)
			return {
				ok: true,
				profile: {
					id: existing.id,
					email: existing.email,
					full_name: existing.full_name,
					role: existing.role as "admin" | "logger",
					assigned_site_ids: existing.assigned_site_ids ?? [],
				},
			}
	}
	if (insertError)
		return {
			ok: false,
			error: "Could not complete sign-in. Try again later.",
		}

	// Read back with admin so we don't depend on RLS
	const { data: newProfile } = await supabaseAdmin
		.from("profiles")
		.select("id, email, full_name, role, assigned_site_ids")
		.eq("id", user.id)
		.single()
	if (newProfile)
		return {
			ok: true,
			profile: {
				id: newProfile.id,
				email: newProfile.email,
				full_name: newProfile.full_name,
				role: newProfile.role as "admin" | "logger",
				assigned_site_ids: newProfile.assigned_site_ids ?? [],
			},
		}
	return {
		ok: false,
		error: "Sign-in completed but something went wrong. Try again.",
	}
}

/** Create a logger account. Only callable by an admin. Returns { ok: true, tempPassword } or { ok: false, error }. */
export async function createLoggerAccount(formData: {
	email: string
	full_name: string
	password: string
	assigned_site_ids: string[]
}): Promise<
	{ ok: true; tempPassword?: string } | { ok: false; error: string }
> {
	const supabase = await createServerSupabase()
	if (!supabase)
		return { ok: false, error: "Service unavailable. Try again later." }

	const {
		data: { user: caller },
	} = await supabase.auth.getUser()
	if (!caller) return { ok: false, error: "Not signed in" }

	const { data: callerProfile } = await supabase
		.from("profiles")
		.select("role")
		.eq("id", caller.id)
		.single()
	const superAdminEmail =
		process.env.SUPABASE_SUPER_ADMIN_EMAIL?.trim().toLowerCase()
	const isSuperAdmin =
		!!superAdminEmail && caller.email?.toLowerCase() === superAdminEmail
	const isAdmin = callerProfile?.role === "admin" || isSuperAdmin
	if (!isAdmin)
		return { ok: false, error: "You don't have permission to do that." }

	const admin = supabaseAdmin
	if (!admin)
		return { ok: false, error: "Service unavailable. Try again later." }

	const { data: newUser, error: createError } =
		await admin.auth.admin.createUser({
			email: formData.email.trim(),
			password: formData.password,
			email_confirm: true,
		})
	if (createError) return { ok: false, error: createError.message }
	if (!newUser.user) return { ok: false, error: "User not created" }

	const { error: profileError } = await admin.from("profiles").insert({
		id: newUser.user.id,
		email: formData.email.trim(),
		full_name: formData.full_name.trim(),
		role: "logger",
		assigned_site_ids: formData.assigned_site_ids,
		created_by: caller.id,
	})
	if (profileError) {
		await admin.auth.admin.deleteUser(newUser.user.id)
		return { ok: false, error: profileError.message }
	}

	return { ok: true }
}

/** Create an admin account. Only callable by the super admin (env SUPABASE_SUPER_ADMIN_EMAIL). */
export async function createAdminAccount(formData: {
	email: string
	full_name: string
	password: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
	const supabase = await createServerSupabase()
	if (!supabase)
		return { ok: false, error: "Service unavailable. Try again later." }

	const {
		data: { user: caller },
	} = await supabase.auth.getUser()
	if (!caller?.email) return { ok: false, error: "Not signed in" }

	const superAdminEmail =
		process.env.SUPABASE_SUPER_ADMIN_EMAIL?.trim().toLowerCase()
	if (!superAdminEmail || caller.email.toLowerCase() !== superAdminEmail)
		return {
			ok: false,
			error: "You don't have permission to create admin accounts.",
		}

	const admin = supabaseAdmin
	if (!admin)
		return { ok: false, error: "Service unavailable. Try again later." }

	const { data: newUser, error: createError } =
		await admin.auth.admin.createUser({
			email: formData.email.trim(),
			password: formData.password,
			email_confirm: true,
		})
	if (createError) return { ok: false, error: createError.message }
	if (!newUser.user) return { ok: false, error: "User not created" }

	const { error: profileError } = await admin.from("profiles").insert({
		id: newUser.user.id,
		email: formData.email.trim(),
		full_name: formData.full_name.trim(),
		role: "admin",
		assigned_site_ids: [], // admins typically get all sites in the app
		created_by: caller.id,
	})
	if (profileError) {
		await admin.auth.admin.deleteUser(newUser.user.id)
		return { ok: false, error: profileError.message }
	}

	return { ok: true }
}

/** True if the current user is the super admin (only one who can create admin accounts). */
export async function getIsSuperAdmin(): Promise<boolean> {
	const supabase = await createServerSupabase()
	if (!supabase) return false
	const {
		data: { user },
	} = await supabase.auth.getUser()
	const email = user?.email?.trim().toLowerCase()
	const superAdmin =
		process.env.SUPABASE_SUPER_ADMIN_EMAIL?.trim().toLowerCase()
	return Boolean(superAdmin && email && email === superAdmin)
}

/** List all logger profiles. Admins only. */
export async function listLoggers(): Promise<Profile[] | null> {
	const supabase = await createServerSupabase()
	if (!supabase) return null

	const {
		data: { user },
	} = await supabase.auth.getUser()
	if (!user) return null

	const { data: myProfile } = await supabase
		.from("profiles")
		.select("role")
		.eq("id", user.id)
		.single()
	const superAdminEmail =
		process.env.SUPABASE_SUPER_ADMIN_EMAIL?.trim().toLowerCase()
	const isSuperAdmin =
		!!superAdminEmail && user.email?.toLowerCase() === superAdminEmail
	if (myProfile?.role !== "admin" && !isSuperAdmin) return null

	const { data } = await supabase
		.from("profiles")
		.select("id, email, full_name, role, assigned_site_ids")
		.eq("role", "logger")
		.order("created_at", { ascending: false })

	return (data ?? []).map((r) => ({
		id: r.id,
		email: r.email,
		full_name: r.full_name,
		role: r.role as "admin" | "logger",
		assigned_site_ids: r.assigned_site_ids ?? [],
	}))
}

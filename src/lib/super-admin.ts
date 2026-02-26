/** Super admin emails from env (comma- or newline-separated). Lowercase, trimmed, quotes stripped. */
export function getSuperAdminEmails(): Set<string> {
	const raw = process.env.SUPABASE_SUPER_ADMIN_EMAIL?.trim().toLowerCase() ?? ""
	if (!raw) return new Set()
	return new Set(
		raw
			.replace(/\s+/g, ",")
			.split(",")
			.map((e) => e.replace(/^["']|["']$/g, "").trim())
			.filter(Boolean),
	)
}

export function isSuperAdminEmail(email: string | undefined): boolean {
	if (!email) return false
	return getSuperAdminEmails().has(email.trim().toLowerCase())
}

import { AppState, Session, Badge } from "./store"
import { getInventoryDayString, DEFAULT_TIMEZONE } from "./time"

export function getLatestSubmittedSession(
	state: AppState,
	siteId: string,
): Session | undefined {
	const sessions = Object.values(state.sessions)
		.filter(
			(s) => s.siteId === siteId && s.status === "submitted" && !s.isSuperseded,
		)
		.sort(
			(a, b) =>
				new Date(b.submittedAt!).getTime() - new Date(a.submittedAt!).getTime(),
		)

	return sessions[0]
}

/** Latest submitted session for this site on the given local date (YYYY-MM-DD) in the site's timezone. */
export function getLatestSubmittedSessionForDate(
	state: AppState,
	siteId: string,
	dateStr: string,
): Session | undefined {
	const site = state.sites.find((s) => s.id === siteId)
	const tz = site?.timeZone ?? DEFAULT_TIMEZONE
	const sessions = Object.values(state.sessions)
		.filter(
			(s) =>
				s.siteId === siteId &&
				s.status === "submitted" &&
				!s.isSuperseded &&
				s.submittedAt &&
				getInventoryDayString(s.submittedAt, tz) === dateStr,
		)
		.sort(
			(a, b) =>
				new Date(b.submittedAt!).getTime() - new Date(a.submittedAt!).getTime(),
		)
	return sessions[0]
}

function getPreviousDateStr(dateStr: string): string {
	const [y, m, d] = dateStr.split("-").map(Number)
	const date = new Date(y, m - 1, d)
	date.setDate(date.getDate() - 1)
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

export function getPreviousSubmittedSession(
	state: AppState,
	siteId: string,
	currentSessionId: string,
): Session | undefined {
	const current = state.sessions[currentSessionId]
	if (!current) return undefined

	if (current.replaces) {
		return state.sessions[current.replaces]
	}

	// Fallback: finding the session submitted right before it
	const sessions = Object.values(state.sessions)
		.filter(
			(s) =>
				s.siteId === siteId &&
				s.status === "submitted" &&
				s.id !== currentSessionId,
		)
		.sort(
			(a, b) =>
				new Date(b.submittedAt!).getTime() - new Date(a.submittedAt!).getTime(),
		)

	// Return the first one that is strictly older
	const cTime = new Date(current.submittedAt!).getTime()
	return sessions.find((s) => new Date(s.submittedAt!).getTime() < cTime)
}

export interface HealthStats {
	missingCount: number
	presentCount: number
	totalCount: number
	newlyMissingCount: number
	resolvedCount: number
	missingList: { badge: Badge; guestName?: string; sponsorName?: string }[]
	latestSession?: Session
}

export function computeHealth(
	state: AppState,
	siteId: string,
	dateStr?: string,
): HealthStats {
	const siteBadges = state.badges.filter(
		(b) => b.siteId === siteId && b.active !== false,
	)
	const totalCount = siteBadges.length

	const latest = dateStr
		? getLatestSubmittedSessionForDate(state, siteId, dateStr)
		: getLatestSubmittedSession(state, siteId)
	if (!latest) {
		return {
			missingCount: 0,
			presentCount: 0,
			totalCount,
			newlyMissingCount: 0,
			resolvedCount: 0,
			missingList: [],
		}
	}

	let missingCount = 0
	let presentCount = 0
	const missingList: {
		badge: Badge
		guestName?: string
		sponsorName?: string
	}[] = []

	// Use the master list of badges for the site as the source of truth
	siteBadges.forEach((badge) => {
		const item = latest.items[badge.id]
		if (!item) return // Badge added after this session was created

		if (item.state === "missing") {
			missingCount++
			missingList.push({
				badge,
				guestName: item.guestName,
				sponsorName: item.sponsorName,
			})
		} else if (item.state === "present") {
			presentCount++
		}
	})

	const previous = dateStr
		? getLatestSubmittedSessionForDate(
				state,
				siteId,
				getPreviousDateStr(dateStr),
			)
		: getPreviousSubmittedSession(state, siteId, latest.id)
	let newlyMissingCount = 0
	let resolvedCount = 0

	if (previous) {
		Object.keys(latest.items).forEach((badgeId) => {
			const curState = latest.items[badgeId]?.state
			const prevState = previous.items[badgeId]?.state

			if (curState === "missing" && prevState !== "missing") newlyMissingCount++
			if (curState !== "missing" && prevState === "missing") resolvedCount++
		})
	} else {
		newlyMissingCount = missingCount // Everything missing is newly missing if no prior session
	}

	return {
		missingCount,
		presentCount,
		totalCount,
		newlyMissingCount,
		resolvedCount,
		missingList,
		latestSession: latest,
	}
}

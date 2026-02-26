/** Default timezone when site has none set (e.g. Eastern for HQ). */
export const DEFAULT_TIMEZONE = "America/New_York"

export function formatLocalTime(
	isoString: string,
	timeZone = DEFAULT_TIMEZONE,
	formatOptions?: Intl.DateTimeFormatOptions,
) {
	const dt = new Date(isoString)
	const options: Intl.DateTimeFormatOptions = formatOptions || {
		timeZone,
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
		timeZoneName: "short",
	}
	return new Intl.DateTimeFormat("en-US", options).format(dt)
}

export function formatTimeOnly(isoString: string, timeZone = DEFAULT_TIMEZONE) {
	return formatLocalTime(isoString, timeZone, {
		timeZone,
		hour: "numeric",
		minute: "2-digit",
		timeZoneName: "short",
	})
}

/** Returns the date as YYYY-MM-DD in the given timezone (for comparing with date inputs). */
export function getLocalDateString(
	isoString: string,
	timeZone = DEFAULT_TIMEZONE,
): string {
	const dt = new Date(isoString)
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(dt)
	const y = parts.find((p) => p.type === "year")!.value
	const m = parts.find((p) => p.type === "month")!.value
	const d = parts.find((p) => p.type === "day")!.value
	return `${y}-${m}-${d}`
}

/**
 * Inventory "day" is 8am–8am: the day starting at 8:00 AM on date D runs until 7:59:59 AM on D+1.
 * So a submission at 7:30 AM on Feb 26 counts as "Feb 25"; at 8:00 AM on Feb 26 counts as "Feb 26".
 * Returns YYYY-MM-DD for the start date of that window.
 */
export function getInventoryDayString(
	isoString: string,
	timeZone = DEFAULT_TIMEZONE,
): string {
	const dt = new Date(isoString)
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "numeric",
		hour12: false,
	}).formatToParts(dt)
	const y = parts.find((p) => p.type === "year")!.value
	const m = parts.find((p) => p.type === "month")!.value
	const d = parts.find((p) => p.type === "day")!.value
	const hour = parseInt(parts.find((p) => p.type === "hour")!.value, 10)
	if (hour < 8) {
		const prev = new Date(dt.getTime() - 24 * 60 * 60 * 1000)
		return getLocalDateString(prev.toISOString(), timeZone)
	}
	return `${y}-${m}-${d}`
}

export function isSameLocalDay(
	isoA: string,
	isoB: string,
	timeZone = DEFAULT_TIMEZONE,
) {
	const options: Intl.DateTimeFormatOptions = {
		timeZone,
		year: "numeric",
		month: "numeric",
		day: "numeric",
	}
	const strA = new Intl.DateTimeFormat("en-US", options).format(new Date(isoA))
	const strB = new Intl.DateTimeFormat("en-US", options).format(new Date(isoB))
	return strA === strB
}

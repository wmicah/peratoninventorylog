export function formatLocalTime(
	isoString: string,
	timeZone = "America/New_York",
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

export function formatTimeOnly(
	isoString: string,
	timeZone = "America/New_York",
) {
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
	timeZone = "America/New_York",
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

export function isSameLocalDay(
	isoA: string,
	isoB: string,
	timeZone = "America/New_York",
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

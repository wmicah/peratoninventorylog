"use client"

import { AppLayout } from "@/components/AppLayout"
import { useStore, type AppState, formatBadgeLabel } from "@/lib/store"
import { computeHealth } from "@/lib/inventoryLogic"
import {
	formatLocalTime,
	getInventoryDayString,
	DEFAULT_TIMEZONE,
} from "@/lib/time"
import {
	AlertCircle,
	User,
	ShieldAlert,
	History as HistoryIcon,
	Activity,
	Globe,
	Server,
	ChevronRight,
	ChevronDown,
	ClipboardCheck,
	Plus,
	ChevronLeft,
	Calendar,
	Tag,
} from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useState, useMemo, useEffect, Suspense } from "react"
import {
	fetchBadges,
	badgeRowsToBadges,
	fetchSessions,
	sessionRowToSession,
} from "@/lib/db"
import {
	turnOffMissingBadgesForSite,
	runAutoOffWeekOldMissing,
} from "@/app/actions/badges"
import { purgeSessionsOlderThan5Years } from "@/app/actions/sessions"

export default function Dashboard() {
	return (
		<Suspense>
			<DashboardInner />
		</Suspense>
	)
}

function DashboardInner() {
	const searchParams = useSearchParams()
	const [mounted, setMounted] = useState(false)
	const currentUser = useStore((state) => state.currentUser)
	const selectedSite = useStore((state) => state.selectedSite)
	const sites = useStore((state) => state.sites)
	const sessions = useStore((state) => state.sessions)
	const badges = useStore((state) => state.badges)
	const setBadges = useStore((state) => state.setBadges)
	const setSessions = useStore((state) => state.setSessions)

	useEffect(() => {
		setMounted(true)
	}, [])

	// On admin load: auto-turn-off badges missing 7+ days, purge sessions older than 5 years, show one-time notification
	useEffect(() => {
		if (!mounted || currentUser?.role !== "admin") return
		;(async () => {
			let shouldRefetchBadges = false
			let shouldRefetchSessions = false
			const autoOffRes = await runAutoOffWeekOldMissing()
			if (autoOffRes.ok && autoOffRes.turnedOff.length > 0) {
				setAutoOffReport(autoOffRes.turnedOff)
				shouldRefetchBadges = true
			}
			const purgeRes = await purgeSessionsOlderThan5Years()
			if (purgeRes.ok && purgeRes.deleted > 0) {
				setPurgeCount(purgeRes.deleted)
				shouldRefetchSessions = true
			}
			if (shouldRefetchBadges)
				fetchBadges().then((rows) => setBadges(badgeRowsToBadges(rows)))
			if (shouldRefetchSessions) {
				const rows = await fetchSessions()
				const next: Record<string, ReturnType<typeof sessionRowToSession>> = {}
				rows.forEach((r) => {
					next[r.id] = sessionRowToSession(r)
				})
				setSessions(next)
			}
		})()
	}, [mounted, currentUser?.role, setBadges, setSessions])

	// Use local date so "today" is the user's date, not UTC (which could show tomorrow)
	const getTodayLocal = () => {
		const now = new Date()
		return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
	}
	const [selectedDate, setSelectedDate] = useState(() => {
		const fromUrl = searchParams.get("date")
		if (fromUrl && /^\d{4}-\d{2}-\d{2}$/.test(fromUrl)) return fromUrl
		return getTodayLocal()
	})
	const [turnOffMissingSiteId, setTurnOffMissingSiteId] = useState<
		string | null
	>(null)
	const [officerMessage, setOfficerMessage] = useState<string | null>(null)
	const [expandedBadgeStatusSiteId, setExpandedBadgeStatusSiteId] = useState<
		string | null
	>(null)
	const [autoOffReport, setAutoOffReport] = useState<
		{ badgeId: string; code: string; siteId: string; siteName: string }[] | null
	>(null)
	const [dismissedAutoOff, setDismissedAutoOff] = useState(false)
	const [purgeCount, setPurgeCount] = useState<number | null>(null)

	const changeDate = (days: number) => {
		const [y, m, d] = selectedDate.split("-").map(Number)
		const date = new Date(y, m - 1, d)
		date.setDate(date.getDate() + days)
		setSelectedDate(
			`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
		)
	}

	// Compute stats for ALL sites, filtered to selected date
	const globalStats = useMemo(() => {
		if (!mounted) return null
		return sites.map((s) => ({
			site: s,
			health: computeHealth({ sessions, badges, sites } as AppState, s.id, selectedDate),
		}))
	}, [mounted, sessions, badges, sites, selectedDate])

	const myRecentSessions = useMemo(() => {
		if (!currentUser?.name || !mounted) return []
		return Object.values(sessions)
			.filter(
				(s) =>
					s.status === "submitted" &&
					s.createdBy.trim().toLowerCase() ===
						currentUser.name.trim().toLowerCase(),
			)
			.sort(
				(a, b) =>
					new Date(b.submittedAt!).getTime() -
					new Date(a.submittedAt!).getTime(),
			)
			.slice(0, 5)
	}, [mounted, sessions, currentUser?.name])

	// Previous inventory day (8am–8am window that ended at 8am this morning)
	const yesterdayStr = getInventoryDayString(
		new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
	)
	const notRunDismissalKey = `peraton_notRunYesterday_${currentUser?.email ?? currentUser?.name ?? "anon"}`
	const [dismissedNotRunYesterday, setDismissedNotRunYesterday] =
		useState(false)
	useEffect(() => {
		if (!mounted || typeof window === "undefined") return
		try {
			if (localStorage.getItem(notRunDismissalKey) === yesterdayStr) {
				setDismissedNotRunYesterday(true)
			}
		} catch {
			// ignore
		}
	}, [mounted, notRunDismissalKey, yesterdayStr])
	const dismissNotRunYesterday = () => {
		setDismissedNotRunYesterday(true)
		try {
			localStorage.setItem(notRunDismissalKey, yesterdayStr)
		} catch {
			// ignore
		}
	}
	const siteIdsRunYesterday = useMemo(() => {
		if (!mounted) return new Set<string>()
		const set = new Set<string>()
		Object.values(sessions).forEach((s) => {
			if (s.status !== "submitted" || !s.submittedAt) return
			const site = sites.find((x) => x.id === s.siteId)
			const tz = site?.timeZone ?? DEFAULT_TIMEZONE
			const yesterdayInTz = getInventoryDayString(
				new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
				tz,
			)
			if (getInventoryDayString(s.submittedAt, tz) === yesterdayInTz) {
				set.add(s.siteId)
			}
		})
		return set
	}, [mounted, sessions, sites])
	const sitesNotRunYesterday = useMemo(
		() => sites.filter((s) => !siteIdsRunYesterday.has(s.id)),
		[sites, siteIdsRunYesterday],
	)

	const aggregateMetrics = useMemo(() => {
		if (!globalStats) return null
		const total = globalStats.reduce(
			(acc, curr) => acc + curr.health.totalCount,
			0,
		)
		const present = globalStats.reduce(
			(acc, curr) => acc + curr.health.presentCount,
			0,
		)
		const missing = globalStats.reduce(
			(acc, curr) => acc + curr.health.missingCount,
			0,
		)
		const resolved = globalStats.reduce(
			(acc, curr) => acc + curr.health.resolvedCount,
			0,
		)
		const drift = globalStats.reduce(
			(acc, curr) => acc + curr.health.newlyMissingCount,
			0,
		)

		return {
			total,
			present,
			missing,
			resolved,
			drift,
			accuracy: total > 0 ? (present / total) * 100 : 100,
		}
	}, [globalStats])

	if (!mounted) return null

	// --- OFFICER DASHBOARD (inventory accounts) ---
	if (currentUser?.role !== "admin") {
		const assignedSites = sites.filter((s) =>
			currentUser?.assignedSiteIds?.includes(s.id),
		)
		const mySessions = Object.values(sessions)
			.filter(
				(s) =>
					s.status === "submitted" &&
					currentUser?.name &&
					s.createdBy.trim().toLowerCase() ===
						currentUser.name.trim().toLowerCase(),
			)
			.sort(
				(a, b) =>
					new Date(b.submittedAt ?? b.createdAt).getTime() -
					new Date(a.submittedAt ?? a.createdAt).getTime(),
			)
			.slice(0, 10)
		return (
			<AppLayout>
				<div className="flex flex-col gap-8 bg-dots min-h-[calc(100vh-4rem)] -m-8 md:-m-10 p-8 md:p-10">
					<div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
						<div>
							<h1 className="text-2xl font-black text-slate-900 tracking-tight mb-1">
								Your dashboard
							</h1>
							<p className="text-sm text-slate-500 font-medium">
								Assigned facilities and recent audits
							</p>
						</div>
						<Link
							href="/start"
							className="flex items-center gap-2 bg-[#0F1C3F] text-white px-5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-slate-800 transition-all shadow-sm"
						>
							<ClipboardCheck className="w-4 h-4" /> Start inventory
						</Link>
					</div>

					{officerMessage && (
						<div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800">
							{officerMessage}
						</div>
					)}

					{/* Assigned facilities + badge status */}
					<div>
						<h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
							<Server className="w-3.5 h-3.5" /> Your facilities
						</h2>
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
							{assignedSites.length === 0 ? (
								<div className="col-span-full bg-white rounded-xl border border-slate-200 p-6 text-center text-slate-500 text-sm">
									No facilities assigned. Contact an administrator.
								</div>
							) : (
								assignedSites.map((site) => {
									const siteBadges = badges.filter(
										(b) => b.siteId === site.id && b.active !== false,
									)
									const inactiveCount = badges.filter(
										(b) => b.siteId === site.id && b.active === false,
									).length
									const siteHealth = computeHealth(
										{ sessions, badges, sites, selectedSite } as AppState,
										site.id,
									)
									const missingCount = siteHealth.missingCount
									const isTurningOff = turnOffMissingSiteId === site.id
									return (
										<div
											key={site.id}
											className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm"
										>
											<div className="flex items-start justify-between gap-2 mb-3">
												<div>
													<h3 className="font-bold text-slate-900 text-sm">
														{site.name}
													</h3>
													<span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
														{site.id}
													</span>
												</div>
											</div>
											<div className="flex flex-wrap gap-3 text-[11px] mb-3">
												<span className="font-semibold text-slate-600">
													{siteBadges.length} active for inventory
												</span>
												{inactiveCount > 0 && (
													<span className="text-amber-600 font-semibold">
														{inactiveCount} turned off
													</span>
												)}
												{missingCount > 0 && (
													<span className="text-red-600 font-semibold">
														{missingCount} missing
													</span>
												)}
											</div>
											{missingCount > 0 && (
												<button
													type="button"
													onClick={async () => {
														setOfficerMessage(null)
														setTurnOffMissingSiteId(site.id)
														const res = await turnOffMissingBadgesForSite(
															site.id,
														)
														setTurnOffMissingSiteId(null)
														if (res.ok) {
															if (res.count > 0) {
																const rows = await fetchBadges()
																setBadges(badgeRowsToBadges(rows))
																setOfficerMessage(
																	`Turned off ${res.count} missing badge${res.count === 1 ? "" : "s"}. Disable the physical badge(s) in your other software.`,
																)
																setTimeout(() => setOfficerMessage(null), 5000)
															}
														} else {
															setOfficerMessage(res.error)
															setTimeout(() => setOfficerMessage(null), 5000)
														}
													}}
													disabled={isTurningOff}
													className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border-2 border-slate-200 text-slate-700 text-[10px] font-bold uppercase tracking-wider hover:bg-slate-50 hover:border-slate-300 disabled:opacity-60 transition-all"
												>
													{isTurningOff ? (
														<>Turning off…</>
													) : (
														<>Turn off all missing badges</>
													)}
												</button>
											)}
											<button
												type="button"
												onClick={() =>
													setExpandedBadgeStatusSiteId((prev) =>
														prev === site.id ? null : site.id,
													)
												}
												className="w-full mt-2 flex items-center justify-center gap-2 py-2 rounded-lg border border-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-wider hover:bg-slate-50 transition-all"
											>
												<Tag className="w-3.5 h-3.5" />
												{expandedBadgeStatusSiteId === site.id
													? "Hide badge status"
													: "View badge status"}
												{expandedBadgeStatusSiteId === site.id ? (
													<ChevronDown className="w-3.5 h-3.5 rotate-180" />
												) : (
													<ChevronDown className="w-3.5 h-3.5" />
												)}
											</button>
											{expandedBadgeStatusSiteId === site.id && (
												<div className="mt-3 pt-3 border-t border-slate-100 max-h-48 overflow-y-auto">
													<p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">
														Badge status (read-only)
													</p>
													<ul className="space-y-1.5">
														{badges
															.filter((b) => b.siteId === site.id)
															.sort((a, b) => a.code.localeCompare(b.code))
															.map((b) => (
																<li
																	key={b.id}
																	className="flex items-center justify-between gap-2 text-[11px]"
																>
																	<span className="font-mono font-semibold text-slate-800 truncate">
																		{formatBadgeLabel(b)}
																	</span>
																	<span
																		className={`shrink-0 font-bold uppercase tracking-wider ${
																			b.active
																				? "text-teal-600"
																				: "text-amber-600"
																		}`}
																	>
																		{b.active ? "On" : "Off"}
																	</span>
																</li>
															))}
													</ul>
												</div>
											)}
										</div>
									)
								})
							)}
						</div>
					</div>

					{/* Recent audits */}
					<div>
						<h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
							<HistoryIcon className="w-3.5 h-3.5" /> Your recent audits
						</h2>
						{mySessions.length === 0 ? (
							<div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-slate-500 text-sm">
								No submitted audits yet. Start an inventory from the button
								above.
							</div>
						) : (
							<ul className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden shadow-sm">
								{mySessions.map((s) => {
									const sessSite = sites.find((x) => x.id === s.siteId)
									return (
										<li key={s.id}>
											<Link
												href={`/sessions/${s.id}`}
												className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-slate-50 transition-colors"
											>
												<span className="font-medium text-slate-900 text-sm">
													{sessSite?.name ?? s.siteId} •{" "}
													{formatLocalTime(s.submittedAt ?? s.createdAt)}
												</span>
												<ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
											</Link>
										</li>
									)
								})}
							</ul>
						)}
					</div>
				</div>
			</AppLayout>
		)
	}

	// --- NO DATA: prompt to run schema seed in Supabase ---
	if (sites.length === 0) {
		return (
			<AppLayout>
				<div className="flex flex-col gap-8 bg-dots min-h-[calc(100vh-4rem)] -m-8 md:-m-10 p-10 md:p-12 items-center justify-center">
					<div className="bg-white rounded-xl border border-slate-200 shadow-card p-10 max-w-lg text-center">
						<div className="w-14 h-14 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-6">
							<Server className="w-7 h-7 text-slate-400" />
						</div>
						<h2 className="text-xl font-black text-slate-900 tracking-tight mb-2">
							No facilities loaded
						</h2>
						<p className="text-slate-500 text-sm mb-6">
							The dashboard needs sites, categories, and badges from the
							database. Run the full schema script in Supabase once, then
							refresh this page.
						</p>
						<div className="bg-slate-50 rounded-lg p-4 text-left border border-slate-100">
							<p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
								In Supabase Dashboard → SQL Editor, run:
							</p>
							<code className="text-xs font-mono text-slate-700 break-all">
								supabase/run_full_schema_and_seed.sql
							</code>
						</div>
						<button
							type="button"
							onClick={() => window.location.reload()}
							className="mt-6 text-sm font-bold text-primary-900 hover:underline uppercase tracking-widest"
						>
							Refresh after running the script
						</button>
					</div>
				</div>
			</AppLayout>
		)
	}

	// --- GLOBAL OVERVIEW (admin: all facilities; use Dashboard then click a site to go to /dashboard/[siteId]) ---
	if (currentUser?.role === "admin" && aggregateMetrics && globalStats) {
		return (
			<AppLayout>
				<div className="flex flex-col gap-10 bg-dots min-h-[calc(100vh-4rem)] -m-8 md:-m-10 p-10 md:p-12">
					{((autoOffReport && autoOffReport.length > 0) ||
						(purgeCount != null && purgeCount > 0)) &&
						!dismissedAutoOff && (
							<div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-4 flex flex-wrap items-start justify-between gap-3">
								<div>
									{autoOffReport && autoOffReport.length > 0 && (
										<>
											<p className="font-bold text-amber-900 text-sm">
												{autoOffReport.length} badge
												{autoOffReport.length === 1 ? "" : "s"} turned off
												automatically
											</p>
											<p className="text-amber-800 text-xs mt-1">
												These had been missing for 7+ days with no new
												inventory. They are now hidden from officers.
											</p>
											{autoOffReport.length <= 5 ? (
												<ul className="mt-2 text-xs font-medium text-amber-900">
													{autoOffReport.map((r) => (
														<li key={r.badgeId}>
															{r.code} ({r.siteName})
														</li>
													))}
												</ul>
											) : (
												<p className="mt-2 text-xs font-medium text-amber-900">
													{autoOffReport.length} badges across{" "}
													{new Set(autoOffReport.map((r) => r.siteId)).size}{" "}
													facilities
												</p>
											)}
										</>
									)}
									{purgeCount != null && purgeCount > 0 && (
										<p className="text-amber-800 text-xs font-medium mt-2">
											{purgeCount} session{purgeCount === 1 ? "" : "s"} older
											than 5 years were purged (retention policy).
										</p>
									)}
								</div>
								<button
									type="button"
									onClick={() => setDismissedAutoOff(true)}
									className="shrink-0 px-3 py-1.5 rounded-lg border border-amber-300 text-amber-900 text-xs font-bold uppercase tracking-wider hover:bg-amber-100 transition-colors"
								>
									Dismiss
								</button>
							</div>
						)}
					<div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
						<div>
							<h1 className="text-3xl font-black text-slate-900 tracking-tighter leading-none mb-3">
								Global Inventory Management
							</h1>
							<div className="flex items-center gap-3">
								<div className="bg-primary-900 text-white px-3 py-1 rounded text-xs font-bold uppercase tracking-widest shadow-sm flex items-center gap-2">
									<Globe className="w-3.5 h-3.5" /> Fleet Oversight
								</div>
								<span className="text-slate-400 font-bold text-xs uppercase tracking-widest">
									Active nodes: {sites.length} Facilities
								</span>
							</div>
						</div>

						<div className="flex items-center bg-white border border-slate-200 rounded-xl p-1.5 shadow-card-sm">
							<button
								onClick={() => changeDate(-1)}
								className="p-2 hover:bg-slate-50 rounded-lg transition-colors text-slate-400 hover:text-slate-900"
							>
								<ChevronLeft className="w-5 h-5" />
							</button>
							<div className="flex items-center gap-3 px-4 border-x border-slate-100">
								<Calendar className="w-4 h-4 text-slate-400" />
								<input
									type="date"
									value={selectedDate}
									onChange={(e) => setSelectedDate(e.target.value)}
									className="text-xs font-black text-slate-900 uppercase tracking-widest bg-transparent border-none focus:ring-0 p-0 cursor-pointer w-28"
								/>
							</div>
							<button
								onClick={() => changeDate(1)}
								disabled={selectedDate >= getTodayLocal()}
								className="p-2 hover:bg-slate-50 rounded-lg transition-colors text-slate-400 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed"
							>
								<ChevronRight className="w-5 h-5" />
							</button>
						</div>
					</div>

					{/* Aggregated KPIs */}
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
						<div className="bg-white p-6 rounded-xl border border-slate-200 shadow-card relative overflow-hidden group">
							<div className="absolute -right-2 -top-2 w-20 h-20 bg-slate-50 rounded-full opacity-50 group-hover:scale-110 transition-transform" />
							<div className="relative z-10">
								<div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center mb-4 border border-blue-100">
									<Activity className="w-5 h-5" />
								</div>
								<p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none mb-2">
									Reconciliation Rate
								</p>
								<div className="flex items-baseline gap-2">
									<h3 className="text-3xl font-black text-slate-900 tracking-tight">
										{aggregateMetrics.accuracy.toFixed(1)}%
									</h3>
								</div>
							</div>
						</div>

						<div className="bg-white p-6 rounded-xl border border-slate-200 shadow-card relative overflow-hidden group">
							<div className="relative z-10">
								<div className="w-10 h-10 bg-slate-50 text-slate-600 rounded-lg flex items-center justify-center mb-4 border border-slate-100">
									<ShieldAlert className="w-5 h-5" />
								</div>
								<p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none mb-2">
									Unreconciled Assets
								</p>
								<div className="flex items-baseline gap-2">
									<h3 className="text-3xl font-black text-slate-900 tracking-tight">
										{aggregateMetrics.missing}
									</h3>
									<span className="text-xs font-bold text-slate-400 uppercase tracking-tight">
										Open Items
									</span>
								</div>
							</div>
						</div>

						<div className="bg-white p-6 rounded-xl border border-slate-200 shadow-card relative overflow-hidden group">
							<div className="relative z-10">
								<div className="w-10 h-10 bg-slate-50 text-slate-600 rounded-lg flex items-center justify-center mb-4 border border-slate-100">
									<Server className="w-5 h-5" />
								</div>
								<p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none mb-2">
									Total Managed
								</p>
								<div className="flex items-baseline gap-2">
									<h3 className="text-3xl font-black text-slate-900 tracking-tight">
										{aggregateMetrics.total}
									</h3>
									<span className="text-xs font-bold text-slate-400 uppercase tracking-tight">
										Assets
									</span>
								</div>
							</div>
						</div>

						<div className="bg-primary-900 p-6 rounded-xl shadow-card relative overflow-hidden group">
							<div className="absolute right-0 top-0 p-4 opacity-10">
								<ClipboardCheck className="w-16 h-16 text-white" />
							</div>
							<div className="relative z-10">
								<p className="text-xs font-bold text-white/50 uppercase tracking-widest leading-none mb-3 text-center underline decoration-white/20 underline-offset-4">
									Audit Fidelity
								</p>
								<div className="flex flex-col items-center justify-center h-20">
									<span className="text-4xl font-black text-white tracking-widest uppercase">
										Nominal
									</span>
									<span className="text-[10px] font-bold text-teal-400 uppercase mt-2 tracking-[0.2em]">
										Operational Status
									</span>
								</div>
							</div>
						</div>
					</div>

					{sitesNotRunYesterday.length > 0 && !dismissedNotRunYesterday && (
						<div className="rounded-xl border-2 border-red-200 bg-red-50 p-5">
							<div className="flex items-start justify-between gap-4">
								<div className="min-w-0">
									<h2 className="text-[10px] font-bold text-red-700 uppercase tracking-widest flex items-center gap-2 mb-3">
										<AlertCircle className="w-3.5 h-3.5 shrink-0" /> Inventory
										not run yesterday
									</h2>
									<p className="text-sm text-red-800 font-medium mb-2">
										{sitesNotRunYesterday.length} facilit
										{sitesNotRunYesterday.length === 1 ? "y" : "ies"} had no
										submitted audit for yesterday:
									</p>
									<ul className="flex flex-wrap gap-2">
										{sitesNotRunYesterday.map((s) => (
											<li key={s.id}>
												<Link
													href={`/dashboard/${s.id}?date=${selectedDate}`}
													className="px-3 py-1.5 rounded-lg bg-red-100 border border-red-200 text-red-800 text-xs font-bold uppercase tracking-wider hover:bg-red-200 transition-colors inline-block"
												>
													{s.name} ({s.id})
												</Link>
											</li>
										))}
									</ul>
								</div>
								<button
									type="button"
									onClick={dismissNotRunYesterday}
									className="shrink-0 px-4 py-2 rounded-lg bg-red-700 text-white text-xs font-bold uppercase tracking-widest hover:bg-red-800 transition-colors"
								>
									Okay
								</button>
							</div>
						</div>
					)}

					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
								<Activity className="w-3.5 h-3.5" /> Facility Health Map
							</h2>
							<Link
								href="/admin/inventory"
								className="text-[9px] font-bold text-slate-400 hover:text-slate-900 flex items-center gap-1 transition-all uppercase tracking-widest"
							>
								Master Repository <ChevronRight className="w-2.5 h-2.5" />
							</Link>
						</div>

						<div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
							{globalStats.map(({ site: s, health: h }) => {
								const noRunYesterday = sitesNotRunYesterday.some(
									(x) => x.id === s.id,
								)
								return (
									<Link
										key={s.id}
										href={`/dashboard/${s.id}?date=${selectedDate}`}
										className={`bg-white rounded-xl border p-5 text-left hover:border-slate-900 transition-all group relative shadow-card block ${
											noRunYesterday
												? "border-red-300 ring-1 ring-red-200"
												: "border-slate-200"
										}`}
									>
										<div className="flex items-center justify-between gap-2 mb-4">
											<div className="flex items-center gap-2.5 min-w-0 flex-1">
												<div className="w-8 h-8 shrink-0 rounded bg-slate-50 flex items-center justify-center border border-slate-100 group-hover:bg-slate-900 group-hover:text-white transition-all shadow-sm">
													<Server className="w-4 h-4" />
												</div>
												<div className="overflow-hidden min-w-0">
													<h4 className="font-bold text-slate-900 group-hover:text-slate-900 transition-colors text-xs truncate">
														{s.name}
													</h4>
													<span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none">
														{s.id}
													</span>
												</div>
											</div>
											{noRunYesterday && (
												<span className="shrink-0 bg-red-100 text-red-700 text-[8px] font-bold px-1.5 py-0.5 rounded border border-red-200 uppercase tracking-widest">
													No run yesterday
												</span>
											)}
											<ChevronRight className="w-3.5 h-3.5 shrink-0 text-slate-300 group-hover:translate-x-1 group-hover:text-slate-900 transition-all" />
										</div>

										<div className="space-y-3">
											<div className="flex items-center justify-between text-[10px]">
												<span className="font-bold text-slate-400 uppercase tracking-tight">
													Reconciliation
												</span>
												<span
													className={`font-black tracking-tighter ${h.missingCount > 0 ? "text-blue-600" : "text-teal-600"}`}
												>
													{h.totalCount > 0
														? `${((h.presentCount / h.totalCount) * 100).toFixed(0)}%`
														: "—"}
												</span>
											</div>
											<div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
												<div
													className={`h-full transition-all duration-1000 ${h.missingCount > 0 ? "bg-blue-500" : "bg-teal-500"}`}
													style={{
														width: `${h.totalCount > 0 ? (h.presentCount / h.totalCount) * 100 : 0}%`,
													}}
												/>
											</div>
										</div>

										<div className="mt-5 flex items-center justify-between pt-4 border-t border-slate-50">
											<div className="flex items-center gap-3">
												<div className="flex flex-col">
													<span className="text-[7px] font-bold text-slate-300 uppercase leading-none mb-1 tracking-tighter">
														Inventory
													</span>
													<span
														className={`text-[10px] font-black ${h.missingCount > 0 ? "text-slate-600" : "text-slate-900"}`}
													>
														{h.missingCount} Open Items
													</span>
												</div>
											</div>
											<div className="flex flex-col text-right">
												<span className="text-[7px] font-bold text-slate-300 uppercase leading-none mb-1 tracking-tighter">
													Last Update
												</span>
												<span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">
													{h.latestSession?.submittedAt
														? formatLocalTime(h.latestSession.submittedAt)
														: "Never"}
												</span>
											</div>
										</div>
									</Link>
								)
							})}
						</div>

						{/* My Activity — for inventory accounts only (hidden for admins) */}
						{currentUser && currentUser.role !== "admin" && (
							<div className="space-y-4 mt-10">
								<h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
									<User className="w-3.5 h-3.5" /> My Activity
								</h2>
								<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
									<div className="bg-white rounded-xl border border-slate-200 p-5 shadow-card">
										<p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-3">
											Your recent audits
										</p>
										{myRecentSessions.length === 0 ? (
											<p className="text-slate-500 text-xs italic">
												No submitted audits yet.
											</p>
										) : (
											<ul className="space-y-2">
												{myRecentSessions.map((sess) => {
													const siteName =
														sites.find((s) => s.id === sess.siteId)?.name ??
														sess.siteId
													return (
														<li key={sess.id}>
															<Link
																href={`/sessions/${sess.id}`}
																className="flex items-center justify-between text-xs hover:bg-slate-50 -mx-2 px-2 py-1.5 rounded transition-colors"
															>
																<span className="font-semibold text-slate-800">
																	{siteName}
																</span>
																<span className="text-slate-400 font-medium">
																	{sess.submittedAt
																		? formatLocalTime(sess.submittedAt)
																		: "—"}
																</span>
															</Link>
														</li>
													)
												})}
											</ul>
										)}
									</div>
									<div className="bg-white rounded-xl border border-slate-200 p-5 shadow-card">
										<p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-3">
											Quick actions
										</p>
										<div className="flex flex-wrap gap-2">
											{currentUser?.role !== "admin" && (
												<Link
													href="/take"
													className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold uppercase tracking-widest hover:bg-black transition-colors"
												>
													<Plus className="w-3.5 h-3.5" /> Start inventory
												</Link>
											)}
											{currentUser?.role === "admin" && (
												<Link
													href="/admin/sites"
													className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-bold uppercase tracking-widest hover:border-slate-900 hover:text-slate-900 transition-colors"
												>
													<Server className="w-3.5 h-3.5" /> Facilities
												</Link>
											)}
										</div>
									</div>
								</div>
							</div>
						)}
					</div>
				</div>
			</AppLayout>
		)
	}

	// Site-specific dashboard is at /dashboard/[siteId]
	return null
}

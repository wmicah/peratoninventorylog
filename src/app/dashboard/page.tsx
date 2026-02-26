"use client"

import { AppLayout } from "@/components/AppLayout"
import { useStore, type AppState } from "@/lib/store"
import { computeHealth } from "@/lib/inventoryLogic"
import { formatLocalTime, getLocalDateString } from "@/lib/time"
import {
	ArrowUpRight,
	AlertCircle,
	User,
	ShieldCheck,
	ShieldAlert,
	History as HistoryIcon,
	Activity,
	Globe,
	Server,
	ChevronRight,
	ClipboardCheck,
	Plus,
	Check,
	ChevronLeft,
	Calendar,
	Download,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useMemo, useEffect } from "react"

export default function Dashboard() {
	const [mounted, setMounted] = useState(false)
	const router = useRouter()

	const currentUser = useStore((state) => state.currentUser)
	const selectedSite = useStore((state) => state.selectedSite)
	const sites = useStore((state) => state.sites)
	const sessions = useStore((state) => state.sessions)
	const badges = useStore((state) => state.badges)
	const setSelectedSite = useStore((state) => state.setSelectedSite)

	useEffect(() => {
		setMounted(true)
	}, [])

	// Loggers use /start, not dashboard
	useEffect(() => {
		if (mounted && currentUser?.role !== "admin") {
			router.replace("/start")
		}
	}, [mounted, currentUser?.role, router])

	// Use local date so "today" is the user's date, not UTC (which could show tomorrow)
	const getTodayLocal = () => {
		const now = new Date()
		return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
	}
	const getYesterdayLocal = () => {
		const d = new Date()
		d.setDate(d.getDate() - 1)
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
	}
	const [selectedDate, setSelectedDate] = useState(getTodayLocal())
	const [exporting, setExporting] = useState(false)

	const changeDate = (days: number) => {
		const [y, m, d] = selectedDate.split("-").map(Number)
		const date = new Date(y, m - 1, d)
		date.setDate(date.getDate() + days)
		setSelectedDate(
			`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
		)
	}

	const exportDailyReport = async () => {
		if (!site || !health) return
		setExporting(true)
		try {
			// Get all sessions for this site on the selected day
			const daySessions = Object.values(sessions).filter(
				(s) =>
					s.siteId === selectedSite &&
					getLocalDateString(s.submittedAt || s.createdAt) === selectedDate,
			)

			const ExcelJS = (await import("exceljs")).default
			const wb = new ExcelJS.Workbook()
			wb.creator = "Peraton Inventory"
			const ws = wb.addWorksheet("Reconciliation Report", {
				views: [{ state: "frozen", ySplit: 1 }],
			})

			// Column widths
			ws.columns = [
				{ width: 38 },
				{ width: 18 },
				{ width: 22 },
				{ width: 12 },
				{ width: 18 },
				{ width: 14 },
			]

			const titleFont = { name: "Calibri", size: 16, bold: true }
			const sectionFont = { name: "Calibri", size: 11, bold: true }
			const headerFont = { name: "Calibri", size: 11, bold: true }
			const sectionFill = {
				type: "pattern" as const,
				pattern: "solid" as const,
				fgColor: { argb: "FFE2E8F0" },
			}
			const headerFill = {
				type: "pattern" as const,
				pattern: "solid" as const,
				fgColor: { argb: "FFF1F5F9" },
			}
			const thinBorder = {
				top: { style: "thin" as const },
				left: { style: "thin" as const },
				bottom: { style: "thin" as const },
				right: { style: "thin" as const },
			}

			let row = 1

			// Title
			ws.mergeCells(row, 1, row, 5)
			ws.getCell(row, 1).value = "Inventory Reconciliation Report"
			ws.getCell(row, 1).font = titleFont
			ws.getCell(row, 1).alignment = { vertical: "middle" }
			row += 1

			ws.getCell(row, 1).value = "Site:"
			ws.getCell(row, 1).font = sectionFont
			ws.getCell(row, 2).value = `${site.name} (${site.id})`
			row += 1
			ws.getCell(row, 1).value = "Date:"
			ws.getCell(row, 1).font = sectionFont
			ws.getCell(row, 2).value = selectedDate
			row += 2

			// Facility Summary
			ws.mergeCells(row, 1, row, 3)
			ws.getCell(row, 1).value = "Facility Summary"
			ws.getCell(row, 1).font = sectionFont
			ws.getCell(row, 1).fill = sectionFill
			ws.getCell(row, 1).border = thinBorder
			row += 1

			const fidelityPct =
				health.totalCount > 0
					? ((health.presentCount / health.totalCount) * 100).toFixed(1)
					: "0.0"
			const summaryRows = [
				["Total Registered Assets", health.totalCount],
				["Reconciled Today", health.presentCount],
				["Unreconciled", health.missingCount],
				["Fidelity Rate", `${fidelityPct}%`],
			]
			summaryRows.forEach(([label, value]) => {
				ws.getCell(row, 1).value = label
				ws.getCell(row, 2).value = value
				ws.getCell(row, 1).border = thinBorder
				ws.getCell(row, 2).border = thinBorder
				row += 1
			})
			row += 1

			// Verification Logs
			ws.mergeCells(row, 1, row, 5)
			ws.getCell(row, 1).value = "Verification Logs"
			ws.getCell(row, 1).font = sectionFont
			ws.getCell(row, 1).fill = sectionFill
			ws.getCell(row, 1).border = thinBorder
			row += 1

			const logHeaders = [
				"Session ID",
				"Logger",
				"Timestamp",
				"Status",
				"Unreconciled Count",
			]
			logHeaders.forEach((h, i) => {
				const c = ws.getCell(row, i + 1)
				c.value = h
				c.font = headerFont
				c.fill = headerFill
				c.border = thinBorder
			})
			row += 1

			daySessions.forEach((s) => {
				const missingCount = Object.values(s.items).filter(
					(i) => i.state === "missing",
				).length
				const timestamp = s.submittedAt
					? formatLocalTime(s.submittedAt)
					: "Draft"
				const status = s.isSuperseded ? "Archived" : "Verified"
				ws.getCell(row, 1).value = s.id
				ws.getCell(row, 2).value = s.createdBy
				ws.getCell(row, 3).value = timestamp
				ws.getCell(row, 4).value = status
				ws.getCell(row, 5).value = missingCount
				;[1, 2, 3, 4, 5].forEach((col) => {
					ws.getCell(row, col).border = thinBorder
				})
				row += 1
			})
			row += 1

			// Unreconciled Assets
			ws.mergeCells(row, 1, row, 4)
			ws.getCell(row, 1).value = "Unreconciled Assets (Status: Open)"
			ws.getCell(row, 1).font = sectionFont
			ws.getCell(row, 1).fill = sectionFill
			ws.getCell(row, 1).border = thinBorder
			row += 1

			const assetHeaders = ["Asset Code", "Site", "Last Known Logger", "Status"]
			assetHeaders.forEach((h, i) => {
				const c = ws.getCell(row, i + 1)
				c.value = h
				c.font = headerFont
				c.fill = headerFill
				c.border = thinBorder
			})
			row += 1

			health.missingList.forEach((m) => {
				ws.getCell(row, 1).value = m.badge.code
				ws.getCell(row, 2).value = m.badge.siteId
				ws.getCell(row, 3).value = m.guestName ?? ""
				ws.getCell(row, 4).value = "UNACCOUNTED"
				;[1, 2, 3, 4].forEach((col) => {
					ws.getCell(row, col).border = thinBorder
				})
				row += 1
			})

			const buffer = await wb.xlsx.writeBuffer()
			const blob = new Blob([buffer], {
				type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			})
			const url = URL.createObjectURL(blob)
			const link = document.createElement("a")
			link.href = url
			link.setAttribute(
				"download",
				`Inventory_Report_${site.id}_${selectedDate}.xlsx`,
			)
			document.body.appendChild(link)
			link.click()
			document.body.removeChild(link)
			URL.revokeObjectURL(url)
		} finally {
			setExporting(false)
		}
	}

	// Compute stats for ALL sites
	const globalStats = useMemo(() => {
		if (!mounted) return null
		return sites.map((s) => ({
			site: s,
			health: computeHealth({ sessions, badges, sites } as AppState, s.id),
		}))
	}, [mounted, sessions, badges, sites])

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

	const yesterdayStr = getYesterdayLocal()
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
			if (
				s.status === "submitted" &&
				s.submittedAt &&
				getLocalDateString(s.submittedAt) === yesterdayStr
			) {
				set.add(s.siteId)
			}
		})
		return set
	}, [mounted, sessions, yesterdayStr])
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

	const site = useMemo(
		() => sites.find((s) => s.id === selectedSite),
		[sites, selectedSite],
	)

	const health = useMemo(() => {
		if (!mounted || !selectedSite || selectedSite === "all") return null
		return computeHealth(
			{ sessions, badges, sites, selectedSite } as AppState,
			selectedSite,
		)
	}, [mounted, sessions, badges, sites, selectedSite])

	if (!mounted) return null
	if (currentUser?.role !== "admin") return null

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

	// --- GLOBAL OVERVIEW ---
	if (selectedSite === "all" && aggregateMetrics && globalStats) {
		return (
			<AppLayout>
				<div className="flex flex-col gap-10 bg-dots min-h-[calc(100vh-4rem)] -m-8 md:-m-10 p-10 md:p-12">
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

						<div className="bg-white p-1 rounded-lg border border-slate-200 shadow-sm flex">
							<button className="px-4 py-1.5 text-xs font-bold uppercase tracking-widest bg-slate-900 text-white rounded shadow-sm transition-all">
								Real-time
							</button>
							<button className="px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors">
								Historical
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
												<button
													type="button"
													onClick={() => setSelectedSite(s.id)}
													className="px-3 py-1.5 rounded-lg bg-red-100 border border-red-200 text-red-800 text-xs font-bold uppercase tracking-wider hover:bg-red-200 transition-colors"
												>
													{s.name} ({s.id})
												</button>
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
									<button
										key={s.id}
										onClick={() => setSelectedSite(s.id)}
										className={`bg-white rounded-xl border p-5 text-left hover:border-slate-900 transition-all group relative shadow-card ${
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
									</button>
								)
							})}
						</div>

						{/* My Activity — for loggers only (hidden for admins) */}
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

	// --- SITE SPECIFIC DASHBOARD ---
	if (!site || !health) return null

	const targetSessions = Object.values(sessions).filter(
		(s) =>
			s.siteId === selectedSite &&
			getLocalDateString(s.submittedAt || s.createdAt) === selectedDate,
	)

	const displaySessions = targetSessions
		.filter((s) => s.status === "submitted")
		.sort(
			(a, b) =>
				new Date(b.submittedAt!).getTime() - new Date(a.createdAt).getTime(),
		)

	return (
		<AppLayout>
			<div className="flex flex-col gap-10 bg-dots min-h-[calc(100vh-4rem)] -m-8 md:-m-10 p-8 md:p-10">
				<div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
					<div>
						<h1 className="text-3xl font-black text-slate-900 tracking-tighter leading-none mb-3">
							Facility Inventory Report
						</h1>
						<div className="flex items-center gap-3">
							<div className="flex items-center gap-2 bg-primary-900 text-white px-3 py-1 rounded text-xs font-bold uppercase tracking-widest shadow-sm">
								<ShieldCheck className="w-4 h-4" /> Area Logged
							</div>
							<p className="text-slate-500 font-bold text-xs uppercase tracking-widest">
								{site.name} • FACILITY {site.id}
							</p>
						</div>
					</div>

					<div className="flex flex-wrap items-center gap-6">
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
								className="p-2 hover:bg-slate-50 rounded-lg transition-colors text-slate-400 hover:text-slate-900"
							>
								<ChevronRight className="w-5 h-5" />
							</button>
						</div>

						<button
							onClick={exportDailyReport}
							disabled={exporting}
							className="flex items-center gap-3 bg-white border border-slate-200 px-6 py-3 rounded-xl shadow-card-sm hover:border-slate-900 transition-all text-xs font-black text-slate-600 uppercase tracking-widest disabled:opacity-60 disabled:cursor-not-allowed"
						>
							<Download className="w-4 h-4" />
							{exporting ? "Exporting…" : "Export Report"}
						</button>

						{currentUser?.role !== "admin" && (
							<Link
								href="/take"
								className="text-xs font-black bg-slate-900 text-white px-8 py-3 rounded-xl shadow-sm hover:bg-black transition-all active:scale-95 uppercase tracking-widest flex items-center gap-3"
							>
								Execute Audit <ArrowUpRight className="w-4 h-4" />
							</Link>
						)}
					</div>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
					<div className="bg-white p-6 rounded-xl border border-slate-200 shadow-card relative overflow-hidden group">
						<div className="text-[10px] font-bold text-slate-400 mb-5 uppercase tracking-widest leading-none border-b border-slate-50 pb-2">
							Inventory Status
						</div>
						<div className="flex items-baseline gap-2">
							<div className="text-3xl font-black text-slate-900 tracking-tighter">
								{health.presentCount}
							</div>
							<div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
								/ {health.totalCount}
							</div>
						</div>
						<div className="mt-5 flex items-center justify-between">
							<span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
								{health.missingCount} Unreconciled
							</span>
							<div
								className={`w-8 h-1.5 rounded-full ${health.missingCount > 0 ? "bg-blue-500" : "bg-teal-500"}`}
							/>
						</div>
					</div>

					<div className="bg-white p-6 rounded-xl border border-slate-200 shadow-card overflow-hidden relative group">
						<div className="text-[10px] font-bold text-slate-400 mb-5 uppercase tracking-widest leading-none border-b border-slate-50 pb-2">
							Last Audit Entry
						</div>
						{health.latestSession ? (
							<>
								<div className="text-xl font-black text-slate-900 tracking-tight leading-none">
									{
										formatLocalTime(health.latestSession.submittedAt!).split(
											"at",
										)[1]
									}
								</div>
								<div className="text-xs font-bold text-slate-400 mt-3 flex items-center gap-2 uppercase tracking-widest">
									<User className="w-3.5 h-3.5" />{" "}
									{health.latestSession.createdBy}
								</div>
							</>
						) : (
							<div className="text-slate-400 italic text-xs py-2 uppercase font-bold tracking-widest">
								Status: Pending
							</div>
						)}
					</div>

					<div className="bg-white p-6 rounded-xl border border-slate-200 shadow-card relative overflow-hidden group">
						<div className="text-[10px] font-bold text-slate-400 mb-5 uppercase tracking-widest leading-none border-b border-slate-50 pb-2">
							Summary Adjustments
						</div>
						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
									New Items
								</span>
								<div className="flex items-center gap-1 font-black text-sm text-blue-600">
									<Plus className="w-3.5 h-3.5" /> {health.newlyMissingCount}
								</div>
							</div>
							<div className="flex items-center justify-between">
								<span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
									Reconciled
								</span>
								<div className="flex items-center gap-1 font-black text-sm text-teal-600">
									<Check className="w-3.5 h-3.5" /> {health.resolvedCount}
								</div>
							</div>
						</div>
					</div>

					<div className="bg-slate-50 p-6 rounded-xl border border-slate-200 shadow-card relative overflow-hidden group">
						<div className="text-[10px] font-bold text-slate-400 mb-5 uppercase tracking-widest leading-none border-b border-slate-50 pb-2">
							Site Fidelity
						</div>
						<div className="text-3xl font-black text-slate-900 tracking-tighter">
							{((health.presentCount / health.totalCount) * 100).toFixed(0)}%
						</div>
						<div className="mt-5">
							<span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
								{health.missingCount === 0
									? "Fidelity Verified"
									: "Adjustments Needed"}
							</span>
						</div>
					</div>
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
					<div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden flex flex-col">
						<div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
							<h2 className="font-bold text-slate-900 text-xs uppercase tracking-widest flex items-center gap-2">
								<ShieldAlert className="w-4 h-4 text-slate-400" /> Unreconciled
								Items
							</h2>
							<span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest underline underline-offset-4 decoration-slate-200">
								Inventory Status: Review
							</span>
						</div>
						<div className="p-0 overflow-y-auto max-h-[480px]">
							{health.missingList.length === 0 ? (
								<div className="p-16 text-center flex flex-col items-center justify-center">
									<div className="w-12 h-12 bg-teal-50 rounded-lg flex items-center justify-center mb-4 border border-teal-100">
										<ShieldCheck className="w-6 h-6 text-teal-500" />
									</div>
									<p className="font-extrabold text-slate-900 text-sm uppercase tracking-tight">
										Post Optimal
									</p>
									<p className="text-slate-400 font-bold mt-1 text-[9px] uppercase tracking-widest">
										No unauthorized drift detected.
									</p>
								</div>
							) : (
								<ul className="divide-y divide-slate-100">
									{health.missingList.map((m, idx) => (
										<li
											key={idx}
											className="px-5 py-3.5 group hover:bg-slate-50/50 transition-all"
										>
											<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
												<div className="flex items-center gap-3">
													<div className="w-1 h-1 bg-red-500 rounded-full" />
													<div>
														<span className="font-extrabold text-slate-900 text-base tracking-tighter group-hover:text-red-600 transition-colors uppercase leading-none">
															{m.badge.code}
														</span>
														<p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
															{m.badge.siteId} UNACCOUNTED
														</p>
													</div>
												</div>

												<div className="flex items-center gap-4">
													<div className="flex flex-col items-end">
														<span className="text-[7px] uppercase font-bold text-slate-300 tracking-tighter">
															Last Guest
														</span>
														<span className="text-[9px] font-bold text-slate-700 uppercase">
															{m.guestName}
														</span>
													</div>
													<div className="w-px h-5 bg-slate-100" />
													<div className="flex flex-col items-end">
														<span className="text-[7px] uppercase font-bold text-slate-300 tracking-tighter">
															Sponsor
														</span>
														<span className="text-[9px] font-bold text-slate-700 uppercase">
															{m.sponsorName}
														</span>
													</div>
												</div>
											</div>
										</li>
									))}
								</ul>
							)}
						</div>
					</div>

					<div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden flex flex-col">
						<div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
							<h2 className="font-bold text-slate-900 text-[10px] uppercase tracking-widest flex items-center gap-2">
								<HistoryIcon className="w-3.5 h-3.5 text-slate-400" />{" "}
								Verifications List
							</h2>
						</div>
						<div className="p-0 overflow-y-auto max-h-[480px]">
							{displaySessions.length === 0 ? (
								<div className="p-12 text-center text-slate-400 font-bold italic text-[9px] uppercase tracking-widest">
									No verified history for {selectedDate}
								</div>
							) : (
								<ul className="divide-y divide-slate-100">
									{displaySessions.map((session) => (
										<li key={session.id}>
											<Link
												href={`/sessions/${session.id}`}
												className="block px-5 py-4 hover:bg-slate-50 transition-all group"
											>
												<div className="flex items-center justify-between mb-2">
													<div className="flex items-center gap-2">
														<div className="w-6 h-6 rounded bg-slate-50 border border-slate-100 flex items-center justify-center text-[8px] font-black text-slate-400 group-hover:bg-black group-hover:text-white transition-all">
															{session.createdBy.charAt(0)}
														</div>
														<div className="flex flex-col">
															<span className="text-[10px] font-black text-slate-900 uppercase leading-none">
																{session.createdBy}
															</span>
															<span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
																{
																	formatLocalTime(session.submittedAt!).split(
																		"at",
																	)[1]
																}
															</span>
														</div>
													</div>
													{session.isSuperseded ? (
														<span className="bg-slate-50 text-slate-400 text-[7px] font-bold px-1.5 py-0.5 rounded border border-slate-200 uppercase tracking-widest">
															Archived
														</span>
													) : (
														<span className="bg-teal-50 text-teal-700 text-[7px] font-bold px-1.5 py-0.5 rounded border border-teal-200/50 uppercase tracking-widest">
															Verified
														</span>
													)}
												</div>
												<div className="flex items-center justify-end">
													<div className="flex items-center gap-1 font-black text-[10px] text-slate-900 uppercase tracking-tighter group-hover:text-black">
														{
															Object.values(session.items).filter(
																(i) => i.state === "missing",
															).length
														}{" "}
														<span className="text-slate-400 font-bold">
															Alert Discovered
														</span>
													</div>
												</div>
											</Link>
										</li>
									))}
								</ul>
							)}
							<div className="p-3 border-t border-slate-50 bg-slate-50/20">
								<Link
									href="/admin/sessions"
									className="flex items-center justify-center w-full py-2 rounded border border-slate-200 text-slate-400 font-bold text-[8px] uppercase tracking-widest hover:bg-white hover:text-slate-900 hover:border-slate-900 transition-all"
								>
									View audit log &rarr;
								</Link>
							</div>
						</div>
					</div>
				</div>
			</div>
		</AppLayout>
	)
}

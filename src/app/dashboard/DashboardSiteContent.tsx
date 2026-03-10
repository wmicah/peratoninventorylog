"use client"

import { AppLayout } from "@/components/AppLayout"
import { useStore, type AppState } from "@/lib/store"
import { computeHealth } from "@/lib/inventoryLogic"
import {
	formatLocalTime,
	getInventoryDayString,
	DEFAULT_TIMEZONE,
} from "@/lib/time"
import {
	ArrowUpRight,
	User,
	ShieldCheck,
	ShieldAlert,
	History as HistoryIcon,
	ChevronRight,
	ChevronLeft,
	Calendar,
	Download,
	Tag,
	Plus,
	Check,
} from "lucide-react"
import Link from "next/link"
import { useState, useMemo, useEffect } from "react"
import { fetchBadges, badgeRowsToBadges } from "@/lib/db"
import { turnOffMissingBadgesForSite } from "@/app/actions/badges"
import { listLoggers, type Profile } from "@/app/actions/auth"

function getTodayLocal() {
	const now = new Date()
	return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

export function DashboardSiteContent({ siteId, initialDate }: { siteId: string; initialDate?: string }) {
	const currentUser = useStore((state) => state.currentUser)
	const sites = useStore((state) => state.sites)
	const sessions = useStore((state) => state.sessions)
	const badges = useStore((state) => state.badges)
	const setBadges = useStore((state) => state.setBadges)
	const [selectedDate, setSelectedDate] = useState(() => {
		if (initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate)) return initialDate
		return getTodayLocal()
	})
	const [turnOffMissingSiteId, setTurnOffMissingSiteId] = useState<
		string | null
	>(null)
	const [exporting, setExporting] = useState(false)
	const [assignedAccounts, setAssignedAccounts] = useState<Profile[] | null>(
		null,
	)
	useEffect(() => {
		if (!siteId) return
		if (currentUser?.role !== "admin") {
			setAssignedAccounts([])
			return
		}
		listLoggers().then((list) => {
			if (!list) {
				setAssignedAccounts([])
				return
			}
			const assigned = list.filter(
				(p) =>
					!p.disabled &&
					(p.role === "admin" || (p.assigned_site_ids ?? []).includes(siteId)),
			)
			setAssignedAccounts(assigned)
		})
	}, [currentUser?.role, siteId])
	const site = useMemo(
		() => sites.find((s) => s.id === siteId),
		[sites, siteId],
	)
	const health = useMemo(() => {
		if (!site) return null
		return computeHealth(
			{ sessions, badges, sites, selectedSite: siteId } as AppState,
			siteId,
			selectedDate,
		)
	}, [sessions, badges, sites, siteId, selectedDate, site])
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
			const tz = site.timeZone ?? DEFAULT_TIMEZONE
			const daySessions = Object.values(sessions).filter(
				(s) =>
					s.siteId === siteId &&
					getInventoryDayString(s.submittedAt || s.createdAt, tz) ===
						selectedDate,
			)
			const ExcelJS = (await import("exceljs")).default
			const wb = new ExcelJS.Workbook()
			wb.creator = "Peraton Inventory"
			const ws = wb.addWorksheet("Reconciliation Report", {
				views: [{ state: "frozen", ySplit: 1 }],
			})
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
			ws.mergeCells(row, 1, row, 5)
			ws.getCell(row, 1).value = "Verification Logs"
			ws.getCell(row, 1).font = sectionFont
			ws.getCell(row, 1).fill = sectionFill
			ws.getCell(row, 1).border = thinBorder
			row += 1
			const logHeaders = [
				"Session ID",
				"Account",
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
			ws.mergeCells(row, 1, row, 4)
			ws.getCell(row, 1).value = "Unreconciled Assets (Status: Open)"
			ws.getCell(row, 1).font = sectionFont
			ws.getCell(row, 1).fill = sectionFill
			ws.getCell(row, 1).border = thinBorder
			row += 1
			const assetHeaders = ["Asset Code", "Site", "Last Reported By", "Status"]
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

	const canAccess =
		currentUser?.role === "admin" ||
		currentUser?.assignedSiteIds?.includes(siteId)
	if (!site || !health || !canAccess) {
		return (
			<AppLayout>
				<div className="p-8">
					<Link
						href={`/dashboard?date=${selectedDate}`}
						className="text-sm font-medium text-slate-600 hover:text-slate-900"
					>
						← Dashboard
					</Link>
					<p className="mt-4 text-slate-500">
						{!site
							? "Facility not found."
							: "You don't have access to this facility."}
					</p>
				</div>
			</AppLayout>
		)
	}
	const siteTz = site.timeZone ?? DEFAULT_TIMEZONE
	const targetSessions = Object.values(sessions).filter(
		(s) =>
			s.siteId === siteId &&
			getInventoryDayString(s.submittedAt || s.createdAt, siteTz) ===
				selectedDate,
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
						<Link
							href={`/dashboard?date=${selectedDate}`}
							className="text-sm font-medium text-slate-500 hover:text-slate-900 mb-3 inline-block"
						>
							← Dashboard
						</Link>
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

						{currentUser?.role === "admin" && (
							<Link
								href={`/admin/sites/${siteId}`}
								className="flex items-center gap-3 bg-white border border-slate-200 px-6 py-3 rounded-xl shadow-card-sm hover:border-slate-900 transition-all text-xs font-black text-slate-600 uppercase tracking-widest"
							>
								<Tag className="w-4 h-4" />
								View badges
							</Link>
						)}

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

				{/* Badges + Assigned: two columns */}
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
					<div className="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden">
						<div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
							<h2 className="font-bold text-slate-900 text-xs uppercase tracking-widest flex items-center gap-2">
								<Tag className="w-4 h-4 text-slate-400" /> Badges
							</h2>
							{currentUser?.role === "admin" && (
								<Link
									href={`/admin/sites/${siteId}`}
									className="text-[10px] font-bold text-slate-500 hover:text-slate-900 uppercase tracking-widest flex items-center gap-1"
								>
									Manage <ChevronRight className="w-3 h-3" />
								</Link>
							)}
						</div>
						<div className="overflow-y-auto max-h-[280px]">
							{(() => {
								const siteBadges = badges
									.filter((b) => b.siteId === siteId)
									.sort((a, b) => a.code.localeCompare(b.code))
								if (siteBadges.length === 0) {
									return (
										<div className="p-6 text-center text-slate-500 text-sm">
											No badges at this facility.
										</div>
									)
								}
								return (
									<table className="w-full text-left">
										<thead>
											<tr className="border-b border-slate-100 bg-slate-50/50">
												<th className="px-6 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
													Code
												</th>
												<th className="px-6 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
													Status
												</th>
											</tr>
										</thead>
										<tbody className="divide-y divide-slate-50">
											{siteBadges.map((b) => (
												<tr key={b.id} className="hover:bg-slate-50/50">
													<td className="px-6 py-2.5 font-mono text-sm font-semibold text-slate-800">
														{b.code}
													</td>
													<td className="px-6 py-2.5">
														<span
															className={`text-[10px] font-bold uppercase tracking-wider ${
																b.active ? "text-teal-600" : "text-slate-400"
															}`}
														>
															{b.active ? "On" : "Off"}
														</span>
													</td>
												</tr>
											))}
										</tbody>
									</table>
								)
							})()}
						</div>
					</div>

					<div className="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden">
						<div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
							<h2 className="font-bold text-slate-900 text-xs uppercase tracking-widest flex items-center gap-2">
								<User className="w-4 h-4 text-slate-400" /> Assigned to this
								facility
							</h2>
							{currentUser?.role === "admin" && (
								<Link
									href="/admin/loggers"
									className="text-[10px] font-bold text-slate-500 hover:text-slate-900 uppercase tracking-widest flex items-center gap-1"
								>
									Accounts <ChevronRight className="w-3 h-3" />
								</Link>
							)}
						</div>
						<div className="overflow-y-auto max-h-[280px]">
							{assignedAccounts === null ? (
								<div className="p-6 text-center text-slate-400 text-sm">
									Loading…
								</div>
							) : assignedAccounts.length === 0 ? (
								<div className="p-6 text-center text-slate-500 text-sm">
									{currentUser?.role === "admin"
										? "No accounts assigned to this facility."
										: "—"}
								</div>
							) : (
								<ul className="divide-y divide-slate-50">
									{assignedAccounts.map((p) => (
										<li
											key={p.id}
											className="px-6 py-2.5 flex items-center justify-between gap-2"
										>
											<div className="min-w-0">
												<p className="font-semibold text-slate-800 text-sm truncate">
													{p.full_name || p.email}
												</p>
												<p className="text-[10px] text-slate-500 truncate">
													{p.email}
												</p>
											</div>
											<span
												className={`shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
													p.role === "admin"
														? "bg-slate-100 text-slate-600"
														: "bg-slate-50 text-slate-500"
												}`}
											>
												{p.role}
											</span>
										</li>
									))}
								</ul>
							)}
						</div>
					</div>
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
					<div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden flex flex-col">
						<div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
							<div className="flex items-center gap-2">
								<h2 className="font-bold text-slate-900 text-xs uppercase tracking-widest flex items-center gap-2">
									<ShieldAlert className="w-4 h-4 text-slate-400" />{" "}
									Unreconciled Items
								</h2>
								<span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest underline underline-offset-4 decoration-slate-200">
									Inventory Status: Review
								</span>
							</div>
							{health.missingCount > 0 && (
								<button
									type="button"
									onClick={async () => {
										setTurnOffMissingSiteId(siteId)
										const res = await turnOffMissingBadgesForSite(siteId)
										setTurnOffMissingSiteId(null)
										if (res.ok && res.count > 0) {
											const rows = await fetchBadges()
											setBadges(badgeRowsToBadges(rows))
										}
									}}
									disabled={turnOffMissingSiteId === siteId}
									className="flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg border-2 border-slate-200 text-slate-700 text-[10px] font-bold uppercase tracking-wider hover:bg-slate-100 disabled:opacity-60 transition-all"
								>
									{turnOffMissingSiteId === siteId
										? "Turning off…"
										: "Turn off all missing"}
								</button>
							)}
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

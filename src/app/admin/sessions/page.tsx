"use client"

import { AppLayout } from "@/components/AppLayout"
import { Button } from "@/components/ui/Button"
import { Select } from "@/components/ui/Select"
import { useStore } from "@/lib/store"
import { formatLocalTime } from "@/lib/time"
import Link from "next/link"
import {
	DownloadCloud,
	Shield,
	Filter,
	Calendar,
	Search,
	ArrowRight,
	ExternalLink,
} from "lucide-react"
import { useState, useMemo } from "react"

export default function AdminSessionsPage() {
	const { sessions, sites, currentUser } = useStore()
	const [filterSite, setFilterSite] = useState<string>("ALL")
	const [search, setSearch] = useState("")
	const [startDate, setStartDate] = useState<string>("")
	const [endDate, setEndDate] = useState<string>("")

	const filteredSessions = useMemo(() => {
		return Object.values(sessions)
			.filter((s) => {
				const site = sites.find((st) => st.id === s.siteId)
				const matchesSiteFilter =
					filterSite === "ALL" || s.siteId === filterSite

				const sTime = new Date(s.createdAt).getTime()
				const matchesStart = !startDate
					? true
					: sTime >= new Date(startDate).getTime()

				const matchesEnd = !endDate
					? true
					: sTime <= new Date(endDate).getTime() + 86400000

				const matchesSearch = !search
					? true
					: s.createdBy.toLowerCase().includes(search.toLowerCase()) ||
						s.siteId.toLowerCase().includes(search.toLowerCase()) ||
						(site?.name.toLowerCase().includes(search.toLowerCase()) ?? false)

				return matchesSiteFilter && matchesStart && matchesEnd && matchesSearch
			})
			.sort(
				(a, b) =>
					new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
			)
	}, [sessions, filterSite, startDate, endDate, search, sites])

	const handleExportCsv = () => {
		if (filteredSessions.length === 0) return

		const headers = [
			"Site ID",
			"Site Name",
			"Logger",
			"Status",
			"Started (UTC)",
			"Submitted (UTC)",
			"Total",
			"Present",
			"Missing",
		]
		const rows = filteredSessions.map((s) => {
			const site = sites.find((st) => st.id === s.siteId)
			const items = Object.values(s.items)
			const missing = items.filter((i) => i.state === "missing").length
			const present = items.filter((i) => i.state === "present").length

			return [
				s.siteId,
				site?.name || "Unknown",
				s.createdBy,
				s.status.toUpperCase(),
				s.createdAt,
				s.submittedAt || "N/A",
				items.length,
				present,
				missing,
			]
		})

		const csvContent = [headers, ...rows].map((e) => e.join(",")).join("\n")
		const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
		const link = document.createElement("a")
		const url = URL.createObjectURL(blob)
		link.setAttribute("href", url)
		link.setAttribute(
			"download",
			`audit_log_${new Date().toISOString().split("T")[0]}.csv`,
		)
		link.style.visibility = "hidden"
		document.body.appendChild(link)
		link.click()
		document.body.removeChild(link)
	}

	if (currentUser?.role !== "admin") {
		return (
			<AppLayout>
				<div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-500">
					<Shield className="w-16 h-16 mb-4 opacity-10" />
					<p className="text-xl font-bold tracking-tight text-slate-900">
						Access Restricted
					</p>
					<p className="text-sm font-medium">
						Administrator credentials required for secure audit examination.
					</p>
				</div>
			</AppLayout>
		)
	}

	return (
		<AppLayout>
			<div className="flex flex-col gap-10">
				<div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 pb-8">
					<div>
						<h1 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-none">
							Audit Log
						</h1>
						<p className="text-slate-500 text-sm mt-1">
							Submitted inventory sessions
						</p>
					</div>

					<Button
						variant="secondary"
						size="sm"
						onClick={handleExportCsv}
						disabled={filteredSessions.length === 0}
						className="inline-flex items-center gap-2"
					>
						<DownloadCloud className="w-4 h-4 shrink-0" />
						Export CSV
					</Button>
				</div>

				{/* Filters */}
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm items-center">
					<div className="lg:col-span-1 flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 min-h-[44px]">
						<Search className="w-3.5 h-3.5 shrink-0 text-slate-400" />
						<input
							type="text"
							placeholder="Search logger or ID..."
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							className="bg-transparent border-none text-xs font-medium text-slate-900 focus:ring-0 w-full min-w-0 placeholder:text-slate-400"
						/>
					</div>

					<div className="lg:col-span-1 flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 min-h-[44px]">
						<Filter className="w-3.5 h-3.5 shrink-0 text-slate-400" />
						<Select
							value={filterSite}
							onChange={(e) => setFilterSite(e.target.value)}
							className="text-xs !min-h-[36px] !py-1.5 !border-0 !bg-transparent"
						>
							<option value="ALL">Every facility</option>
							{sites.map((s) => (
								<option key={s.id} value={s.id}>
									{s.name}
								</option>
							))}
						</Select>
					</div>

					<div className="lg:col-span-1 flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 min-h-[44px]">
						<Calendar className="w-3.5 h-3.5 shrink-0 text-slate-400" />
						<input
							type="date"
							value={startDate}
							onChange={(e) => setStartDate(e.target.value)}
							className="bg-transparent border-none text-xs font-medium text-slate-900 focus:ring-0 cursor-pointer w-full min-w-0"
						/>
					</div>

					<div className="lg:col-span-1 flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 min-h-[44px]">
						<ArrowRight className="w-3.5 h-3.5 shrink-0 text-slate-400" />
						<input
							type="date"
							value={endDate}
							onChange={(e) => setEndDate(e.target.value)}
							className="bg-transparent border-none text-xs font-medium text-slate-900 focus:ring-0 cursor-pointer w-full min-w-0"
						/>
					</div>

					<div className="lg:col-span-1 flex items-center justify-end bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 min-h-[44px]">
						<p className="text-xs font-medium text-slate-500">
							Matching:{" "}
							<span className="text-slate-900 font-semibold">
								{filteredSessions.length}
							</span>
						</p>
					</div>
				</div>

				{/* Audit Stream */}
				<div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
					<div className="overflow-x-auto">
						<table className="w-full text-left border-collapse">
							<thead>
								<tr className="bg-slate-50/50 border-b border-slate-100">
									<th className="px-6 py-4 text-[9px] font-bold uppercase tracking-widest text-slate-400">
										Target Site
									</th>
									<th className="px-6 py-4 text-[9px] font-bold uppercase tracking-widest text-slate-400">
										Reporting Logger
									</th>
									<th className="px-6 py-4 text-[9px] font-bold uppercase tracking-widest text-slate-400">
										Cycle Window
									</th>
									<th className="px-6 py-4 text-[9px] font-bold uppercase tracking-widest text-slate-400">
										Drift Result
									</th>
									<th className="px-6 py-4 text-[9px] font-bold uppercase tracking-widest text-slate-400">
										Status
									</th>
									<th className="px-6 py-4 text-[9px] font-bold uppercase tracking-widest text-slate-400 text-right">
										Integrity
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-100">
								{filteredSessions.length === 0 ? (
									<tr>
										<td
											colSpan={6}
											className="px-6 py-20 text-center text-slate-500 text-sm"
										>
											No sessions match the current filters.
										</td>
									</tr>
								) : (
									filteredSessions.map((session) => {
										const site = sites.find((s) => s.id === session.siteId)
										const items = Object.values(session.items)
										const missingCount = items.filter(
											(i) => i.state === "missing",
										).length

										return (
											<tr
												key={session.id}
												className="group hover:bg-slate-50/50 transition-all"
											>
												<td className="px-6 py-5">
													<div className="flex flex-col">
														<span className="text-sm font-bold text-slate-900 group-hover:text-[#0F1C3F] transition-colors">
															{site?.name || "Facility Null"}
														</span>
														<span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
															{session.siteId}
														</span>
													</div>
												</td>
												<td className="px-6 py-5">
													<div className="flex items-center gap-2.5">
														<div className="w-6 h-6 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500">
															{session.createdBy[0]}
														</div>
														<span className="text-xs font-bold text-slate-700">
															{session.createdBy}
														</span>
													</div>
												</td>
												<td className="px-6 py-5">
													<div className="flex flex-col">
														<span className="text-xs font-bold text-slate-900">
															{site
																? formatLocalTime(session.createdAt).split(
																		"at",
																	)[1]
																: "-"}
														</span>
														<span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
															{site
																? formatLocalTime(session.createdAt).split(
																		"at",
																	)[0]
																: "-"}
														</span>
													</div>
												</td>
												<td className="px-6 py-5 font-bold">
													{session.status === "submitted" ? (
														<div className="flex items-center gap-2">
															<div
																className={`w-1.5 h-1.5 rounded-full ${missingCount > 0 ? "bg-red-500" : "bg-teal-500"}`}
															/>
															<span
																className={`text-xs ${missingCount > 0 ? "text-red-700" : "text-teal-700"}`}
															>
																{missingCount} Critical Discrepancies
															</span>
														</div>
													) : (
														<span className="text-slate-400 font-semibold italic text-[10px] uppercase">
															Draft State
														</span>
													)}
												</td>
												<td className="px-6 py-5">
													{session.status === "draft" ? (
														<span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[9px] font-bold uppercase tracking-widest">
															In Progress
														</span>
													) : session.isSuperseded ? (
														<span className="px-2 py-0.5 bg-slate-50 text-slate-500 border border-slate-200 rounded text-[9px] font-bold uppercase tracking-widest">
															Superseded
														</span>
													) : (
														<span className="px-2 py-0.5 bg-teal-50 text-teal-700 border border-teal-200 rounded text-[9px] font-bold uppercase tracking-widest">
															Active State
														</span>
													)}
												</td>
												<td className="px-6 py-5 text-right">
													<Link
														href={
															session.status === "submitted"
																? `/sessions/${session.id}`
																: `/session/${session.id}`
														}
														className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-[#0F1C3F] uppercase tracking-widest transition-colors opacity-40 group-hover:opacity-100"
													>
														Examine <ExternalLink className="w-3 h-3" />
													</Link>
												</td>
											</tr>
										)
									})
								)}
							</tbody>
						</table>
					</div>
				</div>

				<div className="flex items-center justify-between px-6 py-4 text-xs text-slate-500 border-t border-slate-100">
					<div>
						Date range: {startDate || "—"} to {endDate || "—"}
					</div>
					<p className="max-w-[400px] text-right text-[10px]">
						Exports are logged. User: {currentUser?.email ?? "—"}
					</p>
				</div>
			</div>
		</AppLayout>
	)
}

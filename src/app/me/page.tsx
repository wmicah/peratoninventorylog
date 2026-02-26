"use client"

import { AppLayout } from "@/components/AppLayout"
import { Select } from "@/components/ui/Select"
import { useStore } from "@/lib/store"
import { formatLocalTime } from "@/lib/time"
import Link from "next/link"
import { Clock, Filter, Layers } from "lucide-react"
import { useState } from "react"

export default function MySessionsPage() {
	const { sessions, sites, currentUser } = useStore()

	const [filterSite, setFilterSite] = useState<string>("ALL")

	const mySessions = Object.values(sessions)
		.filter(
			(s) =>
				s.createdBy === currentUser?.name || s.createdBy === currentUser?.email,
		)
		.filter((s) => filterSite === "ALL" || s.siteId === filterSite)
		.sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
		)

	return (
		<AppLayout>
			<div className="flex flex-col gap-6 max-w-6xl mx-auto">
				<div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-4">
					<div>
						<h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
							<Layers className="w-6 h-6 text-[var(--color-accent)]" /> My
							Sessions
						</h1>
						<p className="text-slate-500 font-medium">
							History of inventory submissions
						</p>
					</div>
					<div className="flex items-center gap-3">
						<Filter className="w-4 h-4 text-slate-400" />
						<Select
							value={filterSite}
							onChange={(e) => setFilterSite(e.target.value)}
							className="min-w-[200px]"
						>
							<option value="ALL">All Sites</option>
							{sites.map((s) => (
								<option key={s.id} value={s.id}>
									{s.name} ({s.id})
								</option>
							))}
						</Select>
					</div>
				</div>

				<div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
					<table className="w-full text-left text-sm whitespace-nowrap">
						<thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-900 border-t border-t-slate-100">
							<tr>
								<th className="px-6 py-4">Status</th>
								<th className="px-6 py-4">Site</th>
								<th className="px-6 py-4">Date Started</th>
								<th className="px-6 py-4">Missing</th>
								<th className="px-6 py-4 text-right">Actions</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-100 bg-white text-slate-600 font-medium">
							{mySessions.length === 0 ? (
								<tr>
									<td
										colSpan={5}
										className="px-6 py-12 text-center text-slate-500"
									>
										<div className="flex flex-col items-center justify-center gap-2">
											<Clock className="w-8 h-8 text-slate-300" />
											<span>
												No sessions found.{" "}
												<Link
													href="/start"
													className="font-semibold text-[var(--color-primary-900)] hover:underline"
												>
													Go to Start
												</Link>{" "}
												to begin taking inventory.
											</span>
										</div>
									</td>
								</tr>
							) : (
								mySessions.map((session) => {
									const site = sites.find((s) => s.id === session.siteId)
									const missingCount = Object.values(session.items).filter(
										(i) => i.state === "missing",
									).length

									return (
										<tr
											key={session.id}
											className="hover:bg-slate-50 transition-colors"
										>
											<td className="px-6 py-4">
												{session.status === "draft" ? (
													<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
														Draft
													</span>
												) : session.isSuperseded ? (
													<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
														Replaced
													</span>
												) : (
													<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
														Submitted
													</span>
												)}
											</td>
											<td className="px-6 py-4 text-slate-900 font-bold">
												{site?.id || session.siteId}
											</td>
											<td className="px-6 py-4">
												{site && formatLocalTime(session.createdAt)}
											</td>
											<td className="px-6 py-4">
												{session.status === "submitted" ? (
													<span
														className={`font-bold ${missingCount > 0 ? "text-red-600" : "text-teal-600"}`}
													>
														{missingCount} missing
													</span>
												) : (
													<span className="text-slate-400 font-normal italic">
														In progress
													</span>
												)}
											</td>
											<td className="px-6 py-4 text-right">
												{session.status === "draft" ? (
													<Link
														href={`/session/${session.id}`}
														className="text-[var(--color-primary)] hover:underline font-bold"
													>
														Resume &rarr;
													</Link>
												) : (
													<Link
														href={`/sessions/${session.id}`}
														className="text-[var(--color-accent)] hover:underline font-bold"
													>
														View Details &rarr;
													</Link>
												)}
											</td>
										</tr>
									)
								})
							)}
						</tbody>
					</table>
				</div>
			</div>
		</AppLayout>
	)
}

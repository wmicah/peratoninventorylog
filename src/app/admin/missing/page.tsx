"use client"

import { AppLayout } from "@/components/AppLayout"
import {
	useStore,
	type AppState,
	formatBadgeLabel,
	type Badge,
} from "@/lib/store"
import { computeHealth } from "@/lib/inventoryLogic"
import { updateBadge } from "@/app/actions/badges"
import { fetchBadges, badgeRowsToBadges } from "@/lib/db"
import { DEACTIVATED_REASON_PRESETS } from "@/lib/badgeReasons"
import { AlertCircle, Loader2, ToggleLeft, ToggleRight } from "lucide-react"
import { useMemo, useEffect, useState } from "react"

type MissingRow = {
	siteId: string
	siteName: string
	badge: Badge
	guestName?: string
	sponsorName?: string
}

export default function AdminMissingPage() {
	const { currentUser, sessions, badges, sites, setBadges } = useStore()
	const [mounted, setMounted] = useState(false)
	const [togglingId, setTogglingId] = useState<string | null>(null)
	const [message, setMessage] = useState<{
		type: "ok" | "err"
		text: string
	} | null>(null)
	const [editingReasonBadgeId, setEditingReasonBadgeId] = useState<
		string | null
	>(null)
	const [editingReasonValue, setEditingReasonValue] = useState("")
	const [savingReasonId, setSavingReasonId] = useState<string | null>(null)

	useEffect(() => {
		setMounted(true)
	}, [])

	// Refresh badges from DB so we have latest active state
	useEffect(() => {
		if (!mounted) return
		fetchBadges()
			.then((rows) => setBadges(badgeRowsToBadges(rows)))
			.catch(() => {})
	}, [mounted, setBadges])

	const missingRows = useMemo(() => {
		if (!mounted) return []
		const state = { sessions, badges, sites } as AppState
		const rows: MissingRow[] = []
		for (const site of sites) {
			const health = computeHealth(state, site.id)
			for (const m of health.missingList) {
				rows.push({
					siteId: site.id,
					siteName: site.name,
					badge: m.badge,
					guestName: m.guestName,
					sponsorName: m.sponsorName,
				})
			}
		}
		// Sort by site then badge code
		rows.sort((a, b) => {
			if (a.siteName !== b.siteName) return a.siteName.localeCompare(b.siteName)
			return a.badge.code.localeCompare(b.badge.code)
		})
		return rows
	}, [mounted, sessions, badges, sites])

	const handleToggleActive = async (badgeId: string) => {
		const badge = badges.find((b) => b.id === badgeId)
		if (!badge) return
		setMessage(null)
		setTogglingId(badgeId)
		const nextActive = !badge.active
		setBadges(
			badges.map((b) => (b.id === badgeId ? { ...b, active: nextActive } : b)),
		)
		const res = await updateBadge(badgeId, {
			active: nextActive,
			...(nextActive && { deactivatedReason: null }),
		})
		setTogglingId(null)
		if (!res.ok) {
			setMessage({ type: "err", text: res.error })
			const rows = await fetchBadges()
			setBadges(badgeRowsToBadges(rows))
		} else {
			const rows = await fetchBadges()
			setBadges(badgeRowsToBadges(rows))
			setMessage({
				type: "ok",
				text: nextActive
					? "Badge shown in inventory again."
					: "Badge hidden from inventory. Turn off the physical badge in your other software.",
			})
			setTimeout(() => setMessage(null), 4000)
			if (!nextActive) {
				setEditingReasonBadgeId(badgeId)
				setEditingReasonValue(
					badges.find((b) => b.id === badgeId)?.deactivatedReason ?? "",
				)
			} else setEditingReasonBadgeId(null)
		}
	}

	const handleSaveReason = async (badgeId: string) => {
		setSavingReasonId(badgeId)
		const res = await updateBadge(badgeId, {
			deactivatedReason: editingReasonValue.trim() || null,
		})
		setSavingReasonId(null)
		setEditingReasonBadgeId(null)
		if (res.ok) {
			setBadges(
				badges.map((b) =>
					b.id === badgeId
						? { ...b, deactivatedReason: editingReasonValue.trim() || null }
						: b,
				),
			)
			const rows = await fetchBadges()
			setBadges(badgeRowsToBadges(rows))
		} else {
			setMessage({ type: "err", text: res.error })
		}
	}

	if (currentUser?.role !== "admin") {
		return (
			<AppLayout>
				<div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-500">
					<AlertCircle className="w-16 h-16 mb-4 opacity-10" />
					<p className="text-xl font-black tracking-tight text-slate-900">
						Access Restricted
					</p>
					<p className="text-sm font-medium">
						Administrator credentials required.
					</p>
				</div>
			</AppLayout>
		)
	}

	return (
		<AppLayout>
			<div className="max-w-5xl mx-auto">
				<div className="mb-6">
					<h1 className="text-2xl font-black text-slate-900 tracking-tight">
						Open items (missing badges)
					</h1>
					<p className="text-sm text-slate-500 mt-1">
						All badges currently reported missing from the latest run per
						facility. A badge stays missing until a new inventory marks it
						present (e.g. if Tuesday was skipped, Monday’s missing list still
						applies). Turn off &quot;In inventory&quot; to hide a badge from
						officers while you disable it in your other software; turn it back
						on when the physical badge is active again.
					</p>
				</div>

				{message && (
					<div
						className={`rounded-lg border px-4 py-3 text-sm font-semibold mb-4 ${
							message.type === "ok"
								? "bg-emerald-50 border-emerald-200 text-emerald-800"
								: "bg-red-50 border-red-200 text-red-800"
						}`}
					>
						{message.text}
					</div>
				)}

				{missingRows.length === 0 ? (
					<div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
						<p className="font-semibold">No open items</p>
						<p className="text-sm mt-1">
							There are no badges currently reported missing from the latest
							inventory run at any facility.
						</p>
					</div>
				) : (
					<div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
						<div className="overflow-x-auto">
							<table className="w-full text-left">
								<thead>
									<tr className="border-b border-slate-200 bg-slate-50">
										<th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
											Facility
										</th>
										<th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
											Badge
										</th>
										<th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
											Guest
										</th>
										<th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
											Sponsor
										</th>
										<th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
											Reason (why off)
										</th>
										<th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest w-[140px]">
											In inventory
										</th>
									</tr>
								</thead>
								<tbody>
									{missingRows.map((row) => (
										<tr
											key={`${row.siteId}-${row.badge.id}`}
											className="border-b border-slate-100 hover:bg-slate-50/50"
										>
											<td className="px-4 py-3 font-medium text-slate-900">
												{row.siteName}
											</td>
											<td className="px-4 py-3 font-mono text-sm font-semibold text-slate-800">
												{formatBadgeLabel(row.badge)}
											</td>
											<td className="px-4 py-3 text-slate-600">
												{row.guestName ?? "—"}
											</td>
											<td className="px-4 py-3 text-slate-600">
												{row.sponsorName ?? "—"}
											</td>
											<td className="px-4 py-3 text-slate-600 max-w-[200px]">
												{editingReasonBadgeId === row.badge.id ? (
													<div className="flex flex-col gap-1.5">
														<select
															value={
																DEACTIVATED_REASON_PRESETS.includes(
																	editingReasonValue as (typeof DEACTIVATED_REASON_PRESETS)[number],
																)
																	? editingReasonValue
																	: "Other"
															}
															onChange={(e) => {
																const v = e.target.value
																setEditingReasonValue(v === "Other" ? "" : v)
															}}
															className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded bg-white"
														>
															{DEACTIVATED_REASON_PRESETS.map((r) => (
																<option key={r} value={r}>
																	{r}
																</option>
															))}
														</select>
														{!DEACTIVATED_REASON_PRESETS.includes(
															editingReasonValue as (typeof DEACTIVATED_REASON_PRESETS)[number],
														) && (
															<input
																type="text"
																value={editingReasonValue}
																onChange={(e) =>
																	setEditingReasonValue(e.target.value)
																}
																placeholder="Custom reason (or leave blank)"
																className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded bg-white"
															/>
														)}
														<div className="flex gap-2">
															<button
																type="button"
																onClick={() => handleSaveReason(row.badge.id)}
																disabled={savingReasonId === row.badge.id}
																className="text-[10px] font-bold text-emerald-600 hover:underline"
															>
																{savingReasonId === row.badge.id
																	? "Saving…"
																	: "Save"}
															</button>
															<button
																type="button"
																onClick={() => {
																	setEditingReasonBadgeId(null)
																	setEditingReasonValue("")
																}}
																className="text-[10px] font-bold text-slate-500 hover:underline"
															>
																Cancel
															</button>
														</div>
													</div>
												) : (
													<>
														<span className="text-xs">
															{row.badge.deactivatedReason ?? "—"}
														</span>
														{!row.badge.active && (
															<button
																type="button"
																onClick={() => {
																	setEditingReasonBadgeId(row.badge.id)
																	setEditingReasonValue(
																		row.badge.deactivatedReason ?? "",
																	)
																}}
																className="ml-2 text-[10px] font-bold text-slate-500 hover:underline"
															>
																Edit
															</button>
														)}
													</>
												)}
											</td>
											<td className="px-4 py-3">
												<button
													type="button"
													onClick={() => handleToggleActive(row.badge.id)}
													disabled={togglingId === row.badge.id}
													className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 text-xs font-bold uppercase tracking-wider transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 ${
														row.badge.active
															? "bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100 focus:ring-emerald-300"
															: "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200 focus:ring-slate-300"
													}`}
													title={
														row.badge.active
															? "Hide from inventory (turn off in other software)"
															: "Show in inventory again"
													}
												>
													{togglingId === row.badge.id ? (
														<Loader2 className="w-3.5 h-3.5 animate-spin" />
													) : row.badge.active ? (
														<ToggleRight className="w-3.5 h-3.5" />
													) : (
														<ToggleLeft className="w-3.5 h-3.5" />
													)}
													{row.badge.active ? "On" : "Off"}
												</button>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>
				)}
			</div>
		</AppLayout>
	)
}

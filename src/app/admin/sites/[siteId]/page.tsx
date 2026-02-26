"use client"

import { AppLayout } from "@/components/AppLayout"
import { Button } from "@/components/ui/Button"
import { useStore } from "@/lib/store"
import { fetchBadges, badgeRowsToBadges } from "@/lib/db"
import { createBadges, updateBadge } from "@/app/actions/badges"
import {
	MapPin,
	ChevronLeft,
	Tag,
	Plus,
	Trash2,
	FileUp,
	ClipboardList,
	Loader2,
	Filter,
} from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useState, useMemo, useEffect } from "react"
import {
	PaginationBar,
	BADGE_LIST_PAGE_SIZE,
} from "@/components/ui/PaginationBar"

type StatusFilter = "all" | "active" | "inactive"
type SortBy = "recent" | "type"

/** Category order for "Badge type" sort: Escort Required → No Escort → Employee Temp → Foreign → others */
const CATEGORY_SORT_ORDER = [
	"cat-escort", // Escort Required
	"cat-no-escort", // No Escort Required
	"cat-temp", // Employee Temp
	"cat-foreign", // Foreign National
]

export default function AdminSiteDetailsPage() {
	const params = useParams()
	const siteId = (params?.siteId as string) ?? ""

	const { sites, badges, categories, setBadges, addBadge, removeBadge } =
		useStore()

	const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
	const [categoryFilter, setCategoryFilter] = useState<string>("all")
	const [sortBy, setSortBy] = useState<SortBy>("recent")
	const [page, setPage] = useState(1)
	const [message, setMessage] = useState<{
		type: "ok" | "err"
		text: string
	} | null>(null)
	const [addingBadge, setAddingBadge] = useState(false)
	const [newCode, setNewCode] = useState("")
	const [newCategoryId, setNewCategoryId] = useState("")
	const [showBulk, setShowBulk] = useState(false)
	const [bulkText, setBulkText] = useState("")
	const [bulkDefaultCategoryId, setBulkDefaultCategoryId] = useState("")
	const [bulkFile, setBulkFile] = useState<File | null>(null)
	const [bulkSubmitting, setBulkSubmitting] = useState(false)

	const site = useMemo(
		() => sites.find((s) => s.id === siteId),
		[sites, siteId],
	)

	const siteBadgesAll = useMemo(
		() => badges.filter((b) => b.siteId === siteId),
		[badges, siteId],
	)

	const filteredAndSortedBadges = useMemo(() => {
		let list = siteBadgesAll

		if (statusFilter === "active") list = list.filter((b) => b.active)
		if (statusFilter === "inactive") list = list.filter((b) => !b.active)
		if (categoryFilter !== "all")
			list = list.filter((b) => b.categoryId === categoryFilter)

		if (sortBy === "recent") {
			list = [...list].sort((a, b) => {
				const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0
				const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0
				return tb - ta
			})
		} else {
			// sortBy === "type"
			list = [...list].sort((a, b) => {
				const ia = CATEGORY_SORT_ORDER.indexOf(a.categoryId)
				const ib = CATEGORY_SORT_ORDER.indexOf(b.categoryId)
				const ai = ia === -1 ? CATEGORY_SORT_ORDER.length : ia
				const bi = ib === -1 ? CATEGORY_SORT_ORDER.length : ib
				if (ai !== bi) return ai - bi
				return a.code.localeCompare(b.code)
			})
		}

		return list
	}, [siteBadgesAll, statusFilter, categoryFilter, sortBy])

	const paginatedBadges = useMemo(() => {
		const start = (page - 1) * BADGE_LIST_PAGE_SIZE
		return filteredAndSortedBadges.slice(start, start + BADGE_LIST_PAGE_SIZE)
	}, [filteredAndSortedBadges, page])

	useEffect(() => {
		setPage(1)
	}, [statusFilter, categoryFilter, sortBy])

	useEffect(() => {
		fetchBadges()
			.then((rows) => setBadges(badgeRowsToBadges(rows)))
			.catch(() => {})
	}, [setBadges])

	const handleToggleActive = async (b: { id: string; active: boolean }) => {
		const nextActive = !b.active
		setMessage(null)
		// Update UI immediately
		setBadges(
			badges.map((badge) =>
				badge.id === b.id ? { ...badge, active: nextActive } : badge,
			),
		)
		const res = await updateBadge(b.id, { active: nextActive })
		if (!res.ok) {
			setMessage({ type: "err", text: res.error })
			// Revert on failure
			const rows = await fetchBadges()
			setBadges(badgeRowsToBadges(rows))
		}
	}

	const handleRemoveBadge = (badgeId: string) => {
		removeBadge(badgeId)
		fetchBadges()
			.then((rows) => setBadges(badgeRowsToBadges(rows)))
			.catch(() => {})
	}

	function parseBulkLines(
		text: string,
		defaultCategoryId: string,
	): { code: string; categoryId: string }[] {
		const lines = text
			.split(/\r?\n/)
			.map((l) => l.trim())
			.filter(Boolean)
		if (lines.length > 0 && /^code\s*,/i.test(lines[0])) lines.shift()
		const defaultId = defaultCategoryId || categories[0]?.id
		const out: { code: string; categoryId: string }[] = []
		const seen = new Set<string>()
		for (const line of lines) {
			const [codePart, categoryPart] = line
				.split(",")
				.map((s) => s?.trim() ?? "")
			const code = codePart?.trim()
			if (!code) continue
			const key = code.toUpperCase()
			if (seen.has(key)) continue
			seen.add(key)
			const categoryId = categoryPart
				? (categories.find(
						(c) =>
							c.id.toLowerCase() === categoryPart.toLowerCase() ||
							c.name.toLowerCase() === categoryPart.toLowerCase(),
					)?.id ?? defaultId)
				: defaultId
			out.push({ code, categoryId })
		}
		return out
	}

	const handleBulkSubmit = async () => {
		const fromText = parseBulkLines(bulkText, bulkDefaultCategoryId)
		let fromFile: { code: string; categoryId: string }[] = []
		if (bulkFile) {
			const text = await bulkFile.text()
			fromFile = parseBulkLines(
				text,
				(bulkDefaultCategoryId || categories[0]?.id) ?? "",
			)
			setBulkFile(null)
		}
		const combined = [...fromText]
		const seenCodes = new Set(fromText.map((b) => b.code.toUpperCase()))
		for (const b of fromFile) {
			if (seenCodes.has(b.code.toUpperCase())) continue
			seenCodes.add(b.code.toUpperCase())
			combined.push(b)
		}
		if (combined.length === 0) {
			setMessage({ type: "err", text: "No valid badges to add." })
			return
		}
		setBulkSubmitting(true)
		setMessage(null)
		const res = await createBadges(siteId, combined)
		setBulkSubmitting(false)
		if (res.ok) {
			setMessage({ type: "ok", text: `Added ${res.count} badge(s).` })
			setShowBulk(false)
			setBulkText("")
			setBulkDefaultCategoryId("")
			const rows = await fetchBadges()
			setBadges(badgeRowsToBadges(rows))
		} else {
			setMessage({ type: "err", text: res.error })
		}
	}

	const handleAddOne = () => {
		const code = newCode.trim()
		const categoryId = newCategoryId || categories[0]?.id
		if (!code || !categoryId) return
		addBadge({ code, categoryId, siteId })
		setNewCode("")
		setNewCategoryId("")
		setAddingBadge(false)
		fetchBadges()
			.then((rows) => setBadges(badgeRowsToBadges(rows)))
			.catch(() => {})
	}

	if (!site) {
		return (
			<AppLayout>
				<div className="flex flex-col items-center justify-center min-h-[40vh] text-slate-500">
					<p className="font-bold text-slate-700">Facility not found</p>
					<Link
						href="/admin/sites"
						className="text-sm text-emerald-600 hover:underline mt-2"
					>
						← Back to Facilities
					</Link>
				</div>
			</AppLayout>
		)
	}

	return (
		<AppLayout>
			<div className="max-w-5xl mx-auto space-y-6">
				{/* Back + site header */}
				<div className="flex flex-col gap-4">
					<Link
						href="/admin/sites"
						className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-slate-700 uppercase tracking-widest transition-colors"
					>
						<ChevronLeft className="w-3.5 h-3.5" /> Facilities
					</Link>
					<div className="flex flex-wrap items-start justify-between gap-4">
						<div>
							<h1 className="text-2xl font-bold text-slate-900">{site.name}</h1>
							<p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
								{site.id}
							</p>
							{site.address && (
								<p className="text-sm text-slate-500 mt-2 flex items-center gap-1">
									<MapPin className="w-3.5 h-3.5 shrink-0" />
									{site.address}
								</p>
							)}
						</div>
						<Link href="/admin/sites">
							<Button type="button" variant="secondary">
								Edit facility
							</Button>
						</Link>
					</div>
				</div>

				{message && (
					<div
						className={`rounded-lg px-4 py-2 text-sm ${
							message.type === "ok"
								? "bg-emerald-50 text-emerald-800"
								: "bg-red-50 text-red-800"
						}`}
					>
						{message.text}
					</div>
				)}

				{/* Badges section */}
				<div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
					<div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
						<span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
							<Tag className="w-3.5 h-3.5" /> Badges ({siteBadgesAll.length})
						</span>
						<div className="flex items-center gap-2 flex-wrap">
							{!addingBadge && !showBulk && (
								<>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onClick={() => {
											setAddingBadge(true)
											setNewCategoryId(categories[0]?.id ?? "")
										}}
									>
										<Plus className="w-3.5 h-3.5" /> Add
									</Button>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onClick={() => {
											setShowBulk(true)
											setBulkDefaultCategoryId(categories[0]?.id ?? "")
											setBulkText("")
											setBulkFile(null)
										}}
									>
										<ClipboardList className="w-3.5 h-3.5" /> Bulk add / Import
									</Button>
								</>
							)}
						</div>
					</div>

					{addingBadge && (
						<div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center gap-2">
							<input
								type="text"
								value={newCode}
								onChange={(e) => setNewCode(e.target.value)}
								placeholder="Badge code"
								className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
							/>
							<select
								value={newCategoryId}
								onChange={(e) => setNewCategoryId(e.target.value)}
								className="text-sm border border-slate-200 rounded-lg bg-white px-3 py-2"
							>
								{categories.map((c) => (
									<option key={c.id} value={c.id}>
										{c.name}
									</option>
								))}
							</select>
							<Button
								size="sm"
								onClick={handleAddOne}
								disabled={!newCode.trim()}
							>
								Add
							</Button>
							<button
								type="button"
								onClick={() => {
									setAddingBadge(false)
									setNewCode("")
								}}
								className="text-sm text-slate-500 hover:text-slate-700"
							>
								Cancel
							</button>
						</div>
					)}

					{showBulk && (
						<div className="px-6 py-4 bg-slate-50 border-b border-slate-100 space-y-4">
							<div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
								Paste or import
							</div>
							<div>
								<label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
									Default category
								</label>
								<select
									value={bulkDefaultCategoryId}
									onChange={(e) => setBulkDefaultCategoryId(e.target.value)}
									className="text-sm border border-slate-200 rounded-lg bg-white px-3 py-2 w-full max-w-xs"
								>
									{categories.map((c) => (
										<option key={c.id} value={c.id}>
											{c.name}
										</option>
									))}
								</select>
							</div>
							<div>
								<label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
									Paste list (one per line)
								</label>
								<textarea
									value={bulkText}
									onChange={(e) => setBulkText(e.target.value)}
									placeholder={"RES001\nRES002\nRES003,Escort Required"}
									rows={4}
									className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg bg-white"
								/>
							</div>
							<div>
								<input
									type="file"
									accept=".csv"
									onChange={(e) => setBulkFile(e.target.files?.[0] ?? null)}
									className="text-sm file:mr-3 file:py-2 file:px-3 file:rounded file:border file:border-slate-200 file:bg-white file:text-xs file:font-semibold"
								/>
							</div>
							<div className="flex gap-2">
								<Button
									variant="primary"
									disabled={bulkSubmitting}
									onClick={handleBulkSubmit}
								>
									{bulkSubmitting ? (
										<Loader2 className="w-4 h-4 animate-spin" />
									) : (
										<FileUp className="w-4 h-4" />
									)}
									{bulkSubmitting ? "Adding…" : "Add badges"}
								</Button>
								<Button
									variant="secondary"
									onClick={() => {
										setShowBulk(false)
										setBulkText("")
										setBulkFile(null)
									}}
								>
									Cancel
								</Button>
							</div>
						</div>
					)}

					{/* Filters */}
					<div className="px-6 py-3 border-b border-slate-100 flex flex-wrap items-center gap-4 bg-slate-50/50">
						<span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
							<Filter className="w-3 h-3" /> View
						</span>
						<select
							value={statusFilter}
							onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
							className="text-xs border border-slate-200 rounded-lg bg-white px-2 py-1.5"
						>
							<option value="all">All</option>
							<option value="active">Active for inventory</option>
							<option value="inactive">Inactive</option>
						</select>
						<select
							value={categoryFilter}
							onChange={(e) => setCategoryFilter(e.target.value)}
							className="text-xs border border-slate-200 rounded-lg bg-white px-2 py-1.5"
						>
							<option value="all">All types</option>
							{categories.map((c) => (
								<option key={c.id} value={c.id}>
									{c.name}
								</option>
							))}
						</select>
						<select
							value={sortBy}
							onChange={(e) => setSortBy(e.target.value as SortBy)}
							className="text-xs border border-slate-200 rounded-lg bg-white px-2 py-1.5"
						>
							<option value="recent">Recent</option>
							<option value="type">Badge type</option>
						</select>
					</div>

					{/* Table */}
					<div className="overflow-x-auto">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b border-slate-100 bg-slate-50/80">
									<th className="text-left px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
										Code
									</th>
									<th className="text-left px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
										Type
									</th>
									<th className="text-left px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
										#
									</th>
									<th className="text-left px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
										On for inventory
									</th>
									<th className="w-10 px-6 py-3" />
								</tr>
							</thead>
							<tbody>
								{filteredAndSortedBadges.length === 0 ? (
									<tr>
										<td
											colSpan={5}
											className="px-6 py-8 text-center text-slate-400 italic"
										>
											{siteBadgesAll.length === 0
												? "No badges yet. Add one above."
												: "No badges match the current filters."}
										</td>
									</tr>
								) : (
									paginatedBadges.map((b) => (
										<tr
											key={b.id}
											className="border-b border-slate-50 hover:bg-slate-50/50"
										>
											<td className="px-6 py-3 font-medium text-slate-800">
												{b.code}
											</td>
											<td className="px-6 py-3 text-slate-500 text-[10px] uppercase tracking-wider">
												{categories.find((c) => c.id === b.categoryId)?.name ??
													b.categoryId}
											</td>
											<td className="px-6 py-3 text-slate-500">
												{b.displayNumber != null ? b.displayNumber : "—"}
											</td>
											<td className="px-6 py-3">
												<label className="flex items-center gap-2">
													<input
														type="checkbox"
														checked={b.active}
														onChange={() => handleToggleActive(b)}
														className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
													/>
													{b.active ? "On" : "Off"}
												</label>
											</td>
											<td className="px-6 py-3">
												<button
													type="button"
													onClick={() => handleRemoveBadge(b.id)}
													className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
													title="Remove badge"
												>
													<Trash2 className="w-3.5 h-3.5" />
												</button>
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
					<PaginationBar
						total={filteredAndSortedBadges.length}
						pageSize={BADGE_LIST_PAGE_SIZE}
						currentPage={page}
						onPageChange={setPage}
						itemLabel="badges"
					/>
				</div>
			</div>
		</AppLayout>
	)
}

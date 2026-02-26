"use client"

import { AppLayout } from "@/components/AppLayout"
import { Button } from "@/components/ui/Button"
import { useStore } from "@/lib/store"
import { createSite, updateSite } from "@/app/actions/sites"
import { fetchSites, fetchBadges, badgeRowsToBadges } from "@/lib/db"
import { createBadges } from "@/app/actions/badges"
import {
	MapPin,
	Loader2,
	Check,
	Server,
	Search,
	Plus,
	Tag,
	FileUp,
	ClipboardList,
	ChevronRight,
} from "lucide-react"
import Link from "next/link"
import { useState, useMemo } from "react"

const TIMEZONE_OPTIONS = [
	{ value: "America/New_York", label: "Eastern (New York)" },
	{ value: "America/Chicago", label: "Central (Chicago)" },
	{ value: "America/Denver", label: "Mountain (Denver)" },
	{ value: "America/Los_Angeles", label: "Pacific (Los Angeles)" },
	{ value: "America/Phoenix", label: "Arizona (no DST)" },
]

export default function AdminSitesPage() {
	const {
		currentUser,
		sites,
		setSites,
		badges,
		categories,
		addBadge,
		setBadges,
	} = useStore()
	const [search, setSearch] = useState("")
	const [editingId, setEditingId] = useState<string | null>(null)
	const [editName, setEditName] = useState("")
	const [editAddress, setEditAddress] = useState("")
	const [editTimeZone, setEditTimeZone] = useState("America/New_York")
	const [saving, setSaving] = useState(false)
	const [addingBadgeSiteId, setAddingBadgeSiteId] = useState<string | null>(
		null,
	)
	const [newBadgeCode, setNewBadgeCode] = useState("")
	const [newBadgeCategoryId, setNewBadgeCategoryId] = useState("")
	const [bulkSiteId, setBulkSiteId] = useState<string | null>(null)
	const [bulkText, setBulkText] = useState("")
	const [bulkDefaultCategoryId, setBulkDefaultCategoryId] = useState("")
	const [bulkSubmitting, setBulkSubmitting] = useState(false)
	const [bulkFile, setBulkFile] = useState<File | null>(null)
	const [message, setMessage] = useState<{
		type: "ok" | "err"
		text: string
	} | null>(null)
	const [showCreate, setShowCreate] = useState(false)
	const [newId, setNewId] = useState("")
	const [newName, setNewName] = useState("")
	const [newAddress, setNewAddress] = useState("")
	const [newTimeZone, setNewTimeZone] = useState("America/New_York")
	const [creating, setCreating] = useState(false)

	// Filter sites by search (name, id, or address)
	const filteredSites = useMemo(() => {
		const q = search.trim().toLowerCase()
		if (!q) return sites
		return sites.filter(
			(s) =>
				s.name.toLowerCase().includes(q) ||
				s.id.toLowerCase().includes(q) ||
				(s.address && s.address.toLowerCase().includes(q)),
		)
	}, [sites, search])

	const startEdit = (id: string) => {
		const site = sites.find((s) => s.id === id)
		if (site) {
			setEditingId(id)
			setEditName(site.name)
			setEditAddress(site.address ?? "")
			setEditTimeZone(site.timeZone ?? "America/New_York")
			setMessage(null)
		}
	}

	const cancelEdit = () => {
		setEditingId(null)
		setEditName("")
		setEditAddress("")
		setEditTimeZone("America/New_York")
	}

	const saveEdit = async () => {
		if (!editingId) return
		setSaving(true)
		setMessage(null)
		const res = await updateSite(editingId, {
			name: editName,
			address: editAddress || null,
			timeZone: editTimeZone || null,
		})
		setSaving(false)
		if (res.ok) {
			setMessage({ type: "ok", text: "Facility updated." })
			const updated = await fetchSites()
			setSites(updated)
			setEditingId(null)
		} else {
			setMessage({ type: "err", text: res.error })
		}
	}

	const siteBadges = (siteId: string) =>
		badges.filter((b) => b.siteId === siteId)

	const handleAddBadge = (siteId: string) => {
		const code = newBadgeCode.trim()
		const categoryId = newBadgeCategoryId || categories[0]?.id
		if (!code || !categoryId) return
		addBadge({ code, categoryId, siteId, active: true })
		setNewBadgeCode("")
		setNewBadgeCategoryId("")
		setAddingBadgeSiteId(null)
		// Refresh badges from DB so list stays in sync
		fetchBadges()
			.then((rows) => setBadges(badgeRowsToBadges(rows)))
			.catch(() => {})
	}

	function resolveCategoryId(value: string): string | null {
		const v = value.trim().toLowerCase()
		const byId = categories.find((c) => c.id.toLowerCase() === v)
		if (byId) return byId.id
		const byName = categories.find((c) => c.name.toLowerCase() === v)
		return byName?.id ?? null
	}

	function parseBulkLines(
		text: string,
		defaultCategoryId: string,
	): { code: string; categoryId: string }[] {
		let lines = text
			.split(/\r?\n/)
			.map((l) => l.trim())
			.filter(Boolean)
		// Skip CSV header if it looks like "code,category"
		if (lines.length > 0 && /^code\s*,/i.test(lines[0])) lines = lines.slice(1)
		const defaultId = defaultCategoryId || categories[0]?.id
		const out: { code: string; categoryId: string }[] = []
		const seen = new Set<string>()
		for (const line of lines) {
			const [codePart, categoryPart] = line.split(",").map((s) => s.trim())
			const code = codePart?.trim()
			if (!code) continue
			const key = code.toUpperCase()
			if (seen.has(key)) continue
			seen.add(key)
			const categoryId = categoryPart
				? (resolveCategoryId(categoryPart) ?? defaultId)
				: defaultId
			if (!categoryId) continue
			out.push({ code, categoryId })
		}
		return out
	}

	const handleBulkSubmit = async (siteId: string) => {
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
			setMessage({
				type: "err",
				text: "No valid badges to add. Use one code per line, or CODE,CATEGORY.",
			})
			return
		}
		setBulkSubmitting(true)
		setMessage(null)
		const res = await createBadges(siteId, combined)
		setBulkSubmitting(false)
		if (res.ok) {
			setMessage({ type: "ok", text: `Added ${res.count} badge(s).` })
			setBulkSiteId(null)
			setBulkText("")
			setBulkDefaultCategoryId("")
			const updated = await fetchBadges()
			setBadges(badgeRowsToBadges(updated))
		} else {
			setMessage({ type: "err", text: res.error })
		}
	}

	const handleCreateFacility = async (e: React.FormEvent) => {
		e.preventDefault()
		const id = newId.trim().toUpperCase().replace(/\s+/g, "-")
		const name = newName.trim()
		if (!id || !name) {
			setMessage({ type: "err", text: "ID and name are required." })
			return
		}
		setCreating(true)
		setMessage(null)
		const res = await createSite({
			id,
			name,
			address: newAddress.trim() || null,
			timeZone: newTimeZone || null,
		})
		setCreating(false)
		if (res.ok) {
			setMessage({
				type: "ok",
				text: "Facility created. All admins and accounts will see it.",
			})
			setNewId("")
			setNewName("")
			setNewAddress("")
			setNewTimeZone("America/New_York")
			setShowCreate(false)
			const updated = await fetchSites()
			setSites(updated)
		} else {
			setMessage({ type: "err", text: res.error })
		}
	}

	if (currentUser?.role !== "admin") {
		return (
			<AppLayout>
				<div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-500">
					<Server className="w-16 h-16 mb-4 opacity-10" />
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
			<div className="flex flex-col gap-8 max-w-3xl">
				<div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
					<div>
						<h1 className="text-2xl font-black text-slate-900 tracking-tight">
							Facilities
						</h1>
						<p className="text-sm text-slate-500 mt-1">
							Create and edit facilities. All admins see the same data; new
							facilities are site-wide.
						</p>
					</div>
					{!showCreate ? (
						<Button
							type="button"
							variant="primary"
							onClick={() => {
								setShowCreate(true)
								setMessage(null)
							}}
						>
							<Plus className="w-4 h-4" /> Create facility
						</Button>
					) : null}
				</div>

				{/* Create facility form */}
				{showCreate && (
					<div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 animate-facility-enter">
						<h2 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-4">
							New facility
						</h2>
						<form onSubmit={handleCreateFacility} className="space-y-4">
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
								<div>
									<label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">
										ID (short code)
									</label>
									<input
										type="text"
										required
										value={newId}
										onChange={(e) => setNewId(e.target.value)}
										className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-900)] transition-shadow duration-150 uppercase"
										placeholder="e.g. SG, HQ"
										maxLength={20}
									/>
									<p className="text-[10px] text-slate-400 mt-1">
										Unique code; stored uppercase. No spaces.
									</p>
								</div>
								<div>
									<label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">
										Name
									</label>
									<input
										type="text"
										required
										value={newName}
										onChange={(e) => setNewName(e.target.value)}
										className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-900)] transition-shadow duration-150"
										placeholder="e.g. Stone Gate"
									/>
								</div>
							</div>
							<div>
								<label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">
									Address (optional)
								</label>
								<input
									type="text"
									value={newAddress}
									onChange={(e) => setNewAddress(e.target.value)}
									className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-900)] transition-shadow duration-150"
									placeholder="Street, city, state"
								/>
							</div>
							<div>
								<label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">
									Timezone (inventory 8am–8am)
								</label>
								<select
									value={newTimeZone}
									onChange={(e) => setNewTimeZone(e.target.value)}
									className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-900)]"
								>
									{TIMEZONE_OPTIONS.map((opt) => (
										<option key={opt.value} value={opt.value}>
											{opt.label}
										</option>
									))}
								</select>
							</div>
							<div className="flex gap-2">
								<Button type="submit" disabled={creating} variant="primary">
									{creating ? (
										<Loader2 className="w-4 h-4 animate-spin" />
									) : (
										<Check className="w-4 h-4" />
									)}
									{creating ? "Creating…" : "Create facility"}
								</Button>
								<Button
									type="button"
									variant="secondary"
									onClick={() => {
										setShowCreate(false)
										setNewId("")
										setNewName("")
										setNewAddress("")
										setMessage(null)
									}}
								>
									Cancel
								</Button>
							</div>
						</form>
					</div>
				)}

				{/* Search */}
				<div className="relative transition-opacity duration-200">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
					<input
						type="search"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Search by name, ID, or address..."
						className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-900)] transition-shadow duration-200"
					/>
				</div>

				{message && (
					<div
						className={`rounded-lg border px-4 py-3 text-sm font-semibold transition-opacity duration-200 ${
							message.type === "ok"
								? "bg-emerald-50 border-emerald-200 text-emerald-800"
								: "bg-red-50 border-red-200 text-red-800"
						}`}
					>
						{message.text}
					</div>
				)}

				<div className="space-y-4">
					{filteredSites.map((site, index) => (
						<div
							key={site.id}
							className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 transition-all duration-200 ease-out hover:shadow-md hover:border-slate-300 animate-facility-enter"
							style={{ animationDelay: `${index * 30}ms` }}
						>
							{editingId === site.id ? (
								<div className="space-y-4">
									<div>
										<label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">
											Facility name
										</label>
										<input
											type="text"
											value={editName}
											onChange={(e) => setEditName(e.target.value)}
											className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-900)] transition-shadow duration-150"
											placeholder="e.g. Stone Gate"
										/>
									</div>
									<div>
										<label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">
											Address
										</label>
										<input
											type="text"
											value={editAddress}
											onChange={(e) => setEditAddress(e.target.value)}
											className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-900)] transition-shadow duration-150"
											placeholder="Street, city, state"
										/>
									</div>
									<div>
										<label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">
											Timezone (inventory 8am–8am)
										</label>
										<select
											value={editTimeZone}
											onChange={(e) => setEditTimeZone(e.target.value)}
											className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-900)]"
										>
											{TIMEZONE_OPTIONS.map((opt) => (
												<option key={opt.value} value={opt.value}>
													{opt.label}
												</option>
											))}
										</select>
									</div>
									<div className="flex gap-2">
										<Button
											type="button"
											onClick={saveEdit}
											disabled={saving}
											variant="primary"
										>
											{saving ? (
												<Loader2 className="w-4 h-4 animate-spin" />
											) : (
												<Check className="w-4 h-4" />
											)}
											{saving ? "Saving…" : "Save"}
										</Button>
										<Button
											type="button"
											onClick={cancelEdit}
											variant="secondary"
										>
											Cancel
										</Button>
									</div>
								</div>
							) : (
								<>
									<div className="flex items-start justify-between gap-4">
										<div>
											<p className="font-bold text-slate-900">{site.name}</p>
											<p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
												{site.id}
											</p>
											<p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
												<MapPin className="w-3 h-3 shrink-0" />
												{site.address ? (
													<span>{site.address}</span>
												) : (
													<span className="italic">No address</span>
												)}
											</p>
										</div>
										<Button
											type="button"
											variant="secondary"
											onClick={() => startEdit(site.id)}
										>
											Edit
										</Button>
									</div>

									{/* Badges: simple add + link to full management */}
									<div className="mt-5 pt-5 border-t border-slate-100">
										<div className="flex flex-wrap items-center justify-between gap-3">
											<div className="flex items-center gap-3 flex-wrap">
												<span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
													<Tag className="w-3 h-3" /> Badges (
													{siteBadges(site.id).length})
												</span>
												<Link
													href={`/admin/sites/${site.id}`}
													className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700"
												>
													View badges
													<ChevronRight className="w-3.5 h-3.5" />
												</Link>
											</div>
											<div className="flex items-center gap-2">
												{addingBadgeSiteId !== site.id ? (
													<>
														<Button
															type="button"
															variant="ghost"
															size="sm"
															onClick={() => {
																setAddingBadgeSiteId(site.id)
																setNewBadgeCategoryId(categories[0]?.id ?? "")
															}}
														>
															<Plus className="w-3.5 h-3.5" /> Add
														</Button>
														<Button
															type="button"
															variant="ghost"
															size="sm"
															onClick={() => {
																setBulkSiteId(site.id)
																setBulkDefaultCategoryId(
																	categories[0]?.id ?? "",
																)
																setBulkText("")
																setBulkFile(null)
																setMessage(null)
															}}
														>
															<ClipboardList className="w-3.5 h-3.5" /> Bulk add
															/ Import
														</Button>
													</>
												) : null}
											</div>
										</div>
										{addingBadgeSiteId === site.id && (
											<div className="mt-3 flex items-center gap-2 flex-wrap">
												<input
													type="text"
													value={newBadgeCode}
													onChange={(e) => setNewBadgeCode(e.target.value)}
													placeholder="Code"
													className="w-24 px-2 py-1.5 text-xs border border-slate-200 rounded bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-900)]"
												/>
												<select
													value={newBadgeCategoryId}
													onChange={(e) =>
														setNewBadgeCategoryId(e.target.value)
													}
													className="text-xs border border-slate-200 rounded bg-slate-50 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-900)]"
												>
													{categories.map((c) => (
														<option key={c.id} value={c.id}>
															{c.name}
														</option>
													))}
												</select>
												<Button
													type="button"
													size="sm"
													onClick={() => handleAddBadge(site.id)}
													disabled={!newBadgeCode.trim()}
												>
													Add
												</Button>
												<button
													type="button"
													onClick={() => {
														setAddingBadgeSiteId(null)
														setNewBadgeCode("")
														setNewBadgeCategoryId("")
													}}
													className="text-xs text-slate-500 hover:text-slate-700"
												>
													Cancel
												</button>
											</div>
										)}
										{bulkSiteId === site.id && (
											<div className="mt-4 p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-4">
												<div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
													<ClipboardList className="w-3.5 h-3.5" /> Paste or
													import badges
												</div>
												<div>
													<label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">
														Default category (for lines with only CODE)
													</label>
													<select
														value={bulkDefaultCategoryId}
														onChange={(e) =>
															setBulkDefaultCategoryId(e.target.value)
														}
														className="w-full max-w-xs text-sm border border-slate-200 rounded-lg bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-900)]"
													>
														{categories.map((c) => (
															<option key={c.id} value={c.id}>
																{c.name}
															</option>
														))}
													</select>
												</div>
												<div>
													<label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">
														Paste list (one per line)
													</label>
													<textarea
														value={bulkText}
														onChange={(e) => setBulkText(e.target.value)}
														placeholder={
															"RES001\nRES002\nRES003,Escort Required"
														}
														rows={6}
														className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-900)] resize-y"
													/>
													<p className="text-[10px] text-slate-400 mt-1">
														Format: CODE or CODE,CATEGORY (category name or id).
														Duplicates skipped.
													</p>
												</div>
												<div>
													<label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">
														Or upload CSV
													</label>
													<input
														type="file"
														accept=".csv"
														onChange={(e) =>
															setBulkFile(e.target.files?.[0] ?? null)
														}
														className="block w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded file:border file:border-slate-200 file:bg-white file:text-xs file:font-semibold file:cursor-pointer"
													/>
													<p className="text-[10px] text-slate-400 mt-1">
														Same format: one row per badge. Save Excel as CSV if
														needed.
													</p>
												</div>
												<div className="flex gap-2">
													<Button
														type="button"
														variant="primary"
														disabled={bulkSubmitting}
														onClick={() => handleBulkSubmit(site.id)}
													>
														{bulkSubmitting ? (
															<Loader2 className="w-4 h-4 animate-spin" />
														) : (
															<FileUp className="w-4 h-4" />
														)}
														{bulkSubmitting ? "Adding…" : "Add badges"}
													</Button>
													<Button
														type="button"
														variant="secondary"
														onClick={() => {
															setBulkSiteId(null)
															setBulkText("")
															setBulkFile(null)
															setMessage(null)
														}}
													>
														Cancel
													</Button>
												</div>
											</div>
										)}
									</div>
								</>
							)}
						</div>
					))}
				</div>

				{filteredSites.length === 0 && (
					<p className="text-sm text-slate-500 text-center py-8 transition-opacity duration-200">
						{search.trim()
							? "No facilities match your search."
							: "No facilities yet."}
					</p>
				)}
			</div>
		</AppLayout>
	)
}

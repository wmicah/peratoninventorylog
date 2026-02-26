"use client"

import { AppLayout } from "@/components/AppLayout"
import { Button } from "@/components/ui/Button"
import { Select } from "@/components/ui/Select"
import { useStore } from "@/lib/store"
import {
	Trash2,
	Search,
	Filter,
	ShieldCheck,
	Database,
	Package,
} from "lucide-react"
import { useState, useMemo, useEffect } from "react"
import {
	PaginationBar,
	BADGE_LIST_PAGE_SIZE,
} from "@/components/ui/PaginationBar"

export default function InventoryManagementPage() {
	const { badges, categories, sites, currentUser, removeBadge } = useStore()

	const [search, setSearch] = useState("")
	const [selectedSiteFilter, setSelectedSiteFilter] = useState<string>("all")
	const [selectedCategoryFilter, setSelectedCategoryFilter] =
		useState<string>("all")
	const [statusFilter, setStatusFilter] = useState<
		"all" | "active" | "inactive"
	>("all")
	const [page, setPage] = useState(1)

	const filteredBadges = useMemo(() => {
		return badges.filter((b) => {
			const matchesSearch = b.code.toLowerCase().includes(search.toLowerCase())
			const matchesSite =
				selectedSiteFilter === "all" || b.siteId === selectedSiteFilter
			const matchesCategory =
				selectedCategoryFilter === "all" ||
				b.categoryId === selectedCategoryFilter
			const matchesStatus =
				statusFilter === "all" ||
				(statusFilter === "active" && b.active) ||
				(statusFilter === "inactive" && !b.active)
			return matchesSearch && matchesSite && matchesCategory && matchesStatus
		})
	}, [badges, search, selectedSiteFilter, selectedCategoryFilter, statusFilter])

	const paginatedBadges = useMemo(() => {
		const start = (page - 1) * BADGE_LIST_PAGE_SIZE
		return filteredBadges.slice(start, start + BADGE_LIST_PAGE_SIZE)
	}, [filteredBadges, page])

	useEffect(() => {
		setPage(1)
	}, [search, selectedSiteFilter, selectedCategoryFilter, statusFilter])

	if (currentUser?.role !== "admin") {
		return (
			<AppLayout>
				<div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-500">
					<ShieldCheck className="w-16 h-16 mb-4 opacity-10" />
					<p className="text-xl font-black tracking-tight text-slate-900">
						Access Restricted
					</p>
					<p className="text-sm font-medium">
						Administrator credentials required for inventory modification.
					</p>
				</div>
			</AppLayout>
		)
	}

	return (
		<AppLayout>
			<div className="flex flex-col gap-10">
				<div className="border-b border-slate-200 pb-8">
					<h1 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-none">
						Asset Lifecycle
					</h1>
					<div className="flex items-center gap-3 mt-2.5">
						<div className="flex items-center gap-1.5 bg-[var(--color-primary-900)] text-white px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest shadow-sm">
							<Database className="w-3.5 h-3.5" /> Inventory Master
						</div>
						<p className="text-slate-500 font-semibold text-xs uppercase tracking-wider">
							Configure System Assets
						</p>
					</div>
				</div>

				<div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
					<div className="relative flex-1 w-full min-w-0">
						<Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
						<input
							type="text"
							placeholder="Search by badge code..."
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-900)] focus:border-transparent transition-all"
						/>
					</div>
					<div className="flex items-center gap-3 w-full lg:w-auto flex-wrap">
						<div className="flex items-center gap-2 min-w-[160px]">
							<Filter className="w-4 h-4 text-slate-400 shrink-0" />
							<Select
								value={selectedSiteFilter}
								onChange={(e) => setSelectedSiteFilter(e.target.value)}
								className="text-sm py-2.5"
							>
								<option value="all">Every Site</option>
								{sites.map((s) => (
									<option key={s.id} value={s.id}>
										{s.name}
									</option>
								))}
							</Select>
						</div>
						<div className="flex items-center gap-2 min-w-[160px]">
							<Package className="w-4 h-4 text-slate-400 shrink-0" />
							<Select
								value={selectedCategoryFilter}
								onChange={(e) => setSelectedCategoryFilter(e.target.value)}
								className="text-sm py-2.5"
							>
								<option value="all">Every Class</option>
								{categories.map((c) => (
									<option key={c.id} value={c.id}>
										{c.name}
									</option>
								))}
							</Select>
						</div>
						<div className="flex items-center gap-2 min-w-[140px]">
							<Select
								value={statusFilter}
								onChange={(e) =>
									setStatusFilter(
										e.target.value as "all" | "active" | "inactive",
									)
								}
								className="text-sm py-2.5"
							>
								<option value="all">All status</option>
								<option value="active">Active</option>
								<option value="inactive">Inactive</option>
							</Select>
						</div>
					</div>
				</div>

				<div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
					<table className="w-full text-left border-collapse">
						<thead>
							<tr className="bg-slate-50 border-b-2 border-slate-200">
								<th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">
									Badge Identifier
								</th>
								<th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">
									Site Facility
								</th>
								<th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">
									Classification
								</th>
								<th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">
									Status
								</th>
								<th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 text-right">
									Operations
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-100">
							{filteredBadges.length === 0 ? (
								<tr>
									<td
										colSpan={5}
										className="px-8 py-16 text-center text-slate-500 font-medium"
									>
										No matching assets found in the inventory master.
									</td>
								</tr>
							) : (
								paginatedBadges.map((badge) => (
									<tr
										key={badge.id}
										className="group hover:bg-slate-50/70 transition-colors"
									>
										<td className="px-6 py-4">
											<span className="font-semibold text-slate-900 text-[15px] tracking-tight">
												{badge.code}
											</span>
											{badge.displayNumber != null && (
												<span className="ml-1.5 text-slate-500 text-sm font-normal">
													[{badge.displayNumber}]
												</span>
											)}
										</td>
										<td className="px-6 py-4">
											<div className="flex flex-col gap-0.5">
												<span className="text-sm font-medium text-slate-800">
													{sites.find((s) => s.id === badge.siteId)?.name ??
														"—"}
												</span>
												<span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
													{badge.siteId}
												</span>
											</div>
										</td>
										<td className="px-6 py-4">
											<span className="inline-flex items-center px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
												{categories.find((c) => c.id === badge.categoryId)
													?.name ?? badge.categoryId}
											</span>
										</td>
										<td className="px-6 py-4">
											<span
												className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${
													badge.active
														? "bg-emerald-50 border-emerald-200 text-emerald-700"
														: "bg-slate-100 border-slate-200 text-slate-500"
												}`}
											>
												{badge.active ? "Active" : "Inactive"}
											</span>
											<p className="mt-1 text-[10px] text-slate-400">
												{badge.active
													? "Shown in officer inventory"
													: "Hidden from inventory"}
											</p>
										</td>
										<td className="px-6 py-4 text-right">
											<Button
												variant="ghost"
												size="icon"
												onClick={() => {
													if (
														confirm(
															`Deprovision ${badge.code}? This action cannot be undone.`,
														)
													) {
														removeBadge(badge.id)
													}
												}}
												title="Deprovision Asset"
												className="text-slate-400 hover:text-red-600 hover:bg-red-50"
											>
												<Trash2 className="w-4 h-4" />
											</Button>
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>

				<PaginationBar
					total={filteredBadges.length}
					pageSize={BADGE_LIST_PAGE_SIZE}
					currentPage={page}
					onPageChange={setPage}
					itemLabel="assets"
				/>

				<div className="flex items-center justify-between px-6 py-4 text-sm text-slate-500 border-t border-slate-100">
					<span className="font-medium">
						Total: {filteredBadges.length} asset
						{filteredBadges.length !== 1 ? "s" : ""}
					</span>
					<p className="max-w-[320px] text-right text-xs">
						Authorized personnel only. Deprovisioning is logged and audited.
					</p>
				</div>
			</div>
		</AppLayout>
	)
}

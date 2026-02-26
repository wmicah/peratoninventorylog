"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useStore } from "@/lib/store"
import { supabase } from "@/lib/supabase"
import { LogOut, User, CheckCircle2 } from "lucide-react"
import { useEffect, useState } from "react"

const hasSupabase = () => {
	if (typeof window === "undefined") return false
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL
	const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
	return Boolean(url && key && url.length > 0 && key.length > 0)
}

export function AppLayout({ children }: { children: React.ReactNode }) {
	const [mounted, setMounted] = useState(false)
	const router = useRouter()
	const pathname = usePathname()

	const currentUser = useStore((state) => state.currentUser)
	const sites = useStore((state) => state.sites)
	const selectedSite = useStore((state) => state.selectedSite)
	const setSelectedSite = useStore((state) => state.setSelectedSite)
	const logout = useStore((state) => state.logout)

	const [showSitePrompt, setShowSitePrompt] = useState(false)

	useEffect(() => {
		setMounted(true)
	}, [])

	// Sites available in the header dropdown: admins see all sites, others see only assigned
	const userSites = sites.filter(
		(s) => currentUser?.assignedSiteIds?.includes(s.id) ?? false,
	)
	const sitesForDropdown = currentUser?.role === "admin" ? sites : userSites

	// Auto-select valid site if current isn't assigned
	useEffect(() => {
		if (mounted && currentUser) {
			const assignedIds = currentUser.assignedSiteIds ?? []
			const isAdmin = currentUser.role === "admin"

			// Admin: allow "all" or any site that exists in the store
			if (isAdmin) {
				const validSite =
					selectedSite === "all" || sites.some((s) => s.id === selectedSite)
				if (!validSite) setSelectedSite("all")
				return
			}

			// Non-admin: must be assigned to selected site
			const isAssigned = assignedIds.includes(selectedSite)
			if (!isAssigned && assignedIds.length > 0) {
				setSelectedSite(assignedIds[0])
				if (assignedIds.length > 1) setShowSitePrompt(true)
			}
		}
	}, [mounted, currentUser, selectedSite, setSelectedSite, sites])

	// Auth guard: redirect to login (/) if not signed in (after short delay so AuthHydrate can restore session)
	useEffect(() => {
		if (pathname === "/") return
		if (!mounted || currentUser) return
		const t = setTimeout(() => {
			if (!useStore.getState().currentUser) router.push("/")
		}, 400)
		return () => clearTimeout(t)
	}, [mounted, currentUser, pathname, router])

	if (!mounted && pathname !== "/") return null
	if (mounted && !currentUser && pathname !== "/") return null

	return (
		<div className="min-h-screen flex flex-col font-sans selection:bg-[var(--color-primary-100)] selection:text-[var(--color-primary-900)]">
			<header className="sticky top-0 z-50 flex h-16 items-center border-b border-slate-200 bg-white/95 backdrop-blur-md px-6 shadow-sm">
				<div className="flex items-center gap-6 flex-1">
					<Link
						href={currentUser?.role === "admin" ? "/dashboard" : "/start"}
						className="flex items-center gap-2 group"
					>
						<div className="w-7 h-7 bg-[var(--color-primary-900)] rounded flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
							<div className="w-3.5 h-3.5 border-2 border-white rounded-sm" />
						</div>
						<span className="font-bold text-[var(--color-primary-900)] text-lg tracking-tight uppercase">
							Peraton
							<span className="font-normal text-slate-400 ml-0.5">
								Inventory
							</span>
						</span>
					</Link>

					<div className="h-4 w-px bg-slate-200" />

					<div className="flex flex-col gap-1">
						<label
							htmlFor="header-facility"
							className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none"
						>
							Facility
						</label>
						<select
							id="header-facility"
							value={selectedSite}
							onChange={(e) => setSelectedSite(e.target.value)}
							className="min-h-[36px] w-full min-w-[140px] rounded-lg border border-slate-200 bg-white px-3 py-2 pr-8 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-200)] focus:border-[var(--color-primary-500)] cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23475569%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22M6%209l6%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1rem] bg-[right_0.5rem_center] bg-no-repeat hover:border-slate-300 transition-colors"
						>
							{currentUser?.role === "admin" && (
								<option value="all">All facilities</option>
							)}
							{sitesForDropdown.map((s) => (
								<option key={s.id} value={s.id}>
									{s.name}
								</option>
							))}
						</select>
					</div>

					<nav className="ml-6 flex gap-5 text-xs">
						{currentUser?.role === "admin" && (
							<Link
								href="/dashboard"
								className={`${pathname === "/dashboard" ? "text-[var(--color-primary-900)] font-bold border-b-2 border-[var(--color-primary-900)]" : "text-slate-500 hover:text-slate-900 font-bold"} py-4 transition-all uppercase tracking-wider`}
							>
								Dashboard
							</Link>
						)}
						{currentUser?.role !== "admin" && (
							<>
								<Link
									href="/start"
									className={`${pathname === "/start" ? "text-[var(--color-primary-900)] font-bold border-b-2 border-[var(--color-primary-900)]" : "text-slate-500 hover:text-slate-900 font-bold"} py-4 transition-all uppercase tracking-wider`}
								>
									Start
								</Link>
								<Link
									href="/me"
									className={`${pathname === "/me" ? "text-[var(--color-primary-900)] font-bold border-b-2 border-[var(--color-primary-900)]" : "text-slate-500 hover:text-slate-900 font-bold"} py-4 transition-all uppercase tracking-wider`}
								>
									My sessions
								</Link>
							</>
						)}
						{currentUser?.role === "admin" && (
							<Link
								href="/admin/inventory"
								className={`${pathname === "/admin/inventory" ? "text-[var(--color-primary-900)] font-bold border-b-2 border-[var(--color-primary-900)]" : "text-slate-500 hover:text-slate-900 font-bold"} py-4 transition-all uppercase tracking-wider`}
							>
								Assets
							</Link>
						)}
						{currentUser?.role === "admin" && (
							<Link
								href="/admin/sites"
								className={`${pathname === "/admin/sites" ? "text-[var(--color-primary-900)] font-bold border-b-2 border-[var(--color-primary-900)]" : "text-slate-500 hover:text-slate-900 font-bold"} py-4 transition-all uppercase tracking-wider`}
							>
								Facilities
							</Link>
						)}
						{currentUser?.role === "admin" && (
							<Link
								href="/admin/loggers"
								className={`${pathname === "/admin/loggers" ? "text-[var(--color-primary-900)] font-bold border-b-2 border-[var(--color-primary-900)]" : "text-slate-500 hover:text-slate-900 font-bold"} py-4 transition-all uppercase tracking-wider`}
							>
								Loggers
							</Link>
						)}
						{currentUser?.role === "admin" && (
							<Link
								href="/admin/sessions"
								className={`${pathname === "/admin/sessions" ? "text-[var(--color-primary-900)] font-bold border-b-2 border-[var(--color-primary-900)]" : "text-slate-500 hover:text-slate-900 font-bold"} py-4 transition-all uppercase tracking-wider`}
							>
								Audit Log
							</Link>
						)}
					</nav>
				</div>

				<div className="flex items-center gap-5">
					{currentUser?.role !== "admin" && (
						<Link
							href="/start"
							className="text-xs bg-[#0F1C3F] text-white px-4 py-2 rounded font-bold hover:bg-slate-900 transition-all shadow shadow-blue-900/10 active:scale-95 uppercase tracking-wider"
						>
							Begin
						</Link>
					)}

					<div className="flex items-center gap-3 pl-5 border-l border-slate-100">
						<div className="text-right hidden md:block">
							<div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-0.5">
								{currentUser?.role}
							</div>
							<div className="text-xs font-bold text-slate-900 leading-none">
								{currentUser?.name}
							</div>
						</div>
						<button
							onClick={async () => {
								if (hasSupabase()) await supabase.auth.signOut()
								logout()
								router.push("/")
								router.refresh()
							}}
							className="group min-h-[44px] min-w-[44px] p-2.5 rounded-lg bg-slate-50 border-2 border-slate-100 text-slate-400 hover:bg-red-50 hover:border-red-100 hover:text-red-500 transition-all active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-red-200 focus:ring-offset-1"
							title="Logout"
						>
							<LogOut className="h-4 w-4" />
						</button>
					</div>
				</div>
			</header>

			<main className="flex-1 max-w-7xl w-full mx-auto p-8 md:p-10">
				{children}
			</main>

			{showSitePrompt && (
				<div className="fixed inset-0 bg-slate-950/20 backdrop-blur-md z-[100] flex items-center justify-center p-4">
					<div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-8 animate-in zoom-in-95 duration-200 border border-slate-200">
						<div className="text-center mb-8">
							<div className="w-14 h-14 bg-slate-100 rounded-lg flex items-center justify-center mx-auto mb-4 border border-slate-200">
								<User className="w-6 h-6 text-slate-600" />
							</div>
							<h3 className="text-xl font-bold text-slate-900 tracking-tight leading-tight">
								Duty Location Required
							</h3>
							<p className="text-slate-500 font-bold mt-1 uppercase tracking-widest text-[9px]">
								Select assigned facility
							</p>
						</div>

						<div className="space-y-3">
							{userSites.map((site) => (
								<button
									key={site.id}
									onClick={() => {
										setSelectedSite(site.id)
										setShowSitePrompt(false)
									}}
									className={`w-full text-left p-4 rounded-lg border-2 transition-all flex items-center justify-between group ${
										selectedSite === site.id
											? "border-[var(--color-primary-900)] bg-slate-50 shadow-sm"
											: "border-slate-100 hover:border-slate-200 hover:bg-slate-50"
									}`}
								>
									<div>
										<span
											className={`block font-bold text-sm ${selectedSite === site.id ? "text-[var(--color-primary-900)]" : "text-slate-900"}`}
										>
											{site.name}
										</span>
										<div className="flex items-center gap-1.5 mt-0.5">
											<span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
												{site.id}
											</span>
										</div>
									</div>
									<div
										className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
											selectedSite === site.id
												? "border-[var(--color-primary-900)] bg-[var(--color-primary-900)]"
												: "border-slate-200 group-hover:border-slate-300"
										}`}
									>
										{selectedSite === site.id && (
											<CheckCircle2 className="w-3 h-3 text-white" />
										)}
									</div>
								</button>
							))}
						</div>

						<button
							onClick={() => setShowSitePrompt(false)}
							className="w-full mt-8 min-h-[48px] bg-[var(--color-primary-900)] text-white py-3 px-5 rounded-lg font-bold shadow-md hover:bg-[var(--color-primary-950)] transition-all uppercase tracking-widest text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-900)] focus:ring-offset-2 active:scale-[0.98]"
						>
							Access Portal
						</button>
					</div>
				</div>
			)}
		</div>
	)
}

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
	const [nathalieMode, setNathalieMode] = useState(false)

	useEffect(() => {
		setMounted(true)
	}, [])
	useEffect(() => {
		if (!mounted) return
		try {
			const stored = localStorage.getItem("peraton_nathalie_mode")
			const on = stored === "1"
			setNathalieMode(on)
			if (on) document.body.setAttribute("data-nathalie-mode", "true")
			else document.body.removeAttribute("data-nathalie-mode")
		} catch {
			// ignore
		}
	}, [mounted])
	const toggleNathalieMode = () => {
		const next = !nathalieMode
		setNathalieMode(next)
		try {
			localStorage.setItem("peraton_nathalie_mode", next ? "1" : "0")
			if (typeof document !== "undefined") {
				if (next) document.body.setAttribute("data-nathalie-mode", "true")
				else document.body.removeAttribute("data-nathalie-mode")
			}
		} catch {
			// ignore
		}
	}

	const userSites = sites.filter(
		(s) => currentUser?.assignedSiteIds?.includes(s.id) ?? false,
	)

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
		<div
			className="min-h-screen flex flex-col font-sans selection:bg-[var(--color-primary-100)] selection:text-[var(--color-primary-900)]"
			data-nathalie-mode={nathalieMode ? "true" : undefined}
		>
			<header className="sticky top-0 z-50 flex h-16 items-center border-b border-slate-200 bg-white/95 backdrop-blur-md px-6 shadow-sm">
				<div className="flex items-center gap-6 flex-1">
					<Link
						href={currentUser?.role === "admin" ? "/dashboard" : "/start"}
						className="text-base tracking-tight hover:opacity-90 transition-opacity"
					>
						<span className="font-semibold text-[var(--color-primary-900)]">
							Peraton
						</span>
						<span className="font-normal text-slate-500 ml-0.5">Inventory</span>
					</Link>

					<nav className="ml-2 flex items-center gap-6 text-sm">
						<Link
							href="/dashboard"
							className={`${pathname.startsWith("/dashboard") ? "text-[var(--color-primary-900)] font-semibold border-b-2 border-[var(--color-primary-900)]" : "text-slate-600 hover:text-slate-900 font-medium"} py-4 transition-colors border-b-2 border-transparent -mb-px`}
						>
							Dashboard
						</Link>
						{currentUser?.role !== "admin" && (
							<>
								<Link
									href="/start"
									className={`${pathname === "/start" ? "text-[var(--color-primary-900)] font-semibold border-b-2 border-[var(--color-primary-900)]" : "text-slate-600 hover:text-slate-900 font-medium"} py-4 transition-colors border-b-2 border-transparent -mb-px`}
								>
									Start
								</Link>
								<Link
									href="/me"
									className={`${pathname === "/me" ? "text-[var(--color-primary-900)] font-semibold border-b-2 border-[var(--color-primary-900)]" : "text-slate-600 hover:text-slate-900 font-medium"} py-4 transition-colors border-b-2 border-transparent -mb-px`}
								>
									My sessions
								</Link>
							</>
						)}
						{currentUser?.role === "admin" && (
							<>
								<Link
									href="/admin/inventory"
									className={`${pathname === "/admin/inventory" ? "text-[var(--color-primary-900)] font-semibold border-b-2 border-[var(--color-primary-900)]" : "text-slate-600 hover:text-slate-900 font-medium"} py-4 transition-colors border-b-2 border-transparent -mb-px`}
								>
									Assets
								</Link>
								<Link
									href="/admin/sites"
									className={`${pathname === "/admin/sites" || pathname.startsWith("/admin/sites/") ? "text-[var(--color-primary-900)] font-semibold border-b-2 border-[var(--color-primary-900)]" : "text-slate-600 hover:text-slate-900 font-medium"} py-4 transition-colors border-b-2 border-transparent -mb-px`}
								>
									Facilities
								</Link>
								<Link
									href="/admin/loggers"
									className={`${pathname === "/admin/loggers" ? "text-[var(--color-primary-900)] font-semibold border-b-2 border-[var(--color-primary-900)]" : "text-slate-600 hover:text-slate-900 font-medium"} py-4 transition-colors border-b-2 border-transparent -mb-px`}
								>
									Accounts
								</Link>
								<Link
									href="/admin/missing"
									className={`${pathname === "/admin/missing" ? "text-[var(--color-primary-900)] font-semibold border-b-2 border-[var(--color-primary-900)]" : "text-slate-600 hover:text-slate-900 font-medium"} py-4 transition-colors border-b-2 border-transparent -mb-px`}
								>
									Open items
								</Link>
								<Link
									href="/admin/sessions"
									className={`${pathname === "/admin/sessions" ? "text-[var(--color-primary-900)] font-semibold border-b-2 border-[var(--color-primary-900)]" : "text-slate-600 hover:text-slate-900 font-medium"} py-4 transition-colors border-b-2 border-transparent -mb-px`}
								>
									Audit log
								</Link>
							</>
						)}
					</nav>
				</div>

				<div className="flex items-center gap-5">
					{currentUser?.role === "admin" && (
						<button
							type="button"
							onClick={toggleNathalieMode}
							className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-xs font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 ${
								nathalieMode
									? "bg-pink-200 border-pink-400 text-pink-900 focus:ring-pink-300"
									: "bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300 focus:ring-slate-200"
							}`}
							title={
								nathalieMode
									? "Turn off Nathalie Mode"
									: "Turn on Nathalie Mode"
							}
						>
							<span
								className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${
									nathalieMode ? "bg-pink-500" : "bg-slate-300"
								}`}
								aria-hidden
							>
								<span
									className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition translate-y-0.5 ${
										nathalieMode ? "translate-x-4" : "translate-x-0.5"
									}`}
								/>
							</span>
							Nathalie Mode
						</button>
					)}
					{currentUser?.role !== "admin" && (
						<Link
							href="/start"
							className="text-sm bg-[#0F1C3F] text-white px-4 py-2 rounded font-medium hover:bg-slate-900 transition-all shadow shadow-blue-900/10 active:scale-95"
						>
							Begin
						</Link>
					)}

					<div className="flex items-center gap-3 pl-5 border-l border-slate-100">
						<div className="text-right hidden md:block">
							<div className="text-[10px] font-medium text-slate-500 uppercase tracking-wider leading-none mb-0.5">
								{currentUser?.role}
							</div>
							<div className="text-sm font-medium text-slate-800 leading-none">
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

"use client"

import { getOrCreateProfile } from "@/app/actions/auth"
import { Button } from "@/components/ui/Button"
import { useStore } from "@/lib/store"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { ShieldAlert, User, LogIn } from "lucide-react"

const hasSupabase = () => {
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL
	const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
	return Boolean(url && key && url.length > 0 && key.length > 0)
}

export default function LoginPage() {
	const router = useRouter()
	const currentUser = useStore((s) => s.currentUser)
	const { login, setCurrentUser } = useStore()
	const [email, setEmail] = useState("")
	const [password, setPassword] = useState("")
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState("")

	// If already logged in, go to dashboard (avoid loop: only redirect when we have a real session when using Supabase)
	useEffect(() => {
		if (!currentUser) return

		if (hasSupabase()) {
			supabase.auth.getSession().then(({ data: { session } }) => {
				if (session?.user) {
					const role = currentUser?.role
					router.replace(role === "logger" ? "/start" : "/dashboard")
				} else {
					// No Supabase session but store has user (stale) – clear so we show login and don’t loop
					setCurrentUser(null)
				}
			})
		} else {
			router.replace("/dashboard")
		}
	}, [currentUser, router, setCurrentUser])

	const handleLogin = async (e: React.FormEvent) => {
		e.preventDefault()
		setError("")
		if (!email.trim()) return

		setIsLoading(true)

		if (hasSupabase()) {
			const { data: authData, error: signInError } =
				await supabase.auth.signInWithPassword({
					email: email.trim(),
					password,
				})
			if (signInError) {
				setError(
					signInError.message === "Invalid login credentials"
						? "Invalid email or password."
						: signInError.message,
				)
				setIsLoading(false)
				return
			}
			if (!authData.user) {
				setError("Sign-in failed.")
				setIsLoading(false)
				return
			}
			// Pass session so server can get/create profile even if cookies aren't available yet
			const session = authData.session
			const result = await getOrCreateProfile(
				session
					? {
							access_token: session.access_token,
							refresh_token: session.refresh_token ?? "",
						}
					: undefined,
			)
			if (!result.ok) {
				await supabase.auth.signOut()
				setError(result.error)
				setIsLoading(false)
				return
			}
			const profile = result.profile
			setCurrentUser({
				name: profile.full_name,
				email: profile.email,
				role: profile.role as "admin" | "logger",
				assignedSiteIds: profile.assigned_site_ids ?? [],
			})
			router.replace(profile.role === "logger" ? "/start" : "/dashboard")
			router.refresh()
			return
		}

		// Fallback: mock login when Supabase not configured
		setTimeout(() => {
			login(email.trim())
			const { currentUser: u } = useStore.getState()
			router.replace(u?.role === "logger" ? "/start" : "/dashboard")
			setIsLoading(false)
		}, 400)
	}

	// Show nothing briefly while redirecting if already logged in
	if (currentUser) {
		return null
	}

	return (
		<div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans text-slate-900 selection:bg-[#00AEB3]/30">
			<div className="sm:mx-auto sm:w-full sm:max-w-md">
				<h2 className="text-center text-3xl font-bold text-[#0F1C3F] tracking-tight">
					Internal Inventory
				</h2>
				<p className="mt-2 text-center text-sm text-slate-500 font-medium">
					Secure Access for Inventory Accounts and Administrators
				</p>
			</div>

			<div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
				<div className="bg-white py-10 px-6 shadow-sm sm:rounded-xl sm:px-12 border border-slate-200">
					<form className="space-y-6" onSubmit={handleLogin} autoComplete="off">
						{error && (
							<div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm font-medium text-red-800">
								{error}
							</div>
						)}
						<div>
							<label
								htmlFor="email"
								className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-2"
							>
								Work Email
							</label>
							<div className="relative">
								<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
									<User className="h-5 w-5 text-slate-300" />
								</div>
								<input
									id="email"
									name="email"
									type="email"
									required
									autoComplete="off"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-lg bg-slate-50 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0F1C3F] sm:text-sm font-semibold transition-all"
									placeholder="name@peraton.com"
								/>
							</div>
						</div>

						<div>
							<label
								htmlFor="password"
								className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-2"
							>
								Password
							</label>
							<div className="relative">
								<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
									<ShieldAlert className="h-5 w-5 text-slate-300" />
								</div>
								<input
									id="password"
									name="password"
									type="password"
									required
									autoComplete="new-password"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-lg bg-slate-50 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0F1C3F] sm:text-sm font-semibold transition-all"
									placeholder="••••••••"
								/>
							</div>
						</div>

						<div>
							<Button type="submit" disabled={isLoading} className="w-full">
								{isLoading ? (
									<div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
								) : (
									<>
										<LogIn className="w-4 h-4" /> Sign In
									</>
								)}
							</Button>
						</div>
					</form>
				</div>
			</div>
		</div>
	)
}

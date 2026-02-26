"use client"

import { AppLayout } from "@/components/AppLayout"
import { Button } from "@/components/ui/Button"
import { useStore } from "@/lib/store"
import { isSameLocalDay } from "@/lib/time"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo } from "react"
import { Play, CheckCircle2, RotateCcw } from "lucide-react"

export default function StartPage() {
	const router = useRouter()
	const { currentUser, selectedSite, setSelectedSite, sites, sessions } =
		useStore()

	const isLogger = currentUser?.role !== "admin"
	const userSiteIds = useMemo(
		() => currentUser?.assignedSiteIds ?? [],
		[currentUser?.assignedSiteIds],
	)
	const userSites = sites.filter((s) => userSiteIds.includes(s.id))

	// Ensure selected site is one of the logger's assigned sites
	useEffect(() => {
		if (!isLogger || userSites.length === 0) return
		if (!selectedSite || !userSiteIds.includes(selectedSite)) {
			setSelectedSite(userSiteIds[0])
		}
	}, [isLogger, selectedSite, userSiteIds, userSites.length, setSelectedSite])

	const site = userSites.find((s) => s.id === selectedSite)

	// One inventory per site per day: if anyone has already submitted for this site today, no need to run again
	const submittedForToday = Object.values(sessions).some(
		(s) =>
			s.siteId === selectedSite &&
			s.status === "submitted" &&
			!s.isSuperseded &&
			s.submittedAt &&
			isSameLocalDay(s.submittedAt, new Date().toISOString()),
	)

	// Admins: redirect to dashboard
	useEffect(() => {
		if (currentUser?.role === "admin") {
			router.replace("/dashboard")
		}
	}, [currentUser?.role, router])

	if (currentUser?.role === "admin") return null

	if (!currentUser) return null

	// No assigned sites
	if (userSites.length === 0) {
		return (
			<AppLayout>
				<div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
					<p className="text-slate-600 font-medium">
						You have no facilities assigned. Contact an admin.
					</p>
				</div>
			</AppLayout>
		)
	}

	// Done for today: show completion screen with "Missed one? Go back"
	if (site && submittedForToday) {
		return (
			<AppLayout>
				<div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
					<div className="bg-white p-8 md:p-12 rounded-2xl border border-slate-200 shadow-sm max-w-md w-full">
						<div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
							<CheckCircle2 className="w-8 h-8 text-green-600" />
						</div>
						<h1 className="text-2xl font-bold text-slate-900 mb-2">
							You&apos;re all set for today
						</h1>
						<p className="text-slate-500 mb-8 font-medium">
							Inventory for{" "}
							<strong className="text-slate-900">{site.name}</strong> has
							already been submitted for today. No tasks left.
						</p>
						<Link href="/take">
							<Button
								variant="secondary"
								className="w-full text-base py-4 gap-2"
							>
								<RotateCcw className="w-4 h-4" />
								Missed one? Go back
							</Button>
						</Link>
					</div>
				</div>
			</AppLayout>
		)
	}

	// Not done yet: site selector (if multiple) + Begin
	return (
		<AppLayout>
			<div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
				<div className="bg-white p-8 md:p-12 rounded-2xl border border-slate-200 shadow-sm max-w-md w-full">
					<div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
						<Play className="w-8 h-8 text-slate-600 ml-1" />
					</div>
					<h1 className="text-2xl font-bold text-slate-900 mb-2">
						Take inventory
					</h1>

					{userSites.length > 1 ? (
						<>
							<p className="text-slate-500 mb-4 font-medium">
								Select facility, then begin.
							</p>
							<div className="flex flex-col gap-2 mb-6">
								{userSites.map((s) => (
									<label
										key={s.id}
										className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
											selectedSite === s.id
												? "border-[var(--color-primary-900)] bg-slate-50"
												: "border-slate-200 hover:border-slate-300"
										}`}
									>
										<input
											type="radio"
											name="site"
											checked={selectedSite === s.id}
											onChange={() => setSelectedSite(s.id)}
											className="sr-only"
										/>
										<span className="font-semibold text-slate-900">
											{s.name}
										</span>
									</label>
								))}
							</div>
						</>
					) : (
						<p className="text-slate-500 mb-8 font-medium">
							Recording inventory for{" "}
							<strong className="text-slate-900">{site?.name}</strong>
						</p>
					)}

					{site && (
						<Link href="/take" className="block">
							<Button className="w-full text-base py-4 gap-2">
								<Play className="w-4 h-4" />
								Begin
							</Button>
						</Link>
					)}
				</div>
			</div>
		</AppLayout>
	)
}

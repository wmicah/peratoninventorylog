"use client"

import { AppLayout } from "@/components/AppLayout"
import { Button } from "@/components/ui/Button"
import { useStore, formatBadgeLabel } from "@/lib/store"
import { formatTimeOnly, isSameLocalDay } from "@/lib/time"
import { useParams, useRouter } from "next/navigation"
import { useState, useMemo, useEffect } from "react"
import {
	AlertCircle,
	CheckCircle2,
	ChevronRight,
	ChevronLeft,
	Lock,
} from "lucide-react"

export default function SessionInputPage() {
	const router = useRouter()
	const params = useParams()
	const sessionId = params?.id as string
	const {
		sessions,
		sites,
		badges,
		currentUser,
		updateSessionItem,
		submitSession,
	} = useStore()

	const [showIncompleteModal, setShowIncompleteModal] = useState(false)
	const [showConflictModal, setShowConflictModal] = useState<string | null>(
		null,
	)
	const [activeTabIdx, setActiveTabIdx] = useState(0)

	const session = sessions[sessionId]
	const site = sites.find((s) => s?.id === session?.siteId)

	// progression order
	const tabProgress = [
		{ id: "cat-escort", name: "Escort Required" },
		{ id: "cat-no-escort", name: "No Escort Required" },
		{ id: "cat-temp", name: "Employee Temp" },
		{ id: "cat-foreign", name: "Foreign National" },
	]

	const currentTab = tabProgress[activeTabIdx]

	const siteBadges = useMemo(
		() =>
			badges.filter(
				(b) =>
					b.siteId === session?.siteId && session?.items[b.id] !== undefined,
			),
		[badges, session],
	)

	useEffect(() => {
		if (session?.status === "submitted") {
			router.replace(
				currentUser?.role !== "admin" ? "/start" : `/sessions/${sessionId}`,
			)
		}
	}, [session?.status, sessionId, router, currentUser?.role])

	if (!session || !site) {
		return (
			<AppLayout>
				<div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-500">
					<AlertCircle className="w-12 h-12 mb-4 opacity-20" />
					<p className="text-xl font-bold tracking-tight">Session not found</p>
					<p className="text-sm font-medium">
						The requested record does not exist or has been removed.
					</p>
				</div>
			</AppLayout>
		)
	}

	if (session.status === "submitted") {
		return null
	}

	const items = Object.values(session.items)
	const totalCount = items.length
	const checkedCount = items.filter((i) => i.state !== "not_checked").length

	// Tab Completion logic
	const isTabComplete = (tabId: string) => {
		const tabBadges = siteBadges.filter((b) => b.categoryId === tabId)
		return tabBadges.every(
			(b) =>
				session.items[b.id]?.state !== "not_checked" &&
				(session.items[b.id]?.state === "present" ||
					(session.items[b.id]?.state === "missing" &&
						session.items[b.id]?.guestName &&
						session.items[b.id]?.sponsorName)),
		)
	}

	const canProceedToNext = isTabComplete(currentTab.id)

	const handleAttemptSubmit = () => {
		const allComplete = tabProgress.every((t) => isTabComplete(t.id))
		if (!allComplete) {
			setShowIncompleteModal(true)
			return
		}

		const existingSession = Object.values(sessions).find(
			(s) =>
				s.siteId === site.id &&
				s.status === "submitted" &&
				!s.isSuperseded &&
				s.id !== sessionId &&
				isSameLocalDay(s.createdAt, session.createdAt),
		)

		if (existingSession) {
			setShowConflictModal(existingSession.id)
		} else {
			submitSession(sessionId)
			router.push(
				currentUser?.role !== "admin" ? "/start" : `/sessions/${sessionId}`,
			)
		}
	}

	const submitWithConflict = (replaceSessionId?: string) => {
		submitSession(sessionId, replaceSessionId)
		setShowConflictModal(null)
		router.push(
			currentUser?.role !== "admin" ? "/start" : `/sessions/${sessionId}`,
		)
	}

	const tabBadges = siteBadges.filter((b) => b.categoryId === currentTab.id)

	return (
		<AppLayout>
			<div className="flex flex-col gap-6 max-w-5xl mx-auto">
				{/* Progress Header */}
				<div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
					<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
						<div>
							<h1 className="text-2xl font-bold text-slate-900">
								{site.name} Inventory Session
							</h1>
							<p className="text-slate-500 font-medium">
								Started at {formatTimeOnly(session.createdAt)}
							</p>
						</div>
						<div className="flex items-center gap-4">
							<div className="text-right">
								<div className="text-sm font-bold text-slate-900">
									{checkedCount} / {totalCount}
								</div>
								<div className="text-xs text-slate-500 uppercase font-bold tracking-wider">
									Total Progress
								</div>
							</div>
							<div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
								<div
									className="h-full bg-[var(--color-primary-900)] transition-all duration-500"
									style={{ width: `${(checkedCount / totalCount) * 100}%` }}
								/>
							</div>
						</div>
					</div>

					{/* Stepper */}
					<div className="flex items-center justify-between relative">
						<div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-100 -translate-y-1/2 z-0" />
						{tabProgress.map((tab, idx) => {
							const isActive = activeTabIdx === idx
							const isDone = isTabComplete(tab.id)
							const isLocked =
								idx > 0 && !isTabComplete(tabProgress[idx - 1].id)

							return (
								<button
									key={tab.id}
									disabled={isLocked}
									onClick={() => setActiveTabIdx(idx)}
									className={`relative z-10 flex flex-col items-center gap-2 group transition-all ${isLocked ? "cursor-not-allowed" : "cursor-pointer"}`}
								>
									<div
										className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
											isActive
												? "bg-[var(--color-primary-900)] border-[var(--color-primary-900)] text-white shadow-lg shadow-[var(--color-primary-900)]/20"
												: isDone
													? "bg-teal-500 border-teal-500 text-white"
													: isLocked
														? "bg-white border-slate-200 text-slate-300"
														: "bg-white border-slate-300 text-slate-500 group-hover:border-[var(--color-primary-900)]"
										}`}
									>
										{isDone ? (
											<CheckCircle2 className="w-6 h-6" />
										) : isLocked ? (
											<Lock className="w-5 h-5" />
										) : (
											<span className="font-bold">{idx + 1}</span>
										)}
									</div>
									<span
										className={`text-xs font-bold uppercase tracking-tighter w-20 text-center ${
											isActive
												? "text-[var(--color-primary-900)]"
												: isLocked
													? "text-slate-300"
													: "text-slate-500"
										}`}
									>
										{tab.name}
									</span>
								</button>
							)
						})}
					</div>
				</div>

				{/* Current Tab Inventory */}
				<div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
					<div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
						<h2 className="font-bold text-slate-900 text-lg">
							{currentTab.name}
						</h2>
						<span className="text-sm font-medium text-slate-500 italic">
							{
								tabBadges.filter(
									(b) => session.items[b.id]?.state !== "not_checked",
								).length
							}{" "}
							of {tabBadges.length} completed
						</span>
					</div>

					<div className="divide-y divide-slate-100">
						{tabBadges.map((b) => {
							const item = session.items[b.id]
							const isMissing = item?.state === "missing"
							const isPresent = item?.state === "present"

							return (
								<div
									key={b.id}
									className="p-6 transition-colors hover:bg-slate-50/50"
								>
									<div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
										<div className="flex items-center gap-4">
											<div
												className={`w-3 h-3 rounded-full ${
													isPresent
														? "bg-teal-500"
														: isMissing
															? "bg-red-500"
															: "bg-slate-200"
												}`}
											/>
											<span className="text-xl font-bold text-slate-900 tracking-tight">
												{formatBadgeLabel(b)}
											</span>
										</div>

										<div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200 w-full md:w-auto">
											<Button
												variant="ghost"
												size="sm"
												onClick={() =>
													updateSessionItem(sessionId, b.id, {
														state: "present",
													})
												}
												className={`flex-1 md:min-w-[100px] min-h-[40px] ${
													isPresent
														? "bg-white text-teal-600 shadow-sm border border-teal-200"
														: "text-slate-600 hover:bg-white/80"
												}`}
											>
												Present
											</Button>
											<Button
												variant="ghost"
												size="sm"
												onClick={() =>
													updateSessionItem(sessionId, b.id, {
														state: "missing",
													})
												}
												className={`flex-1 md:min-w-[100px] min-h-[40px] ${
													isMissing
														? "bg-white text-red-600 shadow-sm border border-red-200"
														: "text-slate-600 hover:bg-white/80"
												}`}
											>
												Missing
											</Button>
										</div>
									</div>

									{isMissing && (
										<div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 bg-red-50/50 p-4 rounded-xl border border-red-100 animate-in fade-in slide-in-from-top-2">
											<div className="flex flex-col gap-1.5">
												<label className="text-xs font-bold text-red-800 uppercase ml-1">
													Guest Name
												</label>
												<input
													type="text"
													value={item?.guestName || ""}
													onChange={(e) =>
														updateSessionItem(sessionId, b.id, {
															guestName: e.target.value,
														})
													}
													placeholder="Full Name"
													required
													className="w-full text-sm border border-red-200 rounded-lg py-2.5 px-4 bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 shadow-sm"
												/>
											</div>
											<div className="flex flex-col gap-1.5">
												<label className="text-xs font-bold text-red-800 uppercase ml-1">
													Sponsor Name
												</label>
												<input
													type="text"
													value={item?.sponsorName || ""}
													onChange={(e) =>
														updateSessionItem(sessionId, b.id, {
															sponsorName: e.target.value,
														})
													}
													placeholder="Full Name"
													required
													className="w-full text-sm border border-red-200 rounded-lg py-2.5 px-4 bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 shadow-sm"
												/>
											</div>
										</div>
									)}
								</div>
							)
						})}
					</div>

					{/* Footer Navigation */}
					<div className="px-6 py-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-4">
						<Button
							variant="ghost"
							disabled={activeTabIdx === 0}
							onClick={() => setActiveTabIdx((prev) => prev - 1)}
							className="text-slate-600 hover:text-slate-900 disabled:opacity-40"
						>
							<ChevronLeft className="w-4 h-4" /> Previous Tab
						</Button>

						{activeTabIdx < tabProgress.length - 1 ? (
							<Button
								variant={canProceedToNext ? "primary" : "muted"}
								disabled={!canProceedToNext}
								onClick={() => setActiveTabIdx((prev) => prev + 1)}
							>
								Next Tab <ChevronRight className="w-4 h-4" />
							</Button>
						) : (
							<Button
								variant={canProceedToNext ? "success" : "muted"}
								disabled={!canProceedToNext}
								onClick={handleAttemptSubmit}
								className="px-8"
							>
								Submit Session
							</Button>
						)}
					</div>
				</div>

				{/* Modals */}
				{showIncompleteModal && (
					<div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
						<div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 animate-in zoom-in-95">
							<div className="flex items-center gap-3 mb-4 text-slate-900">
								<AlertCircle className="w-6 h-6 text-amber-500" />
								<h3 className="text-lg font-bold">Incomplete Session</h3>
							</div>
							<p className="text-slate-600 mb-6 font-medium">
								You must mark every badge and provide Guest/Sponsor details for
								missing ones across all tabs.
							</p>
							<Button
								className="w-full"
								variant="secondary"
								onClick={() => setShowIncompleteModal(false)}
							>
								Continue Reviewing
							</Button>
						</div>
					</div>
				)}

				{showConflictModal && (
					<div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
						<div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-in zoom-in-95">
							<div className="flex items-center gap-3 mb-2 text-slate-900">
								<AlertCircle className="w-6 h-6 text-blue-500" />
								<h3 className="text-lg font-bold">Session Collision</h3>
							</div>
							<p className="text-slate-600 mb-6 border-b border-slate-100 pb-4">
								A submitted session already exists for the same site today. How
								would you like to handle this duplicate?
							</p>

							<div className="flex flex-col gap-3">
								<Button
									className="w-full justify-start flex-col items-stretch h-auto min-h-[60px] py-3"
									onClick={() => submitWithConflict(showConflictModal)}
								>
									<span className="block">Replace previous session</span>
									<span className="font-normal text-xs opacity-90 mt-0.5 text-left">
										Marks the older session as superseded
									</span>
								</Button>

								<Button
									variant="secondary"
									className="w-full justify-start flex-col items-stretch h-auto min-h-[60px] py-3"
									onClick={() => submitWithConflict(undefined)}
								>
									<span className="block">Keep both</span>
									<span className="font-normal text-xs text-slate-500 mt-0.5 text-left">
										Records this as an additional session today
									</span>
								</Button>

								<Button
									variant="ghost"
									className="mt-2"
									onClick={() => setShowConflictModal(null)}
								>
									Cancel and review
								</Button>
							</div>
						</div>
					</div>
				)}
			</div>
		</AppLayout>
	)
}

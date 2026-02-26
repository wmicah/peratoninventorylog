"use client"

import { AppLayout } from "@/components/AppLayout"
import { useStore, formatBadgeLabel } from "@/lib/store"
import { formatLocalTime } from "@/lib/time"
import { useParams, useRouter } from "next/navigation"
import { useState, useMemo } from "react"
import {
	CopyX,
	CheckCircle2,
	ChevronLeft,
	Link as LinkIcon,
	User,
	UserCheck,
	Printer,
	ShieldCheck,
} from "lucide-react"
import Link from "next/link"

export default function SessionDetailPage() {
	const router = useRouter()
	const params = useParams()
	const sessionId = params?.id as string
	const { sessions, sites, badges } = useStore()

	const [activeTab, setActiveTab] = useState<"missing" | "present" | "all">(
		"missing",
	)

	const session = sessions[sessionId]
	const site = sites.find((s) => s?.id === session?.siteId)
	const siteBadges = useMemo(
		() => badges.filter((b) => b.siteId === session?.siteId),
		[badges, session],
	)

	if (!session || !site) {
		return (
			<AppLayout>
				<div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-500">
					<ShieldCheck className="w-16 h-16 mb-4 opacity-10" />
					<p className="text-xl font-bold tracking-tight text-slate-900">
						Instance Null
					</p>
					<p className="text-sm font-medium">
						The requested audit session does not exist in the registry.
					</p>
				</div>
			</AppLayout>
		)
	}

	const items = Object.values(session.items)
	const missingItems = items.filter((i) => i.state === "missing")
	const presentItems = items.filter((i) => i.state === "present")

	const filteredItems =
		activeTab === "missing"
			? missingItems
			: activeTab === "present"
				? presentItems
				: items

	const handlePrint = () => {
		window.print()
	}

	return (
		<AppLayout>
			<div className="flex flex-col gap-8 max-w-5xl mx-auto print:max-w-none print:m-0">
				{/* Navigation & Actions */}
				<div className="flex items-center justify-between gap-4 print:hidden">
					<button
						onClick={() => router.back()}
						className="text-[10px] font-bold text-slate-400 hover:text-slate-900 flex items-center gap-1 uppercase tracking-widest transition-colors"
					>
						<ChevronLeft className="w-3.5 h-3.5" /> Return to Chronicle
					</button>

					<button
						onClick={handlePrint}
						className="flex items-center gap-2 bg-white text-slate-900 border border-slate-200 px-4 py-2 rounded font-bold text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm active:scale-95"
					>
						<Printer className="w-3.5 h-3.5" /> Print Intelligence Report
					</button>
				</div>

				{/* Header Block */}
				<div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b-2 border-slate-900 pb-8 print:border-b-4">
					<div>
						<div className="flex items-center gap-2 mb-2">
							<div className="bg-slate-900 text-white px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-[0.2em]">
								Official Record
							</div>
							<span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
								ID: {sessionId.split("-")[0]}
							</span>
						</div>
						<h1 className="text-4xl font-extrabold text-slate-900 tracking-tighter leading-none mb-3 print:text-5xl">
							Audit Intelligence
						</h1>
						<div className="flex flex-wrap items-center gap-4">
							<div className="flex flex-col">
								<span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
									Target Facility
								</span>
								<span className="text-sm font-bold text-slate-900">
									{site.name} ({site.id})
								</span>
							</div>
							<div className="w-px h-8 bg-slate-200 hidden sm:block print:block" />
							<div className="flex flex-col">
								<span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
									Reporting Logger
								</span>
								<span className="text-sm font-bold text-slate-900">
									{session.createdBy}
								</span>
							</div>
							<div className="w-px h-8 bg-slate-200 hidden sm:block print:block" />
							<div className="flex flex-col">
								<span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
									Timestamp (Local)
								</span>
								<span className="text-sm font-bold text-slate-900">
									{formatLocalTime(session.submittedAt || session.createdAt)}
								</span>
							</div>
						</div>
					</div>

					<div className="flex gap-4 print:mt-4">
						<div className="bg-white rounded-lg border border-slate-200 px-5 py-3 min-w-[140px] shadow-sm flex flex-col items-center">
							<span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">
								Items Present
							</span>
							<div className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
								<CheckCircle2 className="w-5 h-5 text-teal-600" />{" "}
								{presentItems.length}
							</div>
						</div>
						<div className="bg-white rounded-lg border-2 border-red-200 px-5 py-3 min-w-[140px] shadow-sm flex flex-col items-center">
							<span className="text-[9px] font-bold text-red-400 uppercase tracking-widest mb-1">
								Missing Units
							</span>
							<div className="text-2xl font-extrabold text-red-600 flex items-center gap-2">
								<CopyX className="w-5 h-5" /> {missingItems.length}
							</div>
						</div>
					</div>
				</div>

				{/* Audit Context Links */}
				<div className="flex flex-col gap-3 print:hidden">
					{session.isSuperseded && (
						<div className="flex items-center gap-3 bg-slate-50 text-slate-700 px-4 py-3 rounded-lg border border-slate-200 text-xs font-bold uppercase tracking-wider">
							<CopyX className="w-4 h-4 text-slate-400" /> This Intelligence has
							been superseded
							{session.supersededBy && (
								<Link
									href={`/sessions/${session.supersededBy}`}
									className="flex items-center gap-1 text-[#0F1C3F] hover:underline ml-auto"
								>
									View Latest Instance{" "}
									<ChevronLeft className="w-3 h-3 rotate-180" />
								</Link>
							)}
						</div>
					)}

					{session.replaces && (
						<div className="flex items-center gap-3 bg-blue-50/50 text-blue-700 px-4 py-3 rounded-lg border border-blue-100 text-xs font-bold uppercase tracking-wider">
							<LinkIcon className="w-4 h-4 text-blue-400" /> Corrective Instance
							- Replaces Prior Cycle
							<Link
								href={`/sessions/${session.replaces}`}
								className="flex items-center gap-1 text-blue-900 hover:underline ml-auto"
							>
								View Prior History{" "}
								<ChevronLeft className="w-3 h-3 rotate-180" />
							</Link>
						</div>
					)}
				</div>

				{/* Tabbed Manifest */}
				<div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden print:border-none print:shadow-none">
					<div className="flex border-b border-slate-100 bg-slate-50/50 print:hidden">
						{(["missing", "present", "all"] as const).map((tab) => (
							<button
								key={tab}
								onClick={() => setActiveTab(tab)}
								className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-[0.2em] transition-all ${
									activeTab === tab
										? "text-[#0F1C3F] border-b-2 border-[#0F1C3F] bg-white shadow-inner"
										: "text-slate-400 hover:bg-slate-50 hover:text-slate-700 border-b-2 border-transparent"
								}`}
							>
								{tab} Display (
								{tab === "missing"
									? missingItems.length
									: tab === "present"
										? presentItems.length
										: items.length}
								)
							</button>
						))}
					</div>

					<div className="p-6 bg-slate-50/30 border-b border-slate-100 hidden print:block">
						<h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
							Inventory Manifest: {activeTab.toUpperCase()}
						</h2>
					</div>

					<ul className="divide-y divide-slate-100">
						{filteredItems.length === 0 ? (
							<li className="p-12 text-center text-slate-400 font-bold italic text-sm">
								No manifest entries discovered in this classification.
							</li>
						) : (
							filteredItems.map((item) => {
								const badge = siteBadges.find((b) => b.id === item.badgeId)
								const isMissing = item.state === "missing"

								return (
									<li
										key={item.badgeId}
										className="px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-slate-50/50 transition-colors print:py-4 print:break-inside-avoid"
									>
										<div className="flex items-center gap-4">
											<div
												className={`w-2 h-2 rounded-full ${isMissing ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]" : "bg-teal-500"}`}
											/>
											<div>
												<span className="font-extrabold text-slate-900 text-lg tracking-tight block group-hover:text-[#0F1C3F] transition-colors">
													{badge ? formatBadgeLabel(badge) : "CODE-NULL"}
												</span>
												<span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
													{isMissing ? "DISCREPANCY DETECTED" : "UNIT SECURED"}
												</span>
											</div>
										</div>

										{isMissing && (
											<div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
												<div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded border border-slate-200 min-w-[160px]">
													<User className="w-3.5 h-3.5 text-slate-400" />
													<div className="flex flex-col">
														<span className="text-[8px] uppercase font-bold text-slate-400 tracking-widest">
															Guest Holder
														</span>
														<span className="text-xs font-bold text-slate-900">
															{item.guestName || "UNSPECIFIED"}
														</span>
													</div>
												</div>
												<div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded border border-slate-200 min-w-[160px]">
													<UserCheck className="w-3.5 h-3.5 text-slate-400" />
													<div className="flex flex-col">
														<span className="text-[8px] uppercase font-bold text-slate-400 tracking-widest">
															Sponsor Auth
														</span>
														<span className="text-xs font-bold text-slate-900">
															{item.sponsorName || "UNSPECIFIED"}
														</span>
													</div>
												</div>
											</div>
										)}
									</li>
								)
							})
						)}
					</ul>
				</div>

				{/* Professional Footer for Print */}
				<div className="hidden print:flex flex-col gap-4 mt-auto pt-10 border-t border-slate-200">
					<div className="flex justify-between items-end">
						<div>
							<p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">
								Generated System Audit
							</p>
							<p className="text-[11px] font-extrabold text-slate-900 uppercase tracking-widest">
								Peraton Inventory - Audit Intelligence Manifest
							</p>
						</div>
						<div className="text-right">
							<p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
								Authentication Key
							</p>
							<p className="text-[11px] font-mono font-bold text-slate-900">
								{sessionId}
							</p>
						</div>
					</div>
					<p className="text-[8px] text-slate-400 italic text-center border-t border-slate-100 pt-4">
						Classified Information. For Official Use Only. Unauthorized
						distribution is prohibited. This electronic record serves as a valid
						security audit instance as of {new Date().toLocaleDateString()}.
					</p>
				</div>
			</div>

			<style jsx global>{`
				@media print {
					body {
						background: white !important;
						padding: 0 !important;
					}
					.print\:hidden {
						display: none !important;
					}
					@page {
						margin: 2cm;
					}
				}
			`}</style>
		</AppLayout>
	)
}

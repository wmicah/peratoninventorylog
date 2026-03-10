"use client"

import { AppLayout } from "@/components/AppLayout"
import { Button } from "@/components/ui/Button"
import { useStore } from "@/lib/store"
import {
	createLoggerAccount,
	createAdminAccount,
	listLoggers,
	getIsSuperAdmin,
	updateLoggerAccount,
	type Profile,
} from "@/app/actions/auth"
import {
	UserPlus,
	ShieldCheck,
	Users,
	Loader2,
	Pencil,
	UserX,
	UserCheck,
} from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"

export default function AdminLoggersPage() {
	const { currentUser, sites } = useStore()
	const [loggers, setLoggers] = useState<Profile[]>([])
	const [isSuperAdmin, setIsSuperAdmin] = useState(false)
	const [loading, setLoading] = useState(true)
	const [createForm, setCreateForm] = useState<{
		accountType: "logger" | "admin" | null
		email: string
		full_name: string
		password: string
		assigned_site_ids: string[]
	}>({
		accountType: null,
		email: "",
		full_name: "",
		password: "",
		assigned_site_ids: [],
	})
	const [message, setMessage] = useState<{
		type: "ok" | "err"
		text: string
	} | null>(null)
	const [submitting, setSubmitting] = useState(false)
	const [editingProfile, setEditingProfile] = useState<Profile | null>(null)
	const [editForm, setEditForm] = useState({
		full_name: "",
		assigned_site_ids: [] as string[],
	})
	const [actionLoading, setActionLoading] = useState(false)
	const [togglingId, setTogglingId] = useState<string | null>(null)
	const [siteStateFilter, setSiteStateFilter] = useState<string>("VA")

	const availableStates = useMemo(() => {
		const states = [
			...new Set(sites.map((s) => (s.state ?? "VA").trim() || "VA")),
		]
		return states.length ? states.sort() : ["VA"]
	}, [sites])

	const sitesByState = useMemo(
		() =>
			sites.filter((s) => {
				const effective = (s.state ?? "VA").trim() || "VA"
				return effective === siteStateFilter
			}),
		[sites, siteStateFilter],
	)

	useEffect(() => {
		if (!currentUser) {
			setLoading(false)
			return
		}
		getIsSuperAdmin().then((superAdmin) => {
			setIsSuperAdmin(!!superAdmin)
			const canLoad = currentUser.role === "admin" || superAdmin
			if (canLoad) {
				listLoggers().then((list) => {
					setLoggers(list ?? [])
				})
			}
			setLoading(false)
		})
	}, [currentUser])

	const handleCreateAccount = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!createForm.accountType) return
		setMessage(null)
		setSubmitting(true)
		if (createForm.accountType === "logger") {
			const res = await createLoggerAccount({
				email: createForm.email,
				full_name: createForm.full_name,
				password: createForm.password,
				assigned_site_ids:
					createForm.assigned_site_ids.length > 0
						? createForm.assigned_site_ids
						: sites.map((s) => s.id),
			})
			setSubmitting(false)
			if (res.ok) {
				setMessage({
					type: "ok",
					text: "Account created. They can sign in with the password you set.",
				})
				setCreateForm({
					accountType: null,
					email: "",
					full_name: "",
					password: "",
					assigned_site_ids: [],
				})
				const list = await listLoggers()
				setLoggers(list ?? [])
			} else {
				setMessage({ type: "err", text: res.error })
			}
		} else {
			const res = await createAdminAccount({
				email: createForm.email,
				full_name: createForm.full_name,
				password: createForm.password,
			})
			setSubmitting(false)
			if (res.ok) {
				setMessage({ type: "ok", text: "Admin account created." })
				setCreateForm({
					accountType: null,
					email: "",
					full_name: "",
					password: "",
					assigned_site_ids: [],
				})
			} else {
				setMessage({ type: "err", text: res.error })
			}
		}
	}

	const openEdit = (p: Profile) => {
		setEditingProfile(p)
		setEditForm({
			full_name: p.full_name,
			assigned_site_ids: p.assigned_site_ids ?? [],
		})
	}

	const handleSaveEdit = async () => {
		if (!editingProfile) return
		setMessage(null)
		setActionLoading(true)
		const res = await updateLoggerAccount(editingProfile.id, {
			full_name: editForm.full_name,
			assigned_site_ids: editForm.assigned_site_ids.length
				? editForm.assigned_site_ids
				: sites.map((s) => s.id),
		})
		setActionLoading(false)
		if (res.ok) {
			setMessage({ type: "ok", text: "Account updated." })
			setEditingProfile(null)
			const list = await listLoggers()
			setLoggers(list ?? [])
		} else {
			setMessage({ type: "err", text: res.error })
		}
	}

	const handleToggleDisabled = async (p: Profile) => {
		setMessage(null)
		setTogglingId(p.id)
		const res = await updateLoggerAccount(p.id, {
			disabled: !p.disabled,
		})
		setTogglingId(null)
		if (res.ok) {
			setMessage({
				type: "ok",
				text: p.disabled
					? "Account re-enabled."
					: "Account disabled. Audit history is preserved.",
			})
			const list = await listLoggers()
			setLoggers(list ?? [])
		} else {
			setMessage({ type: "err", text: res.error })
		}
	}

	const canAccess = (currentUser?.role === "admin" || isSuperAdmin) && !loading
	if (!canAccess) {
		return (
			<AppLayout>
				<div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-500">
					{loading ? (
						<Loader2 className="w-10 h-10 animate-spin text-slate-300 mb-4" />
					) : (
						<>
							<ShieldCheck className="w-16 h-16 mb-4 opacity-10" />
							<p className="text-xl font-black tracking-tight text-slate-900">
								Access Restricted
							</p>
							<p className="text-sm font-medium">
								Administrator credentials required.
							</p>
						</>
					)}
				</div>
			</AppLayout>
		)
	}

	return (
		<AppLayout>
			<div className="flex flex-col gap-10 max-w-4xl">
				<div>
					<h1 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-none">
						Account Management
					</h1>
					<p className="text-slate-500 font-semibold text-sm mt-1">
						Create accounts. Choose inventory account or admin (super admin
						only). Account type is required.
					</p>
				</div>

				{message && (
					<div
						className={`rounded-lg border px-4 py-3 text-sm font-medium ${
							message.type === "ok"
								? "bg-green-50 border-green-200 text-green-800"
								: "bg-red-50 border-red-200 text-red-800"
						}`}
					>
						{message.text}
					</div>
				)}

				{/* Create Account — single form with account type choice */}
				<div
					id="create-account"
					className="bg-white rounded-xl border border-slate-200 shadow-sm p-6"
				>
					<h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-4">
						<UserPlus className="w-5 h-5" /> Create Account
					</h2>
					<form
						onSubmit={handleCreateAccount}
						className="space-y-6"
						autoComplete="off"
					>
						<div>
							<label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-2 block">
								Account type <span className="text-red-500">*</span>
							</label>
							<div className="flex flex-wrap gap-4">
								<button
									type="button"
									onClick={() =>
										setCreateForm((p) => ({ ...p, accountType: "logger" }))
									}
									className={`flex items-center gap-3 px-5 py-4 rounded-xl border-2 text-left transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary-900)] ${
										createForm.accountType === "logger"
											? "border-[var(--color-primary-900)] bg-primary-50"
											: "border-slate-200 bg-slate-50 hover:border-slate-300"
									}`}
								>
									<Users className="w-6 h-6 text-slate-600 shrink-0" />
									<div>
										<span className="font-bold text-slate-900 block">
											Inventory account
										</span>
										<span className="text-xs text-slate-500">
											Takes inventory at assigned facilities
										</span>
									</div>
								</button>
								{isSuperAdmin && (
									<button
										type="button"
										onClick={() =>
											setCreateForm((p) => ({ ...p, accountType: "admin" }))
										}
										className={`flex items-center gap-3 px-5 py-4 rounded-xl border-2 text-left transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 ${
											createForm.accountType === "admin"
												? "border-amber-500 bg-amber-50"
												: "border-slate-200 bg-slate-50 hover:border-slate-300"
										}`}
									>
										<ShieldCheck className="w-6 h-6 text-amber-600 shrink-0" />
										<div>
											<span className="font-bold text-slate-900 block">
												Admin
											</span>
											<span className="text-xs text-slate-500">
												Full access to facilities and accounts
											</span>
										</div>
									</button>
								)}
							</div>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">
									Email
								</label>
								<input
									type="email"
									required
									autoComplete="off"
									value={createForm.email}
									onChange={(e) =>
										setCreateForm((p) => ({ ...p, email: e.target.value }))
									}
									className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-900)]"
									placeholder="name@peraton.com"
								/>
							</div>
							<div>
								<label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">
									Full Name
								</label>
								<input
									type="text"
									required
									value={createForm.full_name}
									onChange={(e) =>
										setCreateForm((p) => ({ ...p, full_name: e.target.value }))
									}
									className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-900)]"
									placeholder="Full Name"
								/>
							</div>
						</div>
						<div>
							<label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">
								Temporary Password
							</label>
							<input
								type="password"
								required
								minLength={6}
								autoComplete="new-password"
								value={createForm.password}
								onChange={(e) =>
									setCreateForm((p) => ({ ...p, password: e.target.value }))
								}
								className="w-full max-w-xs px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-900)]"
								placeholder="Min 6 characters"
							/>
						</div>
						{createForm.accountType === "logger" && (
							<div>
								<div className="mb-2 flex items-center gap-2">
									<label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
										State
									</label>
									<select
										value={siteStateFilter}
										onChange={(e) => setSiteStateFilter(e.target.value)}
										className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-900)]"
									>
										{availableStates.map((st) => (
											<option key={st} value={st}>
												{st}
											</option>
										))}
									</select>
								</div>
								<label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">
									Assigned Sites (leave empty for all)
								</label>
								<div className="flex flex-wrap gap-2">
									{sitesByState.map((s) => (
										<label
											key={s.id}
											className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer"
										>
											<input
												type="checkbox"
												checked={createForm.assigned_site_ids.includes(s.id)}
												onChange={(e) =>
													setCreateForm((p) => ({
														...p,
														assigned_site_ids: e.target.checked
															? [...p.assigned_site_ids, s.id]
															: p.assigned_site_ids.filter((id) => id !== s.id),
													}))
												}
												className="rounded border-slate-300"
											/>
											<span className="text-sm font-semibold text-slate-700">
												{s.name}
											</span>
										</label>
									))}
								</div>
							</div>
						)}
						<Button
							type="submit"
							disabled={submitting || !createForm.accountType}
						>
							{submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
							Create account
						</Button>
					</form>
				</div>

				{/* List Accounts */}
				<div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
					<h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 p-6 pb-0">
						<Users className="w-5 h-5" /> Accounts
					</h2>
					{loading ? (
						<div className="p-8 flex justify-center">
							<Loader2 className="w-8 h-8 animate-spin text-slate-300" />
						</div>
					) : loggers.length === 0 ? (
						<div className="p-8 flex flex-col items-center gap-4 text-center">
							<p className="text-slate-500 font-medium">No accounts yet.</p>
							<Link
								href="#create-account"
								className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0F1C3F] text-white text-sm font-bold hover:bg-slate-800 transition-colors"
							>
								<UserPlus className="w-4 h-4" /> Create account
							</Link>
						</div>
					) : (
						<table className="w-full text-left border-collapse">
							<thead>
								<tr className="bg-slate-50 border-t border-slate-100">
									<th className="px-6 py-4 text-[9px] font-bold uppercase tracking-widest text-slate-400">
										Name
									</th>
									<th className="px-6 py-4 text-[9px] font-bold uppercase tracking-widest text-slate-400">
										Email
									</th>
									<th className="px-6 py-4 text-[9px] font-bold uppercase tracking-widest text-slate-400">
										Sites
									</th>
									<th className="px-6 py-4 text-[9px] font-bold uppercase tracking-widest text-slate-400 w-24">
										Status
									</th>
									<th className="px-6 py-4 text-[9px] font-bold uppercase tracking-widest text-slate-400 w-28">
										Actions
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-100">
								{loggers.map((p) => (
									<tr
										key={p.id}
										className={p.disabled ? "bg-slate-50/70" : undefined}
									>
										<td className="px-6 py-4 font-semibold text-slate-900">
											{p.full_name}
										</td>
										<td className="px-6 py-4 text-slate-600">{p.email}</td>
										<td className="px-6 py-4 text-slate-600">
											{p.assigned_site_ids.length === 0
												? "All"
												: p.assigned_site_ids.join(", ")}
										</td>
										<td className="px-6 py-4">
											<span
												className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
													p.disabled
														? "bg-amber-100 text-amber-800"
														: "bg-emerald-100 text-emerald-800"
												}`}
											>
												{p.disabled ? (
													<>
														<UserX className="w-3 h-3" /> Disabled
													</>
												) : (
													<>
														<UserCheck className="w-3 h-3" /> Enabled
													</>
												)}
											</span>
										</td>
										<td className="px-6 py-4">
											<div className="flex items-center gap-2">
												<button
													type="button"
													onClick={() => openEdit(p)}
													className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors"
													title="Edit account"
												>
													<Pencil className="w-4 h-4" />
												</button>
												<button
													type="button"
													onClick={() => handleToggleDisabled(p)}
													disabled={togglingId === p.id}
													className={`p-2 rounded-lg border transition-colors disabled:opacity-50 ${
														p.disabled
															? "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
															: "border-amber-200 text-amber-600 hover:bg-amber-50"
													}`}
													title={
														p.disabled
															? "Re-enable account"
															: "Disable account (keeps audit data)"
													}
												>
													{togglingId === p.id ? (
														<Loader2 className="w-4 h-4 animate-spin" />
													) : p.disabled ? (
														<UserCheck className="w-4 h-4" />
													) : (
														<UserX className="w-4 h-4" />
													)}
												</button>
											</div>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					)}
				</div>

				{/* Edit account modal */}
				{editingProfile && (
					<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
						<div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full p-6">
							<h3 className="text-lg font-bold text-slate-900 mb-4">
								Edit account
							</h3>
							<p className="text-sm text-slate-500 mb-4">
								{editingProfile.email}
							</p>
							<div className="space-y-4">
								<div>
									<label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
										Full name
									</label>
									<input
										type="text"
										value={editForm.full_name}
										onChange={(e) =>
											setEditForm((f) => ({ ...f, full_name: e.target.value }))
										}
										className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
									/>
								</div>
								<div>
									<div className="mb-2 flex items-center gap-2">
										<label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
											State
										</label>
										<select
											value={siteStateFilter}
											onChange={(e) => setSiteStateFilter(e.target.value)}
											className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-900)]"
										>
											{availableStates.map((st) => (
												<option key={st} value={st}>
													{st}
												</option>
											))}
										</select>
									</div>
									<label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
										Assigned facilities (leave empty for all)
									</label>
									<div className="flex flex-wrap gap-2">
										{sitesByState.map((s) => (
											<label
												key={s.id}
												className="flex items-center gap-1.5 cursor-pointer"
											>
												<input
													type="checkbox"
													checked={editForm.assigned_site_ids.includes(s.id)}
													onChange={(e) =>
														setEditForm((f) => ({
															...f,
															assigned_site_ids: e.target.checked
																? [...f.assigned_site_ids, s.id]
																: f.assigned_site_ids.filter(
																		(id) => id !== s.id,
																	),
														}))
													}
													className="rounded border-slate-300"
												/>
												<span className="text-sm font-medium text-slate-700">
													{s.name}
												</span>
											</label>
										))}
									</div>
								</div>
							</div>
							<div className="flex gap-3 mt-6">
								<Button
									type="button"
									onClick={handleSaveEdit}
									disabled={actionLoading}
									className="flex-1"
								>
									{actionLoading ? (
										<Loader2 className="w-4 h-4 animate-spin" />
									) : (
										"Save"
									)}
								</Button>
								<button
									type="button"
									onClick={() => setEditingProfile(null)}
									disabled={actionLoading}
									className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 disabled:opacity-60"
								>
									Cancel
								</button>
							</div>
						</div>
					</div>
				)}
			</div>
		</AppLayout>
	)
}

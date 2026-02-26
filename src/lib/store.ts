import { create } from "zustand"
import { persist } from "zustand/middleware"
import { persistSession, persistBadge, deleteBadgeFromDb } from "@/lib/db"

export type ItemState = "present" | "missing" | "not_checked"

export interface Category {
	id: string
	name: string
}

export interface Badge {
	id: string
	code: string
	categoryId: string
	siteId: string
	/** When false, officers do not see this badge in inventory. */
	active: boolean
	/** Optional number for officer display, e.g. RES001 [1]. */
	displayNumber?: number | null
	/** When the badge was created (for "recently imported" sort). */
	createdAt?: string
}

/** Officer-facing label: "CODE [N]" when displayNumber set, else "CODE". */
export function formatBadgeLabel(badge: Badge): string {
	return badge.displayNumber != null
		? `${badge.code} [${badge.displayNumber}]`
		: badge.code
}

export interface SessionItem {
	badgeId: string
	state: ItemState
	guestName?: string
	sponsorName?: string
}

export interface Session {
	id: string
	siteId: string
	createdAt: string
	submittedAt?: string
	createdBy: string
	status: "draft" | "submitted"
	isSuperseded: boolean
	supersededBy?: string
	replaces?: string
	items: Record<string, SessionItem>
}

export interface AppState {
	currentUser: {
		name: string
		email: string
		role: "admin" | "logger"
		assignedSiteIds: string[]
	} | null
	sessions: Record<string, Session>
	sites: {
		id: string
		name: string
		address?: string | null
	}[]
	categories: Category[]
	badges: Badge[]
	selectedSite: string

	login: (email: string) => void
	setCurrentUser: (user: AppState["currentUser"]) => void
	logout: () => void
	setSelectedSite: (siteId: string) => void
	setSites: (
		sites: {
			id: string
			name: string
			address?: string | null
		}[],
	) => void
	setCategories: (categories: Category[]) => void
	setBadges: (badges: Badge[]) => void
	setSessions: (sessions: Record<string, Session>) => void
	createSession: (siteId: string) => string
	updateSessionItem: (
		sessionId: string,
		badgeId: string,
		item: Partial<SessionItem>,
	) => void
	submitSession: (sessionId: string, replaceSessionId?: string) => void
	addBadge: (
		badge: Omit<Badge, "id" | "active" | "displayNumber"> &
			Partial<Pick<Badge, "active" | "displayNumber">>,
	) => void
	removeBadge: (badgeId: string) => void
}

const INITIAL_SITES = [
	{ id: "SG", name: "Stone Gate" },
	{ id: "HQ", name: "Headquarters" },
	{ id: "LH", name: "Little Herndon" },
]

const INITIAL_CATEGORIES = [
	{ id: "cat-escort", name: "Escort Required" },
	{ id: "cat-foreign", name: "Foreign National" },
	{ id: "cat-temp", name: "Employee Temp" },
	{ id: "cat-no-escort", name: "No Escort Required" },
]

function generateInitBadges(): Badge[] {
	const badges: Badge[] = []
	INITIAL_SITES.forEach((site) => {
		INITIAL_CATEGORIES.forEach((cat) => {
			for (let i = 1; i <= 5; i++) {
				const pfx = cat.name
					.split(" ")
					.map((w) => w[0])
					.join("")
					.toUpperCase()
				badges.push({
					id: `${site.id}-${cat.id}-${i}`,
					code: `${site.id}-${pfx}-${1000 + i}`,
					categoryId: cat.id,
					siteId: site.id,
					active: true,
					displayNumber: i,
				})
			}
		})
	})
	return badges
}

const MOCK_USERS = [
	{
		email: "admin@peraton.com",
		name: "System Admin",
		role: "admin" as const,
		sites: ["SG", "HQ", "LH"],
	},
	{
		email: "sg-logger@peraton.com",
		name: "Logger Smith",
		role: "logger" as const,
		sites: ["SG"],
	},
	{
		email: "multi-logger@peraton.com",
		name: "Logger Jones",
		role: "logger" as const,
		sites: ["SG", "HQ"],
	},
]

export const useStore = create<AppState>()(
	persist(
		(set, get) => ({
			currentUser: null,
			sessions: {},
			sites: INITIAL_SITES,
			categories: INITIAL_CATEGORIES,
			badges: generateInitBadges(),
			selectedSite: INITIAL_SITES[0].id,

			setSelectedSite: (siteId: string) => set({ selectedSite: siteId }),

			setSites: (sites) => set({ sites }),
			setCategories: (categories) => set({ categories }),
			setBadges: (badges) => set({ badges }),
			setSessions: (sessions) => set({ sessions }),

			login: (email: string) => {
				const mockUser = MOCK_USERS.find(
					(u) => u.email.toLowerCase() === email.toLowerCase(),
				)

				if (mockUser) {
					set({
						currentUser: {
							name: mockUser.name,
							email: mockUser.email,
							role: mockUser.role,
							assignedSiteIds: mockUser.sites,
						},
					})
				} else {
					// Fallback for demo flexibility
					const isAdmin = email.toLowerCase().includes("admin")
					set({
						currentUser: {
							name: isAdmin ? "System Admin" : "Logger User",
							email,
							role: isAdmin ? "admin" : "logger",
							assignedSiteIds: isAdmin
								? INITIAL_SITES.map((s) => s.id)
								: [INITIAL_SITES[0].id],
						},
					})
				}
			},

			setCurrentUser: (user) => set({ currentUser: user }),

			logout: () => set({ currentUser: null }),

			createSession: (siteId: string) => {
				const id = crypto.randomUUID()
				const user = get().currentUser?.name || "Unknown Logger"
				const siteBadges = get().badges.filter(
					(b) => b.siteId === siteId && b.active !== false,
				)

				const items: Record<string, SessionItem> = {}
				siteBadges.forEach((b) => {
					items[b.id] = { badgeId: b.id, state: "not_checked" }
				})

				const newSession: Session = {
					id,
					siteId,
					createdAt: new Date().toISOString(),
					createdBy: user,
					status: "draft",
					isSuperseded: false,
					items,
				}
				set((state) => ({
					sessions: {
						...state.sessions,
						[id]: newSession,
					},
				}))
				persistSession(newSession).catch(() => {})
				return id
			},

			updateSessionItem: (
				sessionId: string,
				badgeId: string,
				itemChanges: Partial<SessionItem>,
			) => {
				set((state) => {
					const session = state.sessions[sessionId]
					if (!session) return state

					const currentItem = session.items[badgeId]
					const newItem = { ...currentItem, ...itemChanges }
					if (newItem.state !== "missing") {
						delete newItem.guestName
						delete newItem.sponsorName
					}

					const updated = {
						...session,
						items: {
							...session.items,
							[badgeId]: newItem,
						},
					}
					persistSession(updated).catch(() => {})
					return {
						sessions: {
							...state.sessions,
							[sessionId]: updated,
						},
					}
				})
			},

			submitSession: (sessionId: string, replaceSessionId?: string) => {
				set((state) => {
					const session = state.sessions[sessionId]
					if (!session) return state

					const submitted: Session = {
						...session,
						status: "submitted",
						submittedAt: new Date().toISOString(),
						replaces: replaceSessionId,
					}
					const updates: Record<string, Session> = { [sessionId]: submitted }

					if (replaceSessionId && state.sessions[replaceSessionId]) {
						const superseded = {
							...state.sessions[replaceSessionId],
							isSuperseded: true,
							supersededBy: sessionId,
						}
						updates[replaceSessionId] = superseded
						persistSession(superseded).catch(() => {})
					}
					persistSession(submitted).catch(() => {})

					return {
						sessions: {
							...state.sessions,
							...updates,
						},
					}
				})
			},

			addBadge: (newBadgeData) => {
				const id = crypto.randomUUID()
				const badge: Badge = {
					...newBadgeData,
					id,
					active: newBadgeData.active ?? true,
					displayNumber: newBadgeData.displayNumber ?? undefined,
				}
				set((state) => ({
					badges: [...state.badges, badge],
				}))
				persistBadge(badge).catch(() => {})
			},

			removeBadge: (badgeId) => {
				set((state) => ({
					badges: state.badges.filter((b) => b.id !== badgeId),
				}))
				deleteBadgeFromDb(badgeId).catch(() => {})
			},
		}),
		{
			name: "inventory-taking-test-storage",
		},
	),
)

"use client"

import { Suspense } from "react"
import { useParams, useSearchParams } from "next/navigation"
import { DashboardSiteContent } from "../DashboardSiteContent"

export default function DashboardSitePage() {
	return (
		<Suspense>
			<DashboardSitePageInner />
		</Suspense>
	)
}

function DashboardSitePageInner() {
	const params = useParams()
	const searchParams = useSearchParams()
	const siteId = (params?.siteId as string) ?? ""
	const initialDate = searchParams.get("date") ?? undefined

	if (!siteId) return null

	return <DashboardSiteContent siteId={siteId} initialDate={initialDate} />
}

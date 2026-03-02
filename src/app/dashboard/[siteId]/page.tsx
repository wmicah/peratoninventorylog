"use client"

import { useParams } from "next/navigation"
import { DashboardSiteContent } from "../DashboardSiteContent"

export default function DashboardSitePage() {
	const params = useParams()
	const siteId = (params?.siteId as string) ?? ""

	if (!siteId) return null

	return <DashboardSiteContent siteId={siteId} />
}

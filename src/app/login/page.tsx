"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/** Login is now at /. Redirect old /login links to home. */
export default function LoginRedirect() {
	const router = useRouter()
	useEffect(() => {
		router.replace("/")
	}, [router])
	return null
}

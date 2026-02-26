"use client"

import { useEffect, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { useStore } from "@/lib/store"

const hasSupabase = () => {
  if (typeof window === "undefined") return false
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return Boolean(url && key && url.length > 0 && key.length > 0)
}

/** Restores Supabase session into the store (profile) on load. */
export function AuthHydrate() {
  const ran = useRef(false)
  const setCurrentUser = useStore((s) => s.setCurrentUser)

  useEffect(() => {
    if (!hasSupabase() || ran.current) return
    ran.current = true

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) return
      supabase
        .from("profiles")
        .select("id, email, full_name, role, assigned_site_ids")
        .eq("id", session.user.id)
        .single()
        .then(({ data: profile, error }) => {
          if (error || !profile) return
          setCurrentUser({
            name: profile.full_name,
            email: profile.email,
            role: profile.role as "admin" | "logger",
            assignedSiteIds: profile.assigned_site_ids ?? [],
          })
        })
    })
  }, [setCurrentUser])

  return null
}

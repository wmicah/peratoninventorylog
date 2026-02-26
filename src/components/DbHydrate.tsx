"use client";

import { useEffect, useRef } from "react";
import { hydrateFromSupabase, isDbConfigured } from "@/lib/db";
import { useStore } from "@/lib/store";

/**
 * When Supabase env vars are set, hydrates the store from the database once on mount.
 * Safe to mount in root layout; no-op when DB is not configured.
 */
export function DbHydrate() {
  const ran = useRef(false);
  const setSites = useStore((s) => s.setSites);
  const setCategories = useStore((s) => s.setCategories);
  const setBadges = useStore((s) => s.setBadges);
  const setSessions = useStore((s) => s.setSessions);

  useEffect(() => {
    if (!isDbConfigured() || ran.current) return;
    ran.current = true;
    hydrateFromSupabase({
      setSites,
      setCategories,
      setBadges,
      setSessions,
    }).catch((err) => console.warn("[DbHydrate]", err));
  }, [setSites, setCategories, setBadges, setSessions]);

  return null;
}

"use client";

import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/Button";
import { useStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";

export default function TakeInventoryPage() {
  const router = useRouter();
  const { selectedSite, sites, createSession, currentUser } = useStore();
  const site = sites.find(s => s.id === selectedSite);

  const handleStart = () => {
    if (site) {
      const sessionId = createSession(site.id);
      router.push(`/session/${sessionId}`);
    }
  };

  if (!site) return null;

  return (
    <AppLayout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="bg-white p-8 md:p-12 rounded-2xl border border-slate-200 shadow-sm max-w-md w-full">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Play className="w-8 h-8 text-[var(--color-primary)] ml-1" />
          </div>
          
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Start a session</h1>
          <p className="text-slate-500 mb-8 font-medium">
            Recording inventory for <br />
            <strong className="text-slate-900 text-lg">{site.name}</strong>
          </p>

          {site && currentUser?.role !== 'admin' ? (
            <Button onClick={handleStart} className="w-full text-base py-4">
              Start Session
            </Button>
          ) : (
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
               <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Administrative Access Only</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

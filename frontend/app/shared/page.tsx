"use client";

import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/ligma/AppSidebar";
import { WorkspaceTopbar } from "@/components/ligma/WorkspaceTopbar";
import { SessionGrid, SessionItem } from "@/components/ligma/SessionGrid";
import { Loader2 } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

async function getAuthHeader(): Promise<Record<string, string>> {
  try {
    const { supabase } = await import("@/lib/supabase");
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token || localStorage.getItem("sb-access-token");
    if (token) return { Authorization: `Bearer ${token}` };
  } catch {}
  return {};
}

export default function Shared() {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const headers = await getAuthHeader();
        const res = await fetch(`${API}/api/share/shared-with-me`, { headers });
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        const items: SessionItem[] = (data.rooms || []).map((r: any) => ({
          id: r.id,
          name: r.name,
          folder: "Shared",
          folderColor: "bg-indigo",
          thumb: "bg-sticky-sky",
          live: 0,
          time: r.updated_at
            ? new Date(r.updated_at).toLocaleDateString()
            : "unknown",
          tasks: 0,
          shared: true,
        }));
        setSessions(items);
      } catch {
        setSessions([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 min-w-0">
        <WorkspaceTopbar label="/shared with me" title="Shared with you" />
        <div className="px-4 md:px-8 py-6 md:py-8 space-y-6">
          <div>
            <div className="zine-label mb-1">§ collaborations</div>
            <h2 className="text-xl font-bold">Sessions teammates invited you to</h2>
          </div>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-8">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading shared sessions...
            </div>
          ) : (
            <SessionGrid
              sessions={sessions}
              empty={<p className="text-muted-foreground">Nothing shared with you yet.</p>}
            />
          )}
        </div>
      </main>
    </div>
  );
}

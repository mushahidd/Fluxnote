"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppSidebar } from "@/components/ligma/AppSidebar";
import { WorkspaceTopbar } from "@/components/ligma/WorkspaceTopbar";
import { SessionGrid, type SessionItem } from "@/components/ligma/SessionGrid";
import { roomsApi, workspacesApi, type Room } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

const thumbs = ["bg-sticky-yellow", "bg-sticky-pink", "bg-sticky-mint", "bg-sticky-sky"];
const folderColors = ["bg-coral", "bg-warning", "bg-success", "bg-indigo"];

const folders = [
  { name: "All projects", color: "bg-foreground" },
];

function ProjectsContent() {
  const searchParams = useSearchParams();
  const folder = searchParams.get("folder") || "All projects";
  const { user } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [workspaceName, setWorkspaceName] = useState("Workspace");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      if (!user) { setLoading(false); return; }
      setLoading(true);
      try {
        const [roomData, primaryWorkspace] = await Promise.all([
          roomsApi.getRooms(),
          workspacesApi.getPrimary(),
        ]);
        if (!isMounted) return;
        setRooms(roomData || []);
        setWorkspaceName(primaryWorkspace?.name || "Workspace");
      } catch (err) {
        console.error("Failed to load rooms:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    load();
    return () => { isMounted = false; };
  }, [user]);

  const sessionItems: SessionItem[] = rooms.map((room, i) => ({
    id: room.id,
    name: room.name,
    folder: workspaceName,
    folderColor: folderColors[i % folderColors.length],
    thumb: thumbs[i % thumbs.length],
    live: 0,
    time: room.createdAt ? formatTime(room.createdAt) : "recently",
    tasks: 0,
  }));

  const filtered = folder === "All projects" ? sessionItems : sessionItems.filter(s => s.folder === folder);

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 min-w-0">
        <WorkspaceTopbar label="/projects" title="Projects" />
        <div className="px-4 md:px-8 py-6 md:py-8 space-y-6">
          <div className="flex gap-2 flex-wrap">
            {folders.map(f => {
              const active = folder === f.name;
              return (
                <button key={f.name}
                  onClick={() => {
                    const params = new URLSearchParams(searchParams.toString());
                    if (f.name === "All projects") {
                      params.delete("folder");
                    } else {
                      params.set("folder", f.name);
                    }
                    window.history.pushState(null, "", `?${params.toString()}`);
                  }}
                  className={cn("inline-flex items-center gap-2 rounded-full border-2 px-3 py-1.5 text-sm transition-colors",
                    active ? "border-foreground bg-foreground text-background" : "border-foreground/15 hover:border-foreground/40")}>
                  <span className={cn("h-2 w-2 rounded-sm", f.color)} />
                  {f.name}
                </button>
              );
            })}
          </div>
          {loading ? (
            <div className="rounded-2xl border-2 border-foreground/15 bg-card p-6 text-sm text-muted-foreground">
              Loading projects…
            </div>
          ) : (
            <SessionGrid sessions={filtered} empty={<p className="text-muted-foreground">No sessions in this project.</p>}/>
          )}
        </div>
      </main>
    </div>
  );
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";
  const diff = Date.now() - date.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function Projects() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen bg-background items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-4 text-sm text-muted-foreground">Loading projects...</p>
        </div>
      </div>
    }>
      <ProjectsContent />
    </Suspense>
  );
}

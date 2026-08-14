"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Grid3x3, List, Filter, ArrowRight, CheckCircle2, Circle, AlertCircle, MoreHorizontal } from "lucide-react";
import { AppSidebar } from "@/components/ligma/AppSidebar";
import { WorkspaceTopbar } from "@/components/ligma/WorkspaceTopbar";
import { SessionGrid, type SessionItem } from "@/components/ligma/SessionGrid";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { roomsApi, tasksApi, workspacesApi, type Room, type Task } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const thumbs = ["bg-sticky-yellow", "bg-sticky-pink", "bg-sticky-mint", "bg-sticky-sky"];
const folderColors = ["bg-coral", "bg-warning", "bg-success", "bg-indigo"];

export default function Recent() {
  const { user, isLoading: authLoading } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [workspaceName, setWorkspaceName] = useState("Workspace");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      window.location.href = '/auth';
    }
  }, [user, authLoading]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      if (!user) { setLoading(false); return; }
      setLoading(true);
      setError(null);
      try {
        const [roomData, primaryWorkspace] = await Promise.all([
          roomsApi.getRooms(),
          workspacesApi.getPrimary(),
        ]);
        if (!isMounted) return;
        setRooms(roomData || []);
        setWorkspaceName(primaryWorkspace?.name || "Workspace");
        const tasksByRoom = await Promise.all(
          (roomData || []).slice(0, 3).map(async (room) => {
            try { return await tasksApi.getTasks(room.id); } catch { return [] as Task[]; }
          })
        );
        if (!isMounted) return;
        setTasks(tasksByRoom.flat());
      } catch (err: any) {
        if (!isMounted) return;
        setError(err.message || "Failed to load sessions");
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    load();
    return () => { isMounted = false; };
  }, [user]);

  const sessionItems = useMemo<SessionItem[]>(() => {
    if (!mounted) return [];
    return rooms.map((room, i) => ({
      id: room.id,
      name: room.name,
      folder: workspaceName,
      folderColor: folderColors[i % folderColors.length],
      thumb: thumbs[i % thumbs.length],
      live: 0,
      time: room.createdAt ? formatTime(room.createdAt) : "recently",
      tasks: tasks.filter(t => t.roomId === room.id).length,
    }));
  }, [rooms, tasks, workspaceName, mounted]);

  const taskItems = useMemo(() =>
    tasks.slice(0, 6).map(task => ({
      t: task.text, status: task.status,
      session: rooms.find(r => r.id === task.roomId)?.name || "Session",
      due: task.createdAt ? formatTime(task.createdAt) : "soon",
    })),
  [rooms, tasks]);

  const metrics = useMemo(() => {
    if (!mounted) return { activeSessions: 0, tasksExtracted: 0 };
    return {
      activeSessions: rooms.length,
      tasksExtracted: tasks.length,
    };
  }, [rooms.length, tasks.length, mounted]);

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 min-w-0">
        <WorkspaceTopbar label="/recent" title="Welcome back" />

        <div className="px-4 md:px-8 py-6 md:py-8 space-y-8 md:space-y-12">
          {/* Sessions section */}
          <section>
            <div className="flex items-end justify-between mb-5">
              <div>
                <div className="zine-label mb-1">§ continue working</div>
                <h2 className="text-xl font-bold">Pick up where you left off</h2>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => toast({ title: "Filters", description: "Filter UI is coming soon." })}>
                  <Filter className="h-3.5 w-3.5"/> Filter
                </Button>
                <Button
                  variant="ghost" size="icon-sm"
                  className={view === "grid" ? "bg-muted" : ""}
                  onClick={() => setView("grid")}
                >
                  <Grid3x3 className="h-3.5 w-3.5"/>
                </Button>
                <Button
                  variant="ghost" size="icon-sm"
                  className={view === "list" ? "bg-muted" : ""}
                  onClick={() => setView("list")}
                >
                  <List className="h-3.5 w-3.5"/>
                </Button>
              </div>
            </div>

            {loading && (
              <div className="rounded-2xl border-2 border-foreground/15 bg-card p-6 text-sm text-muted-foreground">
                Loading sessions…
              </div>
            )}
            {!loading && error && (
              <div className="rounded-2xl border-2 border-coral/40 bg-coral/5 p-6 text-sm text-coral">{error}</div>
            )}
            {!loading && !error && (
              <SessionGrid
                sessions={sessionItems}
                view={view}
                empty={
                  <div className="space-y-2">
                    <p className="text-muted-foreground">No sessions yet.</p>
                    <p className="text-xs text-muted-foreground">Click "New session" above to get started.</p>
                  </div>
                }
              />
            )}
          </section>

          {/* Tasks + Pulse */}
          <section className="grid lg:grid-cols-3 gap-4 md:gap-6">
            <div className="lg:col-span-2 rounded-2xl border-2 border-foreground/15 bg-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="zine-label mb-1">§ assigned to you</div>
                  <h2 className="text-xl font-bold">Tasks across sessions</h2>
                </div>
                <Button asChild variant="ghost" size="sm"><Link href="/projects">View all <ArrowRight className="h-3.5 w-3.5"/></Link></Button>
              </div>
              <div className="divide-y divide-foreground/10">
                {taskItems.length === 0 && (
                  <div className="py-6 text-sm text-muted-foreground">No tasks yet — capture action items on the canvas.</div>
                )}
                {taskItems.map((t, i) => {
                  const Icon = t.status === "done" ? CheckCircle2 : t.status === "in_progress" ? AlertCircle : Circle;
                  const color = t.status === "done" ? "text-success" : t.status === "in_progress" ? "text-warning" : "text-muted-foreground";
                  return (
                    <div key={i} className="py-3 flex items-center gap-3 hover:bg-muted/40 -mx-3 px-3 rounded-md transition-colors">
                      <Icon className={`h-4 w-4 ${color}`} />
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium ${t.status === "done" ? "line-through text-muted-foreground" : ""}`}>{t.t}</div>
                        <div className="text-xs text-muted-foreground font-mono mt-0.5">{t.session}</div>
                      </div>
                      <span className="text-xs font-mono text-muted-foreground">{t.due}</span>
                      <Button variant="ghost" size="icon-sm"><MoreHorizontal className="h-3.5 w-3.5"/></Button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border-2 border-foreground bg-foreground text-background p-6 relative overflow-hidden">
              <div className="absolute inset-0 bg-blueprint-grid opacity-15" />
              <div className="relative">
                <div className="zine-label text-warning mb-2">§ this week</div>
                <h2 className="text-xl font-bold mb-4">Workspace pulse</h2>
                <div className="space-y-4">
                  {[
                    { l: "Active sessions", v: String(metrics.activeSessions), c: "text-warning" },
                    { l: "Tasks extracted", v: String(metrics.tasksExtracted), c: "text-success" },
                  ].map(s => (
                    <div key={s.l} className="flex items-baseline justify-between border-b border-background/10 pb-3">
                      <span className="text-sm text-background/70">{s.l}</span>
                      <span className={`text-3xl font-bold font-mono ${s.c}`}>{s.v}</span>
                    </div>
                  ))}
                </div>
                <p className="font-hand text-xl text-warning mt-5">↑ keep the momentum</p>
              </div>
            </div>
          </section>
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

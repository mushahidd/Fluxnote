"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Plus, Sparkles, LogOut, Settings, User as UserIcon, AlertTriangle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { roomsApi } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

type Props = {
  label?: string;
  title?: string;
  showSearch?: boolean;
};

export function WorkspaceTopbar({ label = "/home", title = "Welcome back", showSearch = true }: Props) {
  const { user: authUser, logout, isLoading: authLoading } = useAuth();
  const [openNew, setOpenNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [signOutOpen, setSignOutOpen] = useState(false);
  const router = useRouter();

  const user = authUser;
  const initials = user?.name
    ? user.name.split(" ").slice(0, 2).map((p: string) => p[0]).join("").toUpperCase()
    : "?";
  const firstName = user?.name ? user.name.split(" ")[0] : "";
  const avatarUrl = (authUser as any)?.avatar_url ?? null;

  const handleCreate = async () => {
    const name = newName.trim() || "Untitled session";
    setCreating(true);
    try {
      const room = await roomsApi.createRoom(name);
      setOpenNew(false);
      setNewName("");
      toast({ title: "Session created", description: `"${room.name}" is ready in your lobby.` });
      router.push(`/lobby?roomId=${room.id}&name=${encodeURIComponent(room.name)}`);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to create session", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleLogout = async () => {
    setSignOutOpen(false);
    await logout();
  };

  return (
    <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-foreground/10">
      {/* Main topbar row */}
      <div className="px-4 md:px-8 py-3 md:py-4 flex items-center gap-2 md:gap-4">
        {/* Left spacer on mobile to avoid hamburger overlap */}
        <div className="w-10 lg:hidden shrink-0" />

        <div className="min-w-0 flex-1 lg:flex-none">
          <div className="zine-label hidden sm:block">{label}</div>
          <h1 className="text-lg md:text-2xl font-bold tracking-tight truncate">
            {title}{title === "Welcome back" && firstName ? `, ${firstName}` : ""}
          </h1>
        </div>

        {/* Search — hidden on mobile, shown md+ */}
        {showSearch && (
          <div className="hidden md:flex flex-1 max-w-2xl mx-auto">
            <div className="relative w-full">
              <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
              <Input
                placeholder="Search sessions (coming soon)…"
                className="pl-10 pr-24 h-11 bg-card border-2 border-foreground/15 focus-visible:border-foreground rounded-xl"
                value={search}
                onChange={e => setSearch(e.target.value)}
                disabled
              />
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">⌘ K</kbd>
            </div>
          </div>
        )}

        <div className="flex items-center gap-1 md:gap-2 ml-auto lg:ml-0">
          {/* Search icon on mobile */}
          {showSearch && (
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Search">
              <Search className="h-4 w-4" />
            </Button>
          )}

          {/* Notifications */}
          <Link href="/notifications">
            <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
              <Bell className="h-4 w-4" />
            </Button>
          </Link>

          {/* Profile */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="h-9 w-9 rounded-full overflow-hidden bg-gradient-blueprint flex items-center justify-center font-bold text-primary-foreground text-xs hover:opacity-90 transition-opacity ring-2 ring-transparent hover:ring-foreground/20">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={user?.name || "avatar"} className="h-full w-full object-cover" />
                ) : (
                  <span>{initials}</span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel>
                <div className="flex items-center gap-2.5 py-1">
                  <div className="h-8 w-8 rounded-full overflow-hidden bg-gradient-blueprint flex items-center justify-center font-bold text-primary-foreground text-xs shrink-0">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={user?.name || "avatar"} className="h-full w-full object-cover" />
                    ) : (
                      <span>{initials}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{user?.name || "Guest"}</div>
                    <div className="text-xs text-muted-foreground font-normal truncate">{user?.email || ""}</div>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild><Link href="/settings"><UserIcon className="h-3.5 w-3.5"/> Profile</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link href="/settings"><Settings className="h-3.5 w-3.5"/> Settings</Link></DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setSignOutOpen(true)} className="text-coral focus:text-coral">
                <LogOut className="h-3.5 w-3.5"/> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="paper" size="sm" onClick={() => setOpenNew(true)} className="hidden xs:flex">
            <Plus className="h-4 w-4"/>
            <span className="hidden sm:inline ml-1">New session</span>
          </Button>
          <Button variant="paper" size="icon" onClick={() => setOpenNew(true)} className="xs:hidden">
            <Plus className="h-4 w-4"/>
          </Button>
        </div>
      </div>

      {/* New session dialog */}
      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New session</DialogTitle>
            <DialogDescription>Spin up a fresh canvas. You can rename and invite later.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              autoFocus
              placeholder="e.g. Sprint 45 — kickoff"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleCreate(); }}
            />
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">→ opens in lobby</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenNew(false)}>Cancel</Button>
            <Button variant="paper" onClick={handleCreate} disabled={creating}>
              <Sparkles className="h-3.5 w-3.5"/> {creating ? "Creating…" : "Create session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sign-out confirmation */}
      <Dialog open={signOutOpen} onOpenChange={setSignOutOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="h-10 w-10 rounded-full bg-coral/15 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-coral" />
              </div>
              <DialogTitle>Sign out?</DialogTitle>
            </div>
            <DialogDescription>
              You'll be taken back to the login page. Any unsaved canvas changes will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setSignOutOpen(false)}>Stay</Button>
            <Button onClick={handleLogout} className="bg-coral text-background hover:bg-coral/90">
              <LogOut className="h-3.5 w-3.5"/> Yes, sign out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}

export function GlobalSearchHint() {
  return <Search className="h-4 w-4" />;
}

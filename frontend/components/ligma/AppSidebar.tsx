"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Clock, Share2, LayoutTemplate, FolderKanban, Trash2, Settings, Plus, Menu, X } from "lucide-react";
import { Logo } from "./Logo";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { toast } from "@/hooks/use-toast";

const items = [
  { icon: Clock, label: "Recent", to: "/recent" },
  { icon: Share2, label: "Shared with me", to: "/shared" },
  { icon: LayoutTemplate, label: "Templates", to: "/templates" },
  { icon: FolderKanban, label: "Projects", to: "/projects" },
  { icon: Trash2, label: "Trash", to: "/trash" },
];

function SidebarContent({ onNav }: { onNav?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user: authUser, isLoading: authLoading } = useAuth();

  const initials = authUser?.name
    ? authUser.name.split(" ").slice(0, 2).map((p: string) => p[0]).join("").toUpperCase()
    : "?";
  const displayName = authUser?.name || "Guest";
  const displayRole = authUser?.role || "viewer";

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-4 border-b border-sidebar-border">
        <Logo />
      </div>

      <div className="px-3 py-4">
        <button
          onClick={() => { router.push("/settings"); onNav?.(); }}
          className="w-full flex items-center gap-3 rounded-lg p-2 hover:bg-sidebar-accent transition-colors text-left"
        >
          <div className="h-9 w-9 rounded-full overflow-hidden bg-gradient-blueprint flex items-center justify-center font-bold text-primary-foreground text-sm shrink-0">
            {(authUser as any)?.avatar_url ? (
              <img src={(authUser as any).avatar_url} alt={displayName} className="h-full w-full object-cover" />
            ) : (
              <span>{initials}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{displayName}</div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground truncate">{displayRole}</div>
          </div>
        </button>
      </div>

      <nav className="px-3 flex-1 overflow-y-auto">
        <div className="space-y-0.5">
          {items.map(it => {
            const active = pathname === it.to;
            return (
              <Link
                key={it.label}
                href={it.to}
                onClick={onNav}
                className={cn(
                  "flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors",
                  active
                    ? "bg-foreground text-background font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent"
                )}
              >
                <it.icon className="h-4 w-4 shrink-0" />
                {it.label}
              </Link>
            );
          })}
        </div>

        <div className="mt-6">
          <div className="zine-label px-2 mb-2">workspace folders</div>
          <div className="space-y-0.5">
            <button
              onClick={() => { toast({ title: "New folder", description: "Folders are coming soon." }); onNav?.(); }}
              className="w-full flex items-center gap-3 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-sidebar-accent transition-colors"
            >
              <Plus className="h-3.5 w-3.5 shrink-0" /> New folder
            </button>
          </div>
        </div>
      </nav>

      <div className="p-3 border-t border-sidebar-border space-y-2">
        <Link
          href="/settings"
          onClick={onNav}
          className={cn(
            "flex items-center gap-3 rounded-md px-2.5 py-2 text-sm hover:bg-sidebar-accent",
            pathname === "/settings" ? "bg-foreground text-background font-medium" : "text-muted-foreground"
          )}
        >
          <Settings className="h-4 w-4" /> Settings
        </Link>
      </div>
    </div>
  );
}

export function AppSidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close on route change
  const pathname = usePathname();
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  return (
    <>
      {/* Mobile hamburger trigger — shown only on small screens */}
      <button
        className="lg:hidden fixed top-3 left-3 z-50 h-10 w-10 flex items-center justify-center rounded-lg bg-background border-2 border-foreground/15 shadow-sm"
        onClick={() => setMobileOpen(v => !v)}
        aria-label="Toggle sidebar"
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          "lg:hidden fixed top-0 left-0 z-40 h-full w-72 bg-sidebar border-r-2 border-foreground/10 transition-transform duration-300",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarContent onNav={() => setMobileOpen(false)} />
      </aside>

      {/* Desktop sidebar — always visible */}
      <aside className="hidden lg:flex w-64 shrink-0 border-r-2 border-foreground/10 bg-sidebar h-screen sticky top-0 flex-col">
        <SidebarContent />
      </aside>
    </>
  );
}

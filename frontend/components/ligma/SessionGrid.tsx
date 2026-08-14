"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, Users, Star, MoreHorizontal, Trash2, RotateCcw, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { ShareModal } from "@/components/ligma/ShareModal";

type Variant = "default" | "trash";

export type SessionItem = {
  id: string;
  name: string;
  folder: string;
  folderColor: string;
  thumb: string;
  live: number;
  time: string;
  tasks: number;
  pulse?: boolean;
  starred?: boolean;
  shared?: boolean;
  trashed?: boolean;
};

export function SessionGrid({
  sessions,
  empty,
  variant = "default",
  interactive = true,
  view = "grid",
}: {
  sessions: SessionItem[];
  empty?: React.ReactNode;
  variant?: Variant;
  interactive?: boolean;
  view?: "grid" | "list";
}) {
  const router = useRouter();
  const [shareTarget, setShareTarget] = useState<{ id: string; name: string } | null>(null);

  if (sessions.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-foreground/20 bg-card p-12 text-center">
        {empty || <p className="text-muted-foreground">Nothing here yet.</p>}
      </div>
    );
  }

  const handleOpen = (s: SessionItem) => {
    if (variant !== "default") return;
    router.push(`/lobby?roomId=${s.id}&name=${encodeURIComponent(s.name)}`);
  };

  const menu = (s: SessionItem) => interactive && (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="h-7 w-7 bg-background/80 backdrop-blur shrink-0"><MoreHorizontal className="h-3.5 w-3.5"/></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {variant === "default" ? (
          <>
            <DropdownMenuItem onClick={() => { toast({ title: s.starred ? "Removed from favorites" : "Starred" }); }}>
              <Star className="h-3.5 w-3.5"/> {s.starred ? "Unstar" : "Star"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShareTarget({ id: s.id, name: s.name })}>
              <Share2 className="h-3.5 w-3.5"/> Share
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { toast({ title: "Moved to trash", description: s.name }); }}>
              <Trash2 className="h-3.5 w-3.5"/> Move to trash
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuItem onClick={() => { toast({ title: "Restored", description: s.name }); }}>
              <RotateCcw className="h-3.5 w-3.5"/> Restore
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { toast({ title: "Deleted forever" }); }}>
              <Trash2 className="h-3.5 w-3.5"/> Delete forever
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (view === "list") {
    return (
      <>
      <div className="rounded-2xl border-2 border-foreground/15 bg-card divide-y divide-foreground/10">
        {sessions.map((s) => (
          <div key={s.id} className="group flex items-center gap-4 px-4 py-3 hover:bg-muted/40 transition-colors">
            <button
              onClick={() => handleOpen(s)}
              disabled={variant === "trash"}
              className="flex items-center gap-4 flex-1 min-w-0 text-left"
            >
              <div className={`h-10 w-14 rounded-lg ${s.thumb} shrink-0 border border-foreground/10 relative overflow-hidden ${variant === "trash" ? "opacity-50 grayscale" : ""}`}>
                <div className="absolute inset-0 bg-blueprint-grid opacity-30" />
                {s.pulse && variant === "default" && (
                  <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{s.name}</h3>
                  {s.starred && <Star className="h-3 w-3 text-warning fill-warning shrink-0" />}
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className={`h-1.5 w-1.5 rounded-sm ${s.folderColor}`} />
                    {s.folder}
                  </span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3"/> {s.time}</span>
                  {s.live > 0 && <span className="flex items-center gap-1 text-success"><Users className="h-3 w-3"/> {s.live} live</span>}
                  <span>{s.tasks} tasks</span>
                </div>
              </div>
            </button>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
              {menu(s)}
            </div>
          </div>
        ))}
      </div>

      {shareTarget && (
        <ShareModal
          open={!!shareTarget}
          onClose={() => setShareTarget(null)}
          roomId={shareTarget.id}
          roomName={shareTarget.name}
        />
      )}
      </>
    );
  }

  return (
    <>
    <div className="grid xs:grid-cols-2 lg:grid-cols-3 gap-4">
      {sessions.map((s) => (        <div key={s.id} className="group rounded-2xl border-2 border-foreground/15 bg-card p-3 hover:border-foreground hover:-translate-y-0.5 transition-all relative">
          <button onClick={() => handleOpen(s)} className="block w-full text-left" disabled={variant === "trash"}>
            <div className={`relative aspect-[16/10] rounded-xl ${s.thumb} overflow-hidden border border-foreground/10 ${variant === "trash" ? "opacity-60 grayscale" : ""}`}>
              <div className="absolute inset-0 bg-blueprint-grid opacity-30" />
              <div className="absolute top-3 left-3 h-8 w-12 bg-card rounded shadow-sm rotate-[-3deg]" />
              <div className="absolute top-6 left-14 h-10 w-14 bg-card rounded shadow-sm rotate-[2deg]" />
              <div className="absolute bottom-3 right-3 h-6 w-10 bg-card rounded shadow-sm rotate-[-1deg]" />
              {s.pulse && variant === "default" && (
                <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-success/90 text-background px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider">
                  <span className="h-1.5 w-1.5 rounded-full bg-background animate-pulse" /> live
                </span>
              )}
            </div>
            <div className="pt-3 px-1 pb-1">
              <div className="flex items-center gap-2 mb-1">
                <span className={`h-2 w-2 rounded-sm ${s.folderColor}`} />
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{s.folder}</span>
                {s.starred && <Star className="h-3 w-3 text-warning fill-warning ml-auto" />}
              </div>
              <h3 className="font-semibold leading-tight group-hover:text-primary transition-colors">{s.name}</h3>
              <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Clock className="h-3 w-3"/> {s.time}</span>
                <span className="flex items-center gap-2">
                  {s.live > 0 && <span className="flex items-center gap-1 text-success"><Users className="h-3 w-3"/> {s.live}</span>}
                  <span>{s.tasks} tasks</span>
                </span>
              </div>
            </div>
          </button>
          {interactive && (
            <div className="absolute top-5 right-5 opacity-0 group-hover:opacity-100 transition-opacity">
              {menu(s)}
            </div>
          )}
        </div>
      ))}
    </div>

    {shareTarget && (
      <ShareModal
        open={!!shareTarget}
        onClose={() => setShareTarget(null)}
        roomId={shareTarget.id}
        roomName={shareTarget.name}
      />
    )}
  </>
  );
}

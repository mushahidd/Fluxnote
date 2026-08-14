"use client";

import { AppSidebar } from "@/components/ligma/AppSidebar";
import { WorkspaceTopbar } from "@/components/ligma/WorkspaceTopbar";
import { SessionGrid } from "@/components/ligma/SessionGrid";

export default function Trash() {
  // Trash functionality not yet implemented in backend
  const trashed: any[] = [];
  
  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 min-w-0">
        <WorkspaceTopbar label="/trash" title="Trash" />
        <div className="px-4 md:px-8 py-6 md:py-8 space-y-6">
          <div className="flex items-end justify-between">
            <div>
              <div className="zine-label mb-1">§ deleted</div>
              <h2 className="text-xl font-bold">Items in your trash</h2>
              <p className="text-sm text-muted-foreground mt-1">Items here will be permanently deleted after 30 days.</p>
            </div>
          </div>
          <SessionGrid sessions={trashed} variant="trash" empty={<p className="text-muted-foreground">Trash is empty ✦</p>} />
        </div>
      </main>
    </div>
  );
}
"use client";

import { AppSidebar } from "@/components/ligma/AppSidebar";
import { WorkspaceTopbar } from "@/components/ligma/WorkspaceTopbar";

export default function Notifications() {
  // Notifications functionality not yet implemented in backend
  const notifications: any[] = [];
  
  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 min-w-0">
        <WorkspaceTopbar label="/inbox" title="Notifications" showSearch={false}/>
        <div className="px-4 md:px-8 py-6 md:py-8 max-w-3xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="zine-label mb-1">§ everything</div>
              <h2 className="text-xl font-bold">0 unread</h2>
            </div>
          </div>
          <div className="rounded-2xl border-2 border-foreground/15 bg-card divide-y divide-border overflow-hidden">
            <div className="px-6 py-12 text-center text-muted-foreground">No notifications ✦</div>
          </div>
        </div>
      </main>
    </div>
  );
}
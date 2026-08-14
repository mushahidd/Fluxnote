"use client";

import { useRouter } from "next/navigation";
import { AppSidebar } from "@/components/ligma/AppSidebar";
import { WorkspaceTopbar } from "@/components/ligma/WorkspaceTopbar";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const templates = [
  { t: "Brainstorm map", d: "Open canvas, semantic auto-grouping", tag: "Ideation", color: "bg-sticky-yellow" },
  { t: "Sprint retro", d: "Liked / Learned / Lacked / Longed-for", tag: "Agile", color: "bg-sticky-pink" },
  { t: "Product planning", d: "Now / Next / Later with assignees", tag: "Roadmap", color: "bg-sticky-sky" },
  { t: "Architecture review", d: "Locked decision nodes by lead", tag: "Engineering", color: "bg-sticky-mint" },
  { t: "Content planning", d: "Calendar-linked task export", tag: "Marketing", color: "bg-sticky-yellow" },
  { t: "UX flow workshop", d: "Frames + journey + open questions", tag: "Design", color: "bg-sticky-pink" },
];

export default function Templates() {
  const router = useRouter();
  const useTemplate = (name: string) => {
    toast({ title: "Template applied", description: `${name} session created.` });
    router.push("/lobby");
  };
  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 min-w-0">
        <WorkspaceTopbar label="/templates" title="Templates" />
        <div className="px-4 md:px-8 py-6 md:py-8 space-y-6">
          <div>
            <div className="zine-label mb-1">§ start somewhere</div>
            <h2 className="text-xl font-bold">Pick a starting frame</h2>
          </div>
          <div className="grid xs:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {templates.map(tpl => (
              <div key={tpl.t} className="rounded-2xl border-2 border-foreground/15 bg-card p-3 hover:border-foreground hover:-translate-y-0.5 transition-all">
                <div className={`${tpl.color} aspect-[4/3] rounded-xl border-2 border-foreground/20 p-4 relative overflow-hidden shadow-sticky`}>
                  <div className="bg-blueprint-grid absolute inset-0 opacity-20" />
                  <div className="relative h-full flex flex-col justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-foreground/70 self-start bg-background/60 backdrop-blur px-2 py-0.5 rounded">{tpl.tag}</span>
                    <div className="flex gap-1.5">
                      <span className="h-6 w-10 bg-background rounded rotate-[-4deg] shadow-sm" />
                      <span className="h-6 w-12 bg-background rounded rotate-[3deg] shadow-sm" />
                      <span className="h-6 w-8 bg-background rounded rotate-[-2deg] shadow-sm" />
                    </div>
                  </div>
                </div>
                <div className="px-1 pt-3 pb-1">
                  <h3 className="font-bold leading-tight">{tpl.t}</h3>
                  <p className="text-sm text-muted-foreground">{tpl.d}</p>
                  <Button variant="paper" size="sm" className="mt-3 w-full" onClick={() => useTemplate(tpl.t)}>
                    <Sparkles className="h-3.5 w-3.5"/> Use template
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
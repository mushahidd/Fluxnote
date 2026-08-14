"use client";

import { Sparkles, Lock, MessageCircle } from "lucide-react";

// Stylized split-view mockup: canvas (left) + task board (right) with linkage
// On mobile: only the canvas side is shown. Task board appears md+.
export function HeroMockup() {
  return (
    <div className="relative rounded-2xl border-2 border-foreground bg-card shadow-[6px_6px_0_hsl(var(--foreground))] md:shadow-[10px_10px_0_hsl(var(--foreground))] overflow-hidden">
      {/* window chrome */}
      <div className="flex items-center gap-2 px-3 md:px-4 h-8 md:h-9 border-b-2 border-foreground bg-muted">
        <span className="h-2.5 w-2.5 md:h-3 md:w-3 rounded-full bg-coral border border-foreground" />
        <span className="h-2.5 w-2.5 md:h-3 md:w-3 rounded-full bg-warning border border-foreground" />
        <span className="h-2.5 w-2.5 md:h-3 md:w-3 rounded-full bg-success border border-foreground" />
        <span className="ml-2 md:ml-3 font-mono text-[10px] md:text-[11px] text-muted-foreground">fluxnote · sprint-44 · live</span>
        <div className="ml-auto flex -space-x-1.5">
          {["bg-coral", "bg-indigo", "bg-success", "bg-warning"].map((c, i) => (
            <span key={i} className={`h-4 w-4 md:h-5 md:w-5 rounded-full border-2 border-card ${c}`} />
          ))}
        </div>
      </div>

      {/* Body: canvas only on mobile, canvas+taskboard on md+ */}
      <div className="flex md:grid md:grid-cols-5 min-h-[280px] md:min-h-[420px]">
        {/* CANVAS — full width on mobile, 3/5 on md+ */}
        <div className="flex-1 md:col-span-3 relative bg-paper bg-blueprint-grid p-3 md:p-5 overflow-hidden">
          {/* sticky notes — scaled down on mobile */}
          <div className="absolute left-3 md:left-6 top-3 md:top-6 w-28 md:w-36 rotate-[-3deg] rounded-md bg-sticky-yellow p-2 md:p-3 shadow-sticky border border-foreground/20">
            <div className="font-hand text-sm md:text-base leading-tight">Auto-tag images on upload</div>
            <div className="mt-1.5 md:mt-2 flex items-center gap-1 text-[9px] md:text-[10px] font-mono text-intent-action">● ACTION</div>
          </div>
          <div className="absolute left-32 md:left-44 top-10 md:top-16 w-28 md:w-36 rotate-[2deg] rounded-md bg-sticky-pink p-2 md:p-3 shadow-sticky border border-foreground/20">
            <div className="font-hand text-sm md:text-base leading-tight">Should we ship dark mode v1?</div>
            <div className="mt-1.5 md:mt-2 flex items-center gap-1 text-[9px] md:text-[10px] font-mono text-intent-question">● QUESTION</div>
          </div>
          <div className="absolute left-8 md:left-12 top-32 md:top-44 w-32 md:w-40 rotate-[1deg] rounded-md bg-sticky-mint p-2 md:p-3 shadow-sticky border border-foreground/20 ring-2 ring-primary ring-offset-2 ring-offset-background animate-pulse-ring">
            <div className="font-hand text-sm md:text-base leading-tight">Use Postgres + LISTEN/NOTIFY</div>
            <div className="mt-1.5 md:mt-2 flex items-center gap-1 text-[9px] md:text-[10px] font-mono text-intent-decision">● DECISION</div>
            <Lock className="absolute -top-2 -right-2 h-3.5 w-3.5 md:h-4 md:w-4 p-0.5 bg-foreground text-background rounded-full" />
          </div>
          <div className="absolute right-4 md:right-8 top-6 md:top-10 w-24 md:w-32 rotate-[-1deg] rounded-md bg-sticky-sky p-2 md:p-3 shadow-sticky border border-foreground/20">
            <div className="font-hand text-sm md:text-base leading-tight">RFC #214</div>
            <div className="mt-1.5 md:mt-2 flex items-center gap-1 text-[9px] md:text-[10px] font-mono text-intent-reference">● REF</div>
          </div>

          {/* connector arrow — only visible on md+ where task board is shown */}
          <svg className="hidden md:block absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 600 420" preserveAspectRatio="none">
            <path d="M210 250 Q 380 230 540 200" fill="none" stroke="hsl(var(--primary))" strokeWidth="2.5" strokeDasharray="4 5" className="animate-draw" />
            <path d="M530 195 L545 200 L532 208" fill="none" stroke="hsl(var(--primary))" strokeWidth="2.5" />
          </svg>

          {/* live cursors */}
          <div className="absolute left-[38%] top-[58%] flex items-start gap-1">
            <svg className="h-3.5 w-3.5 md:h-4 md:w-4 text-coral" viewBox="0 0 24 24" fill="currentColor"><path d="M3 2 L3 22 L9 16 L13 22 L16 19 L12 14 L20 13 Z"/></svg>
            <span className="rounded bg-coral px-1 md:px-1.5 py-0.5 text-[9px] md:text-[10px] font-medium text-background">Maya</span>
          </div>
          <div className="absolute right-[28%] bottom-[14%] flex items-start gap-1">
            <svg className="h-3.5 w-3.5 md:h-4 md:w-4 text-indigo" viewBox="0 0 24 24" fill="currentColor"><path d="M3 2 L3 22 L9 16 L13 22 L16 19 L12 14 L20 13 Z"/></svg>
            <span className="rounded bg-indigo px-1 md:px-1.5 py-0.5 text-[9px] md:text-[10px] font-medium text-background">Jin</span>
          </div>

          {/* zine label */}
          <span className="absolute bottom-2 md:bottom-3 left-3 md:left-4 zine-label text-[9px] md:text-[10px]">/canvas · 4 nodes · 2 editing</span>
        </div>

        {/* TASK BOARD — hidden on mobile, shown md+ */}
        <div className="hidden md:block md:col-span-2 border-l-2 border-foreground bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="zine-label">/task board</div>
              <h3 className="font-mono text-sm font-bold mt-0.5">Auto-extracted</h3>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-mono">
              <Sparkles className="h-3 w-3" /> AI · 12
            </span>
          </div>

          {[
            { c: "intent-decision", t: "Adopt Postgres LISTEN/NOTIFY", meta: "from sticky #03 · locked", glow: true },
            { c: "intent-action", t: "Auto-tag images on upload", meta: "assigned · Maya · Fri" },
            { c: "intent-question", t: "Ship dark mode v1?", meta: "open · 3 votes" },
            { c: "intent-action", t: "Wire LISTEN channel client-side", meta: "todo · 2pt" },
          ].map((task, i) => (
            <div key={i} className={`rounded-lg border-2 ${task.glow ? "border-primary shadow-glow" : "border-foreground/15"} bg-background p-3 space-y-1.5 hover:border-foreground transition-colors`}>
              <div className="flex items-start gap-2">
                <span className={`mt-1 h-2 w-2 rounded-full bg-${task.c} shrink-0`} />
                <div className="flex-1">
                  <div className="text-[13px] font-medium leading-snug">{task.t}</div>
                  <div className="text-[10px] font-mono text-muted-foreground mt-0.5">{task.meta}</div>
                </div>
                <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            </div>
          ))}

          <div className="pt-1 font-hand text-lg text-primary">↑ click → jump to canvas node</div>
        </div>
      </div>
    </div>
  );
}

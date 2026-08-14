"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ArrowLeft, MousePointer2, Hand, StickyNote, Type, Square, Circle as CircleIcon,
  Diamond, ArrowUpRight, Minus, Pencil, Image as ImageIcon, Stamp, MessageCircle,
  Frame, Lock, Eraser, MoreHorizontal, Sparkles, Share2, Download, History,
  Users, Search, X, CheckCircle2, ChevronRight, ChevronLeft
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { useCanvas } from "@/lib/hooks/useCanvas";
import { CanvasWrapper } from "@/components/canvas/CanvasWrapper";
import { usePresence } from "@/lib/hooks/usePresence";
import { useAuth } from "@/lib/auth-context";
import { ShareModal } from "@/components/ligma/ShareModal";
import { useRoleSync } from "@/lib/hooks/useRoleSync";
import { useTaskBoard } from "@/lib/hooks/useTaskBoard";

type Intent = "action" | "decision" | "question" | "reference";
type Note = {
  id: string;
  text: string;
  intent: Intent;
  color: string;
  x: number; y: number; rot: number;
  author: { name: string; color: string };
  locked?: boolean;
  taskStatus?: "todo" | "done" | "backlog" | "in_progress";
  assignee?: string;
};

const intentMeta: Record<Intent, { label: string; color: string; chip: string }> = {
  action:    { label: "ACTION",   color: "text-intent-action",    chip: "bg-intent-action/15 text-intent-action" },
  decision:  { label: "DECISION", color: "text-intent-decision",  chip: "bg-intent-decision/15 text-intent-decision" },
  question:  { label: "QUESTION", color: "text-intent-question",  chip: "bg-intent-question/15 text-intent-question" },
  reference: { label: "REF",      color: "text-intent-reference", chip: "bg-intent-reference/15 text-intent-reference" },
};

const intentToColor: Record<Intent, string> = {
  action: "bg-sticky-yellow",
  decision: "bg-sticky-mint",
  question: "bg-sticky-pink",
  reference: "bg-sticky-sky",
};

const userColors = ["bg-coral", "bg-indigo", "bg-success", "bg-warning"];
const userColorMap = new Map<string, string>();

function getUserColor(userId: string): string {
  if (!userColorMap.has(userId)) {
    const colorIndex = userColorMap.size % userColors.length;
    userColorMap.set(userId, userColors[colorIndex]);
  }
  return userColorMap.get(userId)!;
}

const tools = [
  { icon: MousePointer2, k: "V" }, { icon: Hand, k: "H" }, { icon: StickyNote, k: "N", highlight: true },
  { icon: Type, k: "T" }, { icon: Square, k: "R" }, { icon: CircleIcon, k: "O" }, { icon: Diamond, k: "D" },
  { icon: ArrowUpRight, k: "A" }, { icon: Minus, k: "L" }, { icon: Pencil, k: "P" },
  { icon: ImageIcon, k: "I" }, { icon: Stamp, k: "S" }, { icon: MessageCircle, k: "C" },
  { icon: Frame, k: "F" }, { icon: Lock, k: "K" }, { icon: Eraser, k: "E" }, { icon: MoreHorizontal, k: "" },
];

function EditorContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Auto-generate roomId if not provided
  const urlRoomId = searchParams.get('roomId');
  const [roomId, setRoomId] = useState<string>(() => {
    if (urlRoomId) return urlRoomId;
    // Generate unique roomId
    return `room-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  });
  
  // Update URL with generated roomId (only once, after mount)
  useEffect(() => {
    if (!urlRoomId && roomId) {
      router.replace(`/editor?roomId=${roomId}`, { scroll: false });
    }
  }, []); // Empty deps - only run once on mount
  
  const { user } = useAuth();
  
  // Real-time canvas data
  const { 
    nodes: canvasNodes, 
    isConnected: canvasConnected, 
    isSynced,
    status: canvasStatus,
    addNode,
    updateNode,
    deleteNode,
    setNodeLocked,
  } = useCanvas({ roomId });

  // Real-time presence/cursors
  const { 
    cursors: liveCursors, 
    isConnected: presenceConnected,
    updateCursor,
  } = usePresence({ roomId });

  // Tasks from backend with real-time WebSocket updates
  const { tasks, updateTaskStatus: updateTaskStatusAPI, ws: taskBoardWs } = useTaskBoard(roomId);

  // Sync role changes from WebSocket
  useRoleSync(taskBoardWs);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Convert canvas nodes to Note format (for right panel only)
  const notes: Note[] = canvasNodes.filter((n: any) => n.type === 'sticky').map((node: any) => {
    const intent = (node.intent || 'action') as Intent;
    return {
      id: node.id,
      text: node.content?.text || '',
      intent: intent,
      color: node.color || intentToColor[intent],
      x: node.x || 0,
      y: node.y || 0,
      rot: node.rotation || 0,
      author: {
        name: node.createdBy,
        color: getUserColor(node.createdBy),
      },
      locked: node.locked,
      taskStatus: node.taskStatus,
      assignee: node.assignee,
    };
  });

  const selected = notes.find(n => n.id === selectedId);

  return (
    <>
      <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* TOP BAR */}
      <header className="h-14 border-b-2 border-foreground/10 bg-card flex items-center px-3 gap-3 shrink-0">
        <Button asChild variant="ghost" size="icon-sm"><Link href="/lobby"><ArrowLeft className="h-4 w-4"/></Link></Button>
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-[11px] text-muted-foreground truncate">orbital / sprint-44 /</span>
          <h1 className="font-bold truncate">Sprint 44 — kickoff</h1>
          <span className="font-mono text-[10px] text-muted-foreground hidden sm:inline">· {isSynced ? 'synced' : 'syncing...'} · {canvasStatus}</span>
          <span className={cn(
            "ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider",
            canvasConnected && presenceConnected 
              ? "bg-success/15 text-success" 
              : "bg-warning/15 text-warning"
          )}>
            <span className={cn(
              "h-1.5 w-1.5 rounded-full",
              canvasConnected && presenceConnected ? "bg-success animate-pulse" : "bg-warning"
            )} /> 
            {canvasConnected && presenceConnected ? 'live' : 'connecting...'}
          </span>
        </div>

        <Button variant="ghost" size="icon-sm" className="hidden md:inline-flex" onClick={() => toast({ title: "Search canvas", description: "Try ⌘K — node search is coming soon." })}><Search className="h-4 w-4"/></Button>

        {/* Real authenticated users from presence */}
        {liveCursors && liveCursors.length > 0 && (
          <div className="flex -space-x-1.5 ml-2">
            {liveCursors.slice(0, 4).map((cursor, i) => {
              const initial = cursor.userName?.[0]?.toUpperCase() || '?';
              const colorClass = userColors[i % userColors.length];
              return (
                <span 
                  key={cursor.userId || i} 
                  className={`h-7 w-7 rounded-full ${colorClass} text-background border-2 border-card flex items-center justify-center text-[10px] font-bold`}
                  title={cursor.userName || 'Anonymous'}
                >
                  {initial}
                </span>
              );
            })}
            {liveCursors.length > 4 && (
              <span className="h-7 w-7 rounded-full bg-muted text-foreground border-2 border-card flex items-center justify-center text-[10px] font-bold">
                +{liveCursors.length - 4}
              </span>
            )}
          </div>
        )}
        <Button variant="ghost" size="icon-sm" onClick={() => setHistoryOpen(true)}><History className="h-4 w-4"/></Button>
        <Button variant="ghost" size="sm" onClick={() => setShareOpen(true)}>
          <Share2 className="h-3.5 w-3.5"/> Share
        </Button>
        <Button 
          variant="paper" 
          size="sm" 
          onClick={async () => {
            try {
              toast({ title: "Capturing canvas...", description: "Generating image" });
              
              // Dynamically import html2canvas
              const html2canvas = (await import('html2canvas')).default;
              
              // Find the canvas section
              const canvasSection = document.querySelector('section.bg-paper') as HTMLElement;
              
              if (!canvasSection) {
                toast({ title: "Export failed", description: "Canvas not found", variant: "destructive" });
                return;
              }

              // Capture the canvas
              const canvas = await html2canvas(canvasSection, {
                backgroundColor: '#f5f5f0',
                scale: 2,
                logging: false,
                useCORS: true,
                allowTaint: true,
              });

              // Convert to blob and download
              canvas.toBlob((blob) => {
                if (!blob) {
                  toast({ title: "Export failed", description: "Could not generate image", variant: "destructive" });
                  return;
                }
                
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `canvas-export-${Date.now()}.png`;
                document.body.appendChild(a);
                a.click();
                URL.revokeObjectURL(url);
                document.body.removeChild(a);
                
                toast({ title: "Export successful", description: "Canvas exported as PNG" });
              }, 'image/png');
              
            } catch (error) {
              console.error('Export error:', error);
              toast({ title: "Export failed", description: "Could not export canvas", variant: "destructive" });
            }
          }}
        >
          <Download className="h-3.5 w-3.5"/> Export
        </Button>
      </header>

      <div className="flex-1 flex min-h-0">

        {/* CANVAS */}
        <section 
          className="flex-1 relative bg-paper overflow-hidden"
        >
          {/* Viewer Read-Only Banner */}
          {user?.role === 'viewer' || user?.role === 'Viewer' ? (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
              <div className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium border-2 border-warning/30 bg-warning/10 text-warning backdrop-blur">
                <Lock className="h-4 w-4" />
                View-Only Mode — You cannot edit this canvas
              </div>
            </div>
          ) : null}
          
          <CanvasWrapper
            nodes={canvasNodes as any}
            onNodeAdd={addNode as any}
            onNodeUpdate={updateNode}
            onNodeDelete={deleteNode}
            cursors={liveCursors}
            onCursorMove={updateCursor}
            externalSelectedId={selectedId}
            onSelectionChange={(ids) => setSelectedId(ids[0] ?? null)}
          />
        </section>

        {/* RIGHT PANEL - Collapsible */}
        {rightPanelOpen && (
          <aside className="w-80 shrink-0 border-l-2 border-foreground/10 bg-card flex flex-col">
            {selected ? (
              <>
                <div className="px-4 py-3 border-b border-foreground/10 flex items-center gap-2">
                  <div className="zine-label">/node details</div>
                  <Button 
                    variant="ghost" 
                    size="icon-sm" 
                    onClick={() => setRightPanelOpen(false)}
                    title="Collapse panel"
                  >
                    <ChevronRight className="h-3.5 w-3.5"/>
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => setSelectedId(null)}><X className="h-3.5 w-3.5"/></Button>
                </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-5">
                <div>
                  <div className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-mono mb-2", intentMeta[selected.intent].chip)}>
                    <Sparkles className="h-2.5 w-2.5"/> AI · {intentMeta[selected.intent].label} · 94%
                  </div>
                  <h3 className="font-bold leading-snug">{selected.text}</h3>
                </div>

                <div className="space-y-2 text-sm">
                  <Row k="Author" v={<span className="flex items-center gap-1.5"><span className={`h-4 w-4 rounded-full ${selected.author.color} text-background text-[8px] font-bold flex items-center justify-center`}>{selected.author.name[0]}</span>{selected.author.name}</span>}/>
                  <Row k="Created" v={<span className="font-mono text-xs">12 min ago</span>}/>
                  {selected.assignee && <Row k="Assignee" v={<span className="font-mono text-xs">@{selected.assignee.toLowerCase()}</span>}/>}
                  <Row k="Permissions" v={selected.locked ? <span className="inline-flex items-center gap-1 text-foreground"><Lock className="h-3 w-3"/> Lead-only</span> : <span className="text-muted-foreground">Open</span>}/>
                  {selected.taskStatus && <Row k="Linked task" v={<span className="text-primary font-mono text-xs flex items-center gap-1">{selected.taskStatus.replace("_"," ")} <ChevronRight className="h-3 w-3"/></span>}/>}
                </div>

                <div className="space-y-2 pt-2 border-t border-border">
                  <Button variant="paper" className="w-full justify-start" onClick={() => {
                    if (selected.taskStatus) {
                      toast({ title: "Already a task" });
                    } else {
                      updateNode(selected.id, { intent: "action", taskStatus: "todo" });
                      toast({ title: "Converted to task", description: selected.text });
                    }
                  }}><Sparkles className="h-3.5 w-3.5"/> Convert to task</Button>
                  <Button variant="outline" className="w-full justify-start" onClick={() => {
                    updateNode(selected.id, { intent: "decision" });
                    toast({ title: "Marked as decision" });
                  }}><CheckCircle2 className="h-3.5 w-3.5"/> Mark as decision</Button>
                  <Button variant="outline" className="w-full justify-start" onClick={() => {
                    setNodeLocked(selected.id, !selected.locked);
                    toast({ title: selected.locked ? "Node unlocked" : "Node locked" });
                  }}><Lock className="h-3.5 w-3.5"/> {selected.locked ? "Unlock node" : "Lock node"}</Button>
                </div>

                <div>
                  <div className="zine-label mb-2">§ comments · 2</div>
                  <div className="space-y-2">
                    {[{w:"Jin", c:"agree, locking this before we drift"}, {w:"Sam", c:"+1, will start the migration draft"}].map((c,i)=>(
                      <div key={i} className="rounded-lg border border-border p-2 text-xs">
                        <div className="font-medium mb-0.5">{c.w}</div>
                        <div className="text-muted-foreground">{c.c}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <RoomInsights onCollapse={() => setRightPanelOpen(false)} />
          )}
        </aside>
        )}

        {/* Expand Button - Shows when right panel is closed */}
        {!rightPanelOpen && (
          <button
            onClick={() => setRightPanelOpen(true)}
            className="fixed right-4 bottom-4 z-20 flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all border-2 border-primary/20"
            title="Open AI Panel"
          >
            <ChevronLeft className="h-4 w-4"/>
            <Sparkles className="h-4 w-4"/>
            <span className="text-sm font-medium">AI Panel</span>
          </button>
        )}
      </div>
    </div>

    {/* History Modal */}
    {historyOpen && <HistoryModal roomId={roomId} open={historyOpen} onClose={() => setHistoryOpen(false)} />}

    {shareOpen && (
      <ShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        roomId={roomId}
        roomName="Sprint 44 — kickoff"
      />
    )}
    </>
  );
}

export default function Editor() {
  return (
    <Suspense fallback={
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-4 text-sm text-muted-foreground">Loading editor...</p>
        </div>
      </div>
    }>
      <EditorContent />
    </Suspense>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">{k}</span>
      <span className="text-sm">{v}</span>
    </div>
  );
}

function RoomInsights({ onCollapse }: { onCollapse: () => void }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const roomId = searchParams?.get('roomId');

  const handleGenerateSummary = async () => {
    if (!roomId) {
      toast({ title: "Error", description: "No room ID found", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    try {
      const token = localStorage.getItem('auth_token');
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      
      const response = await fetch(`${API_URL}/api/canvas/${roomId}/export`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to generate summary');
      }

      const summaryText = await response.text();
      setSummary(summaryText);
      toast({ title: "Success", description: "Session summary generated!" });
    } catch (error: any) {
      console.error('Summary generation error:', error);
      toast({ 
        title: "Error", 
        description: error.message || "Failed to generate summary", 
        variant: "destructive" 
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <div className="px-4 py-3 border-b border-foreground/10 flex items-center gap-2">
        <div>
          <div className="zine-label">/room insights</div>
          <h3 className="font-bold text-sm mt-0.5 flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-primary"/> AI is watching</h3>
        </div>
        <Button 
          variant="ghost" 
          size="icon-sm" 
          className="ml-auto"
          onClick={onCollapse}
          title="Collapse panel"
        >
          <ChevronRight className="h-3.5 w-3.5"/>
        </Button>
      </div>
      <div className="p-4 space-y-5 text-sm">
        <div className="flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground"/> <span>Real-time collaboration active</span></div>
        <div>
          <div className="zine-label mb-2">latest extracted</div>
          <ul className="space-y-1.5 text-xs">
            <li className="flex items-start gap-2"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-intent-action shrink-0"/>Syncing with backend...</li>
            <li className="flex items-start gap-2"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-intent-decision shrink-0"/>AI intent classification active</li>
          </ul>
        </div>
        <div>
          <div className="zine-label mb-2">features</div>
          <ul className="space-y-1.5 text-xs">
            <li className="flex items-start gap-2"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-success shrink-0"/>Real-time CRDT sync (Yjs)</li>
            <li className="flex items-start gap-2"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-success shrink-0"/>Live cursor tracking</li>
            <li className="flex items-start gap-2"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-success shrink-0"/>Event sourcing</li>
            <li className="flex items-start gap-2"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-success shrink-0"/>RBAC permissions</li>
          </ul>
        </div>
        <Button 
          variant="paper" 
          className="w-full" 
          onClick={handleGenerateSummary}
          disabled={isGenerating}
        >
          <Sparkles className="h-3.5 w-3.5"/> 
          {isGenerating ? "Generating..." : "Generate session summary"}
        </Button>

        {summary && (
          <div className="mt-4 p-3 rounded-lg border border-foreground/10 bg-muted/30 max-h-96 overflow-y-auto">
            <div className="zine-label mb-2">AI Summary</div>
            <div className="prose prose-sm max-w-none text-xs whitespace-pre-wrap">
              {summary}
            </div>
          </div>
        )}
      </div>
    </>
  );
}



// History Modal Component
function HistoryModal({ roomId, open, onClose }: { roomId: string; open: boolean; onClose: () => void }) {
  const [events, setEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!open) return;

    const fetchHistory = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
        
        const response = await fetch(`${API_URL}/api/canvas/${roomId}/history`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('History API error:', response.status, errorText);
          throw new Error(`Failed to fetch history: ${response.status}`);
        }

        const data = await response.json();
        setEvents(data.events || []);
      } catch (error: any) {
        console.error('History fetch error:', error);
        toast({ 
          title: "Failed to load history", 
          description: error.message || "Could not fetch canvas history",
          variant: "destructive" 
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [open, roomId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-card border-2 border-foreground/10 rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-foreground/10 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Canvas History</h2>
            <p className="text-sm text-muted-foreground">Event log for this room</p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="h-4 w-4"/>
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
                <p className="mt-4 text-sm text-muted-foreground">Loading history...</p>
              </div>
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-12">
              <History className="h-12 w-12 mx-auto text-muted-foreground mb-4"/>
              <p className="text-sm text-muted-foreground">No events yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((event, index) => (
                <div key={event.id || index} className="border border-border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-mono bg-primary/10 text-primary">
                          {event.type}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(event.timestamp).toLocaleString()}
                        </span>
                      </div>
                      {event.payload && (
                        <pre className="text-xs text-muted-foreground mt-2 overflow-x-auto">
                          {JSON.stringify(event.payload, null, 2)}
                        </pre>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      #{event.id}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-foreground/10 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {events.length} {events.length === 1 ? 'event' : 'events'}
          </span>
          <Button variant="paper" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Play, Users, Clock, ListChecks, Activity, Lock, Sparkles, UserPlus, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppSidebar } from "@/components/ligma/AppSidebar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { sharingApi, type ShareSettings } from "@/lib/api";

const tabs = ["Overview", "Tasks", "Members", "Activity", "Settings"] as const;
type Tab = typeof tabs[number];

function LobbyContent() {
  const searchParams = useSearchParams();
  const roomId = searchParams?.get('roomId') || '';
  const sessionName = searchParams?.get('name') ? decodeURIComponent(searchParams.get('name')!) : (roomId ? roomId : 'New Session');

  const [tab, setTab] = useState<Tab>("Overview");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [shareSettings, setShareSettings] = useState<ShareSettings | null>(null);
  const [loadingShare, setLoadingShare] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [copied, setCopied] = useState(false);

  // Load share settings
  useEffect(() => {
    if (!roomId) return;
    
    const loadShareSettings = async () => {
      setLoadingShare(true);
      try {
        const settings = await sharingApi.getShareSettings(roomId);
        setShareSettings(settings);
      } catch (error) {
        console.error('Failed to load share settings:', error);
      } finally {
        setLoadingShare(false);
      }
    };

    loadShareSettings();
  }, [roomId]);

  const share = async () => {
    if (!roomId) return;

    try {
      // Ensure share is created with anyone_with_link access
      if (!shareSettings?.share) {
        await sharingApi.updateShareSettings(roomId, {
          accessType: 'anyone_with_link',
          linkRole: 'contributor',
        });
        
        // Reload settings to get the token
        const newSettings = await sharingApi.getShareSettings(roomId);
        setShareSettings(newSettings);
        
        if (newSettings.share) {
          const url = sharingApi.getShareLink(roomId, newSettings.share.token);
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
          toast({ title: "Share link copied", description: "Anyone with this link can join as a contributor." });
        }
      } else {
        const url = sharingApi.getShareLink(roomId, shareSettings.share.token);
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast({ title: "Share link copied", description: "Anyone with this link can join." });
      }
    } catch (error: any) {
      toast({ 
        title: "Failed to create share link", 
        description: error.message || "Please try again.",
        variant: "destructive" 
      });
    }
  };

  const sendInvite = async () => {
    if (!inviteEmail || !roomId) return;
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail)) {
      toast({ 
        title: "Invalid email", 
        description: "Please enter a valid email address.",
        variant: "destructive" 
      });
      return;
    }

    setSendingInvite(true);
    try {
      await sharingApi.addInvites(roomId, [inviteEmail], 'contributor');
      toast({ 
        title: "Invite sent", 
        description: `${inviteEmail} has been invited as a contributor.` 
      });
      setInviteEmail("");
      setInviteOpen(false);
      
      // Reload share settings to show new invite
      const newSettings = await sharingApi.getShareSettings(roomId);
      setShareSettings(newSettings);
    } catch (error: any) {
      toast({ 
        title: "Failed to send invite", 
        description: error.message || "Please try again.",
        variant: "destructive" 
      });
    } finally {
      setSendingInvite(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 min-w-0">
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-foreground/10">
          <div className="px-8 py-4 flex items-center gap-3">
            <Button asChild variant="ghost" size="icon"><Link href="/dashboard"><ArrowLeft className="h-4 w-4"/></Link></Button>
            <div className="font-mono text-xs text-muted-foreground">sessions /</div>
            <div className="font-bold truncate max-w-xs">{sessionName}</div>
            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-success/15 text-success px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" /> live · 1 in room
            </span>
            <div className="ml-auto flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={share}
                disabled={loadingShare}
              >
                {copied ? <Check className="h-3.5 w-3.5"/> : <Copy className="h-3.5 w-3.5"/>}
                {copied ? "Copied!" : "Share"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setInviteOpen(true)}>
                <UserPlus className="h-3.5 w-3.5"/> Invite
              </Button>
              <Button asChild variant="paper" size="sm">
                <Link href={`/editor?roomId=${roomId}`}><Play className="h-3.5 w-3.5"/> Enter session</Link>
              </Button>
            </div>
          </div>
          <div className="px-8 flex items-center gap-1">
            {tabs.map((t) => (
              <button key={t} onClick={() => setTab(t)} className={cn(
                "px-3 py-2.5 text-sm border-b-2 transition-colors",
                tab === t ? "border-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground"
              )}>{t}</button>
            ))}
          </div>
        </header>

        {tab === "Overview" && (
        <div className="px-8 py-8 grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* preview */}
            <div className="rounded-2xl border-2 border-foreground/15 bg-card overflow-hidden">
              <div className="aspect-[16/8] relative bg-paper bg-blueprint-grid">
                <div className="absolute top-6 left-6 h-16 w-24 bg-sticky-yellow rounded shadow-sticky border border-foreground/10 rotate-[-3deg]" />
                <div className="absolute top-12 left-32 h-20 w-28 bg-sticky-pink rounded shadow-sticky border border-foreground/10 rotate-[2deg]" />
                <div className="absolute top-24 left-12 h-16 w-24 bg-sticky-mint rounded shadow-sticky border border-foreground/10 rotate-[1deg] ring-2 ring-primary" />
                <div className="absolute bottom-6 right-8 h-14 w-20 bg-sticky-sky rounded shadow-sticky border border-foreground/10 rotate-[-1deg]" />
                <span className="absolute top-3 right-3 stamp text-coral text-xs bg-card">snapshot</span>
              </div>
            </div>

            <div className="rounded-2xl border-2 border-foreground/15 bg-card p-6">
              <div className="zine-label mb-2">§ session brief</div>
              <h2 className="text-2xl font-bold mb-3">{sessionName}</h2>
              <p className="text-muted-foreground leading-relaxed">
                A fresh canvas is ready. Start adding sticky notes, invite collaborators, and let the AI extract action items as you work.
              </p>
              <div className="mt-5 grid grid-cols-3 gap-4">
                {[
                  { l: "Started", v: "just now", icon: Clock },
                  { l: "Tasks extracted", v: "0", icon: ListChecks },
                  { l: "Locked nodes", v: "0", icon: Lock },
                ].map(s => (
                  <div key={s.l} className="rounded-lg border border-foreground/10 p-3">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs"><s.icon className="h-3.5 w-3.5"/> {s.l}</div>
                    <div className="text-xl font-bold font-mono mt-1">{s.v}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border-2 border-foreground/15 bg-card p-6">
              <div className="flex items-center gap-2 mb-3"><Sparkles className="h-4 w-4 text-primary"/> <h3 className="font-bold">AI agenda suggestions</h3></div>
              <ul className="space-y-2">
                {["Set a clear goal for this session", "Invite your collaborators to join", "Start adding sticky notes to the canvas"].map(s => (
                  <li key={s} className="flex items-start gap-2 text-sm">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" /> {s}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-2xl border-2 border-foreground/15 bg-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold flex items-center gap-2"><Users className="h-4 w-4"/> Members</h3>
                <Button variant="ghost" size="sm" onClick={() => setInviteOpen(true)}>Invite</Button>
              </div>
              <div className="space-y-2">
                {shareSettings && shareSettings.invites.length > 0 ? (
                  shareSettings.invites.map(invite => (
                    <div key={invite.id} className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-indigo text-background flex items-center justify-center text-xs font-bold">
                        {invite.email.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{invite.email}</div>
                      </div>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground border border-border rounded px-1.5 py-0.5">
                        {invite.role}
                      </span>
                      <span className={cn(
                        "text-[10px] font-mono uppercase tracking-wider border border-border rounded px-1.5 py-0.5",
                        invite.status === 'accepted' ? "text-success border-success/30" : "text-warning border-warning/30"
                      )}>
                        {invite.status}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-muted-foreground py-4 text-center">
                    No members yet. Click "Invite" to add collaborators.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border-2 border-foreground/15 bg-card p-5">
              <h3 className="font-bold flex items-center gap-2 mb-3"><Activity className="h-4 w-4"/> Recent activity</h3>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-2">
                  <span className="font-mono text-[10px] text-muted-foreground mt-1 w-8">now</span>
                  <span><span className="font-medium">You</span> <span className="text-muted-foreground">created this session</span></span>
                </li>
              </ul>
            </div>
          </aside>
        </div>
        )}

        {tab === "Tasks" && (
          <div className="px-8 py-8 max-w-3xl">
            <div className="zine-label mb-1">§ tasks</div>
            <h2 className="text-xl font-bold mb-4">Backlog from this session</h2>
            <div className="rounded-2xl border-2 border-dashed border-foreground/20 bg-card p-12 text-center text-sm text-muted-foreground">
              No tasks yet — enter the session and start capturing action items on the canvas.
            </div>
          </div>
        )}

        {tab === "Members" && (
          <div className="px-8 py-8 max-w-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="zine-label mb-1">§ members</div>
                <h2 className="text-xl font-bold">Who's in this session</h2>
              </div>
              <Button variant="paper" onClick={() => setInviteOpen(true)}><UserPlus className="h-3.5 w-3.5"/> Invite</Button>
            </div>
            {shareSettings && shareSettings.invites.length > 0 ? (
              <div className="rounded-2xl border-2 border-foreground/15 bg-card divide-y divide-border">
                {shareSettings.invites.map(invite => (
                  <div key={invite.id} className="flex items-center gap-3 p-4">
                    <div className="h-10 w-10 rounded-full bg-indigo text-background flex items-center justify-center text-sm font-bold">
                      {invite.email.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{invite.email}</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        Invited {new Date(invite.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground border border-border rounded px-1.5 py-0.5">
                      {invite.role}
                    </span>
                    <span className={cn(
                      "text-[10px] font-mono uppercase tracking-wider border border-border rounded px-1.5 py-0.5",
                      invite.status === 'accepted' ? "text-success border-success/30" : "text-warning border-warning/30"
                    )}>
                      {invite.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border-2 border-dashed border-foreground/20 bg-card p-12 text-center">
                <p className="text-sm text-muted-foreground mb-3">No members yet</p>
                <Button variant="paper" onClick={() => setInviteOpen(true)}>
                  <UserPlus className="h-3.5 w-3.5"/> Invite your first member
                </Button>
              </div>
            )}
          </div>
        )}

        {tab === "Activity" && (
          <div className="px-8 py-8 max-w-2xl">
            <div className="zine-label mb-1">§ activity</div>
            <h2 className="text-xl font-bold mb-4">Session timeline</h2>
            <div className="rounded-2xl border-2 border-foreground/15 bg-card p-5 space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <span className="font-mono text-[10px] text-muted-foreground mt-1 w-10">now</span>
                <span><span className="font-medium">You</span> <span className="text-muted-foreground">created this session</span></span>
              </div>
            </div>
          </div>
        )}

        {tab === "Settings" && (
          <div className="px-8 py-8 max-w-2xl space-y-4">
            <div className="zine-label mb-1">§ session settings</div>
            <h2 className="text-xl font-bold">Configure this session</h2>
            <div className="rounded-2xl border-2 border-foreground/15 bg-card p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Session name</label>
                <Input defaultValue={sessionName} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Room ID</label>
                <Input defaultValue={roomId} readOnly className="font-mono text-xs text-muted-foreground" />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost">Cancel</Button>
                <Button variant="paper" onClick={() => toast({ title: "Settings saved" })}>Save</Button>
              </div>
            </div>
          </div>
        )}
      </main>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite to {sessionName}</DialogTitle>
            <DialogDescription>Add a teammate by email. They'll join as a Contributor.</DialogDescription>
          </DialogHeader>
          <Input 
            type="email" 
            placeholder="teammate@studio.com" 
            value={inviteEmail} 
            onChange={e => setInviteEmail(e.target.value)} 
            onKeyDown={e => { if (e.key === "Enter" && !sendingInvite) sendInvite(); }}
            disabled={sendingInvite}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={share} disabled={loadingShare}>
              {copied ? <Check className="h-3.5 w-3.5"/> : <Copy className="h-3.5 w-3.5"/>}
              {copied ? "Copied!" : "Copy link instead"}
            </Button>
            <Button variant="paper" onClick={sendInvite} disabled={sendingInvite || !inviteEmail}>
              {sendingInvite ? "Sending..." : "Send invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Lobby() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-4 text-sm text-muted-foreground">Loading lobby...</p>
        </div>
      </div>
    }>
      <LobbyContent />
    </Suspense>
  );
}

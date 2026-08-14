"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Link2, Globe, Lock, X, UserPlus, Copy, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type AccessType = "anyone_with_link" | "restricted";
type ShareRole = "viewer" | "contributor" | "lead";

interface ShareSettings {
  id: string;
  room_id: string;
  access_type: AccessType;
  link_role: ShareRole;
  token: string;
  expires_at: string | null;
}

interface Invite {
  id: string;
  email: string;
  role: ShareRole;
  status: "pending" | "accepted" | "revoked";
}

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  roomId: string;
  roomName: string;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

async function getAuthHeader(): Promise<Record<string, string>> {
  try {
    const { supabase } = await import("@/lib/supabase");
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token || localStorage.getItem("sb-access-token");
    if (token) return { Authorization: `Bearer ${token}` };
  } catch {}
  return {};
}

async function apiFetch(path: string, opts: RequestInit = {}) {
  const headers = await getAuthHeader();
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...headers, ...(opts.headers || {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Request failed");
  }
  return res.json();
}

// ─── Role badge ───────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<ShareRole, string> = {
  viewer: "Can view",
  contributor: "Can edit",
  lead: "Can manage",
};

// ─── Component ────────────────────────────────────────────────────────────────

export function ShareModal({ open, onClose, roomId, roomName }: ShareModalProps) {
  const [share, setShare] = useState<ShareSettings | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // Invite form state
  const [emailInput, setEmailInput] = useState("");
  const [inviteRole, setInviteRole] = useState<ShareRole>("viewer");
  const [inviting, setInviting] = useState(false);

  // ── Load share settings ──────────────────────────────────────────────────
  const loadSettings = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    try {
      const data = await apiFetch(`/api/rooms/${roomId}/share`);
      setShare(data.share || null);
      setInvites(data.invites || []);
    } catch {
      // Room may not have share config yet — that's fine
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    if (open) loadSettings();
  }, [open, loadSettings]);

  // ── Update access type ───────────────────────────────────────────────────
  async function handleAccessTypeChange(value: AccessType) {
    setSaving(true);
    try {
      const data = await apiFetch(`/api/rooms/${roomId}/share`, {
        method: "POST",
        body: JSON.stringify({ accessType: value }),
      });
      setShare(data.share);
      toast({ title: value === "anyone_with_link" ? "Anyone with the link can join" : "Access restricted to invited people" });
    } catch (e: any) {
      toast({ title: "Failed to update", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  // ── Update link role ─────────────────────────────────────────────────────
  async function handleLinkRoleChange(value: ShareRole) {
    setSaving(true);
    try {
      const data = await apiFetch(`/api/rooms/${roomId}/share`, {
        method: "POST",
        body: JSON.stringify({ linkRole: value }),
      });
      setShare(data.share);
    } catch (e: any) {
      toast({ title: "Failed to update", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  // ── Copy share link ──────────────────────────────────────────────────────
  async function handleCopyLink() {
    // Simple: just copy the current editor URL with roomId
    const url = `${window.location.origin}/editor?roomId=${roomId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({ title: "Link copied", description: "Share this link to invite collaborators." });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({ title: "Failed to copy", description: "Please copy the URL manually.", variant: "destructive" });
    }
  }

  // ── Add invites ──────────────────────────────────────────────────────────
  async function handleInvite() {
    const emails = emailInput
      .split(/[\s,;]+/)
      .map(e => e.trim())
      .filter(e => e.includes("@"));

    if (emails.length === 0) {
      toast({ title: "Enter at least one valid email", variant: "destructive" });
      return;
    }

    setInviting(true);
    try {
      const data = await apiFetch(`/api/rooms/${roomId}/share/invites`, {
        method: "POST",
        body: JSON.stringify({ emails, role: inviteRole }),
      });
      setInvites(prev => {
        const existing = new Map(prev.map(i => [i.email, i]));
        (data.invites || []).forEach((i: Invite) => existing.set(i.email, i));
        return Array.from(existing.values());
      });
      setEmailInput("");
      toast({ title: `Invited ${emails.length} ${emails.length === 1 ? "person" : "people"}` });
    } catch (e: any) {
      toast({ title: "Failed to invite", description: e.message, variant: "destructive" });
    } finally {
      setInviting(false);
    }
  }

  // ── Revoke invite ────────────────────────────────────────────────────────
  async function handleRevoke(inviteId: string) {
    try {
      await apiFetch(`/api/rooms/${roomId}/share/invites/${inviteId}`, { method: "DELETE" });
      setInvites(prev => prev.filter(i => i.id !== inviteId));
      toast({ title: "Access removed" });
    } catch (e: any) {
      toast({ title: "Failed to remove", description: e.message, variant: "destructive" });
    }
  }

  // ── Update invite role ───────────────────────────────────────────────────
  async function handleInviteRoleChange(inviteId: string, email: string, role: ShareRole) {
    try {
      // Re-invite with new role (upsert)
      const data = await apiFetch(`/api/rooms/${roomId}/share/invites`, {
        method: "POST",
        body: JSON.stringify({ emails: [email], role }),
      });
      setInvites(prev => prev.map(i => i.id === inviteId ? { ...i, role } : i));
    } catch (e: any) {
      toast({ title: "Failed to update role", description: e.message, variant: "destructive" });
    }
  }

  const accessType = share?.access_type ?? "restricted";
  const linkRole = share?.link_role ?? "viewer";

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-[520px] gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-foreground/10">
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <Link2 className="h-4 w-4 text-primary" />
            Share "{roomName}"
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-5 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* ── Invite by email ─────────────────────────────────────── */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Add people</p>
                <div className="flex gap-2">
                  <Input
                    placeholder="Email addresses, comma-separated"
                    value={emailInput}
                    onChange={e => setEmailInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleInvite()}
                    className="flex-1 text-sm"
                  />
                  <Select value={inviteRole} onValueChange={v => setInviteRole(v as ShareRole)}>
                    <SelectTrigger className="w-[130px] text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">Can view</SelectItem>
                      <SelectItem value="contributor">Can edit</SelectItem>
                      <SelectItem value="lead">Can manage</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    onClick={handleInvite}
                    disabled={inviting || !emailInput.trim()}
                    className="shrink-0"
                  >
                    {inviting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                    Invite
                  </Button>
                </div>
              </div>

              {/* ── People with access ──────────────────────────────────── */}
              {invites.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">People with access</p>
                  <div className="rounded-xl border border-foreground/10 divide-y divide-foreground/8 overflow-hidden">
                    {invites.map(invite => (
                      <div key={invite.id} className="flex items-center gap-3 px-3 py-2.5 bg-card">
                        <div className="h-7 w-7 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[11px] font-bold shrink-0">
                          {invite.email[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{invite.email}</p>
                          <p className={cn(
                            "text-[10px] font-mono",
                            invite.status === "accepted" ? "text-success" : "text-muted-foreground"
                          )}>
                            {invite.status === "accepted" ? "accepted" : "invite pending"}
                          </p>
                        </div>
                        <Select
                          value={invite.role}
                          onValueChange={v => handleInviteRoleChange(invite.id, invite.email, v as ShareRole)}
                        >
                          <SelectTrigger className="w-[120px] h-7 text-xs border-foreground/15">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="viewer">Can view</SelectItem>
                            <SelectItem value="contributor">Can edit</SelectItem>
                            <SelectItem value="lead">Can manage</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                          onClick={() => handleRevoke(invite.id)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── General access ──────────────────────────────────────── */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">General access</p>
                <div className="rounded-xl border border-foreground/10 bg-card p-3 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "h-9 w-9 rounded-full flex items-center justify-center shrink-0",
                      accessType === "anyone_with_link"
                        ? "bg-success/15 text-success"
                        : "bg-muted text-muted-foreground"
                    )}>
                      {accessType === "anyone_with_link"
                        ? <Globe className="h-4 w-4" />
                        : <Lock className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <Select
                        value={accessType}
                        onValueChange={v => handleAccessTypeChange(v as AccessType)}
                        disabled={saving}
                      >
                        <SelectTrigger className="border-0 p-0 h-auto font-semibold text-sm shadow-none focus:ring-0 w-auto">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="restricted">
                            <span className="flex items-center gap-2">
                              <Lock className="h-3.5 w-3.5" /> Restricted
                            </span>
                          </SelectItem>
                          <SelectItem value="anyone_with_link">
                            <span className="flex items-center gap-2">
                              <Globe className="h-3.5 w-3.5" /> Anyone with the link
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {accessType === "anyone_with_link"
                          ? "Anyone on the internet with this link can access"
                          : "Only people you invite can access"}
                      </p>
                    </div>
                    {accessType === "anyone_with_link" && (
                      <Select
                        value={linkRole}
                        onValueChange={v => handleLinkRoleChange(v as ShareRole)}
                        disabled={saving}
                      >
                        <SelectTrigger className="w-[120px] text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="viewer">Can view</SelectItem>
                          <SelectItem value="contributor">Can edit</SelectItem>
                          <SelectItem value="lead">Can manage</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-t border-foreground/10 flex items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyLink}
            disabled={saving}
            className="gap-1.5"
          >
            {copied
              ? <><Check className="h-3.5 w-3.5 text-success" /> Copied!</>
              : <><Copy className="h-3.5 w-3.5" /> Copy link</>}
          </Button>
          <Button size="sm" onClick={onClose}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

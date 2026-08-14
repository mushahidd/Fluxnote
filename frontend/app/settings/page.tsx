"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/components/ligma/AppSidebar";
import { WorkspaceTopbar } from "@/components/ligma/WorkspaceTopbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { workspacesApi, type Workspace, type WorkspaceMember } from "@/lib/api";

const tabs = ["Profile", "Workspace", "Notifications", "Billing", "Danger zone"] as const;
type Tab = typeof tabs[number];

const roles = ["owner", "lead", "contributor", "viewer"] as const;

export default function Settings() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<Tab>("Profile");
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [roleLabel, setRoleLabel] = useState(user?.role || "");
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifMentions, setNotifMentions] = useState(true);
  const [notifWeekly, setNotifWeekly] = useState(false);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<(typeof roles)[number]>("contributor");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const router = useRouter();

  useEffect(() => {
    setName(user?.name || "");
    setEmail(user?.email || "");
    setRoleLabel(user?.role || "");
  }, [user]);

  const initials = useMemo(() => {
    if (!name) return "?";
    return name
      .split(" ")
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  }, [name]);

  const loadWorkspace = async () => {
    setWorkspaceLoading(true);
    setWorkspaceError(null);
    try {
      const primary = await workspacesApi.getPrimary();
      setWorkspace(primary);

      if (primary?.id) {
        const workspaceMembers = await workspacesApi.getMembers(primary.id);
        setMembers(workspaceMembers);
      } else {
        setMembers([]);
      }
    } catch (error: any) {
      setWorkspaceError(error.message || "Failed to load workspace");
    } finally {
      setWorkspaceLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadWorkspace();
    }
  }, [user]);

  const saveProfile = () => {
    toast({ title: "Profile updated", description: "Profile updates are handled via Supabase." });
  };

  const createWorkspace = async () => {
    try {
      const nameToUse = newWorkspaceName || `${name || 'Workspace'}`;
      await workspacesApi.createWorkspace(nameToUse);
      setNewWorkspaceName("");
      await loadWorkspace();
      toast({ title: "Workspace created" });
    } catch (error: any) {
      toast({ title: "Failed to create workspace", description: error.message, variant: "destructive" });
    }
  };

  const inviteMember = async () => {
    if (!workspace) return;
    setInviteLoading(true);
    try {
      await workspacesApi.addMember(workspace.id, inviteEmail, inviteRole);
      setInviteEmail("");
      await loadWorkspace();
      toast({ title: "Member invited" });
    } catch (error: any) {
      toast({ title: "Invite failed", description: error.message, variant: "destructive" });
    } finally {
      setInviteLoading(false);
    }
  };

  const updateMemberRole = async (memberId: string, role: string) => {
    if (!workspace) return;
    try {
      await workspacesApi.updateMemberRole(workspace.id, memberId, role);
      await loadWorkspace();
      toast({ title: "Role updated" });
    } catch (error: any) {
      toast({ title: "Failed to update role", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 min-w-0">
        <WorkspaceTopbar label="/settings" title="Settings" showSearch={false} />
        <div className="px-4 md:px-8 py-6 md:py-8 grid lg:grid-cols-[200px_1fr] gap-6 md:gap-8 max-w-5xl">
          <nav className="flex lg:flex-col gap-1 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "whitespace-nowrap w-full text-left px-3 py-2 rounded-md text-sm transition-colors",
                  tab === t
                    ? "bg-foreground text-background font-medium"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                {t}
              </button>
            ))}
          </nav>

          <section className="space-y-6">
            {tab === "Profile" && (
              <div className="rounded-2xl border-2 border-foreground/15 bg-card p-6 space-y-5">
                <div>
                  <div className="zine-label">§ profile</div>
                  <h2 className="text-xl font-bold">Your account</h2>
                </div>
                {!user ? (
                  <div className="text-sm text-muted-foreground">Sign in to manage your profile.</div>
                ) : (
                  <>
                    <div className="flex items-center gap-4">
                      <div className="h-16 w-16 rounded-full overflow-hidden bg-gradient-blueprint flex items-center justify-center font-bold text-primary-foreground text-xl ring-2 ring-foreground/10">
                        {(user as any)?.avatar_url ? (
                          <img src={(user as any).avatar_url} alt={user.name} className="h-full w-full object-cover" />
                        ) : (
                          <span>{initials}</span>
                        )}
                      </div>
                      <div className="space-y-1">
                        <Button
                          variant="outline"
                          onClick={() => toast({
                            title: "Avatar upload",
                            description: "Connect Cloud to enable image uploads.",
                          })}
                        >
                          Change avatar
                        </Button>
                        {(user as any)?.avatar_url && (
                          <p className="text-xs text-muted-foreground font-mono">Using Google profile picture</p>
                        )}
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label>Full name</Label>
                        <Input value={name} onChange={(e) => setName(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Email</Label>
                        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label>Role / title</Label>
                        <Input value={roleLabel} onChange={(e) => setRoleLabel(e.target.value)} />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setName(user.name || "");
                          setEmail(user.email || "");
                          setRoleLabel(user.role || "");
                        }}
                      >
                        Reset
                      </Button>
                      <Button variant="paper" onClick={saveProfile}>Save changes</Button>
                    </div>
                  </>
                )}
              </div>
            )}

            {tab === "Workspace" && (
              <div className="rounded-2xl border-2 border-foreground/15 bg-card p-6 space-y-6">
                <div>
                  <div className="zine-label">§ workspace</div>
                  <h2 className="text-xl font-bold">Workspace setup</h2>
                </div>

                {workspaceLoading && (
                  <div className="text-sm text-muted-foreground">Loading workspace…</div>
                )}

                {!workspaceLoading && workspaceError && (
                  <div className="rounded-lg border border-coral/40 bg-coral/5 p-3 text-sm text-coral">
                    {workspaceError}
                  </div>
                )}

                {!workspaceLoading && !workspace && !workspaceError && (
                  <div className="rounded-xl border border-dashed border-foreground/30 p-4 space-y-3">
                    <div className="text-sm text-muted-foreground">
                      No workspace found yet. Create one to start inviting teammates.
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <Input
                        placeholder="Workspace name"
                        value={newWorkspaceName}
                        onChange={(e) => setNewWorkspaceName(e.target.value)}
                      />
                      <Button variant="paper" onClick={createWorkspace}>Create workspace</Button>
                    </div>
                  </div>
                )}

                {!workspaceLoading && workspace && (
                  <>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label>Workspace name</Label>
                        <Input value={workspace.name} readOnly />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Slug</Label>
                        <Input value={workspace.slug} readOnly />
                      </div>
                    </div>

                    <div className="border-t border-border pt-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="zine-label">§ members</div>
                          <h3 className="text-lg font-bold">Invite teammates</h3>
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <Input
                          placeholder="teammate@company.com"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                        />
                        <select
                          className="h-11 rounded-md border border-input bg-background px-3 text-sm"
                          value={inviteRole}
                          onChange={(e) => setInviteRole(e.target.value as (typeof roles)[number])}
                        >
                          {roles.map((role) => (
                            <option key={role} value={role}>{role}</option>
                          ))}
                        </select>
                        <Button variant="paper" onClick={inviteMember} disabled={inviteLoading || !inviteEmail}>
                          {inviteLoading ? "Inviting…" : "Invite"}
                        </Button>
                      </div>

                      {members.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                          No members yet. Invite someone to collaborate.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {members.map((member) => (
                            <div key={member.id} className="flex items-center justify-between gap-3 border border-foreground/10 rounded-lg px-3 py-2">
                              <div>
                                <div className="text-sm font-medium">
                                  {member.profile?.display_name || member.profile?.email || member.id}
                                </div>
                                <div className="text-xs text-muted-foreground font-mono">{member.profile?.email || 'unknown'}</div>
                              </div>
                              <select
                                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                                value={member.role}
                                onChange={(e) => updateMemberRole(member.id, e.target.value)}
                              >
                                {roles.map((role) => (
                                  <option key={role} value={role}>{role}</option>
                                ))}
                              </select>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {tab === "Notifications" && (
              <div className="rounded-2xl border-2 border-foreground/15 bg-card p-6 space-y-4">
                <div>
                  <div className="zine-label">§ notifications</div>
                  <h2 className="text-xl font-bold">What pings you</h2>
                </div>
                <Toggle label="Email digests" desc="Daily summary of activity in your sessions" checked={notifEmail} onChange={setNotifEmail} />
                <Toggle label="Mentions" desc="When teammates @ you in notes or comments" checked={notifMentions} onChange={setNotifMentions} />
                <Toggle label="Weekly recap" desc="Friday recap with extracted tasks & decisions" checked={notifWeekly} onChange={setNotifWeekly} />
                <div className="flex justify-end"><Button variant="paper" onClick={() => toast({ title: "Preferences saved" })}>Save preferences</Button></div>
              </div>
            )}

            {tab === "Billing" && (
              <div className="rounded-2xl border-2 border-foreground bg-warning p-6 space-y-3">
                <div className="zine-label">§ billing</div>
                <h2 className="text-xl font-bold">You're on the Free plan</h2>
                <p className="text-sm">Upgrade to Pro for unlimited sessions, replays, and node permissions.</p>
                <Button variant="ink" onClick={() => toast({ title: "Upgrade", description: "Hook up payments to start billing in production." })}>Upgrade to Pro · $12/seat</Button>
              </div>
            )}

            {tab === "Danger zone" && (
              <div className="rounded-2xl border-2 border-coral/60 bg-coral/5 p-6 space-y-4">
                <div>
                  <div className="zine-label text-coral">§ danger</div>
                  <h2 className="text-xl font-bold">Reset & delete</h2>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-medium">Delete account</div>
                    <p className="text-sm text-muted-foreground">Signs you out of the app.</p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      await logout();
                      router.push("/auth");
                      toast({ title: "Account deleted" });
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function Toggle({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border pb-4 last:border-0 last:pb-0">
      <div>
        <div className="font-medium text-sm">{label}</div>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}



"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import { Eye, EyeOff, Sparkles, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login, register } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register(email, password, name);
      }
    } catch {
      // handled in context
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogle = async () => {
    setIsLoading(true);
    try {
      // Use localhost for development, otherwise use current origin
      const redirectUrl = process.env.NODE_ENV === 'development' 
        ? 'http://localhost:3000/auth/callback'
        : `${window.location.origin}/auth/callback`;
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: redirectUrl },
      });
      if (error) toast({ title: "Google sign-in failed", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background overflow-hidden">
      {/* ── LEFT PANEL ── */}
      <div className="hidden lg:flex w-[52%] relative bg-foreground text-background flex-col overflow-hidden">
        {/* grid texture */}
        <div className="absolute inset-0 bg-blueprint-grid opacity-20 pointer-events-none" />

        {/* floating sticky notes */}
        <div className="absolute top-[12%] left-[8%] w-44 bg-sticky-yellow rounded-xl p-4 shadow-sticky rotate-[-3deg] border border-foreground/10">
          <div className="text-[10px] font-mono uppercase tracking-wider text-foreground/50 mb-1">ACTION</div>
          <p className="text-sm font-semibold leading-snug text-foreground">Lock the architecture decision before EOD</p>
          <div className="mt-3 flex items-center gap-1.5">
            <span className="h-5 w-5 rounded-full bg-coral text-background text-[9px] font-bold flex items-center justify-center">M</span>
            <span className="text-[10px] text-foreground/50 font-mono">maya · 2m ago</span>
          </div>
        </div>

        <div className="absolute top-[28%] left-[38%] w-40 bg-sticky-mint rounded-xl p-4 shadow-sticky rotate-[2deg] border border-foreground/10">
          <div className="text-[10px] font-mono uppercase tracking-wider text-foreground/50 mb-1">DECISION</div>
          <p className="text-sm font-semibold leading-snug text-foreground">Use LISTEN/NOTIFY over polling</p>
          <div className="mt-3 flex items-center gap-1.5">
            <span className="h-5 w-5 rounded-full bg-indigo text-background text-[9px] font-bold flex items-center justify-center">J</span>
            <span className="text-[10px] text-foreground/50 font-mono">jin · locked</span>
          </div>
        </div>

        <div className="absolute top-[48%] left-[12%] w-48 bg-sticky-pink rounded-xl p-4 shadow-sticky rotate-[1deg] border border-foreground/10">
          <div className="text-[10px] font-mono uppercase tracking-wider text-foreground/50 mb-1">QUESTION</div>
          <p className="text-sm font-semibold leading-snug text-foreground">Do we need a separate read replica for analytics?</p>
          <div className="mt-3 flex items-center gap-1.5">
            <span className="h-5 w-5 rounded-full bg-success text-background text-[9px] font-bold flex items-center justify-center">S</span>
            <span className="text-[10px] text-foreground/50 font-mono">sam · open</span>
          </div>
        </div>

        <div className="absolute top-[62%] left-[42%] w-36 bg-sticky-sky rounded-xl p-4 shadow-sticky rotate-[-2deg] border border-foreground/10">
          <div className="text-[10px] font-mono uppercase tracking-wider text-foreground/50 mb-1">REF</div>
          <p className="text-sm font-semibold leading-snug text-foreground">Figma spec v3 — pricing page</p>
          <div className="mt-3 flex items-center gap-1.5">
            <span className="h-5 w-5 rounded-full bg-warning text-background text-[9px] font-bold flex items-center justify-center">L</span>
            <span className="text-[10px] text-foreground/50 font-mono">lia · ref</span>
          </div>
        </div>

        {/* live cursors */}
        <div className="absolute top-[22%] left-[55%] flex items-center gap-1.5 pointer-events-none">
          <svg width="16" height="20" viewBox="0 0 16 20" fill="none"><path d="M0 0L16 10L8 12L6 20L0 0Z" fill="#FF6B6B"/></svg>
          <span className="bg-coral text-background text-[10px] font-mono px-1.5 py-0.5 rounded">maya</span>
        </div>
        <div className="absolute top-[55%] left-[30%] flex items-center gap-1.5 pointer-events-none">
          <svg width="16" height="20" viewBox="0 0 16 20" fill="none"><path d="M0 0L16 10L8 12L6 20L0 0Z" fill="#6366F1"/></svg>
          <span className="bg-indigo text-background text-[10px] font-mono px-1.5 py-0.5 rounded">jin</span>
        </div>

        {/* bottom branding */}
        <div className="absolute bottom-0 left-0 right-0 p-10">
          <div className="inline-flex items-center mb-5">
            <img src="/fluxnote.png" alt="Fluxnote" className="h-9 w-auto max-w-[160px] object-contain brightness-0 invert" />
          </div>
          <h2 className="text-4xl font-bold leading-tight text-background">
            Brainstorm together.<br />
            <span className="font-hand text-warning text-5xl">Leave with action.</span>
          </h2>
          <p className="mt-3 text-background/60 text-sm max-w-sm">
            A real-time canvas that turns sticky notes into a structured task board — with AI, live cursors, and node-level permissions.
          </p>
          <div className="mt-5 flex items-center gap-3">
            {["bg-coral","bg-indigo","bg-success","bg-warning"].map((c, i) => (
              <span key={i} className={`h-7 w-7 rounded-full ${c} border-2 border-background/20`} />
            ))}
            <span className="text-background/50 text-xs font-mono">2,400+ teams · live now</span>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 relative">
        {/* subtle grid */}
        <div className="absolute inset-0 bg-blueprint-grid opacity-30 pointer-events-none" />

        <div className="relative w-full max-w-[400px] space-y-6">
          {/* mobile logo */}
          <div className="lg:hidden flex items-center mb-2">
            <img src="/fluxnote.png" alt="Fluxnote" className="h-7 w-auto max-w-[120px] object-contain" />
          </div>

          {/* heading */}
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-foreground/15 bg-card px-3 py-1 text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-3">
              <Sparkles className="h-3 w-3 text-primary" />
              {isLogin ? "welcome back" : "get started free"}
            </div>
            <h1 className="text-3xl font-bold tracking-tight">
              {isLogin ? "Sign in to your workspace" : "Create your workspace"}
            </h1>
            <p className="text-muted-foreground mt-1.5 text-sm">
              {isLogin ? "Enter your credentials to continue." : "No credit card. No setup call. Just a canvas."}
            </p>
          </div>

          {/* Google */}
          <button
            onClick={handleGoogle}
            disabled={isLoading}
            className="w-full h-11 flex items-center justify-center gap-3 rounded-xl border-2 border-foreground/15 bg-card hover:border-foreground hover:bg-muted transition-all text-sm font-medium disabled:opacity-50"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3">
            <span className="flex-1 h-px bg-border" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">or</span>
            <span className="flex-1 h-px bg-border" />
          </div>

          {/* form */}
          <form className="space-y-3" onSubmit={handleSubmit}>
            {!isLogin && (
              <div className="space-y-1">
                <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Full name</label>
                <Input
                  type="text"
                  placeholder="Maya Kane"
                  className="h-11 rounded-xl border-2 border-foreground/15 focus-visible:border-foreground"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
              </div>
            )}
            <div className="space-y-1">
              <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Email</label>
              <Input
                type="email"
                placeholder="you@studio.com"
                className="h-11 rounded-xl border-2 border-foreground/15 focus-visible:border-foreground"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Password</label>
              <div className="relative">
                <Input
                  type={showPass ? "text" : "password"}
                  placeholder="••••••••"
                  className="h-11 rounded-xl border-2 border-foreground/15 focus-visible:border-foreground pr-10"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={cn(
                "w-full h-11 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all",
                "bg-foreground text-background hover:bg-foreground/90 shadow-[3px_3px_0_hsl(var(--primary))] hover:shadow-[1px_1px_0_hsl(var(--primary))] hover:translate-x-[2px] hover:translate-y-[2px]",
                "disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0"
              )}
            >
              {isLoading ? (
                <span className="h-4 w-4 rounded-full border-2 border-background/30 border-t-background animate-spin" />
              ) : (
                <>
                  {isLogin ? "Sign in" : "Create workspace"}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            {isLogin ? "No account yet? " : "Already have one? "}
            <button
              onClick={() => setIsLogin(v => !v)}
              className="text-foreground font-medium underline underline-offset-2 hover:no-underline"
            >
              {isLogin ? "Sign up free" : "Sign in"}
            </button>
          </p>

          <p className="text-center text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
            by continuing you agree to our terms · privacy
          </p>
        </div>
      </div>
    </div>
  );
}

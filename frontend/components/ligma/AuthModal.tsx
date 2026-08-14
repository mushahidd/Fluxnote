"use client";

import { useState, useEffect } from "react";
import { X, Eye, EyeOff, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Mode = "login" | "signup";

interface AuthModalProps {
  open: boolean;
  defaultMode?: Mode;
  onClose: () => void;
}

export function AuthModal({ open, defaultMode = "login", onClose }: AuthModalProps) {
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();

  // sync mode when prop changes
  useEffect(() => { setMode(defaultMode); }, [defaultMode]);

  // close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // lock body scroll
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        await login(email, password);
        onClose();
      } else {
        await register(email, password, name);
        onClose();
      }
    } catch {
      // handled in context
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) toast({ title: "Google sign-in failed", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    /* backdrop */
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* blur overlay */}
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />

      {/* modal card */}
      <div className="relative z-10 w-full max-w-[420px] bg-background rounded-2xl border-2 border-foreground/15 shadow-[8px_8px_0_hsl(var(--foreground))] p-8 animate-in fade-in zoom-in-95 duration-200">

        {/* close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 h-8 w-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        {/* heading */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold tracking-tight">
            {mode === "login" ? "Welcome back" : "Create account"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "login" ? "Sign in to your workspace." : "No credit card. Just a canvas."}
          </p>
        </div>

        {/* Google */}
        <button
          onClick={handleGoogle}
          disabled={loading}
          className="w-full h-12 flex items-center justify-center gap-3 rounded-xl border-2 border-foreground/20 bg-background hover:border-foreground hover:bg-muted transition-all text-sm font-semibold disabled:opacity-50 mb-5"
        >
          <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <div className="flex items-center gap-3 mb-5">
          <span className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground font-mono uppercase tracking-widest">or</span>
          <span className="flex-1 h-px bg-border" />
        </div>

        {/* form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "signup" && (
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">Full name</label>
              <input
                type="text"
                placeholder="Maya Kane"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                className="w-full h-12 rounded-xl border-2 border-foreground/15 bg-muted/40 px-4 text-sm focus:outline-none focus:border-foreground transition-colors"
              />
            </div>
          )}

          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">Email</label>
            <input
              type="email"
              placeholder="you@studio.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full h-12 rounded-xl border-2 border-foreground/15 bg-muted/40 px-4 text-sm focus:outline-none focus:border-foreground transition-colors"
            />
          </div>

          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full h-12 rounded-xl border-2 border-foreground/15 bg-muted/40 px-4 pr-11 text-sm focus:outline-none focus:border-foreground transition-colors"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={cn(
              "w-full h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 mt-2 transition-all",
              "bg-foreground text-background",
              "shadow-[3px_3px_0_hsl(var(--primary))] hover:shadow-[1px_1px_0_hsl(var(--primary))] hover:translate-x-[2px] hover:translate-y-[2px]",
              "disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0"
            )}
          >
            {loading ? (
              <span className="h-4 w-4 rounded-full border-2 border-background/30 border-t-background animate-spin" />
            ) : (
              <>{mode === "login" ? "Log in" : "Create workspace"} <ArrowRight className="h-4 w-4" /></>
            )}
          </button>
        </form>

        {/* footer links */}
        <div className="mt-5 space-y-2 text-center">
          <p className="text-sm text-muted-foreground">
            {mode === "login" ? "No account? " : "Already have one? "}
            <button
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              className="text-primary font-semibold hover:underline"
            >
              {mode === "login" ? "Create one" : "Sign in"}
            </button>
          </p>
          <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
            by continuing you agree to our terms · privacy
          </p>
        </div>
      </div>
    </div>
  );
}

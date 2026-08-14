"use client";

import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "./Logo";
import { AuthModal } from "./AuthModal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";

const links = [
  { label: "Features", href: "#features" },
  { label: "How it Works", href: "#how" },
  { label: "Templates", href: "#templates" },
  { label: "Community", href: "#community" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const openLogin = () => { setAuthMode("login"); setAuthOpen(true); setMenuOpen(false); };
  const openSignup = () => { setAuthMode("signup"); setAuthOpen(true); setMenuOpen(false); };

  const handleStartFree = () => {
    if (isAuthenticated) {
      router.push("/dashboard");
    } else {
      openSignup();
    }
  };

  return (
    <>
      <header className={cn(
        "fixed top-0 inset-x-0 z-50 transition-all duration-300",
        scrolled ? "bg-background/80 backdrop-blur-xl border-b border-border" : "bg-transparent"
      )}>
        <div className="container flex h-16 items-center justify-between">
          <Logo />
          <nav className="hidden md:flex items-center gap-7">
            {links.map(l => (
              <a key={l.href} href={l.href} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                {l.label}
              </a>
            ))}
          </nav>
          <div className="hidden md:flex items-center gap-2">
            {isAuthenticated ? (
              <Button variant="paper" size="sm" onClick={() => router.push("/dashboard")}>
                Go to dashboard →
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={openLogin}>Log in</Button>
                <Button variant="paper" size="sm" onClick={openSignup}>Start free →</Button>
              </>
            )}
          </div>
          <button className="md:hidden p-2" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden bg-background border-t border-border animate-fade-in">
            <div className="container py-6 flex flex-col gap-4">
              {links.map(l => (
                <a key={l.href} href={l.href} className="text-lg font-medium" onClick={() => setMenuOpen(false)}>{l.label}</a>
              ))}
              <div className="flex flex-col gap-2 pt-3 border-t border-border">
                {isAuthenticated ? (
                  <Button variant="paper" onClick={() => { setMenuOpen(false); router.push("/dashboard"); }}>Go to dashboard</Button>
                ) : (
                  <>
                    <Button variant="ghost" onClick={openLogin}>Log in</Button>
                    <Button variant="paper" onClick={openSignup}>Start free</Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      <AuthModal open={authOpen} defaultMode={authMode} onClose={() => setAuthOpen(false)} />
    </>
  );
}

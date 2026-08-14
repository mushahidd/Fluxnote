"use client";

import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

export function Logo({ className, mark = false }: { className?: string; mark?: boolean }) {
  const { isAuthenticated } = useAuth();
  const href = isAuthenticated ? "/recent" : "/";

  return (
    <a href={href} className={cn("inline-flex items-center group", className)}>
      <img
        src="/fluxnote.png"
        alt="Fluxnote"
        className={cn(
          "object-contain",
          mark ? "h-8 w-8" : "h-8 w-auto max-w-[140px]"
        )}
      />
    </a>
  );
}

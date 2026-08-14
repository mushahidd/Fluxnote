import { cn } from "@/lib/utils";

export function ScribbleArrow({ className, color = "currentColor" }: { className?: string; color?: string }) {
  return (
    <svg className={cn("pointer-events-none", className)} viewBox="0 0 120 60" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 30 Q30 5 60 32 T112 28" />
      <path d="M104 20 L114 28 L104 36" />
    </svg>
  );
}

export function StarBurst({ className }: { className?: string }) {
  return (
    <svg className={cn("pointer-events-none", className)} viewBox="0 0 60 60" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M30 6 L30 18 M30 42 L30 54 M6 30 L18 30 M42 30 L54 30 M13 13 L21 21 M39 39 L47 47 M47 13 L39 21 M21 39 L13 47" />
    </svg>
  );
}

export function CornerStamp({ className, label = "DRAFT" }: { className?: string; label?: string }) {
  return (
    <div className={cn("stamp text-coral text-xs", className)}>{label}</div>
  );
}

export function Sparkle({ className }: { className?: string }) {
  return (
    <svg className={cn(className)} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2 L13.5 9 L20 10.5 L13.5 12 L12 19 L10.5 12 L4 10.5 L10.5 9 Z" />
    </svg>
  );
}

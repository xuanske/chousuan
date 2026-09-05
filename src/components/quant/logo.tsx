import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden="true">
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <rect x="7" y="8" width="18" height="2.2" rx="1" className="fill-primary-foreground" />
      <rect x="7" y="22" width="18" height="2.2" rx="1" className="fill-primary-foreground" />
      <circle cx="12" cy="16" r="3.1" className="fill-primary-foreground" />
      <circle cx="20.5" cy="16" r="3.1" className="fill-primary-foreground" />
    </svg>
  );
}

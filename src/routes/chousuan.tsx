import { createFileRoute } from "@tanstack/react-router";
import { Desk } from "@/components/quant/desk";

export const Route = createFileRoute("/chousuan")({ component: ChousuanPage });

function ChousuanPage() {
  return (
    <div className="theme-ink min-h-dvh bg-background text-foreground">
      <Desk />
    </div>
  );
}

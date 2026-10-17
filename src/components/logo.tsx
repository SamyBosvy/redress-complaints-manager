import { Scale } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-display text-xl font-semibold", className)}>
      <Scale className="h-5 w-5 text-primary" />
      Redress
    </span>
  );
}

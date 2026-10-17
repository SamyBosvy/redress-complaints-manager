import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { clockTone, type Status } from "@/lib/complaints";

const tones = {
  ok: "bg-success/10 text-success",
  risk: "bg-warning/15 text-warning",
  overdue: "bg-destructive/10 text-destructive",
  stopped: "bg-muted text-muted-foreground",
};

export function DeadlineClock({ daysLeft, status }: { daysLeft: number | null; status: Status }) {
  const tone = clockTone(daysLeft, status);
  const label =
    tone === "stopped" ? "—" : daysLeft! < 0 ? `${Math.abs(daysLeft!)} overdue` : daysLeft === 0 ? "Due today" : `${daysLeft} days`;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium tabular", tones[tone])}>
      <Clock className="h-3 w-3" /> {label}
    </span>
  );
}

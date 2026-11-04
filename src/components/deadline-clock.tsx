import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { clockTone, type Status } from "@/lib/complaints";
import { clockProgress } from "@/lib/queue";
import { formatDate } from "@/lib/letters";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const tones = {
  ok: "bg-success/10 text-success",
  risk: "bg-warning/15 text-warning",
  overdue: "bg-destructive/10 text-destructive",
  stopped: "bg-muted text-muted-foreground",
};

const bars = {
  ok: "bg-success",
  risk: "bg-warning",
  overdue: "bg-destructive",
  stopped: "bg-muted-foreground",
};

export function DeadlineClock({
  daysLeft,
  status,
  due,
  receivedAt,
}: {
  daysLeft: number | null;
  status: Status;
  due?: string | null;
  receivedAt?: string | null;
}) {
  const tone = clockTone(daysLeft, status);
  const label =
    tone === "stopped" ? "—" : daysLeft! < 0 ? `${Math.abs(daysLeft!)} overdue` : daysLeft === 0 ? "Due today" : `${daysLeft} days`;
  const progress = clockProgress(receivedAt ?? null, due ?? null, daysLeft, status);
  const badge = (
    <span
      tabIndex={due ? 0 : undefined}
      className={cn("inline-flex min-w-20 flex-col gap-1 rounded px-2 py-1 text-xs font-medium tabular", tones[tone])}
    >
      <span className="inline-flex items-center gap-1">
        <Clock aria-hidden="true" className="h-3 w-3" /> {label}
      </span>
      {progress !== null && (
        <span className="h-1 w-full overflow-hidden rounded-full bg-background/60" aria-hidden="true">
          <span className={cn("block h-full rounded-full", bars[tone])} style={{ width: `${Math.round(progress * 100)}%` }} />
        </span>
      )}
    </span>
  );
  if (!due) return badge;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent>{tone === "stopped" ? "Clock stopped" : `Due ${formatDate(due)}`}</TooltipContent>
    </Tooltip>
  );
}

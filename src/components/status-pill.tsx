import { cn } from "@/lib/utils";
import { STATUSES, type Status } from "@/lib/complaints";
import { STATUS_TONES, type AckState, type StatusTone } from "@/lib/queue";

const toneClasses: Record<StatusTone, string> = {
  neutral: "bg-secondary text-secondary-foreground",
  teal: "bg-accent text-accent-foreground",
  progress: "bg-primary/10 text-primary",
  wait: "bg-warning/15 text-warning",
  review: "bg-ink/10 text-ink",
  done: "bg-success/10 text-success",
  closed: "bg-muted text-muted-foreground",
  alert: "bg-destructive/10 text-destructive",
};

export function StatusPill({ status, className }: { status: Status; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium",
        toneClasses[STATUS_TONES[status]],
        className,
      )}
    >
      {STATUSES[status]}
    </span>
  );
}

export function AckBadge({ state }: { state: Exclude<AckState, null> }) {
  return state === "overdue" ? (
    <span className="inline-flex w-fit items-center rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
      Ack overdue
    </span>
  ) : (
    <span className="inline-flex w-fit items-center rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
      Ack due
    </span>
  );
}
